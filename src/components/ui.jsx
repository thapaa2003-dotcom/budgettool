import React, { useEffect, useState } from 'react'

export const Card = ({ children, className = '' }) => (
  <div className={`glass p-5 ${className}`}>{children}</div>
)

export const Stat = ({ label, value, sub, accent }) => (
  <Card>
    <div className="label">{label}</div>
    <div className={`text-2xl font-bold tracking-tight ${accent || ''}`}>{value}</div>
    {sub && <div className="text-xs muted mt-1">{sub}</div>}
  </Card>
)

export const Progress = ({ pct, color = 'bg-gold-500' }) => (
  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
  </div>
)

export const Badge = ({ children, tone = 'gold' }) => {
  const tones = {
    gold: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    blue: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  }
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${tones[tone]}`}>{children}</span>
}

export const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between mb-3 mt-8 first:mt-0">
    <h2 className="text-lg font-bold tracking-tight">{children}</h2>
    {right}
  </div>
)

// Halve-cirkel gauge (noodfonds)
export const Gauge = ({ pct, label }) => {
  const p = Math.min(100, Math.max(0, pct))
  const angle = (p / 100) * 180
  const r = 70, cx = 90, cy = 85
  const rad = ((180 - angle) * Math.PI) / 180
  const x = cx + r * Math.cos(rad), y = cy - r * Math.sin(rad)
  const large = angle > 180 ? 1 : 0
  return (
    <svg viewBox="0 0 180 100" className="w-full max-w-[240px] mx-auto">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round" />
      {p > 0 && <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${large} 1 ${x} ${y}`} fill="none" stroke={p >= 100 ? '#34d399' : '#f0b429'} strokeWidth="14" strokeLinecap="round" />}
      <text x={cx} y={cy - 14} textAnchor="middle" className="fill-current" fontSize="22" fontWeight="800">{Math.round(p)}%</text>
      <text x={cx} y={cy + 4} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9">{label}</text>
    </svg>
  )
}

export function Confetti({ trigger }) {
  const [pieces, setPieces] = useState([])
  useEffect(() => {
    if (!trigger) return
    const colors = ['#f0b429', '#34d399', '#60a5fa', '#f87171', '#a78bfa', '#ffffff']
    const ps = Array.from({ length: 80 }, (_, i) => ({
      id: i + '-' + Date.now(),
      left: Math.random() * 100,
      color: colors[i % colors.length],
      dur: 2 + Math.random() * 2,
      delay: Math.random() * 0.6,
    }))
    setPieces(ps)
    const t = setTimeout(() => setPieces([]), 4500)
    return () => clearTimeout(t)
  }, [trigger])
  return (
    <>
      {pieces.map((p) => (
        <div key={p.id} className="confetti-piece" style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, borderRadius: Math.random() > 0.5 ? '50%' : '2px' }} />
      ))}
    </>
  )
}

export const Empty = ({ children }) => (
  <div className="text-center py-10 muted text-sm">{children}</div>
)
