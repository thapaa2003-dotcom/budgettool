import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, SectionTitle, Progress, Badge, Gauge, Confetti, Empty } from './ui'
import { fmtEUR0, fmtDate, todayISO, daysBetween } from '../lib/format'
import { vasteKostenTotaal, groupByMonth } from '../lib/calc'

const isVoertuig = (naam = '') => /auto|wagen|mercedes|bmw|audi|tesla|moto/i.test(naam)

export default function Goals({ userId, profile, transactions, goals, refresh }) {
  const [nieuw, setNieuw] = useState({ naam: '', doelbedrag: '', deadline: '', huidig: '', maandelijkse_bijdrage: '' })
  const [confettiKey, setConfettiKey] = useState(0)
  const [finInput, setFinInput] = useState({ rente: 6, looptijd: 48, renting: 450 })

  const vk = vasteKostenTotaal(profile.vaste_kosten)
  const maanden = useMemo(() => groupByMonth(transactions), [transactions])
  const laatste3 = maanden.slice(-3)
  const spaarcapaciteit = Math.max(0, laatste3.length ? laatste3.reduce((a, m) => a + m.inkomsten - m.uitgaven, 0) / laatste3.length : 0)

  const liquide = (+profile.snapshot?.zicht || 0) + (+profile.snapshot?.spaar || 0) + transactions.reduce((a, t) => a + t.bedrag, 0)
  const noodfondsDoel = vk * 6
  const noodfondsPct = noodfondsDoel > 0 ? (liquide / noodfondsDoel) * 100 : 100
  const runway = vk > 0 ? liquide / vk : Infinity
  const noodBijdrage = Math.max(0, (noodfondsDoel - liquide) / 12)

  // Slimme allocatie: urgentie = resterend bedrag / resterende maanden
  const allocatie = useMemo(() => {
    const open = goals.filter((g) => g.huidig < g.doelbedrag)
    const scored = open.map((g) => {
      const rest = g.doelbedrag - g.huidig
      const mnd = g.deadline ? Math.max(1, daysBetween(todayISO(), g.deadline) / 30) : 24
      return { id: g.id, urgentie: rest / mnd }
    })
    const tot = scored.reduce((a, s) => a + s.urgentie, 0) || 1
    return Object.fromEntries(scored.map((s) => [s.id, (s.urgentie / tot) * spaarcapaciteit]))
  }, [goals, spaarcapaciteit])

  const addGoal = async () => {
    if (!nieuw.naam || !nieuw.doelbedrag) return
    await supabase.from('goals').insert({
      user_id: userId, naam: nieuw.naam, doelbedrag: +nieuw.doelbedrag,
      deadline: nieuw.deadline || null, huidig: +nieuw.huidig || 0, maandelijkse_bijdrage: +nieuw.maandelijkse_bijdrage || 0,
    })
    setNieuw({ naam: '', doelbedrag: '', deadline: '', huidig: '', maandelijkse_bijdrage: '' })
    refresh()
  }

  const updateHuidig = async (g, val) => {
    const huidig = +val || 0
    const wasBereikt = g.huidig >= g.doelbedrag
    await supabase.from('goals').update({ huidig, bereikt: huidig >= g.doelbedrag }).eq('id', g.id)
    if (!wasBereikt && huidig >= g.doelbedrag) setConfettiKey(Date.now())
    refresh()
  }

  return (
    <div>
      <Confetti trigger={confettiKey} />
      <SectionTitle>Noodfonds</SectionTitle>
      <Card>
        <div className="grid sm:grid-cols-3 gap-4 items-center">
          <Gauge pct={noodfondsPct} label="van 6 maanden vaste kosten" />
          <div className="text-center">
            <div className="label">Runway</div>
            <div className="text-3xl font-extrabold text-gold-400">{runway === Infinity ? '∞' : runway.toFixed(1)}</div>
            <div className="text-xs muted">maanden vaste kosten gedekt</div>
          </div>
          <div className="text-center">
            <div className="label">Aanbevolen bijdrage</div>
            <div className="text-3xl font-extrabold">{fmtEUR0(noodBijdrage)}</div>
            <div className="text-xs muted">per maand om binnen 12 mnd op {fmtEUR0(noodfondsDoel)} te zitten</div>
          </div>
        </div>
      </Card>

      <SectionTitle right={<Badge tone="gold">Spaarcapaciteit: {fmtEUR0(spaarcapaciteit)}/mnd</Badge>}>Spaardoelen</SectionTitle>
      <Card className="mb-3">
        <div className="grid sm:grid-cols-6 gap-2">
          <input className="input sm:col-span-2" placeholder="Naam doel" value={nieuw.naam} onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })} />
          <input className="input" type="number" placeholder="Doel €" value={nieuw.doelbedrag} onChange={(e) => setNieuw({ ...nieuw, doelbedrag: e.target.value })} />
          <input className="input" type="date" value={nieuw.deadline} onChange={(e) => setNieuw({ ...nieuw, deadline: e.target.value })} />
          <input className="input" type="number" placeholder="Al gespaard" value={nieuw.huidig} onChange={(e) => setNieuw({ ...nieuw, huidig: e.target.value })} />
          <div className="flex gap-2">
            <input className="input" type="number" placeholder="€/mnd" value={nieuw.maandelijkse_bijdrage} onChange={(e) => setNieuw({ ...nieuw, maandelijkse_bijdrage: e.target.value })} />
            <button className="btn-gold" onClick={addGoal}>+</button>
          </div>
        </div>
      </Card>

      {goals.length ? goals.map((g) => {
        const pct = (g.huidig / g.doelbedrag) * 100
        const rest = Math.max(0, g.doelbedrag - g.huidig)
        const bijdrage = +g.maandelijkse_bijdrage || allocatie[g.id] || 0
        const mndNodig = bijdrage > 0 ? Math.ceil(rest / bijdrage) : null
        const projDatum = mndNodig != null ? new Date(new Date().setMonth(new Date().getMonth() + mndNodig)).toISOString().slice(0, 10) : null
        const opSchema = !g.deadline || (projDatum && projDatum <= g.deadline)
        const jaren = g.deadline ? Math.max(0.5, daysBetween(todayISO(), g.deadline) / 365) : 3
        const oppKost = g.doelbedrag * (Math.pow(1.07, jaren) - 1)
        const leningTotaal = g.doelbedrag * (1 + (finInput.rente / 100) * (finInput.looptijd / 12) * 0.55)
        const rentingTotaal = finInput.renting * finInput.looptijd

        return (
          <Card key={g.id} className="mb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold">{g.naam} {pct >= 100 && '🎉'}</h3>
              <div className="flex items-center gap-2">
                {isVoertuig(g.naam) && <Badge tone="blue">🚗 voertuig · check privé vs beroeps</Badge>}
                <Badge tone={pct >= 100 ? 'green' : opSchema ? 'green' : 'red'}>
                  {pct >= 100 ? 'Bereikt' : opSchema ? 'Op schema' : 'Achter schema'}
                </Badge>
                <button className="text-red-400 text-sm" onClick={async () => { await supabase.from('goals').delete().eq('id', g.id); refresh() }}>×</button>
              </div>
            </div>
            <div className="mt-3"><Progress pct={pct} color={pct >= 100 ? 'bg-emerald-500' : 'bg-gold-500'} /></div>
            <div className="flex flex-wrap justify-between text-xs muted mt-2 gap-2">
              <span>
                <input className="input !w-28 !py-1 !inline-block mr-1" type="number" defaultValue={g.huidig} key={g.huidig}
                  onBlur={(e) => +e.target.value !== g.huidig && updateHuidig(g, e.target.value)} />
                / {fmtEUR0(g.doelbedrag)}
              </span>
              <span>Deadline: {fmtDate(g.deadline)}</span>
              <span>Slimme allocatie: <b className="text-gold-400">{fmtEUR0(allocatie[g.id] || 0)}/mnd</b></span>
              <span>Verwacht klaar: <b>{projDatum ? fmtDate(projDatum) : '— stel bijdrage in'}</b></span>
            </div>
            {pct < 100 && (
              <details className="mt-3">
                <summary className="text-xs text-gold-400 cursor-pointer">Financieringsadvies & opportuniteitskost</summary>
                <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
                  <div className="glass !rounded-xl p-3">
                    <div className="label">Cash</div>
                    <div className="font-bold">{fmtEUR0(g.doelbedrag)}</div>
                    <div className="text-xs muted mt-1">Geen rente, maar opportuniteitskost: belegd aan 7% was dit over {jaren.toFixed(1)} jaar <b className="text-gold-400">{fmtEUR0(oppKost)}</b> meer waard.</div>
                  </div>
                  <div className="glass !rounded-xl p-3">
                    <div className="label">Lening</div>
                    <div className="font-bold">≈ {fmtEUR0(leningTotaal)}</div>
                    <div className="flex gap-2 mt-1.5">
                      <input className="input !py-1 text-xs" type="number" value={finInput.rente} onChange={(e) => setFinInput({ ...finInput, rente: +e.target.value })} />
                      <span className="text-xs muted self-center">% rente</span>
                      <input className="input !py-1 text-xs" type="number" value={finInput.looptijd} onChange={(e) => setFinInput({ ...finInput, looptijd: +e.target.value })} />
                      <span className="text-xs muted self-center">mnd</span>
                    </div>
                  </div>
                  <div className="glass !rounded-xl p-3">
                    <div className="label">Renting / leasing</div>
                    <div className="font-bold">≈ {fmtEUR0(rentingTotaal)}</div>
                    <div className="flex gap-2 mt-1.5">
                      <input className="input !py-1 text-xs" type="number" value={finInput.renting} onChange={(e) => setFinInput({ ...finInput, renting: +e.target.value })} />
                      <span className="text-xs muted self-center">€/mnd, geen eigendom</span>
                    </div>
                    {isVoertuig(g.naam) && <div className="text-xs muted mt-1">Als beroepsvoertuig deels aftrekbaar; privé niet. Bespreek met je boekhouder.</div>}
                  </div>
                </div>
              </details>
            )}
          </Card>
        )
      }) : <Empty>Nog geen spaardoelen. Voeg er hierboven één toe.</Empty>}
    </div>
  )
}
