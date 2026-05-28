import type { PlayerProfile, Game, ExplainRequest, ExplainResponse } from '@/types'

function apiUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? 'http://localhost:8080'
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
}

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export async function narrateProfile(
  username: string,
  metrics: PlayerProfile['metrics'],
  token?: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/profile/narrative`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ username, metrics }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { narrative: string }
    return data.narrative
  } catch {
    return null
  }
}

export async function getProfile(username: string, token?: string): Promise<PlayerProfile | null> {
  try {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(
      `${apiUrl()}/api/profile/${encodeURIComponent(username)}`,
      { cache: 'no-store', headers },
    )
    if (!res.ok) return null
    return res.json() as Promise<PlayerProfile>
  } catch {
    return null
  }
}

export async function analyzeGame(pgn: string, token?: string): Promise<Game | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/analyze`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ pgn }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) return null
    return res.json() as Promise<Game>
  } catch {
    return null
  }
}

export async function narrateGame(game: Game, playerUsername: string, token?: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/narrative`, {
      method: 'POST',
      headers: authHeaders(token),
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

export async function chatGame(
  game: Game,
  playerUsername: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  token?: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/chat`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ game, player_username: playerUsername, messages }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { reply: string }
    return data.reply
  } catch {
    return null
  }
}

export async function getStudies(username: string, token?: string): Promise<Game[] | null> {
  try {
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(
      `${apiUrl()}/api/studies/${encodeURIComponent(username)}`,
      { cache: 'no-store', headers },
    )
    if (!res.ok) return null
    const data = await res.json() as { chapters: Game[] }
    return data.chapters
  } catch {
    return null
  }
}

export async function explainMove(req: ExplainRequest, token?: string): Promise<ExplainResponse | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/explain`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    return res.json() as Promise<ExplainResponse>
  } catch {
    return null
  }
}
