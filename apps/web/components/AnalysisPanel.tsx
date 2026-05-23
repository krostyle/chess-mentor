'use client'

import { useState, type ReactNode } from 'react'
import type { Move, Game } from '@/types'
import { explainMove, narrateGame } from '@/lib/api'

interface Props {
  profileNarrative: string
  profileSummary: string
  currentMove: Move | null
  game?: Game
  username?: string
  onJumpToMove?: (moveIndex: number) => void
}

const SECTIONS = [
  'Explicación',
  '¿Por qué no otra jugada?',
  'Plan del jugador',
  'Plan del contrincante',
  '¿Qué estudiar?',
]

export function AnalysisPanel({ profileNarrative, profileSummary, currentMove, game, username, onJumpToMove }: Props) {
  const [activeTab, setActiveTab] = useState<'game' | 'move'>('move')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0])
  const [loading, setLoading] = useState(false)
  const [gameNarrative, setGameNarrative] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)

  async function analyzeFullGame() {
    if (!game || !username) return
    setNarrativeLoading(true)
    setGameNarrative(null)
    const result = await narrateGame(game, username)
    setGameNarrative(result ?? 'No se pudo generar el análisis.')
    setNarrativeLoading(false)
  }

  async function explainCurrentMove() {
    if (!currentMove) return
    setLoading(true)
    setExplanation(null)
    setActiveSection(SECTIONS[0])

    const resp = await explainMove({
      fen: currentMove.fen_after,
      move: currentMove.san,
      stockfish_eval: currentMove.stockfish_eval ? String(currentMove.stockfish_eval) : '0',
      game_phase: currentMove.game_phase ?? 'middlegame',
      player_profile_summary: profileSummary || 'Jugador sin perfil analizado.',
    })

    setExplanation(resp?.explanation ?? null)
    setLoading(false)
  }

  // Parse markdown into sections keyed by ## heading
  function parseSections(md: string): Record<string, string> {
    const result: Record<string, string> = {}
    const parts = md.split(/^## /m)
    for (const part of parts) {
      const newline = part.indexOf('\n')
      if (newline === -1) continue
      const heading = part.slice(0, newline).trim()
      const body = part.slice(newline + 1).trim()
      result[heading] = body
    }
    return result
  }

  const sections = explanation ? parseSections(explanation) : {}
  const sectionText = sections[activeSection] ?? ''

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4 h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        {(['move', 'game'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded-md transition ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'move' ? 'Este movimiento' : 'Esta partida'}
          </button>
        ))}
      </div>

      {/* ── Move analysis tab ── */}
      {activeTab === 'move' && (
        <div className="space-y-4">
          {currentMove ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-white text-base">{currentMove.san}</span>
                  <span className="text-xs text-gray-500 capitalize">{currentMove.game_phase}</span>
                  {currentMove.stockfish_eval != null && (
                    <span className={`text-xs font-mono font-semibold ${currentMove.stockfish_eval >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {currentMove.stockfish_eval > 0 ? '+' : ''}{currentMove.stockfish_eval.toFixed(2)}
                    </span>
                  )}
                  {currentMove.is_blunder && <span className="rounded bg-red-900 px-1.5 py-0.5 text-xs text-red-300">Blunder ??</span>}
                  {currentMove.is_mistake && !currentMove.is_blunder && <span className="rounded bg-yellow-900 px-1.5 py-0.5 text-xs text-yellow-300">Error ?</span>}
                </div>
                <button
                  onClick={explainCurrentMove}
                  disabled={loading}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  Explicar
                </button>
              </div>

              {/* Best move + variation */}
              {currentMove.best_move && (
                <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2 space-y-1">
                  <p className="text-xs text-gray-500">Mejor jugada según Stockfish</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-green-900/60 px-2 py-0.5 font-mono text-xs text-green-300">
                      {currentMove.best_move}
                    </span>
                    {currentMove.best_line && currentMove.best_line.slice(1).map((move, i) => (
                      <span key={i} className="font-mono text-xs text-gray-500">{move}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Selecciona un movimiento para analizarlo.</p>
          )}

          {loading && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span className="text-xs text-gray-400">El GM está analizando el movimiento…</span>
            </div>
          )}

          {explanation && !loading && (
            <div className="space-y-3">
              {/* Section pills */}
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

              {/* Section content */}
              <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
                <MarkdownText text={sectionText || 'Sin información para esta sección.'} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Game info tab ── */}
      {activeTab === 'game' && (
        <div className="space-y-4">
          {game ? (
            <>
              {/* Game metadata */}
              <div className="space-y-2 text-sm">
                <InfoRow label="Blancas" value={game.white} elo={game.white_elo} />
                <InfoRow label="Negras" value={game.black} elo={game.black_elo} />
                <InfoRow label="Resultado" value={game.result} />
                <InfoRow label="Apertura" value={game.opening || '—'} />
                <InfoRow label="Control" value={game.time_control} />
                <InfoRow
                  label="Errores"
                  value={`${game.moves.filter(m => m.is_blunder).length} blunders · ${game.moves.filter(m => m.is_mistake).length} errores`}
                />
              </div>

              {/* Critical moves — clickable */}
              {onJumpToMove && (() => {
                const critical = game.moves.filter(m => m.is_mistake || m.is_blunder)
                if (critical.length === 0) return null
                return (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      Jugadas críticas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {critical.map((m) => (
                        <button
                          key={m.move_number}
                          onClick={() => onJumpToMove(m.move_number)}
                          className={`rounded px-2 py-1 text-xs font-mono transition ${
                            m.is_blunder
                              ? 'bg-red-900/60 text-red-300 hover:bg-red-800'
                              : 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-800'
                          }`}
                          title={m.is_blunder ? 'Blunder' : 'Error'}
                        >
                          {Math.ceil(m.move_number / 2)}.{m.color === 'black' ? '..' : ''}{m.san}
                          {m.is_blunder ? ' ??' : ' ?'}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Full game analysis */}
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
                    <button
                      onClick={() => setGameNarrative(null)}
                      className="text-xs text-gray-600 hover:text-gray-400"
                    >
                      ↺ Regenerar
                    </button>
                  </div>
                  <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
                    <MarkdownText text={gameNarrative} />
                  </div>
                </div>
              )}

              {/* Link to full player profile */}
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

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('### '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(4))}</p>
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-white mt-2">{renderInline(line.slice(3))}</p>
        if (line.startsWith('- ') || line.startsWith('• '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          )
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
