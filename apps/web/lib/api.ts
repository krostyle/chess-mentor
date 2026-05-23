import type { PlayerProfile, Game, ExplainRequest, ExplainResponse } from '@/types'

function apiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: prefer API_INTERNAL_URL, fall back to NEXT_PUBLIC_API_URL
    return process.env.API_INTERNAL_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? 'http://localhost:8080'
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
}

export async function getProfile(username: string): Promise<PlayerProfile | null> {
  try {
    const res = await fetch(
      `${apiUrl()}/api/profile/${encodeURIComponent(username)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return res.json() as Promise<PlayerProfile>
  } catch {
    return null
  }
}

// Fast — no Stockfish, just PGN parsing. Used for the initial games list.
export async function getGames(username: string): Promise<Game[]> {
  try {
    const res = await fetch(
      `${apiUrl()}/api/games/${encodeURIComponent(username)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json() as Promise<Game[]>
  } catch {
    return []
  }
}

// Sends the PGN we already have to Railway for Stockfish annotation.
// No second Lichess call needed — avoids 404s on re-fetch.
export async function analyzeGame(pgn: string): Promise<Game | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pgn }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return null
    return res.json() as Promise<Game>
  } catch {
    return null
  }
}

export async function narrateGame(game: Game, playerUsername: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, player_username: playerUsername }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { narrative: string }
    return data.narrative
  } catch {
    return null
  }
}

export async function explainMove(req: ExplainRequest): Promise<ExplainResponse | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) return null
    return res.json() as Promise<ExplainResponse>
  } catch {
    return null
  }
}
