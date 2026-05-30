'use client'

import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { PlayerMetrics, StyleMetrics } from '@/types'
import { scoutPlayer } from '@/lib/api'
import { MarkdownText } from './MarkdownText'

interface Props {
  metrics: PlayerMetrics
  styleMetrics: StyleMetrics
}

function AccuracyBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300 font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-700">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ScoutingReport({ metrics, styleMetrics }: Props) {
  const { getToken } = useAuth()
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function generateReport() {
    setLoading(true)
    const token = await getToken()
    const result = await scoutPlayer(metrics, styleMetrics, token ?? undefined)
    setReport(result ?? 'No se pudo generar el informe.')
    setLoading(false)
  }

  const aggPct = Math.round(styleMetrics.aggression_index * 100)
  const tactPct = Math.min(100, Math.round(styleMetrics.tactical_volatility * 20))

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div className="text-left">
            <p className="font-semibold text-white text-sm">Cómo jugarle</p>
            <p className="text-xs text-gray-500">Estilo: <span className="text-indigo-400 capitalize">{styleMetrics.style_label}</span></p>
          </div>
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Agresión" value={`${aggPct}%`} sub="capturas y jaques" />
            <StatCard label="Volatilidad" value={`${tactVol(styleMetrics.tactical_volatility)}`} sub="nivel táctico" />
            <StatCard label="Duración media" value={`${Math.round(styleMetrics.avg_game_length)} mov`} sub="por partida" />
            <StatCard label="Conversión ventaja" value={`${Math.round(metrics.performance_with_advantage * 100)}%`} sub="con material extra" />
          </div>

          {/* Phase accuracy bars */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Precisión por fase</p>
            <AccuracyBar label="Apertura" value={styleMetrics.opening_accuracy} />
            <AccuracyBar label="Medio juego" value={styleMetrics.middlegame_accuracy} />
            <AccuracyBar label="Final" value={styleMetrics.endgame_accuracy} />
          </div>

          {/* Openings */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OpeningList title="Como blancas" openings={styleMetrics.top_openings_white} />
            <OpeningList title="Como negras" openings={styleMetrics.top_openings_black} />
          </div>

          {/* Scouting report from Claude */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            {!report && !loading && (
              <button
                onClick={generateReport}
                className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Generar informe de scouting con IA
              </button>
            )}

            {loading && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span className="text-xs text-gray-400">Preparando el informe de scouting…</span>
              </div>
            )}

            {report && !loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Informe de scouting</p>
                  <button onClick={() => setReport(null)} className="text-xs text-gray-600 hover:text-gray-400">
                    ↺ Regenerar
                  </button>
                </div>
                <div className="rounded-lg bg-gray-800 p-4 text-sm text-gray-300 leading-relaxed">
                  <MarkdownText text={report} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function tactVol(v: number): string {
  if (v < 1) return 'Bajo'
  if (v < 2.5) return 'Medio'
  return 'Alto'
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-gray-800/60 px-3 py-2.5 space-y-0.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  )
}

function OpeningList({ title, openings }: { title: string; openings: { name: string; games: number; win_rate: number }[] }) {
  if (!openings || openings.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
      {openings.map((o) => (
        <div key={o.name} className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-300 truncate">{o.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-600">{o.games}p</span>
            <span className={`font-mono font-semibold ${o.win_rate >= 0.5 ? 'text-green-400' : 'text-red-400'}`}>
              {Math.round(o.win_rate * 100)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
