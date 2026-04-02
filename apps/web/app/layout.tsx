import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FutbolUY — Resultados del fútbol uruguayo',
  description: 'Resultados, tabla de posiciones y estadísticas del fútbol uruguayo en tiempo real',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
