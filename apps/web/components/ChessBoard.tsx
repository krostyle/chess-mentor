'use client'

import { useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import type { Game } from '@/types'
import { MoveNavigator } from './MoveNavigator'

interface Props {
  game: Game | null
  profileSummary: string
}

export function ChessBoardWrapper({ game, profileSummary }: Props) {
  const moves = game?.moves ?? []
  const [currentIndex, setCurrentIndex] = useState(0)

  const getFen = useCallback(() => {
    if (!game || moves.length === 0) return 'start'
    if (currentIndex === 0) return 'start'
    return moves[currentIndex - 1]?.fen_after ?? 'start'
  }, [game, moves, currentIndex])

  if (!game) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-gray-800 bg-gray-900 text-gray-500">
        Selecciona una partida
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl">
        <Chessboard
          position={getFen()}
          arePiecesDraggable={false}
          boardWidth={undefined}
          customBoardStyle={{ borderRadius: '0.75rem' }}
        />
      </div>
      <MoveNavigator
        currentIndex={currentIndex}
        total={moves.length}
        currentMove={moves[currentIndex - 1] ?? null}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(moves.length, i + 1))}
      />
    </div>
  )
}
