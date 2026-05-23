import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

interface EndpointStats {
  calls: number
  input_tokens: number
  output_tokens: number
}

interface UsageResponse {
  endpoints: Record<string, EndpointStats>
  totals: {
    calls: number
    input_tokens: number
    output_tokens: number
    estimated_cost_usd: number
  }
}

async function fetchUsage(): Promise<UsageResponse | null> {
  const adminKey = process.env.ADMIN_KEY
  const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
  try {
    const res = await fetch(`${apiUrl}/api/admin/usage`, {
      headers: adminKey ? { 'X-Admin-Key': adminKey } : {},
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<UsageResponse>
  } catch {
    return null
  }
}

const ENDPOINT_LABELS: Record<string, string> = {
  generate_profile: 'Perfil del jugador',
  explain_move:     'Explicar movimiento',
  analyze_game:     'Análisis de partida',
}

export default async function AdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const data = await fetchUsage()

  return (
    <main className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de administración</h1>
            <p className="text-sm text-gray-400 mt-1">Consumo de la API de Claude desde el último reinicio</p>
          </div>
          <a href="/" className="text-sm text-indigo-400 hover:underline">← Inicio</a>
        </header>

        {!data ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center text-gray-400">
            No se pudo obtener los datos. Verifica que <code className="text-gray-300">ADMIN_KEY</code> esté configurada.
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Llamadas totales" value={String(data.totals.calls)} />
              <StatCard label="Tokens entrada" value={data.totals.input_tokens.toLocaleString()} />
              <StatCard label="Tokens salida" value={data.totals.output_tokens.toLocaleString()} />
              <StatCard
                label="Costo estimado"
                value={`$${data.totals.estimated_cost_usd.toFixed(4)}`}
                highlight
              />
            </div>

            {/* Per endpoint */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Desglose por función</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="px-4 py-2 text-left">Función</th>
                    <th className="px-4 py-2 text-right">Llamadas</th>
                    <th className="px-4 py-2 text-right">Tokens entrada</th>
                    <th className="px-4 py-2 text-right">Tokens salida</th>
                    <th className="px-4 py-2 text-right">Costo est.</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.endpoints).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                        Sin llamadas registradas todavía.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(data.endpoints).map(([key, s]) => {
                      const cost = s.input_tokens * 3 / 1_000_000 + s.output_tokens * 15 / 1_000_000
                      return (
                        <tr key={key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-3 text-gray-300">{ENDPOINT_LABELS[key] ?? key}</td>
                          <td className="px-4 py-3 text-right font-mono text-white">{s.calls}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-400">{s.input_tokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-400">{s.output_tokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-mono text-indigo-400">${cost.toFixed(4)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-600 text-center">
              Precios estimados: $3/MTok entrada · $15/MTok salida (claude-sonnet-4-20250514).
              Los datos se resetean al reiniciar el servidor.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-indigo-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}
