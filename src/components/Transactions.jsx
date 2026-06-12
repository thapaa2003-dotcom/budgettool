import React, { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseBelfiusCSV, parseDexxterCSV } from '../lib/csv'
import { CATEGORIEEN } from '../lib/categorize'
import { fmtEUR, fmtDate, todayISO } from '../lib/format'
import { Card, SectionTitle, Badge, Empty } from './ui'

export default function Transactions({ userId, transactions, expected, rules, refresh }) {
  const belfiusRef = useRef(), dexxterRef = useRef()
  const [msg, setMsg] = useState('')
  const [nieuw, setNieuw] = useState({ datum: todayISO(), omschrijving: '', bedrag: '', categorie: 'Diversen' })
  const [nieuwVerwacht, setNieuwVerwacht] = useState({ omschrijving: '', bedrag: '', verwachte_datum: '', type: 'commissie' })
  const [nieuweRegel, setNieuweRegel] = useState({ keyword: '', categorie: 'Diversen' })
  const [filter, setFilter] = useState('')

  const importCSV = async (file, parser, bron) => {
    if (!file) return
    const text = await file.text()
    const rows = parser(text, rules)
    if (!rows.length) { setMsg(`Geen geldige rijen gevonden in ${bron}-bestand. Controleer het formaat.`); return }
    // Dubbels vermijden: zelfde datum + bedrag + omschrijving
    const bestaand = new Set(transactions.map((t) => `${t.datum}|${t.bedrag}|${t.omschrijving}`))
    const uniek = rows.filter((r) => !bestaand.has(`${r.datum}|${r.bedrag}|${r.omschrijving}`))
    if (uniek.length) {
      const { error } = await supabase.from('transactions').insert(uniek.map((r) => ({ ...r, user_id: userId })))
      if (error) { setMsg('Fout bij importeren: ' + error.message); return }
    }
    setMsg(`${uniek.length} transacties geïmporteerd (${rows.length - uniek.length} dubbels overgeslagen).`)
    refresh()
  }

  const addManueel = async () => {
    if (!nieuw.omschrijving || !nieuw.bedrag) return
    await supabase.from('transactions').insert({
      user_id: userId, datum: nieuw.datum, omschrijving: nieuw.omschrijving,
      bedrag: +nieuw.bedrag, categorie: nieuw.categorie, bron: 'manueel',
    })
    setNieuw({ datum: todayISO(), omschrijving: '', bedrag: '', categorie: 'Diversen' })
    refresh()
  }

  const addVerwacht = async () => {
    if (!nieuwVerwacht.bedrag) return
    await supabase.from('expected_income').insert({ ...nieuwVerwacht, bedrag: +nieuwVerwacht.bedrag, user_id: userId, verwachte_datum: nieuwVerwacht.verwachte_datum || null })
    setNieuwVerwacht({ omschrijving: '', bedrag: '', verwachte_datum: '', type: 'commissie' })
    refresh()
  }

  const markeerOntvangen = async (e) => {
    await supabase.from('expected_income').update({ status: 'ontvangen' }).eq('id', e.id)
    await supabase.from('transactions').insert({
      user_id: userId, datum: todayISO(), omschrijving: e.omschrijving || e.type,
      bedrag: +e.bedrag, categorie: e.type === 'commissie' ? 'Beroepsinkomsten' : 'Diversen', bron: 'manueel',
    })
    refresh()
  }

  const updateCategorie = async (t, cat) => {
    await supabase.from('transactions').update({ categorie: cat }).eq('id', t.id)
    refresh()
  }

  const addRegel = async () => {
    if (!nieuweRegel.keyword) return
    await supabase.from('rules').insert({ ...nieuweRegel, user_id: userId })
    setNieuweRegel({ keyword: '', categorie: 'Diversen' })
    refresh()
  }

  const exportCSV = () => {
    const header = 'datum;omschrijving;bedrag;saldo;tegenrekening;categorie;bron'
    const body = transactions.map((t) =>
      [fmtDate(t.datum), t.omschrijving, String(t.bedrag).replace('.', ','), t.saldo ?? '', t.tegenrekening ?? '', t.categorie, t.bron].join(';')
    ).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'confin-transacties.csv'
    a.click()
  }

  const zichtbaar = transactions
    .filter((t) => !filter || t.omschrijving.toLowerCase().includes(filter.toLowerCase()) || t.categorie.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 100)

  return (
    <div>
      <SectionTitle right={<button className="btn-ghost !py-1.5 text-xs" onClick={exportCSV}>Exporteer CSV</button>}>Data invoer</SectionTitle>
      <div className="grid lg:grid-cols-3 gap-3">
        <Card>
          <div className="label">Belfius CSV</div>
          <p className="text-xs muted mb-3">Puntkomma-gescheiden export: datum; omschrijving; bedrag; saldo; tegenrekening.</p>
          <input ref={belfiusRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { importCSV(e.target.files[0], parseBelfiusCSV, 'Belfius'); e.target.value = '' }} />
          <button className="btn-gold w-full" onClick={() => belfiusRef.current.click()}>Upload Belfius export</button>
        </Card>
        <Card>
          <div className="label">Dexxter CSV</div>
          <p className="text-xs muted mb-3">Inkomsten en facturen uit Dexxter, automatisch als beroepsinkomsten geboekt.</p>
          <input ref={dexxterRef} type="file" accept=".csv,.txt" className="hidden"
            onChange={(e) => { importCSV(e.target.files[0], parseDexxterCSV, 'Dexxter'); e.target.value = '' }} />
          <button className="btn-gold w-full" onClick={() => dexxterRef.current.click()}>Upload Dexxter export</button>
        </Card>
        <Card>
          <div className="label">Manuele transactie</div>
          <div className="space-y-2">
            <input className="input" type="date" value={nieuw.datum} onChange={(e) => setNieuw({ ...nieuw, datum: e.target.value })} />
            <input className="input" placeholder="Omschrijving" value={nieuw.omschrijving} onChange={(e) => setNieuw({ ...nieuw, omschrijving: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" type="number" inputMode="decimal" placeholder="Bedrag (− voor uitgave)" value={nieuw.bedrag} onChange={(e) => setNieuw({ ...nieuw, bedrag: e.target.value })} />
              <select className="input !w-40" value={nieuw.categorie} onChange={(e) => setNieuw({ ...nieuw, categorie: e.target.value })}>
                {CATEGORIEEN.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn-gold w-full" onClick={addManueel}>Toevoegen</button>
          </div>
        </Card>
      </div>
      {msg && <p className="text-sm text-gold-400 mt-3">{msg}</p>}

      <SectionTitle>Verwachte inkomsten pipeline</SectionTitle>
      <Card>
        <div className="grid sm:grid-cols-5 gap-2 mb-4">
          <input className="input sm:col-span-2" placeholder="Omschrijving (bv. OVB commissie dossier X)" value={nieuwVerwacht.omschrijving} onChange={(e) => setNieuwVerwacht({ ...nieuwVerwacht, omschrijving: e.target.value })} />
          <input className="input" type="number" placeholder="Bedrag €" value={nieuwVerwacht.bedrag} onChange={(e) => setNieuwVerwacht({ ...nieuwVerwacht, bedrag: e.target.value })} />
          <input className="input" type="date" value={nieuwVerwacht.verwachte_datum} onChange={(e) => setNieuwVerwacht({ ...nieuwVerwacht, verwachte_datum: e.target.value })} />
          <div className="flex gap-2">
            <select className="input" value={nieuwVerwacht.type} onChange={(e) => setNieuwVerwacht({ ...nieuwVerwacht, type: e.target.value })}>
              <option value="commissie">OVB commissie</option>
              <option value="belasting">Belastingteruggave</option>
              <option value="mutualiteit">Mutualiteit</option>
              <option value="andere">Andere</option>
            </select>
            <button className="btn-gold" onClick={addVerwacht}>+</button>
          </div>
        </div>
        {expected.filter((e) => e.status === 'verwacht').length ? expected.filter((e) => e.status === 'verwacht').map((e) => (
          <div key={e.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm gap-2">
            <span className="truncate">{e.omschrijving || e.type} <Badge tone="blue">{e.type}</Badge></span>
            <span className="whitespace-nowrap">{fmtEUR(e.bedrag)} · {fmtDate(e.verwachte_datum)}</span>
            <button className="btn-ghost !py-1 !px-2 text-xs whitespace-nowrap" onClick={() => markeerOntvangen(e)}>Ontvangen ✓</button>
          </div>
        )) : <Empty>Geen openstaande verwachte inkomsten.</Empty>}
      </Card>

      <SectionTitle>Categorisatieregels</SectionTitle>
      <Card>
        <div className="flex gap-2 mb-3">
          <input className="input" placeholder="Trefwoord (bv. okay)" value={nieuweRegel.keyword} onChange={(e) => setNieuweRegel({ ...nieuweRegel, keyword: e.target.value })} />
          <select className="input !w-44" value={nieuweRegel.categorie} onChange={(e) => setNieuweRegel({ ...nieuweRegel, categorie: e.target.value })}>
            {CATEGORIEEN.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn-gold" onClick={addRegel}>+</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {rules.map((r) => (
            <span key={r.id} className="text-xs glass !rounded-full px-3 py-1.5 flex items-center gap-2">
              {r.keyword} → {r.categorie}
              <button className="text-red-400" onClick={async () => { await supabase.from('rules').delete().eq('id', r.id); refresh() }}>×</button>
            </span>
          ))}
          {!rules.length && <span className="text-xs muted">Eigen regels krijgen voorrang op de standaardregels (Delhaize → Voeding, OVB → Beroepsinkomsten, …).</span>}
        </div>
      </Card>

      <SectionTitle right={<input className="input !w-48 !py-1.5 text-xs" placeholder="Zoeken…" value={filter} onChange={(e) => setFilter(e.target.value)} />}>
        Transacties ({transactions.length})
      </SectionTitle>
      <Card className="!p-0 overflow-hidden">
        {zichtbaar.length ? (
          <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
            {zichtbaar.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="muted text-xs w-20 shrink-0">{fmtDate(t.datum)}</span>
                <span className="flex-1 truncate">{t.omschrijving}</span>
                <select className="input !w-36 !py-1 text-xs shrink-0" value={t.categorie} onChange={(e) => updateCategorie(t, e.target.value)}>
                  {CATEGORIEEN.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span className={`w-24 text-right font-medium shrink-0 ${t.bedrag >= 0 ? 'text-emerald-400' : ''}`}>{fmtEUR(t.bedrag)}</span>
              </div>
            ))}
          </div>
        ) : <Empty>Nog geen transacties. Upload een Belfius of Dexxter export hierboven.</Empty>}
      </Card>
    </div>
  )
}
