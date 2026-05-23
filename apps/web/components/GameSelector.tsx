'use client'

import { useState } from 'react'
import type { Game } from '@/types'

interface Props {
  games: Game[]
  username?: string
  onSelect?: (game: Game) => void
}

type Outcome = 'win' | 'loss' | 'draw'

function getOutcome(game: Game, username?: string): Outcome {
  if (game.result === '1/2-1/2') return 'draw'
  const isWhite = username && game.white.toLowerCase() === username.toLowerCase()
  if (game.result === '1-0') return isWhite ? 'win' : 'loss'
  if (game.result === '0-1') return isWhite ? 'loss' : 'win'
  return 'draw'
}

function getOpponent(game: Game, username?: string): string {
  if (!username) return `${game.white} vs ${game.black}`
  return game.white.toLowerCase() === username.toLowerCase() ? game.black : game.white
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return dateStr
  }
}

const outcomeStyles: Record<Outcome, { dot: string; badge: string; label: string }> = {
  win:  { dot: 'bg-green-500', badge: 'bg-green-900/60 text-green-300', label: 'Victoria' },
  loss: { dot: 'bg-red-500',   badge: 'bg-red-900/60 text-red-300',     label: 'Derrota'  },
  draw: { dot: 'bg-gray-500',  badge: 'bg-gray-800 text-gray-400',      label: 'Tablas'   },
}

export function GameSelector({ games, username, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string>(games[0]?.id ?? '')

  function handleSelect(game: Game) {
    setSelectedId(game.id)
    onSelect?.(game)
  }

  if (games.length === 0) return null

  const wins   = games.filter(g => getOutcome(g, username) === 'win').length
  const losses = games.filter(g => getOutcome(g, username) === 'loss').length
  const draws  = games.filter(g => getOutcome(g, username) === 'draw').length

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      {/* Header with summary */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-500">{games.length} partidas</span>
        <div className="flex gap-2 text-xs">
          <span className="text-green-400">{wins}V</span>
          <span className="text-red-400">{losses}D</span>
          <span className="text-gray-500">{draws}T</span>
        </div>
      </div>

      {/* Scrollable game list */}
      <div className="max-h-48 overflow-y-auto">
        {games.map((game) => {
          const outcome = getOutcome(game, username)
          const style = outcomeStyles[outcome]
          const opponent = getOpponent(game, username)
          const isSelected = selectedId === game.id

          return (
            <button
              key={game.id}
              onClick={() => handleSelect(game)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-gray-800 ${
                isSelected ? 'bg-gray-800' : ''
              }`}
            >
              <span className={`shrink-0 h-2 w-2 rounded-full ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    vs {opponent}
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
                {game.opening && (
                  <p className="text-xs text-gray-500 truncate">{game.opening} · {formatDate(game.date)}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
