import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { AppShell } from '@/components/dashboard/app-shell'
import { FilterProvider } from '@/components/dashboard/filter-context'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'SI-NAPAS · Menutup Titik Buta Pemantauan Udara & Melindungi Kelompok Rentan',
  description:
    'Dasbor pemantauan kualitas udara (AQMS), pola & faktor pemengaruh, dampak kesehatan, serta evaluasi jaringan dan rekomendasi kebijakan.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#1d3340',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <FilterProvider>
          <AppShell>{children}</AppShell>
        </FilterProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
