'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) return
    setLoading(true)
    router.push(`/profile/${encodeURIComponent(trimmed)}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">♟ Chess Mentor</h1>
          <p className="text-gray-400 text-lg">
            Analiza tu estilo de juego en Lichess y recibe coaching personalizado de IA
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario de Lichess"
            disabled={loading}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-center text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!username.trim() || loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Analizando...' : 'Analizar mi juego'}
          </button>
        </form>

        <p className="text-xs text-gray-600">
          Se analizarán tus últimas 50 partidas públicas
        </p>
      </div>
    </main>
  )
}
