'use client'

import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { PlayerProfile as Profile } from '@/types'
import { MarkdownText } from './MarkdownText'

interface Props {
  profile: Profile
}

export function PlayerProfile({ profile }: Props) {
  const { metrics } = profile
  const [expanded, setExpanded] = useState(false)

  const radarData = [
    { subject: 'Aperturas', value: Math.round(averageWinRate(metrics.opening_stats) * 100) },
    { subject: 'Tiempo', value: Math.round((1 - metrics.time_pressure.error_rate_under_10s) * 100) },
    { subject: 'Con ventaja', value: Math.round(metrics.performance_with_advantage * 100) },
    { subject: 'En desventaja', value: Math.round(metrics.performance_in_disadvantage * 100) },
    { subject: 'Medio juego', value: Math.round((1 - metrics.mistake_patterns.moves_20_to_30_loss_rate) * 100) },
  ]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
      <h2 className="font-semibold text-gray-200">Perfil de juego</h2>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <Radar
              name={profile.username}
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.25}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151' }}
              formatter={(v: number) => [`${v}%`]}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Error más común</p>
        <p className="text-sm text-gray-300">{metrics.most_common_error_type}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Partidas" value={String(metrics.total_games_analyzed)} />
        <Stat label="ELO" value={String(profile.elo)} />
        <Stat label="Con ventaja" value={`${Math.round(metrics.performance_with_advantage * 100)}%`} />
        <Stat label="En desventaja" value={`${Math.round(metrics.performance_in_disadvantage * 100)}%`} />
      </div>

      {profile.narrative && (
        <div className="space-y-2 border-t border-gray-800 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Análisis del GM</p>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              {expanded ? 'Ver menos ↑' : 'Ver más ↓'}
            </button>
          </div>
          <div className={`text-sm text-gray-300 leading-relaxed overflow-hidden transition-all ${expanded ? '' : 'max-h-24'}`}>
            <MarkdownText text={profile.narrative} />
          </div>
          {!expanded && (
            <div className="h-6 bg-gradient-to-t from-gray-900 to-transparent -mt-6 relative pointer-events-none" />
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  )
}

function averageWinRate(openings: Record<string, { games: number; win_rate: number }>) {
  const values = Object.values(openings)
  if (values.length === 0) return 0.5
  return values.reduce((sum, o) => sum + o.win_rate, 0) / values.length
}
