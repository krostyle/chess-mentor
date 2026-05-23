'use client'

import { useState, useCallback } from 'react'
import type { Game, Move } from '@chess-mentor/types'
import { Chessboard } from 'react-chessboard'
import { GameSelector } from './GameSelector'
import { MoveNavigator } from './MoveNavigator'
import { AnalysisPanel } from './AnalysisPanel'

interface Props {
  games: Game[]
  profileSummary: string
  profileNarrative: string
}

export function GameViewer({ games, profileSummary, profileNarrative }: Props) {
  const [selectedGame, setSelectedGame] = useState<Game>(games[0])
  const [moveIndex, setMoveIndex] = useState(0) // 0 = start position

  const moves: Move[] = selectedGame?.moves ?? []

  const currentFen = useCallback(() => {
    if (moveIndex === 0) return 'start'
    return moves[moveIndex - 1]?.fen_after ?? 'start'
  }, [moves, moveIndex])

  const currentMove: Move | null = moveIndex > 0 ? (moves[moveIndex - 1] ?? null) : null

  function handleGameSelect(game: Game) {
    setSelectedGame(game)
    setMoveIndex(0)
  }

  function handlePrev() {
    setMoveIndex((i) => Math.max(0, i - 1))
  }

  function handleNext() {
    setMoveIndex((i) => Math.min(moves.length, i + 1))
  }

  // Keyboard navigation
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
      {/* Left column: board + game selector */}
      <div className="space-y-3">
        <GameSelector games={games} onSelect={handleGameSelect} />

        <div className="overflow-hidden rounded-xl">
          <Chessboard
            position={currentFen()}
            arePiecesDraggable={false}
            customBoardStyle={{ borderRadius: '0.75rem' }}
          />
        </div>

        <MoveNavigator
          currentIndex={moveIndex}
          total={moves.length}
          currentMove={currentMove}
          onPrev={handlePrev}
          onNext={handleNext}
        />

        {/* Move list */}
        <MoveList moves={moves} currentIndex={moveIndex} onSelect={setMoveIndex} />
      </div>

      {/* Right column: analysis */}
      <div>
        <AnalysisPanel
          profileNarrative={profileNarrative}
          currentMove={currentMove}
          profileSummary={profileSummary}
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
    pairs.push({
      num: Math.ceil((i + 1) / 2),
      white: moves[i],
      black: moves[i + 1],
    })
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

function MoveToken({
  move,
  index,
  currentIndex,
  onSelect,
}: {
  move: Move
  index: number
  currentIndex: number
  onSelect: (idx: number) => void
}) {
  const isActive = currentIndex === index
  return (
    <button
      onClick={() => onSelect(index)}
      className={`rounded px-1 py-0.5 transition ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {move.san}
    </button>
  )
}
