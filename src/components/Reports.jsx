import React, { useMemo, useState } from 'react'
import { Card, SectionTitle, Empty } from './ui'
import { fmtEUR0, monthLabel, monthKey } from '../lib/format'
import { groupByMonth, byCategory } from '../lib/calc'

export default function Reports({ profile, transactions }) {
  const maanden = useMemo(() => groupByMonth(transactions), [transactions])
  const [sel, setSel] = useState(maanden.length ? maanden[maanden.length - 1].maand : monthKey(new Date().toISOString()))

  const m = maanden.find((x) => x.maand === sel)
  const vorigeIdx = maanden.findIndex((x) => x.maand === sel) - 1
  const vorige = vorigeIdx >= 0 ? maanden[vorigeIdx] : null

  const txM = transactions.filter((t) => monthKey(t.datum) === sel)
  const cats = byCategory(txM)
  const txVorige = vorige ? transactions.filter((t) => monthKey(t.datum) === vorige.maand) : []
  const catsVorige = byCategory(txVorige)

  const highlights = []
  const verbeterpunten = []
  if (m) {
    const overschot = m.inkomsten - m.uitgaven
    if (overschot > 0) highlights.push(`Je hield ${fmtEUR0(overschot)} over deze maand.`)
    else verbeterpunten.push(`Je gaf ${fmtEUR0(-overschot)} meer uit dan er binnenkwam.`)
    for (const c of cats.slice(0, 3)) {
      const prev = catsVorige.find((x) => x.name === c.name)?.value || 0
      if (prev > 0 && c.value < prev * 0.85) highlights.push(`${c.name} daalde met ${fmtEUR0(prev - c.value)} t.o.v. vorige maand.`)
      if (prev > 0 && c.value > prev * 1.25) verbeterpunten.push(`${c.name} steeg met ${fmtEUR0(c.value - prev)} t.o.v. vorige maand.`)
    }
    if (vorige && m.inkomsten > vorige.inkomsten) highlights.push(`Inkomsten stegen van ${fmtEUR0(vorige.inkomsten)} naar ${fmtEUR0(m.inkomsten)}.`)
    if (cats[0]) verbeterpunten.push(`Grootste uitgavenpost: ${cats[0].name} (${fmtEUR0(cats[0].value)}). Hier zit je grootste hefboom.`)
  }

  return (
    <div>
      <SectionTitle right={
        <div className="flex gap-2 no-print">
          <select className="input !w-36 !py-1.5 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
            {maanden.map((x) => <option key={x.maand} value={x.maand}>{monthLabel(x.maand)}</option>)}
          </select>
          <button className="btn-gold !py-1.5 text-sm" onClick={() => window.print()}>Download PDF</button>
        </div>
      }>Maandrapport</SectionTitle>

      {!m ? <Empty>Nog geen data voor een maandrapport. Importeer eerst transacties.</Empty> : (
        <div id="rapport">
          <Card>
            <h2 className="text-2xl font-extrabold">Hoe was {monthLabel(sel)}{profile.naam ? `, ${profile.naam}` : ''}?</h2>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div><div className="label">Inkomsten</div><div className="text-xl font-bold text-emerald-400">{fmtEUR0(m.inkomsten)}</div></div>
              <div><div className="label">Uitgaven</div><div className="text-xl font-bold text-red-400">{fmtEUR0(m.uitgaven)}</div></div>
              <div><div className="label">Saldo</div><div className={`text-xl font-bold ${m.inkomsten - m.uitgaven >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmtEUR0(m.inkomsten - m.uitgaven)}</div></div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-3 mt-3">
            <Card>
              <div className="label">✨ Highlights</div>
              {highlights.length ? highlights.map((h, i) => <p key={i} className="text-sm py-1.5 border-b border-white/5 last:border-0">{h}</p>) : <p className="text-sm muted">Geen uitgesproken highlights deze maand.</p>}
            </Card>
            <Card>
              <div className="label">🎯 Verbeterpunten</div>
              {verbeterpunten.length ? verbeterpunten.map((h, i) => <p key={i} className="text-sm py-1.5 border-b border-white/5 last:border-0">{h}</p>) : <p className="text-sm muted">Niets opvallends. Goed bezig.</p>}
            </Card>
          </div>

          <Card className="mt-3">
            <div className="label">Vergelijking met {vorige ? monthLabel(vorige.maand) : 'vorige maand'}</div>
            {vorige ? (
              <div className="text-sm space-y-1.5 mt-1">
                {[['Inkomsten', vorige.inkomsten, m.inkomsten], ['Uitgaven', vorige.uitgaven, m.uitgaven]].map(([l, a, b]) => (
                  <div key={l} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                    <span className="muted">{l}</span>
                    <span>{fmtEUR0(a)} → <b>{fmtEUR0(b)}</b> <span className={`text-xs ${(l === 'Uitgaven' ? b <= a : b >= a) ? 'text-emerald-400' : 'text-red-400'}`}>({b - a >= 0 ? '+' : ''}{fmtEUR0(b - a)})</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm muted">Geen vorige maand om mee te vergelijken.</p>}
          </Card>

          <Card className="mt-3">
            <div className="label">Uitgaven per categorie</div>
            {cats.map((c) => (
              <div key={c.name} className="flex justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                <span>{c.name}</span><b>{fmtEUR0(c.value)}</b>
              </div>
            ))}
          </Card>
        </div>
      )}
      <p className="text-xs muted mt-3 no-print">Tip: "Download PDF" opent het printvenster. Kies daar "Opslaan als PDF".</p>
    </div>
  )
}
