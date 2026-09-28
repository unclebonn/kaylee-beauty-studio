'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Minus, Plus, RotateCcw, X, ZoomIn } from 'lucide-react'
import { formatPriceVnd } from '@/lib/booking'

type Locale = 'vi' | 'en'

const MIN_SCALE = 1
const MAX_SCALE = 5

type View = { scale: number; x: number; y: number }

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

// Zoom towards the pointer (when given) so the point under the cursor stays put.
function applyZoom(v: View, target: number, rect?: DOMRect, cx?: number, cy?: number): View {
  if (target <= MIN_SCALE) return { scale: MIN_SCALE, x: 0, y: 0 }
  if (!rect || cx === undefined || cy === undefined) return { scale: target, x: v.x, y: v.y }
  const px = cx - rect.left - rect.width / 2
  const py = cy - rect.top - rect.height / 2
  const factor = target / v.scale
  return { scale: target, x: px - (px - v.x) * factor, y: py - (py - v.y) * factor }
}

export default function LashPhotoModal({ service, locale, selected = false, onToggleSelect, onBook, onClose }: {
  service: { vi: string; en: string; price: string; image?: string }
  locale: Locale
  selected?: boolean
  onToggleSelect?: () => void
  onBook?: () => void
  onClose: () => void
}) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)

  const stageRect = () => stageRef.current?.getBoundingClientRect()
  const zoomBy = (factor: number, cx?: number, cy?: number) => setView((v) => applyZoom(v, clampScale(v.scale * factor), stageRect(), cx, cy))
  const zoomToAbs = (target: number, cx?: number, cy?: number) => setView((v) => applyZoom(v, clampScale(target), stageRect(), cx, cy))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoomBy(1.4)
      if (e.key === '-') zoomBy(1 / 1.4)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  })

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      // pointer is not active (e.g. synthetic events) — panning still works via the handlers below
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale }
      panStart.current = null
    } else if (pointers.current.size === 1 && view.scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }
      setDragging(true)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomToAbs(pinchStart.current.scale * (dist / pinchStart.current.dist))
    } else if (panStart.current && pointers.current.size === 1) {
      const start = panStart.current
      const max = (view.scale - 1) * 160
      const nx = Math.max(-max, Math.min(max, start.ox + (e.clientX - start.x)))
      const ny = Math.max(-max, Math.min(max, start.oy + (e.clientY - start.y)))
      setView((v) => ({ ...v, x: nx, y: ny }))
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) {
      panStart.current = null
      setDragging(false)
    }
  }

  const name = locale === 'vi' ? service.vi : service.en
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-camel-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-[2rem] bg-camel-50 p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-camel-600">{locale === 'vi' ? 'Ảnh kiểu mi' : 'Lash style photo'}</p>
            <h3 className="mt-1.5 font-serif text-2xl text-camel-900">{name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={locale === 'vi' ? 'Đóng' : 'Close'} className="rounded-full border border-camel-200 bg-camel-100 p-2 text-camel-700 transition hover:bg-camel-200"><X size={16} /></button>
        </div>
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => (view.scale > 1.5 ? zoomToAbs(1) : zoomToAbs(2.5, e.clientX, e.clientY))}
          className={`relative mt-4 h-[300px] touch-none select-none overflow-hidden rounded-2xl bg-gradient-to-b from-camel-800 to-camel-950 sm:h-[380px] ${view.scale > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'}`}
        >
          {service.image && <img src={service.image} alt={name} draggable={false} className="absolute inset-0 m-auto max-h-full max-w-full object-contain transition-transform duration-100" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} />}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-camel-50/90 px-2 py-1.5 shadow">
            <button type="button" aria-label={locale === 'vi' ? 'Thu nhỏ' : 'Zoom out'} onClick={() => zoomBy(1 / 1.4)} className="flex h-7 w-7 items-center justify-center rounded-full text-camel-800 transition hover:bg-camel-200"><Minus size={14} /></button>
            <span className="min-w-10 text-center text-xs font-bold text-camel-800">{Math.round(view.scale * 100)}%</span>
            <button type="button" aria-label={locale === 'vi' ? 'Phóng to' : 'Zoom in'} onClick={() => zoomBy(1.4)} className="flex h-7 w-7 items-center justify-center rounded-full text-camel-800 transition hover:bg-camel-200"><Plus size={14} /></button>
            <button type="button" aria-label={locale === 'vi' ? 'Vừa khung' : 'Reset'} onClick={() => zoomToAbs(1)} className="flex h-7 w-7 items-center justify-center rounded-full text-camel-800 transition hover:bg-camel-200"><RotateCcw size={13} /></button>
          </div>
          {view.scale === 1 && <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-camel-50/85 px-2.5 py-1.5 text-[11px] font-semibold text-camel-800"><ZoomIn size={12} />{locale === 'vi' ? 'Cuộn/chụm để phóng to' : 'Scroll/pinch to zoom'}</span>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-camel-500">{locale === 'vi' ? 'Giá dịch vụ' : 'Price'}</p>
            <p className="font-serif text-xl font-semibold text-camel-900">{formatPriceVnd(service.price)}</p>
          </div>
          {onToggleSelect ? (
            <button type="button" onClick={onToggleSelect} className={`rounded-full px-5 py-3 text-sm font-bold transition ${selected ? 'border border-camel-300 bg-camel-100 text-camel-800 hover:bg-camel-200' : 'bg-camel-800 text-camel-50 hover:bg-camel-700'}`}>{selected ? (locale === 'vi' ? 'Bỏ chọn dịch vụ' : 'Remove service') : (locale === 'vi' ? 'Chọn dịch vụ này' : 'Choose this service')}</button>
          ) : onBook ? (
            <button type="button" onClick={onBook} className="rounded-full bg-camel-800 px-5 py-3 text-sm font-bold text-camel-50 transition hover:bg-camel-700">{locale === 'vi' ? 'Đặt lịch ngay' : 'Book now'}<ArrowRight className="ml-2 inline" size={15} /></button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
