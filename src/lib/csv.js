import { parseBEDate, parseBedrag } from './format'
import { categorize } from './categorize'

// Belfius export: puntkomma-gescheiden, DD/MM/YYYY
// kolommen (in willekeurige volgorde, header gedetecteerd): datum;omschrijving;bedrag;saldo;tegenrekening
export function parseBelfiusCSV(text, userRules = []) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const header = lines[0].toLowerCase().split(';').map((h) => h.trim().replace(/"/g, ''))
  const idx = (names) => header.findIndex((h) => names.some((n) => h.includes(n)))
  let iDatum = idx(['datum', 'boekingsdatum'])
  let iOms = idx(['omschrijving', 'mededeling', 'transactie'])
  let iBedrag = idx(['bedrag'])
  let iSaldo = idx(['saldo', 'rekeningstand'])
  let iTegen = idx(['tegenrekening', 'rekening tegenpartij', 'tegenpartij'])
  let start = 1
  // Geen header gevonden: neem vaste volgorde datum;omschrijving;bedrag;saldo;tegenrekening
  if (iDatum < 0 || iBedrag < 0) { iDatum = 0; iOms = 1; iBedrag = 2; iSaldo = 3; iTegen = 4; start = 0 }

  const rows = []
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(';').map((c) => c.trim().replace(/^"|"$/g, ''))
    const datum = parseBEDate(cols[iDatum])
    if (!datum) continue
    const omschrijving = cols[iOms] || ''
    rows.push({
      datum,
      omschrijving,
      bedrag: parseBedrag(cols[iBedrag]),
      saldo: iSaldo >= 0 ? parseBedrag(cols[iSaldo]) : null,
      tegenrekening: iTegen >= 0 ? cols[iTegen] || null : null,
      categorie: categorize(omschrijving, userRules),
      bron: 'belfius',
    })
  }
  return rows
}

// Dexxter export voor inkomsten/facturen: datum;omschrijving/klant;bedrag (komma of puntkomma)
export function parseDexxterCSV(text, userRules = []) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0].toLowerCase().split(sep)
  const hasHeader = header.some((h) => /datum|bedrag|klant|factuur|omschrijving/.test(h))
  const idx = (re, fb) => { const i = header.findIndex((h) => re.test(h)); return i >= 0 ? i : fb }
  const iDatum = hasHeader ? idx(/datum/, 0) : 0
  const iOms = hasHeader ? idx(/omschrijving|klant|factuur/, 1) : 1
  const iBedrag = hasHeader ? idx(/bedrag|totaal/, 2) : 2

  const rows = []
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const datum = parseBEDate(cols[iDatum]) || (/^\d{4}-\d{2}-\d{2}/.test(cols[iDatum]) ? cols[iDatum].slice(0, 10) : null)
    if (!datum) continue
    const bedrag = Math.abs(parseBedrag(cols[iBedrag]))
    if (!bedrag) continue
    const omschrijving = cols[iOms] || 'Dexxter inkomst'
    rows.push({
      datum, omschrijving, bedrag, saldo: null, tegenrekening: null,
      categorie: categorize(omschrijving, userRules) === 'Diversen' ? 'Beroepsinkomsten' : categorize(omschrijving, userRules),
      bron: 'dexxter',
    })
  }
  return rows
}
