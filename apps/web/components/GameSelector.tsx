'use client'

import { useState } from 'react'
import type { Game } from '@/types'

interface Props {
  games: Game[]
  onSelect?: (game: Game) => void
}

export function GameSelector({ games, onSelect }: Props) {
  const [selected, setSelected] = useState<string>(games[0]?.id ?? '')

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setSelected(id)
    const game = games.find((g) => g.id === id)
    if (game) onSelect?.(game)
  }

  if (games.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <label htmlFor="game-select" className="mb-1.5 block text-xs font-medium text-gray-500">
        Partida
      </label>
      <select
        id="game-select"
        value={selected}
        onChange={handleChange}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
      >
        {games.map((game) => (
          <option key={game.id} value={game.id}>
            {game.white} vs {game.black} — {game.result} ({game.opening})
          </option>
        ))}
      </select>
    </div>
  )
}
