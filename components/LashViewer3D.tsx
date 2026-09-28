'use client'

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ArrowRight, Orbit, X } from 'lucide-react'
import { formatPriceVnd } from '@/lib/booking'

type Locale = 'vi' | 'en'

type LashConfig = {
  count: number
  baseLength: number
  profile?: (t: number) => number
  curl: number
  lift?: number
  liftFrom?: number
  thickness: number
  layers?: number[]
  forkFrom?: number
  lidTilt?: number
}

// curl = how much the tip rises (fraction of length along world-up), lift = extra rise toward the outer corner.
const lashConfigs: Record<string, LashConfig> = {
  'Anime Douyin': { count: 72, baseLength: 0.44, profile: (t) => 0.8 + 0.6 * t, curl: 0.52, lift: 0.5, liftFrom: 0.4, thickness: 0.0115 },
  'Mi Đuôi Cá': { count: 40, baseLength: 0.44, profile: (t) => 0.85 + 0.55 * t, curl: 0.48, lift: 0.25, forkFrom: 0.58, thickness: 0.011 },
  Foxy: { count: 44, baseLength: 0.48, profile: (t) => 0.72 + 0.9 * t, curl: 0.5, lift: 0.65, liftFrom: 0.35, thickness: 0.011, lidTilt: -0.1 },
  Ulzang: { count: 52, baseLength: 0.4, profile: (t) => 0.92 + 0.3 * Math.sin(t * Math.PI), curl: 0.38, lift: 0.15, thickness: 0.01 },
  Volum: { count: 84, baseLength: 0.38, profile: (t) => 0.85 + 0.4 * t, curl: 0.52, lift: 0.2, thickness: 0.008 },
  Katun: { count: 54, baseLength: 0.42, profile: (t) => 0.9 + 0.25 * t, curl: 0.52, lift: 0.25, thickness: 0.01 },
  'Mi Da Tầng': { count: 38, baseLength: 0.5, profile: (t) => 0.8 + 0.55 * t, curl: 0.48, lift: 0.3, layers: [0.55], thickness: 0.011 },
  'Fox eyes': { count: 44, baseLength: 0.52, profile: (t) => 0.68 + 0.95 * t * t, curl: 0.44, lift: 0.85, liftFrom: 0.3, thickness: 0.011, lidTilt: -0.16 },
  Anime: { count: 52, baseLength: 0.42, profile: (t) => 0.72 + 0.42 * Math.abs(Math.sin(t * Math.PI * 3.2)), curl: 0.55, lift: 0.3, thickness: 0.0115 },
  Classic: { count: 58, baseLength: 0.35, curl: 0.48, lift: 0.2, thickness: 0.009 },
  'Anime Baby': { count: 62, baseLength: 0.28, profile: (t) => 0.88 + 0.35 * Math.sin(t * Math.PI), curl: 0.6, lift: 0.1, thickness: 0.009, lidTilt: 0.06 },
  Sole: { count: 46, baseLength: 0.32, profile: (t) => 0.85 + 0.35 * t, curl: 0.42, lift: 0.2, thickness: 0.0085 },
}

// Upper lash line: almond curve from inner corner (t=0) to outer corner (t=1), projected onto the eyeball.
function lashLinePoint(t: number, squash = 1) {
  const inner = new THREE.Vector3(-0.99, -0.12, 0.12)
  const top = new THREE.Vector3(0, 0.66 * squash, 0.585)
  const outer = new THREE.Vector3(0.99, -0.08, 0.12)
  const a = inner.clone().lerp(top, t)
  const b = top.clone().lerp(outer, t)
  return a.lerp(b, t).normalize()
}

function jitter(i: number, scale: number) {
  const v = Math.sin(i * 12.9898) * 43758.5453
  return (v - Math.floor(v) - 0.5) * 2 * scale
}

function bezier(p0: number[], p1: number[], p2: number[]) {
  return (t: number) => {
    const a = new THREE.Vector3(...p0).lerp(new THREE.Vector3(...p1), t)
    const b = new THREE.Vector3(...p1).lerp(new THREE.Vector3(...p2), t)
    return a.lerp(b, t).normalize()
  }
}

// Skin band stretched from the lash line up to the lid crease — gives a true almond eye outline.
function lidBandGeometry(lash: (t: number) => THREE.Vector3, crease: (t: number) => THREE.Vector3, s0: number, s1: number) {
  const cols = 72
  const rows = 8
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= rows; i++) {
    const s = s0 + (s1 - s0) * (i / rows)
    for (let j = 0; j <= cols; j++) {
      const t = j / cols
      const p = lash(t).lerp(crease(t), s).normalize().multiplyScalar(1.0 + 0.05 * s)
      positions.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const r0 = i * (cols + 1) + j
      const r1 = r0 + cols + 1
      indices.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

function buildLashRow(opts: { ts: number[]; length: (t: number) => number; curl: number; lift: number; liftFrom: number; thickness: number; forkFrom?: number; baseScale?: number }): THREE.BufferGeometry[] {
  const { ts, length, curl, lift, liftFrom, thickness, forkFrom, baseScale = 1 } = opts
  const geoms: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  ts.forEach((tRaw, i) => {
    const t = Math.min(0.97, Math.max(0.03, tRaw + jitter(i, 0.008)))
    const base = lashLinePoint(t, baseScale)
    const radial = base.clone().normalize()
    const len = Math.max(0.1, length(t) * (1 + jitter(i + 7, 0.06)))
    const liftT = Math.max(0, (t - liftFrom) / (1 - liftFrom))
    const strand = (side: number, lenMul: number) => {
      const dir = radial.clone().multiplyScalar(0.55).add(up.clone().multiplyScalar(curl + lift * liftT * liftT)).add(new THREE.Vector3(side, 0, 0)).normalize()
      const L = len * lenMul
      const mid = base.clone().add(radial.clone().multiplyScalar(L * 0.4))
      const tip = base.clone().add(dir.multiplyScalar(L))
      const curve = new THREE.CatmullRomCurve3([base.clone(), mid, tip])
      geoms.push(new THREE.TubeGeometry(curve, 10, thickness * (0.85 + 0.3 * ((i % 3) / 2)), 5, false))
    }
    if (forkFrom !== undefined && t > forkFrom) {
      strand(-0.2, 0.68)
      strand(0.24, 1)
    } else {
      strand(0, 1)
    }
  })
  return geoms
}

function makeIrisTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const ctx = c.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, '#0d0906')
  grad.addColorStop(0.28, '#170e08')
  grad.addColorStop(0.32, '#7a5a38')
  grad.addColorStop(0.55, '#8a6238')
  grad.addColorStop(0.78, '#4a3018')
  grad.addColorStop(0.9, '#241608')
  grad.addColorStop(1, '#160d05')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < 110; i++) {
    const x = (i / 110) * c.width + jitter(i, 3)
    ctx.strokeStyle = i % 2 ? 'rgba(210,170,110,0.16)' : 'rgba(30,18,8,0.2)'
    ctx.lineWidth = 1.5 + jitter(i + 3, 1)
    ctx.beginPath()
    ctx.moveTo(x, c.height * 0.31)
    ctx.lineTo(x + jitter(i + 11, 6), c.height * 0.92)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function EyeModel({ config }: { config: LashConfig }) {
  const irisTex = useMemo(makeIrisTexture, [])
  const lashMeshes = useMemo(() => {
    const mainTs = Array.from({ length: config.count }, (_, i) => 0.02 + (0.96 * i) / (config.count - 1))
    const rows: { ts: number[]; lenMul: number; thMul: number; baseScale: number; fork: boolean }[] = [
      { ts: mainTs, lenMul: 1, thMul: 1, baseScale: 1, fork: true },
      ...(config.layers ?? []).map((m) => ({ ts: mainTs.map((t) => t + 0.015), lenMul: m, thMul: 0.8, baseScale: 0.93, fork: false })),
    ]
    return rows.map((row) => mergeGeometries(buildLashRow({
      ts: row.ts,
      length: (t) => config.baseLength * row.lenMul * (config.profile ? config.profile(t) : 1),
      curl: config.curl,
      lift: config.lift ?? 0,
      liftFrom: config.liftFrom ?? 0.45,
      thickness: config.thickness * row.thMul,
      forkFrom: row.fork ? config.forkFrom : undefined,
      baseScale: row.baseScale,
    }))!)
  }, [config])
  const lidGeos = useMemo(() => {
    const upperLash = bezier([-0.99, -0.12, 0.12], [0, 0.66, 0.585], [0.99, -0.08, 0.12])
    const upperCrease = bezier([-1.02, 0.14, 0.02], [0, 1.05, 0.02], [1.02, 0.18, 0.02])
    const lowerLash = bezier([-0.99, -0.12, 0.12], [0, -0.55, 0.68], [0.99, -0.08, 0.12])
    const lowerCrease = bezier([-1.0, -0.42, 0.02], [0, -1.0, 0.05], [1.0, -0.38, 0.02])
    return {
      liner: lidBandGeometry(upperLash, upperCrease, 0, 0.09),
      upper: lidBandGeometry(upperLash, upperCrease, 0.09, 1),
      lower: lidBandGeometry(lowerLash, lowerCrease, 0, 1),
      backTop: new THREE.SphereGeometry(1.02, 32, 16, 0, Math.PI * 2, 0, 0.55),
      backBottom: new THREE.SphereGeometry(1.02, 32, 16, 0, Math.PI * 2, Math.PI - 0.55, 0.55),
      backSkin: new THREE.SphereGeometry(1.015, 48, 32, Math.PI, Math.PI, 0, Math.PI),
    }
  }, [])
  useEffect(() => () => {
    lashMeshes.forEach((g) => g.dispose())
    Object.values(lidGeos).forEach((g) => g.dispose())
    irisTex.dispose()
  }, [lashMeshes, lidGeos, irisTex])
  return (
    <group rotation={[0, 0, config.lidTilt ?? 0]}>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial color="#f6efe7" roughness={0.45} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[1.004, 48, 24, 0, Math.PI * 2, 0, 0.55]} />
        <meshStandardMaterial map={irisTex} roughness={0.25} />
      </mesh>
      <mesh position={[0.15, 0.2, 0.93]}>
        <circleGeometry args={[0.055, 16]} />
        <meshBasicMaterial color="#fffdf6" />
      </mesh>
      <mesh geometry={lidGeos.liner}><meshStandardMaterial color="#33210f" roughness={0.55} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={lidGeos.upper}><meshStandardMaterial color="#e9c19a" roughness={0.65} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={lidGeos.lower}><meshStandardMaterial color="#e2b389" roughness={0.65} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={lidGeos.backTop}><meshStandardMaterial color="#e9c19a" roughness={0.65} /></mesh>
      <mesh geometry={lidGeos.backBottom}><meshStandardMaterial color="#e2b389" roughness={0.65} /></mesh>
      <mesh geometry={lidGeos.backSkin}><meshStandardMaterial color="#e9c19a" roughness={0.65} side={THREE.DoubleSide} /></mesh>
      {lashMeshes.map((geo, i) => (
        <mesh key={`lashes-${i}`} geometry={geo}>
          <meshStandardMaterial color="#241812" roughness={0.55} metalness={0.1} />
        </mesh>
      ))}
    </group>
  )
}

export default function LashViewerModal({ service, locale, selected = false, onToggleSelect, onBook, onClose }: {
  service: { vi: string; en: string; price: string }
  locale: Locale
  selected?: boolean
  onToggleSelect?: () => void
  onBook?: () => void
  onClose: () => void
}) {
  const [dragged, setDragged] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const config = lashConfigs[service.vi] ?? lashConfigs['Katun']
  const name = locale === 'vi' ? service.vi : service.en
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-camel-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[2rem] bg-camel-50 p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-camel-600">{locale === 'vi' ? 'Xem trước kiểu mi' : 'Lash style preview'}</p>
            <h3 className="mt-1.5 font-serif text-2xl text-camel-900">{name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={locale === 'vi' ? 'Đóng' : 'Close'} className="rounded-full border border-camel-200 bg-camel-100 p-2 text-camel-700 transition hover:bg-camel-200"><X size={16} /></button>
        </div>
        <div className="relative mt-4 h-[300px] overflow-hidden rounded-2xl bg-gradient-to-b from-camel-800 to-camel-950 sm:h-[340px]">
          <Canvas camera={{ position: [0, 0.15, 4.2], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[2.5, 3, 4]} intensity={1.2} color="#fff4e2" />
            <directionalLight position={[-3, 1, 2.5]} intensity={0.4} color="#efe4ff" />
            <directionalLight position={[0, -2, -3]} intensity={0.3} />
            <EyeModel config={config} />
            <OrbitControls makeDefault enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08} autoRotate autoRotateSpeed={1.1} minPolarAngle={Math.PI * 0.28} maxPolarAngle={Math.PI * 0.6} onStart={() => setDragged(true)} />
          </Canvas>
          {!dragged && <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-camel-50/90 px-3.5 py-2 text-xs font-semibold text-camel-800 shadow"><Orbit size={14} />{locale === 'vi' ? 'Kéo để xoay 360°' : 'Drag to rotate 360°'}</div>}
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
