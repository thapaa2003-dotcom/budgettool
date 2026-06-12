export const fmtEUR = (n, digits = 2) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n || 0)

export const fmtEUR0 = (n) => fmtEUR(n, 0)

// ISO (yyyy-mm-dd) -> DD/MM/YYYY
export const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// DD/MM/YYYY -> ISO
export const parseBEDate = (s) => {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// "1.234,56" of "1234.56" -> number
export const parseBedrag = (s) => {
  if (typeof s === 'number') return s
  if (!s) return 0
  let t = String(s).replace(/\s|€/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}

export const todayISO = () => new Date().toISOString().slice(0, 10)
export const monthKey = (iso) => String(iso).slice(0, 7)
export const monthLabel = (key) => {
  const [y, m] = key.split('-')
  const names = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${names[+m - 1]} '${y.slice(2)}`
}
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)
export const addDays = (iso, n) => {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
