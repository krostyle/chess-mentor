'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { Move, Game } from '@/types'
import { explainMove, narrateGame } from '@/lib/api'
import { uciLineToSteps } from './GameViewer'
import { MarkdownText } from './MarkdownText'

interface Props {
  profileNarrative: string
  profileSummary: string
  currentMove: Move | null
  game?: Game
  username?: string
  playerColor?: 'white' | 'black'
  fenBeforeCurrentMove?: string
  onJumpToMove?: (moveIndex: number) => void
  onPreviewFen?: (fen: string | null) => void
}

const SECTIONS = [
  'Explicación',
  'Plan del jugador',
  'Plan del contrincante',
  '¿Qué estudiar?',
]

function moveLabel(m: Move): string {
  const n = Math.ceil(m.move_number / 2)
  return m.color === 'white' ? `${n}.${m.san}` : `${n}...${m.san}`
}

export function AnalysisPanel({
  profileNarrative, profileSummary, currentMove, game, username,
  playerColor, fenBeforeCurrentMove, onJumpToMove, onPreviewFen,
}: Props) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'errors' | 'game'>('errors')
  const [analysisCache, setAnalysisCache] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0])
  const [loading, setLoading] = useState(false)
  const [gameNarrative, setGameNarrative] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)

  useEffect(() => { setGameNarrative(null) }, [game?.id])

  const moves = game?.moves ?? []
  const criticalMoves = moves.filter(m => m.is_mistake || m.is_blunder)

  const selectedError = currentMove && (currentMove.is_mistake || currentMove.is_blunder)
    ? currentMove
    : null

  const errorIdx = selectedError
    ? moves.findIndex(m => m.move_number === selectedError.move_number)
    : -1

  const prevMove = errorIdx > 0 ? moves[errorIdx - 1] : null
  const nextMove = errorIdx >= 0 && errorIdx < moves.length - 1 ? moves[errorIdx + 1] : null

  const moveKey = selectedError?.uci ?? null
  const cachedAnalysis = moveKey ? (analysisCache[moveKey] ?? null) : null

  async function analyzeFullGame() {
    if (!game || !username) return
    setNarrativeLoading(true)
    setGameNarrative(null)
    const token = await getToken()
    const result = await narrateGame(game, username, token ?? undefined)
    setGameNarrative(result ?? 'No se pudo generar el análisis.')
    setNarrativeLoading(false)
  }

  async function analyzeSelectedError() {
    if (!selectedError || !moveKey) return
    setLoading(true)
    setActiveSection(SECTIONS[0])

    let bestMoveSan: string | undefined
    if (selectedError.best_move && fenBeforeCurrentMove) {
      const steps = uciLineToSteps(fenBeforeCurrentMove, [selectedError.best_move])
      bestMoveSan = steps[0]?.san
    }

    const token = await getToken()
    const resp = await explainMove({
      fen: selectedError.fen_after,
      move: selectedError.san,
      stockfish_eval: selectedError.stockfish_eval != null ? String(selectedError.stockfish_eval) : '0',
      game_phase: selectedError.game_phase ?? 'middlegame',
      player_profile_summary: profileSummary || 'Sin perfil analizado.',
      best_move_san: bestMoveSan,
      player_color: playerColor ?? 'white',
      move_color: selectedError.color,
    }, token ?? undefined)

    if (resp?.explanation) {
      setAnalysisCache(prev => ({ ...prev, [moveKey]: resp.explanation }))
    }
    setLoading(false)
  }

  function parseSections(md: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const part of md.split(/^## /m)) {
      const nl = part.indexOf('\n')
      if (nl === -1) continue
      result[part.slice(0, nl).trim()] = part.slice(nl + 1).trim()
    }
    return result
  }

  const sections = cachedAnalysis ? parseSections(cachedAnalysis) : {}
  const sectionText = sections[activeSection] ?? ''

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4 h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition ${
            activeTab === 'errors' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Errores
          {criticalMoves.length > 0 && (
            <span className={`rounded-full px-1.5 text-xs font-semibold ${
              activeTab === 'errors' ? 'bg-indigo-500' : 'bg-gray-700 text-gray-300'
            }`}>
              {criticalMoves.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('game')}
          className={`px-3 py-1 text-sm rounded-md transition ${
            activeTab === 'game' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Esta partida
        </button>
      </div>

      {/* ── Errors tab ── */}
      {activeTab === 'errors' && (
        <div className="space-y-3">
          {criticalMoves.length === 0 ? (
            <p className="text-sm text-gray-500">No hay errores críticos en esta partida.</p>
          ) : (
            <>
              {/* Error list */}
              <div className="space-y-1">
                {criticalMoves.map((m) => {
                  const isSelected = currentMove?.move_number === m.move_number
                  return (
                    <button
                      key={m.move_number}
                      onClick={() => onJumpToMove?.(m.move_number)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition ${
                        isSelected
                          ? 'bg-indigo-900/40 border border-indigo-700'
                          : 'bg-gray-800/50 hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${m.is_blunder ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className="font-mono text-sm text-white">{moveLabel(m)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                          m.is_blunder ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'
                        }`}>
                          {m.is_blunder ? 'Blunder ??' : 'Error ?'}
                        </span>
                      </div>
                      {m.stockfish_eval != null && (
                        <span className={`text-xs font-mono shrink-0 ${m.stockfish_eval >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {m.stockfish_eval > 0 ? '+' : ''}{m.stockfish_eval.toFixed(2)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected error detail */}
              {selectedError ? (
                <div className="space-y-3 pt-2 border-t border-gray-800">

                  {/* Context sequence */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Contexto</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {prevMove && (
                        <>
                          <button
                            onClick={() => onPreviewFen?.(prevMove.fen_after)}
                            className="rounded px-2 py-1 text-xs font-mono bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
                          >
                            {moveLabel(prevMove)}
                          </button>
                          <span className="text-gray-600 text-xs">→</span>
                        </>
                      )}
                      <button
                        onClick={() => onPreviewFen?.(selectedError.fen_after)}
                        className={`rounded px-2 py-1 text-xs font-mono font-bold transition ring-1 ${
                          selectedError.is_blunder
                            ? 'bg-red-900/60 text-red-300 hover:bg-red-800 ring-red-700'
                            : 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-800 ring-yellow-700'
                        }`}
                      >
                        {moveLabel(selectedError)}{selectedError.is_blunder ? ' ??' : ' ?'}
                      </button>
                      {nextMove && (
                        <>
                          <span className="text-gray-600 text-xs">→</span>
                          <button
                            onClick={() => onPreviewFen?.(nextMove.fen_after)}
                            className="rounded px-2 py-1 text-xs font-mono bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
                          >
                            {moveLabel(nextMove)}
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">Haz clic en cada jugada para verla en el tablero</p>
                  </div>

                  {/* Stockfish best continuation */}
                  {selectedError.best_move && fenBeforeCurrentMove && (() => {
                    const line = selectedError.best_line ?? [selectedError.best_move]
                    const steps = uciLineToSteps(fenBeforeCurrentMove, line)
                    if (steps.length === 0) return null
                    return (
                      <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2 space-y-1">
                        <p className="text-xs text-gray-500">Mejor continuación según Stockfish — haz clic para ver en el tablero</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {steps.map((step, i) => (
                            <button
                              key={i}
                              onClick={() => onPreviewFen?.(step.fen)}
                              className={`rounded font-mono text-xs transition px-1.5 py-0.5 ${
                                i === 0
                                  ? 'bg-green-900/60 text-green-300 hover:bg-green-800/80 font-semibold'
                                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                              }`}
                            >
                              {step.san}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Analyze button */}
                  {!cachedAnalysis && !loading && (
                    <button
                      onClick={analyzeSelectedError}
                      className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                    >
                      Analizar con IA
                    </button>
                  )}

                  {loading && (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
                      <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      <span className="text-xs text-gray-400">El GM está analizando el error…</span>
                    </div>
                  )}

                  {cachedAnalysis && !loading && (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          {SECTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setActiveSection(s)}
                              className={`rounded-full px-3 py-1 text-xs transition ${
                                activeSection === s
                                  ? 'bg-indigo-600 text-white'
                                  : 'border border-gray-700 text-gray-400 hover:border-indigo-500 hover:text-indigo-400'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={analyzeSelectedError}
                          className="text-xs text-gray-600 hover:text-gray-400 transition shrink-0"
                          title="Regenerar"
                        >
                          ↺
                        </button>
                      </div>
                      <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
                        <MarkdownText text={sectionText || 'Sin información para esta sección.'} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-600 text-center pt-1">
                  Selecciona un error de la lista para ver el detalle.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Game info tab ── */}
      {activeTab === 'game' && (
        <div className="space-y-4">
          {game ? (
            <>
              <div className="space-y-2 text-sm">
                <InfoRow label="Blancas" value={game.white} elo={game.white_elo} />
                <InfoRow label="Negras" value={game.black} elo={game.black_elo} />
                <InfoRow label="Resultado" value={game.result} />
                <InfoRow label="Apertura" value={game.opening || '—'} />
                <InfoRow label="Control" value={game.time_control} />
                <InfoRow
                  label="Errores"
                  value={`${moves.filter(m => m.is_blunder).length} blunders · ${moves.filter(m => m.is_mistake).length} errores`}
                />
              </div>

              {!gameNarrative && !narrativeLoading && (
                <button
                  onClick={analyzeFullGame}
                  disabled={!username}
                  className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  Analizar partida completa con GM
                </button>
              )}

              {narrativeLoading && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
                  <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <span className="text-xs text-gray-400">El GM está revisando la partida completa…</span>
                </div>
              )}

              {gameNarrative && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Análisis del GM</p>
                    <button onClick={() => setGameNarrative(null)} className="text-xs text-gray-600 hover:text-gray-400">
                      ↺ Regenerar
                    </button>
                  </div>
                  <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
                    <MarkdownText text={gameNarrative} />
                  </div>
                </div>
              )}

              {username && (
                <a
                  href={`/profile/${encodeURIComponent(username)}`}
                  className="block text-center text-xs text-indigo-400 hover:underline"
                >
                  Ver análisis completo del jugador →
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No hay partida seleccionada.</p>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, elo }: { label: string; value: string; elo?: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-300 text-right truncate">
        {value}{elo ? <span className="ml-1 text-gray-500 text-xs">({elo})</span> : null}
      </span>
    </div>
  )
}
