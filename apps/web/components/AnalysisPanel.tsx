'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import type { Move, Game } from '@/types'
import { narrateGame, chatGame } from '@/lib/api'
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

function moveLabel(m: Move): string {
  const n = Math.ceil(m.move_number / 2)
  return m.color === 'white' ? `${n}.${m.san}` : `${n}...${m.san}`
}

export function AnalysisPanel({
  profileNarrative, profileSummary, currentMove, game, username,
  playerColor, fenBeforeCurrentMove, onJumpToMove, onPreviewFen,
}: Props) {
  const { getToken } = useAuth()
  const [activeTab, setActiveTab] = useState<'analysis' | 'game'>('analysis')
  const [gameNarrative, setGameNarrative] = useState<string | null>(null)
  const [narrativeLoading, setNarrativeLoading] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  // Move-specific chat
  const [moveChatMessages, setMoveChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [moveChatInput, setMoveChatInput] = useState('')
  const [moveChatLoading, setMoveChatLoading] = useState(false)
  const moveChatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGameNarrative(null)
    setChatMessages([])
    setChatOpen(false)
  }, [game?.id])

  useEffect(() => {
    setMoveChatMessages([])
    setMoveChatInput('')
  }, [currentMove?.uci])

  const moves = game?.moves ?? []
  const criticalMoves = moves.filter(m => m.is_mistake || m.is_blunder)

  const currentIdx = currentMove
    ? moves.findIndex(m => m.move_number === currentMove.move_number)
    : -1
  const prevMove = currentIdx > 0 ? moves[currentIdx - 1] : null
  const nextMove = currentIdx >= 0 && currentIdx < moves.length - 1 ? moves[currentIdx + 1] : null

  // Compute best move SAN at render time for chat context injection
  const bestMoveSan = currentMove?.best_move && fenBeforeCurrentMove
    ? uciLineToSteps(fenBeforeCurrentMove, [currentMove.best_move])[0]?.san
    : undefined

  // Navigate to a move referenced by notation in chat (e.g. "12...Nd4")
  function handleChatMoveClick(notation: string) {
    if (!onJumpToMove) return
    const m = notation.match(/^(\d+)(\.\.\.|\.)/)
    if (!m) return
    const chessNum = parseInt(m[1])
    const isBlack = m[2] === '...'
    const found = moves.find(mv => {
      const n = Math.ceil(mv.move_number / 2)
      return n === chessNum && (mv.move_number % 2 === 0) === isBlack
    })
    if (found) onJumpToMove(found.move_number)
  }

  async function sendMoveChat(e: React.FormEvent) {
    e.preventDefault()
    const text = moveChatInput.trim()
    if (!text || !game || moveChatLoading) return

    const userMsg = { role: 'user' as const, content: text }
    const displayMessages = [...moveChatMessages, userMsg]
    setMoveChatMessages(displayMessages)
    setMoveChatInput('')
    setMoveChatLoading(true)
    setTimeout(() => moveChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    // First message: inject move context so the AI knows which move is being discussed
    let apiMessages: { role: 'user' | 'assistant'; content: string }[]
    if (moveChatMessages.length === 0 && currentMove) {
      const label = moveLabel(currentMove)
      const errorTag = currentMove.is_blunder ? ' (blunder ??)' : currentMove.is_mistake ? ' (error ?)' : ''
      const evalStr = currentMove.stockfish_eval != null
        ? `Stockfish eval: ${currentMove.stockfish_eval > 0 ? '+' : ''}${currentMove.stockfish_eval.toFixed(2)}.`
        : ''
      const bestStr = bestMoveSan ? ` La mejor jugada era: ${bestMoveSan}.` : ''
      apiMessages = [{ role: 'user', content: `[Jugada analizada: ${label}${errorTag}. ${evalStr}${bestStr}]\n\n${text}` }]
    } else {
      apiMessages = displayMessages
    }

    const token = await getToken()
    const reply = await chatGame(game, username ?? '', apiMessages, token ?? undefined)
    setMoveChatMessages(prev => [...prev, { role: 'assistant', content: reply ?? 'No se pudo obtener respuesta.' }])
    setMoveChatLoading(false)
    setTimeout(() => moveChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text || !game || chatLoading) return
    const newMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...chatMessages,
      { role: 'user', content: text },
    ]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    const token = await getToken()
    const reply = await chatGame(game, username ?? '', newMessages, token ?? undefined)
    setChatMessages(prev => [...prev, { role: 'assistant', content: reply ?? 'No se pudo obtener respuesta.' }])
    setChatLoading(false)
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function analyzeFullGame() {
    if (!game || !username) return
    setNarrativeLoading(true)
    setGameNarrative(null)
    const token = await getToken()
    const result = await narrateGame(game, username, token ?? undefined)
    setGameNarrative(result ?? 'No se pudo generar el análisis.')
    setNarrativeLoading(false)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4 h-full">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-3 py-1 text-sm rounded-md transition ${
            activeTab === 'analysis' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Análisis
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

      {/* ── Analysis tab ── */}
      {activeTab === 'analysis' && (
        <div className="space-y-4 flex flex-col" style={{ minHeight: 0 }}>
          {currentMove ? (
            <div className="space-y-3">
              {/* Move header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-white text-base">{moveLabel(currentMove)}</span>
                <span className="text-xs text-gray-500 capitalize">{currentMove.game_phase}</span>
                {currentMove.stockfish_eval != null && (
                  <span className={`text-xs font-mono font-semibold ${currentMove.stockfish_eval >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentMove.stockfish_eval > 0 ? '+' : ''}{currentMove.stockfish_eval.toFixed(2)}
                  </span>
                )}
                {currentMove.is_blunder && <span className="rounded bg-red-900 px-1.5 py-0.5 text-xs text-red-300">Blunder ??</span>}
                {currentMove.is_mistake && !currentMove.is_blunder && <span className="rounded bg-yellow-900 px-1.5 py-0.5 text-xs text-yellow-300">Error ?</span>}
              </div>

              {/* Context sequence: prev → current → next */}
              <div className="space-y-1">
                <p className="text-xs text-gray-600">Contexto — haz clic para ver en el tablero</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {prevMove && (
                    <>
                      <button
                        onClick={() => onPreviewFen?.(prevMove.fen_after)}
                        className="rounded px-2 py-0.5 text-xs font-mono bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
                      >
                        {moveLabel(prevMove)}
                      </button>
                      <span className="text-gray-700 text-xs">→</span>
                    </>
                  )}
                  <button
                    onClick={() => onPreviewFen?.(currentMove.fen_after)}
                    className={`rounded px-2 py-0.5 text-xs font-mono font-bold transition ${
                      currentMove.is_blunder
                        ? 'bg-red-900/60 text-red-300 hover:bg-red-800 ring-1 ring-red-700'
                        : currentMove.is_mistake
                          ? 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-800 ring-1 ring-yellow-700'
                          : 'bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800 ring-1 ring-indigo-700'
                    }`}
                  >
                    {moveLabel(currentMove)}
                  </button>
                  {nextMove && (
                    <>
                      <span className="text-gray-700 text-xs">→</span>
                      <button
                        onClick={() => onPreviewFen?.(nextMove.fen_after)}
                        className="rounded px-2 py-0.5 text-xs font-mono bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
                      >
                        {moveLabel(nextMove)}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Stockfish best continuation */}
              {currentMove.best_move && fenBeforeCurrentMove && (() => {
                const line = currentMove.best_line ?? [currentMove.best_move]
                const steps = uciLineToSteps(fenBeforeCurrentMove, line)
                if (steps.length === 0) return null
                return (
                  <div className="rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-2 space-y-1">
                    <p className="text-xs text-gray-500">Mejor continuación Stockfish</p>
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

              {/* Move chat */}
              <div className="rounded-lg border border-gray-700 bg-gray-950 flex flex-col">
                <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-medium">Pregunta sobre esta jugada</p>
                  <p className="text-xs text-gray-600">Basado en Stockfish</p>
                </div>
                <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: '240px', minHeight: '80px' }}>
                  {moveChatMessages.length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-3">
                      ¿Por qué fue mala esta jugada? ¿Qué debería haber jugado?
                    </p>
                  )}
                  {moveChatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-lg px-3 py-2 text-xs max-w-[88%] leading-relaxed ${
                        m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'
                      }`}>
                        {m.role === 'user'
                          ? m.content
                          : <MarkdownText text={m.content} onMoveClick={handleChatMoveClick} />
                        }
                      </div>
                    </div>
                  ))}
                  {moveChatLoading && (
                    <div className="flex justify-start">
                      <div className="rounded-lg px-3 py-2 bg-gray-800 flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                        <span className="text-xs text-gray-500">Analizando…</span>
                      </div>
                    </div>
                  )}
                  <div ref={moveChatBottomRef} />
                </div>
                <form onSubmit={sendMoveChat} className="border-t border-gray-800 p-2 flex gap-2">
                  <input
                    type="text"
                    value={moveChatInput}
                    onChange={e => setMoveChatInput(e.target.value)}
                    placeholder="¿Por qué Stockfish prefiere otra jugada?"
                    disabled={moveChatLoading}
                    className="flex-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={moveChatLoading || !moveChatInput.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                  >
                    Enviar
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Selecciona un movimiento en el tablero para preguntar sobre él.</p>
          )}

          {/* Critical moves quick nav */}
          {criticalMoves.length > 0 && (
            <div className="border-t border-gray-800 pt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Jugadas críticas ({criticalMoves.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {criticalMoves.map((m) => (
                  <button
                    key={m.move_number}
                    onClick={() => onJumpToMove?.(m.move_number)}
                    className={`rounded px-2 py-1 text-xs font-mono transition ${
                      currentMove?.move_number === m.move_number
                        ? 'ring-1 ring-indigo-500 '
                        : ''
                    }${
                      m.is_blunder
                        ? 'bg-red-900/60 text-red-300 hover:bg-red-800'
                        : 'bg-yellow-900/60 text-yellow-300 hover:bg-yellow-800'
                    }`}
                  >
                    {moveLabel(m)}{m.is_blunder ? ' ??' : ' ?'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Game tab ── */}
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
                  <span className="text-xs text-gray-400">El GM está revisando la partida…</span>
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
                    <MarkdownText text={gameNarrative} onMoveClick={handleChatMoveClick} />
                  </div>
                </div>
              )}

              {/* Chat */}
              <div className="border-t border-gray-800 pt-3 space-y-2">
                <button
                  onClick={() => setChatOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition text-sm text-gray-300"
                >
                  <span className="flex items-center gap-2">
                    <span>💬</span>
                    <span>Preguntar sobre esta partida</span>
                  </span>
                  <span className="text-gray-500 text-xs">{chatOpen ? '▲' : '▼'}</span>
                </button>

                {chatOpen && (
                  <div className="rounded-lg border border-gray-700 bg-gray-950 flex flex-col" style={{ maxHeight: '380px' }}>
                    <div className="px-3 py-2 border-b border-gray-800">
                      <p className="text-xs text-gray-500">Basado en datos reales de Stockfish · Los movimientos son clickeables</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: '260px' }}>
                      {chatMessages.length === 0 && (
                        <p className="text-xs text-gray-600 text-center py-4">
                          Pregunta sobre la apertura, errores, estrategia...
                        </p>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-lg px-3 py-2 text-xs max-w-[85%] leading-relaxed ${
                            m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300'
                          }`}>
                            {m.role === 'user'
                              ? m.content
                              : <MarkdownText text={m.content} onMoveClick={handleChatMoveClick} />
                            }
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="rounded-lg px-3 py-2 bg-gray-800 flex items-center gap-2">
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            <span className="text-xs text-gray-500">Analizando…</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>
                    <form onSubmit={sendChat} className="border-t border-gray-800 p-2 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="¿Por qué fue malo el movimiento 12?"
                        disabled={chatLoading}
                        className="flex-1 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={chatLoading || !chatInput.trim()}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
                      >
                        Enviar
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {username && (
                <a href={`/profile/${encodeURIComponent(username)}`} className="block text-center text-xs text-indigo-400 hover:underline">
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
