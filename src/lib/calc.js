import { monthKey } from './format'

// Indicatieve parameters, jaarlijks geïndexeerd. Controleer met je sociaal verzekeringsfonds.
export const PCT_SOCIALE_BIJDRAGEN = 0.205
export const PCT_BELASTINGPROVISIE = 0.28
export const BTW_VRIJSTELLINGSGRENS = 25000
export const VAPZ_PCT = 0.0817
export const VAPZ_PLAFOND = 4075
export const PEER_BENCHMARK = {
  student: { Voeding: 280, Wonen: 460, Transport: 80, 'Uit eten': 110, Abonnementen: 40, Gezondheid: 35, Diversen: 120 },
  zelfstandig: { Voeding: 340, Wonen: 850, Transport: 220, 'Uit eten': 160, Abonnementen: 60, Gezondheid: 70, Diversen: 200 },
}

export const sumSnapshot = (s = {}) => {
  const activa = ['zicht', 'spaar', 'tak21', 'tak23', 'aandelen', 'crypto', 'pensioensparen', 'leningen_uit']
    .reduce((a, k) => a + (+s[k] || 0), 0)
  const passiva = +s.schulden || 0
  return { activa, passiva, netto: activa - passiva, liquide: (+s.zicht || 0) + (+s.spaar || 0) }
}

export const vasteKostenTotaal = (vk = []) => vk.reduce((a, k) => a + (+k.bedrag || 0), 0)

export function groupByMonth(transactions) {
  const map = {}
  for (const t of transactions) {
    const k = monthKey(t.datum)
    if (!map[k]) map[k] = { maand: k, inkomsten: 0, uitgaven: 0 }
    if (t.bedrag >= 0) map[k].inkomsten += t.bedrag
    else map[k].uitgaven += -t.bedrag
  }
  return Object.values(map).sort((a, b) => a.maand.localeCompare(b.maand))
}

export function byCategory(transactions) {
  const map = {}
  for (const t of transactions) {
    if (t.bedrag >= 0) continue
    map[t.categorie] = (map[t.categorie] || 0) + -t.bedrag
  }
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

export function movingAvgIncome(months, n = 3) {
  return months.map((m, i) => {
    const slice = months.slice(Math.max(0, i - n + 1), i + 1)
    return { ...m, gemiddeld: slice.reduce((a, x) => a + x.inkomsten, 0) / slice.length }
  })
}

// Gezondheidsscore 0-100 met breakdown
export function healthScore({ avgInkomsten, avgUitgaven, liquide, vasteKosten, schulden, incomeStd }) {
  const spaarquote = avgInkomsten > 0 ? Math.max(0, (avgInkomsten - avgUitgaven) / avgInkomsten) : 0
  const sSpaar = Math.min(30, Math.round(spaarquote / 0.25 * 30))
  const runway = vasteKosten > 0 ? liquide / vasteKosten : 6
  const sNood = Math.min(30, Math.round(runway / 6 * 30))
  const schuldRatio = liquide > 0 ? schulden / liquide : schulden > 0 ? 2 : 0
  const sSchuld = Math.max(0, Math.round(20 - Math.min(20, schuldRatio * 20)))
  const cv = avgInkomsten > 0 ? incomeStd / avgInkomsten : 0
  const sStabiel = Math.max(0, Math.round(20 - Math.min(20, cv * 20)))
  return {
    totaal: sSpaar + sNood + sSchuld + sStabiel,
    breakdown: [
      { naam: 'Spaarquote', score: sSpaar, max: 30 },
      { naam: 'Noodfonds', score: sNood, max: 30 },
      { naam: 'Schulden', score: sSchuld, max: 20 },
      { naam: 'Inkomensstabiliteit', score: sStabiel, max: 20 },
    ],
  }
}

export function stdDev(arr) {
  if (arr.length < 2) return 0
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}

// Volgende kwartaaldeadline sociale bijdragen
export function nextQuarterDeadline(now = new Date()) {
  const y = now.getFullYear()
  const deadlines = [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`, `${y + 1}-03-31`]
  const today = now.toISOString().slice(0, 10)
  return deadlines.find((d) => d >= today)
}

export function quarterDeadlines(now = new Date()) {
  const y = now.getFullYear()
  return [`${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`]
}

// 90-dagen cashflow forecast
export function forecast90({ startSaldo, vasteKosten, avgDagVariabel, expected, startDate }) {
  const out = []
  let saldo = startSaldo
  for (let i = 0; i < 90; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    if (d.getDate() === 1) saldo -= vasteKosten
    saldo -= avgDagVariabel
    for (const e of expected) if (e.verwachte_datum === iso && e.status === 'verwacht') saldo += +e.bedrag
    out.push({ datum: iso, saldo: Math.round(saldo) })
  }
  return out
}

// Terugkerende uitgaven per "merchant" over >= 3 maanden
export function recurringSpending(transactions) {
  const map = {}
  for (const t of transactions) {
    if (t.bedrag >= 0) continue
    const key = (t.omschrijving || '').toLowerCase().split(/[\s\d]/)[0]
    if (!key || key.length < 3) continue
    if (!map[key]) map[key] = { naam: key, maanden: new Set(), totaal: 0, n: 0 }
    map[key].maanden.add(monthKey(t.datum))
    map[key].totaal += -t.bedrag
    map[key].n++
  }
  return Object.values(map)
    .filter((m) => m.maanden.size >= 3)
    .map((m) => ({ naam: m.naam, maanden: m.maanden.size, perMaand: m.totaal / m.maanden.size, totaal: m.totaal }))
    .sort((a, b) => b.perMaand - a.perMaand)
    .slice(0, 6)
}

// Impulsaankopen: uitgave > 2x mediaan van de categorie, in vrije-tijd categorieën
export function impulsePurchases(transactions) {
  const cats = ['Uit eten', 'Diversen']
  const byCat = {}
  for (const t of transactions) {
    if (t.bedrag >= 0 || !cats.includes(t.categorie)) continue
    ;(byCat[t.categorie] = byCat[t.categorie] || []).push(t)
  }
  const out = []
  for (const c of Object.keys(byCat)) {
    const arr = byCat[c].map((t) => -t.bedrag).sort((a, b) => a - b)
    const med = arr[Math.floor(arr.length / 2)] || 0
    for (const t of byCat[c]) if (-t.bedrag > Math.max(40, med * 2)) out.push(t)
  }
  return out.sort((a, b) => a.bedrag - b.bedrag).slice(0, 8)
}
