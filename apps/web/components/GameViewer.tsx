'use client'

import { useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import type { Game, Move } from '@/types'
import { Chessboard } from 'react-chessboard'
import { GameSelector } from './GameSelector'
import { MoveNavigator } from './MoveNavigator'
import { AnalysisPanel } from './AnalysisPanel'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface Props {
  games: Game[]
  profileSummary: string
  profileNarrative: string
  username?: string
}

export function GameViewer({ games, profileSummary, profileNarrative, username }: Props) {
  const [selectedGame, setSelectedGame] = useState<Game>(games[0])
  const [moveIndex, setMoveIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [previewFen, setPreviewFen] = useState<string | null>(null)

  const moves: Move[] = selectedGame?.moves ?? []

  const playerColor: 'white' | 'black' =
    selectedGame && username && selectedGame.white.toLowerCase() === username.toLowerCase()
      ? 'white'
      : 'black'

  const boardOrientation: 'white' | 'black' = flipped
    ? playerColor === 'white' ? 'black' : 'white'
    : playerColor

  const currentFen = useCallback(() => {
    if (moveIndex === 0) return 'start'
    return moves[moveIndex - 1]?.fen_after ?? 'start'
  }, [moves, moveIndex])

  const fenBeforeCurrentMove: string =
    moveIndex <= 1 ? START_FEN : (moves[moveIndex - 2]?.fen_after ?? START_FEN)

  const currentMove: Move | null = moveIndex > 0 ? (moves[moveIndex - 1] ?? null) : null

  function handleGameSelect(game: Game) {
    setSelectedGame(game)
    setMoveIndex(0)
    setFlipped(false)
    setPreviewFen(null)
  }

  function handlePrev() { setPreviewFen(null); setMoveIndex((i) => Math.max(0, i - 1)) }
  function handleNext() { setPreviewFen(null); setMoveIndex((i) => Math.min(moves.length, i + 1)) }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') handlePrev()
    if (e.key === 'ArrowRight') handleNext()
  }

  if (!selectedGame) return null

  return (
    <div
      className="grid grid-cols-1 gap-4 lg:grid-cols-2 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Left column: board + controls */}
      <div className="space-y-3">
        <GameSelector games={games} onSelect={handleGameSelect} />

        <div className="relative overflow-hidden rounded-xl">
          <Chessboard
            position={previewFen ?? currentFen()}
            boardOrientation={boardOrientation}
            arePiecesDraggable={false}
            customBoardStyle={{ borderRadius: '0.75rem' }}
          />
          {previewFen && (
            <div className="absolute top-2 left-2 flex items-center gap-2 rounded-md bg-gray-900/90 px-3 py-1.5 backdrop-blur">
              <span className="text-xs text-indigo-300">Variante Stockfish</span>
              <button
                onClick={() => setPreviewFen(null)}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                × Salir
              </button>
            </div>
          )}
          <button
            onClick={() => setFlipped((f) => !f)}
            title="Girar tablero"
            className="absolute bottom-2 right-2 rounded-md bg-gray-900/80 px-2 py-1 text-xs text-gray-400 backdrop-blur hover:text-white transition"
          >
            ⇅ Girar
          </button>
        </div>

        <MoveNavigator
          currentIndex={moveIndex}
          total={moves.length}
          currentMove={currentMove}
          onPrev={handlePrev}
          onNext={handleNext}
        />

        <MoveList
          moves={moves}
          currentIndex={moveIndex}
          onSelect={(idx) => { setPreviewFen(null); setMoveIndex(idx) }}
        />
      </div>

      {/* Right column: analysis */}
      <div>
        <AnalysisPanel
          profileNarrative={profileNarrative}
          currentMove={currentMove}
          profileSummary={profileSummary}
          game={selectedGame}
          username={username}
          playerColor={playerColor}
          fenBeforeCurrentMove={fenBeforeCurrentMove}
          onJumpToMove={(idx) => { setPreviewFen(null); setMoveIndex(idx) }}
          onPreviewFen={setPreviewFen}
        />
      </div>
    </div>
  )
}

// ─── Move list ────────────────────────────────────────────────────────────────

interface MoveListProps {
  moves: Move[]
  currentIndex: number
  onSelect: (idx: number) => void
}

function MoveList({ moves, currentIndex, onSelect }: MoveListProps) {
  const pairs: Array<{ num: number; white: Move; black?: Move }> = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.ceil((i + 1) / 2), white: moves[i], black: moves[i + 1] })
  }

  return (
    <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="flex flex-wrap gap-1 text-sm font-mono">
        {pairs.map(({ num, white, black }) => (
          <span key={num} className="flex items-center gap-0.5">
            <span className="text-gray-600 text-xs">{num}.</span>
            <MoveToken move={white} index={num * 2 - 1} currentIndex={currentIndex} onSelect={onSelect} />
            {black && (
              <MoveToken move={black} index={num * 2} currentIndex={currentIndex} onSelect={onSelect} />
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

function MoveToken({ move, index, currentIndex, onSelect }: {
  move: Move; index: number; currentIndex: number; onSelect: (idx: number) => void
}) {
  const isActive = currentIndex === index
  const isBlunder = move.is_blunder
  const isMistake = move.is_mistake && !move.is_blunder
  return (
    <button
      onClick={() => onSelect(index)}
      className={`rounded px-1 py-0.5 transition ${
        isActive
          ? 'bg-indigo-600 text-white'
          : isBlunder
          ? 'text-red-400 hover:bg-gray-800'
          : isMistake
          ? 'text-yellow-400 hover:bg-gray-800'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {move.san}{isBlunder ? '??' : isMistake ? '?' : ''}
    </button>
  )
}

// ─── UCI → SAN conversion ─────────────────────────────────────────────────────

export function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen)
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length === 5 ? uci[4] : undefined
    const move = chess.move({ from, to, promotion })
    return move?.san ?? uci
  } catch {
    return uci
  }
}

export function uciLineToSteps(startFen: string, ucis: string[]): { san: string; fen: string }[] {
  const chess = new Chess(startFen)
  const steps: { san: string; fen: string }[] = []
  for (const uci of ucis) {
    try {
      const from = uci.slice(0, 2)
      const to = uci.slice(2, 4)
      const promotion = uci.length === 5 ? uci[4] : undefined
      const move = chess.move({ from, to, promotion })
      if (!move) break
      steps.push({ san: move.san, fen: chess.fen() })
    } catch {
      break
    }
  }
  return steps
}

export function uciLineToPairs(startFen: string, ucis: string[]): string[] {
  return uciLineToSteps(startFen, ucis).map(s => s.san)
}
