import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { validateBookingInput } from '@/lib/booking'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const result = validateBookingInput(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { name, phone, date, time, services, totalPrice } = result.data
  if (!phone) return NextResponse.json({ error: 'Vui lòng nhập số điện thoại.' }, { status: 400 })

  try {
    const conflict = await prisma.booking.count({
      where: { bookingDate: date, bookingTime: time, status: { not: 'CANCELLED' } },
    })
    if (conflict > 0) {
      return NextResponse.json({ error: 'Rất tiếc, khung giờ này vừa có người đặt. Vui lòng chọn khung giờ khác.' }, { status: 409 })
    }

    const booking = await prisma.booking.create({
      data: {
        customerName: name,
        phone,
        source: 'ONLINE',
        services: services as unknown as Prisma.InputJsonValue,
        totalPrice,
        bookingDate: date,
        bookingTime: time,
        status: 'PENDING',
      },
      select: { id: true, bookingDate: true, bookingTime: true, totalPrice: true },
    })
    return NextResponse.json({ ok: true, booking }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Không thể lưu lịch ngay bây giờ. Vui lòng thử lại sau.' }, { status: 500 })
  }
}
