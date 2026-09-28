export const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'] as const

export type BookingService = { vi: string; en: string; price: string; category: string }

export function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayDateString() {
  return toDateString(new Date())
}

export function nowTimeString() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function normalizePhone(raw: unknown) {
  return typeof raw === 'string' ? raw.replace(/[\s.\-()]/g, '') : ''
}

export function isValidPhone(phone: string) {
  return /^(\+84|84|0)\d{8,10}$/.test(phone)
}

// '400.000' → 400000, '200.000 – 250.000' → 200000 (giá từ), '30.000/bộ' → 30000;
// vẫn nhận '400k' kiểu cũ để tính đúng booking tạo trước khi đổi format
export function parsePriceVnd(price: string) {
  const kMatch = price.match(/(\d+)\s*k/i)
  if (kMatch) return Number(kMatch[1]) * 1000
  const match = price.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)/)
  return match ? Number(match[1].replace(/[.,]/g, '')) : 0
}

// Hiển thị giá kèm ₫ sau từng mốc số: '400.000' → '400.000₫', '30.000/bộ' → '30.000₫/bộ',
// '200.000 – 250.000' → '200.000₫ – 250.000₫'
export function formatPriceVnd(price: string) {
  return price.replace(/(\d[\d.,]*\d|\d)/g, '$1₫')
}

export type ValidatedBooking = {
  name: string
  phone: string
  date: string
  time: string
  services: BookingService[]
  totalPrice: number
}

// Dùng chung cho API công khai và API admin; phone được phép rỗng (khách tại quầy)
export function validateBookingInput(body: any): { error: string } | { data: ValidatedBooking } {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 2 || name.length > 80) return { error: 'Vui lòng nhập họ và tên.' }

  const phone = normalizePhone(body?.phone)
  if (phone && !isValidPhone(phone)) return { error: 'Số điện thoại không hợp lệ. Ví dụ: 0912345678.' }

  const date = body?.date
  if (!isValidDateString(date)) return { error: 'Ngày đặt lịch không hợp lệ.' }
  const today = todayDateString()
  if (date < today) return { error: 'Không thể đặt lịch cho ngày đã qua. Vui lòng chọn ngày khác.' }

  const time = body?.time
  if (!isValidTimeString(time) || !(TIME_SLOTS as readonly string[]).includes(time)) return { error: 'Khung giờ không hợp lệ. Vui lòng chọn lại trên lịch.' }
  if (date === today && time <= nowTimeString()) return { error: 'Khung giờ này đã qua. Vui lòng chọn khung giờ khác.' }

  const rawServices = Array.isArray(body?.services) ? body.services : []
  const services: BookingService[] = rawServices
    .slice(0, 10)
    .filter((service: any) => service && typeof service.vi === 'string' && typeof service.price === 'string')
    .map((service: any) => ({
      vi: service.vi.slice(0, 120),
      en: typeof service.en === 'string' ? service.en.slice(0, 120) : service.vi.slice(0, 120),
      price: service.price.slice(0, 40),
      category: typeof service.category === 'string' ? service.category.slice(0, 60) : 'Khác',
    }))
  if (services.length === 0) return { error: 'Vui lòng chọn ít nhất một dịch vụ.' }

  const totalPrice = services.reduce((total, service) => total + parsePriceVnd(service.price), 0)
  return { data: { name, phone, date, time, services, totalPrice } }
}
