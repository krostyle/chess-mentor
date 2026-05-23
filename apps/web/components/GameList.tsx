'use client'

import { useState } from 'react'
import type { Game } from '@/types'
import { getGameById } from '@/lib/api'
import { GameViewer } from './GameViewer'

interface Props {
  username: string
  games: Game[]   // basic list from /api/games — no Stockfish evals yet
}

export function GameList({ username, games }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadedGame, setLoadedGame] = useState<Game | null>(null)
  const [loadingGame, setLoadingGame] = useState(false)

  async function selectGame(game: Game) {
    if (selectedId === game.id) return
    setSelectedId(game.id)
    setLoadedGame(null)
    setLoadingGame(true)

    // Fetch the full game with Stockfish evals on demand
    const full = await getGameById(game.id)
    setLoadedGame(full ?? game) // fallback to basic game if eval fails
    setLoadingGame(false)
  }

  const elo = games[0]
    ? (games[0].white.toLowerCase() === username.toLowerCase()
        ? games[0].white_elo
        : games[0].black_elo)
    : undefined

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{username}</h1>
          <p className="text-gray-400 text-sm">
            {elo ? `ELO ${elo} · ` : ''}{games.length} partidas recientes
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 transition hover:border-gray-500 hover:text-white"
          >
            ← Volver
          </a>
          <a
            href={`/profile/${encodeURIComponent(username)}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Analizar perfil completo →
          </a>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* Game list */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <div className="border-b border-gray-800 px-4 py-2.5">
            <p className="text-xs font-medium uppercase tracking-widest text-gray-500">
              Partidas
            </p>
          </div>
          <ul className="divide-y divide-gray-800 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {games.map((game) => {
              const isWhite = game.white.toLowerCase() === username.toLowerCase()
              const playerResult = gameResult(game.result, isWhite)
              const isSelected = selectedId === game.id

              return (
                <li key={game.id}>
                  <button
                    onClick={() => selectGame(game)}
                    className={`w-full px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-indigo-950 border-l-2 border-l-indigo-500'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {isWhite ? '⬜' : '⬛'}{' '}
                        {isWhite ? game.black : game.white}
                      </span>
                      <ResultBadge result={playerResult} />
                    </div>
                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
                      <span className="truncate">{game.opening || 'Apertura desconocida'}</span>
                      <span className="shrink-0">{game.time_control}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Game viewer / placeholder */}
        <div>
          {!selectedId && (
            <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-800 text-gray-600">
              <div className="text-center space-y-1">
                <p>← Selecciona una partida para verla</p>
                <p className="text-sm">Se analizará con Stockfish automáticamente</p>
              </div>
            </div>
          )}

          {selectedId && loadingGame && (
            <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
              <div className="text-center space-y-3">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                <p className="text-sm text-gray-400">Analizando con Stockfish…</p>
              </div>
            </div>
          )}

          {loadedGame && !loadingGame && (
            <GameViewer
              games={[loadedGame]}
              profileSummary=""
              profileNarrative=""
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gameResult(result: string, isWhite: boolean): 'win' | 'loss' | 'draw' {
  if (result === '1/2-1/2') return 'draw'
  if (result === '1-0') return isWhite ? 'win' : 'loss'
  return isWhite ? 'loss' : 'win'
}

function ResultBadge({ result }: { result: 'win' | 'loss' | 'draw' }) {
  const styles = {
    win: 'bg-green-900 text-green-300',
    loss: 'bg-red-900 text-red-300',
    draw: 'bg-gray-700 text-gray-300',
  }
  const labels = { win: 'Victoria', loss: 'Derrota', draw: 'Tablas' }
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${styles[result]}`}>
      {labels[result]}
    </span>
  )
}
