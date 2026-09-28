import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/services — bảng giá công khai cho FE (danh mục + dịch vụ, khớp shape Service của page.tsx)
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        services: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, nameEn: true, price: true, image: true },
        },
      },
    })
    return NextResponse.json({
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        services: category.services.map((service) => ({
          id: service.id,
          vi: service.name,
          en: service.nameEn || service.name,
          price: service.price,
          image: service.image,
        })),
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Không thể tải bảng dịch vụ.' }, { status: 500 })
  }
}
