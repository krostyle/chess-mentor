import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiUrl =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8080'

  const envInfo = {
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'NOT SET',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'NOT SET',
    resolved_url: apiUrl,
  }

  try {
    const res = await fetch(`${apiUrl}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    const body = await res.text()
    return NextResponse.json({ ok: true, status: res.status, body, env: envInfo })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err), env: envInfo }, { status: 500 })
  }
}
