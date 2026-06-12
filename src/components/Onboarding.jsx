import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtEUR0 } from '../lib/format'
import { vasteKostenTotaal } from '../lib/calc'
import { Card, Progress } from './ui'

const SNAPSHOT_VELDEN = [
  ['zicht', 'Zichtrekening'], ['spaar', 'Spaarrekening(en)'], ['tak21', 'Beleggingen tak 21'],
  ['tak23', 'Beleggingen tak 23'], ['aandelen', 'Aandelen / ETF'], ['crypto', 'Crypto'],
  ['pensioensparen', 'Pensioensparen'], ['schulden', 'Schulden'], ['leningen_uit', 'Leningen uitgestaan'],
]

export default function Onboarding({ userId, onDone }) {
  const [step, setStep] = useState(1)
  const [naam, setNaam] = useState('')
  const [statuut, setStatuut] = useState('student')
  const [overgang, setOvergang] = useState('2026-09-01')
  const [snapshot, setSnapshot] = useState({})
  const [kosten, setKosten] = useState([
    { naam: 'Huur', bedrag: '' }, { naam: 'Abonnementen', bedrag: '' },
    { naam: 'Telefoon', bedrag: '' }, { naam: 'Verzekeringen', bedrag: '' },
  ])
  const [doelen, setDoelen] = useState([{ naam: '', doelbedrag: '', deadline: '', huidig: '' }])
  const [busy, setBusy] = useState(false)

  const vk = vasteKostenTotaal(kosten)
  const overlevingsbudget = Math.round(vk * 1.25)

  const save = async (skip = false) => {
    setBusy(true)
    await supabase.from('profiles').upsert({
      id: userId,
      naam, statuut,
      overgangsdatum: overgang || null,
      vaste_kosten: kosten.filter((k) => k.naam && +k.bedrag > 0).map((k) => ({ naam: k.naam, bedrag: +k.bedrag })),
      snapshot: Object.fromEntries(Object.entries(snapshot).map(([k, v]) => [k, +v || 0])),
      onboarded: true,
    })
    if (!skip) {
      const valid = doelen.filter((d) => d.naam && +d.doelbedrag > 0)
      if (valid.length) {
        await supabase.from('goals').insert(valid.map((d) => ({
          user_id: userId, naam: d.naam, doelbedrag: +d.doelbedrag,
          deadline: d.deadline || null, huidig: +d.huidig || 0,
        })))
      }
    }
    setBusy(false)
    onDone()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm muted">Stap {step} van 5</span>
          <button className="text-sm muted hover:text-gold-400" onClick={() => save(true)}>Overslaan</button>
        </div>
        <Progress pct={(step / 5) * 100} />
        <Card className="mt-4 space-y-5">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold">Welkom 👋</h2>
              <div><label className="label">Je naam</label>
                <input className="input" value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Aryan" /></div>
              <div><label className="label">Huidig statuut</label>
                <div className="grid grid-cols-2 gap-2">
                  {['student', 'zelfstandig'].map((s) => (
                    <button key={s} onClick={() => setStatuut(s)}
                      className={`rounded-xl border px-3 py-2.5 text-sm capitalize transition-colors ${statuut === s ? 'border-gold-500 bg-gold-500/10 text-gold-400' : 'border-white/15'}`}>
                      {s === 'zelfstandig' ? 'Zelfstandige hoofdberoep' : 'Student'}
                    </button>
                  ))}
                </div></div>
              <div><label className="label">Datum overgang naar hoofdberoep</label>
                <input className="input" type="date" value={overgang} onChange={(e) => setOvergang(e.target.value)} /></div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl font-bold">Vermogenssnapshot</h2>
              <p className="text-sm muted -mt-3">Vul in wat je nu hebt. Laat leeg wat niet van toepassing is.</p>
              <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                {SNAPSHOT_VELDEN.map(([k, l]) => (
                  <div key={k}><label className="label">{l}</label>
                    <input className="input" type="number" inputMode="decimal" placeholder="€ 0"
                      value={snapshot[k] || ''} onChange={(e) => setSnapshot({ ...snapshot, [k]: e.target.value })} /></div>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="text-xl font-bold">Vaste maandelijkse kosten</h2>
              {kosten.map((k, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input flex-1" value={k.naam} placeholder="Naam"
                    onChange={(e) => setKosten(kosten.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} />
                  <input className="input w-32" type="number" inputMode="decimal" value={k.bedrag} placeholder="€ /maand"
                    onChange={(e) => setKosten(kosten.map((x, j) => (j === i ? { ...x, bedrag: e.target.value } : x)))} />
                </div>
              ))}
              <button className="btn-ghost w-full" onClick={() => setKosten([...kosten, { naam: '', bedrag: '' }])}>+ Kost toevoegen</button>
            </>
          )}
          {step === 4 && (
            <>
              <h2 className="text-xl font-bold">Jouw overlevingsbudget</h2>
              <div className="text-center py-4">
                <div className="text-4xl font-extrabold text-gold-400">{fmtEUR0(overlevingsbudget)}</div>
                <div className="text-sm muted mt-1">per maand</div>
              </div>
              <p className="text-sm muted">
                Dit is het absolute minimum dat je elke maand nodig hebt: je vaste kosten ({fmtEUR0(vk)})
                plus een marge van 25% voor voeding en onvoorziene uitgaven. Onder dit bedrag kom je in de gevarenzone.
                Je 90-dagen forecast op het dashboard kleurt rood zodra je saldo hieronder dreigt te zakken.
              </p>
            </>
          )}
          {step === 5 && (
            <>
              <h2 className="text-xl font-bold">Spaardoelen</h2>
              {doelen.map((d, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 border-b border-white/10 pb-3">
                  <input className="input col-span-2" placeholder="Naam (bv. Mercedes S-Klasse)" value={d.naam}
                    onChange={(e) => setDoelen(doelen.map((x, j) => (j === i ? { ...x, naam: e.target.value } : x)))} />
                  <input className="input" type="number" placeholder="Doelbedrag €" value={d.doelbedrag}
                    onChange={(e) => setDoelen(doelen.map((x, j) => (j === i ? { ...x, doelbedrag: e.target.value } : x)))} />
                  <input className="input" type="date" value={d.deadline}
                    onChange={(e) => setDoelen(doelen.map((x, j) => (j === i ? { ...x, deadline: e.target.value } : x)))} />
                  <input className="input col-span-2" type="number" placeholder="Al gespaard €" value={d.huidig}
                    onChange={(e) => setDoelen(doelen.map((x, j) => (j === i ? { ...x, huidig: e.target.value } : x)))} />
                </div>
              ))}
              <button className="btn-ghost w-full" onClick={() => setDoelen([...doelen, { naam: '', doelbedrag: '', deadline: '', huidig: '' }])}>+ Doel toevoegen</button>
            </>
          )}
          <div className="flex gap-2 pt-2">
            {step > 1 && <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>Terug</button>}
            {step < 5
              ? <button className="btn-gold flex-1" onClick={() => setStep(step + 1)}>Volgende</button>
              : <button className="btn-gold flex-1" disabled={busy} onClick={() => save(false)}>{busy ? 'Opslaan…' : 'Start dashboard'}</button>}
          </div>
        </Card>
      </div>
    </div>
  )
}
