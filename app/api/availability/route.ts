import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

// GET /api/availability?month=YYYY-MM  → { blocked: { 'YYYY-MM-DD': ['09:00', ...] } }
// GET /api/availability?date=YYYY-MM-DD → { date, blocked: ['09:00', ...] }
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const month = params.get('month')
  const date = params.get('date')

  try {
    if (month && MONTH_RE.test(month)) {
      const from = `${month}-01`
      const [year, monthNumber] = month.split('-').map(Number)
      const lastDay = new Date(year, monthNumber, 0).getDate()
      const to = `${month}-${String(lastDay).padStart(2, '0')}`
      const bookings = await prisma.booking.findMany({
        where: { status: { not: 'CANCELLED' }, bookingDate: { gte: from, lte: to } },
        select: { bookingDate: true, bookingTime: true },
      })
      const blocked: Record<string, string[]> = {}
      for (const booking of bookings) (blocked[booking.bookingDate] ??= []).push(booking.bookingTime)
      return NextResponse.json({ month, blocked })
    }

    if (date && DATE_RE.test(date)) {
      const bookings = await prisma.booking.findMany({
        where: { status: { not: 'CANCELLED' }, bookingDate: date },
        select: { bookingTime: true },
      })
      return NextResponse.json({ date, blocked: bookings.map((booking) => booking.bookingTime) })
    }

    return NextResponse.json({ error: 'Thiếu tham số date hoặc month hợp lệ.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Không thể kiểm tra lịch ngay bây giờ.' }, { status: 500 })
  }
}
