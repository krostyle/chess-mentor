import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chess Mentor',
  description: 'Analiza tu estilo de juego con IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
