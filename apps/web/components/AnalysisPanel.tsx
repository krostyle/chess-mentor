'use client'

import { useState } from 'react'

interface Props {
  profileSummary: string
}

const QUICK_QUESTIONS = [
  '¿Por qué no otra jugada?',
  '¿Cuál era el plan aquí?',
  '¿Qué debería estudiar?',
]

export function AnalysisPanel({ profileSummary }: Props) {
  const [activeTab, setActiveTab] = useState<'move' | 'profile'>('profile')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function askQuestion(question: string) {
    setLoading(true)
    setAnswer(null)
    await new Promise((r) => setTimeout(r, 800))
    setAnswer(`(Respuesta de ejemplo para: "${question}") — integración con backend pendiente.`)
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-4">
      <div className="flex gap-2 border-b border-gray-800 pb-3">
        {(['profile', 'move'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-sm rounded-md transition ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'profile' ? 'Mi perfil' : 'Este movimiento'}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Análisis del GM</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{profileSummary}</p>
        </div>
      )}

      {activeTab === 'move' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Pregunta sobre este movimiento</h3>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => askQuestion(q)}
                disabled={loading}
                className="rounded-full border border-gray-700 px-3 py-1 text-xs text-gray-400 transition hover:border-indigo-500 hover:text-indigo-400 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
          {loading && <p className="text-xs text-gray-500 animate-pulse">El GM está pensando...</p>}
          {answer && (
            <div className="rounded-lg bg-gray-800 p-3 text-sm text-gray-300 leading-relaxed">
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
