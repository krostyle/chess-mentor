'use client'

import { useState } from 'react'
import type { Move } from '@/types'
import { explainMove } from '@/lib/api'

interface Props {
  profileNarrative: string
  profileSummary: string
  currentMove: Move | null
}

const QUICK_QUESTIONS = [
  '¿Por qué no otra jugada?',
  '¿Cuál era el plan aquí?',
  '¿Qué debería estudiar?',
]

export function AnalysisPanel({ profileNarrative, profileSummary, currentMove }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'move'>('profile')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function askQuestion(question: string) {
    if (!currentMove) return
    setLoading(true)
    setExplanation(null)

    const resp = await explainMove({
      fen: currentMove.fen_after,
      move: currentMove.san,
      stockfish_eval: currentMove.stockfish_eval ? String(currentMove.stockfish_eval) : '0',
      game_phase: currentMove.game_phase ?? 'middlegame',
      player_profile_summary: `${profileSummary}. Pregunta: ${question}`,
    })

    setExplanation(resp?.explanation ?? 'No se pudo obtener explicación.')
    setLoading(false)
  }

  async function explainCurrentMove() {
    if (!currentMove) return
    setLoading(true)
    setExplanation(null)

    const resp = await explainMove({
      fen: currentMove.fen_after,
      move: currentMove.san,
      stockfish_eval: currentMove.stockfish_eval ? String(currentMove.stockfish_eval) : '0',
      game_phase: currentMove.game_phase ?? 'middlegame',
      player_profile_summary: profileSummary,
    })

    setExplanation(resp?.explanation ?? 'No se pudo obtener explicación.')
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4 h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        {(['profile', 'move'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded-md transition ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'profile' ? 'Mi perfil' : 'Este movimiento'}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Análisis del GM</h3>
          {profileNarrative ? (
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
              {profileNarrative}
            </p>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-700 p-4 text-center space-y-2">
              <p className="text-sm text-gray-500">
                El análisis narrativo solo está disponible en el perfil completo.
              </p>
              <p className="text-xs text-gray-600">
                Usa <span className="text-indigo-400">Analizar perfil completo →</span> para obtener un resumen del GM con tus patrones de juego.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'move' && (
        <div className="space-y-4">
          {currentMove ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-white">{currentMove.san}</span>
                  <span className="ml-2 text-xs text-gray-500 capitalize">{currentMove.game_phase}</span>
                  {currentMove.time_spent_seconds != null && currentMove.time_spent_seconds > 0 && (
                    <span className="ml-2 text-xs text-gray-600">
                      {currentMove.time_spent_seconds.toFixed(1)}s
                    </span>
                  )}
                </div>
                <button
                  onClick={explainCurrentMove}
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  Explicar
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => askQuestion(q)}
                    disabled={loading}
                    className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400 transition hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Selecciona un movimiento en el tablero para analizarlo.</p>
          )}

          {loading && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span className="text-xs text-gray-400">El GM está analizando el movimiento…</span>
            </div>
          )}

          {explanation && (
            <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
              {explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
