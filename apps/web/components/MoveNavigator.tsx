'use client'

import type { Move } from '@/types'

interface Props {
  currentIndex: number
  total: number
  currentMove: Move | null
  onPrev: () => void
  onNext: () => void
}

export function MoveNavigator({ currentIndex, total, currentMove, onPrev, onNext }: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-2">
      <button
        onClick={onPrev}
        disabled={currentIndex === 0}
        className="rounded px-3 py-1 text-sm font-medium transition hover:bg-gray-800 disabled:opacity-30"
        aria-label="Movimiento anterior"
      >
        ←
      </button>

      <div className="text-center text-sm text-gray-400">
        {currentMove ? (
          <span className="font-mono">
            {Math.ceil(currentMove.move_number / 2)}. {currentMove.san}
            {currentMove.stockfish_eval !== undefined && (
              <span className="ml-2 text-xs text-gray-500">
                {currentMove.stockfish_eval > 0 ? '+' : ''}{currentMove.stockfish_eval.toFixed(1)}
              </span>
            )}
          </span>
        ) : (
          <span>Posición inicial</span>
        )}
        <span className="ml-2 text-xs text-gray-600">
          {currentIndex}/{total}
        </span>
      </div>

      <button
        onClick={onNext}
        disabled={currentIndex === total}
        className="rounded px-3 py-1 text-sm font-medium transition hover:bg-gray-800 disabled:opacity-30"
        aria-label="Siguiente movimiento"
      >
        →
      </button>
    </div>
  )
}
