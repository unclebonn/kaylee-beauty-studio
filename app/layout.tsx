import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Noto_Serif } from 'next/font/google'
import './globals.css'

const notoSans = Noto_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-noto-sans' })
const notoSerif = Noto_Serif({ subsets: ['latin', 'vietnamese'], variable: '--font-noto-serif' })

export const metadata: Metadata = { title: 'Salon Studio — Nail Care & Beauty', description: 'A refined nail salon experience for beautiful, healthy nails.', generator: 'v0.app' }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f8f2ec' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" className={`${notoSans.variable} ${notoSerif.variable} bg-camel-50`}><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
