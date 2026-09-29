import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CalendarDays, CheckCircle2, Clock3, Phone, User } from 'lucide-react'
import { formatPriceVnd } from '@/lib/booking'

export const dynamic = 'force-dynamic'

// Backend NestJS (kaylee-api). Trên Vercel set biến API_URL (VD: http://<vps>:3001).
const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

type ServiceLike = { vi?: string; price?: string }

type Bill = {
  id: number
  customerName: string
  phone: string // đã được API che (VD: 0912•••678)
  services: ServiceLike[]
  totalPrice: number
  bookingDate: string
  bookingTime: string
  status: string
}

async function getBill(token: string): Promise<Bill | null> {
  try {
    const res = await fetch(`${API_URL}/api/bill/${token}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return data?.bill ?? null
  } catch {
    return null
  }
}

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')}₫`
}

function billNumber(id: number) {
  return `#${String(id).padStart(6, '0')}`
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const bill = await getBill(token)
  return { title: bill ? `Hóa đơn ${billNumber(bill.id)} — Kaylee Beauty Studio` : 'Hóa đơn — Kaylee Beauty Studio' }
}

export default async function BillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const booking = await getBill(token)
  if (!booking) notFound()

  const services = (Array.isArray(booking.services) ? booking.services : []) as ServiceLike[]
  const statusLabel =
    booking.status === 'COMPLETED' ? 'Đã hoàn thành' : booking.status === 'CONFIRMED' ? 'Đã xác nhận' : booking.status === 'PENDING' ? 'Chờ xác nhận' : 'Đã hủy'
  const statusStyle =
    booking.status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800'
      : booking.status === 'CANCELLED'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-800'

  return (
    <main className="flex min-h-screen items-center justify-center bg-camel-100/60 px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-camel-200 bg-camel-50 p-7 shadow-[0_18px_50px_rgba(74,52,28,0.12)] sm:p-9">
        <div className="text-center">
          <img src="/images/logo/kaylee-logo-nau.png" alt="Kaylee Beauty Studio" className="mx-auto h-14 w-auto" />
          <h1 className="mt-5 font-serif text-3xl text-camel-900">Hóa đơn dịch vụ</h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-camel-600">Mã {billNumber(booking.id)}</p>
          <p className="mt-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusStyle}`}>
              <CheckCircle2 size={12} /> {statusLabel}
            </span>
          </p>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-camel-200 pt-5 text-sm">
          <p className="flex items-center gap-2.5">
            <User size={15} className="shrink-0 text-camel-500" />
            <span className="w-24 shrink-0 text-camel-600">Khách hàng</span>
            <span className="font-semibold text-camel-900">{booking.customerName}</span>
          </p>
          <p className="flex items-center gap-2.5">
            <Phone size={15} className="shrink-0 text-camel-500" />
            <span className="w-24 shrink-0 text-camel-600">SĐT</span>
            <span className="text-camel-800">{booking.phone || '—'}</span>
          </p>
          <p className="flex items-center gap-2.5">
            <CalendarDays size={15} className="shrink-0 text-camel-500" />
            <span className="w-24 shrink-0 text-camel-600">Ngày</span>
            <span className="text-camel-800">{booking.bookingDate.split('-').reverse().join('/')}</span>
          </p>
          <p className="flex items-center gap-2.5">
            <Clock3 size={15} className="shrink-0 text-camel-500" />
            <span className="w-24 shrink-0 text-camel-600">Giờ</span>
            <span className="text-camel-800">{booking.bookingTime}</span>
          </p>
        </div>

        <div className="mt-6 border-t border-camel-200 pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-camel-600">Dịch vụ</p>
          <div className="mt-3 space-y-2.5">
            {services.map((service, index) => (
              <div key={index} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-camel-800">{service.vi}</span>
                <span className="shrink-0 font-medium text-camel-700">{formatPriceVnd(service.price ?? '')}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-camel-200 pt-4">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-camel-600">Tổng cộng</span>
            <span className="font-serif text-2xl font-semibold text-camel-900">{formatMoney(booking.totalPrice)}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-camel-100/70 p-4 text-center">
          <p className="text-sm leading-6 text-camel-800">Cảm ơn anh/chị đã tin tưởng Kaylee Beauty Studio 💛</p>
          <p className="mt-1 text-xs text-camel-600">Bảo hành nối mi 3 ngày kể từ ngày nối · Mi nối được chăm sóc nhẹ nhàng</p>
        </div>

        <a
          href="/"
          className="mt-6 block rounded-full bg-camel-800 py-3.5 text-center text-sm font-semibold text-camel-50 transition hover:bg-camel-700"
        >
          Đặt lịch lần sau
        </a>

        <div className="mt-6 border-t border-camel-200 pt-4 text-center">
          <a href="tel:+84912345678" className="inline-flex items-center gap-1.5 text-sm font-medium text-camel-700 transition hover:text-camel-500">
            <Phone size={13} /> Hotline: 0912 345 678
          </a>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
            {[
              { href: 'https://www.facebook.com/profile.php?id=61584428326954', label: 'Facebook' },
              { href: 'https://www.tiktok.com/@kaylee.beautystu', label: 'TikTok' },
              { href: 'https://www.instagram.com/kayleebeautystudio', label: 'Instagram' },
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-camel-200 bg-camel-50 px-3 py-1 font-semibold text-camel-700 transition hover:bg-camel-800 hover:text-camel-50"
              >
                {social.label}
              </a>
            ))}
          </p>
          <p className="mt-3 text-[11px] text-camel-500">Kaylee Beauty Studio — Nối mi & Nail · 09:00 — 19:00 mỗi ngày</p>
        </div>
      </div>
    </main>
  )
}
