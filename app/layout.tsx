import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans, Noto_Serif } from 'next/font/google'
import './globals.css'

const notoSans = Noto_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-noto-sans' })
const notoSerif = Noto_Serif({ subsets: ['latin', 'vietnamese'], variable: '--font-noto-serif' })

export const metadata: Metadata = { title: 'Kaylee Beauty Studio — Nối mi & Nail', description: 'Kaylee Beauty Studio — nối mi chuyên nghiệp, bảo hành 3 ngày, cùng các dịch vụ chăm sóc & thiết kế móng.', generator: 'v0.app' }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f8f2ec' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" className={`${notoSans.variable} ${notoSerif.variable} bg-camel-50`}><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
