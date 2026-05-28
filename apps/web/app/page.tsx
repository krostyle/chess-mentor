'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { UserButton, SignInButton } from '@clerk/nextjs'

export default function HomePage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const { isSignedIn, isLoaded } = useAuth()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) return
    setLoading(true)
    router.push(`/profile/${encodeURIComponent(trimmed)}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Auth button top-right */}
      <div className="fixed top-4 right-4">
        {isLoaded && (
          isSignedIn
            ? <UserButton />
            : (
              <SignInButton mode="modal">
                <button className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300 transition hover:border-indigo-500 hover:text-white">
                  Iniciar sesión
                </button>
              </SignInButton>
            )
        )}
      </div>

      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">♟ Chess Mentor</h1>
          <p className="text-gray-400 text-lg">
            Analiza tu estilo de juego en Lichess y recibe coaching personalizado de IA
          </p>
        </div>

        {isLoaded && !isSignedIn ? (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm">Inicia sesión para analizar tus partidas</p>
            <SignInButton mode="modal">
              <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-500">
                Iniciar sesión para comenzar
              </button>
            </SignInButton>
          </div>
        ) : (
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
              {loading ? 'Cargando...' : 'Analizar mis partidas'}
            </button>
          </form>
        )}

        <p className="text-xs text-gray-600">
          Tus últimas 50 partidas públicas de Lichess · análisis con Stockfish e IA
        </p>
      </div>
    </main>
  )
}
