import React, { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, SectionTitle, Badge, Progress, Empty } from './ui'
import { fmtEUR, fmtEUR0, fmtDate, todayISO, daysBetween, monthKey } from '../lib/format'
import {
  PCT_SOCIALE_BIJDRAGEN, PCT_BELASTINGPROVISIE, BTW_VRIJSTELLINGSGRENS,
  VAPZ_PCT, VAPZ_PLAFOND, quarterDeadlines, groupByMonth, movingAvgIncome, vasteKostenTotaal,
} from '../lib/calc'

export default function Zelfstandige({ userId, profile, transactions, commissions, expensesPro, effectiefStatuut, refresh, saveProfile }) {
  const [nieuweComm, setNieuweComm] = useState({ klant: '', producttype: '', bedrag: '', verwachte_datum: '', recurring: false })
  const [nieuweKost, setNieuweKost] = useState({ omschrijving: '', bedrag: '', pct_aftrekbaar: 100 })
  const [poz, setPoz] = useState(profile.settings?.poz || '')

  const jaar = todayISO().slice(0, 4)
  const beroepsinkomstenYTD = transactions
    .filter((t) => t.categorie === 'Beroepsinkomsten' && t.bedrag > 0 && t.datum.startsWith(jaar))
    .reduce((a, t) => a + t.bedrag, 0)

  const maanden = useMemo(() => groupByMonth(transactions), [transactions])
  const smoothing = useMemo(() => movingAvgIncome(maanden).slice(-6), [maanden])
  const vk = vasteKostenTotaal(profile.vaste_kosten)

  const kostenAftrek = expensesPro.reduce((a, e) => a + e.bedrag * (e.pct_aftrekbaar / 100), 0)
  const nettoBelastbaarJaar = Math.max(0, beroepsinkomstenYTD - kostenAftrek)
  const socialeKwartaal = (nettoBelastbaarJaar * PCT_SOCIALE_BIJDRAGEN) / 4
  const belastingProvisie = nettoBelastbaarJaar * PCT_BELASTINGPROVISIE
  const veiligBesteden = Math.max(0, beroepsinkomstenYTD - kostenAftrek - nettoBelastbaarJaar * PCT_SOCIALE_BIJDRAGEN - belastingProvisie)

  const btwPct = (beroepsinkomstenYTD / BTW_VRIJSTELLINGSGRENS) * 100
  const vapzOptimaal = Math.min(nettoBelastbaarJaar * VAPZ_PCT, VAPZ_PLAFOND)
  const vapzVoordeel = vapzOptimaal * (PCT_BELASTINGPROVISIE + PCT_SOCIALE_BIJDRAGEN)

  // Slechte maand simulator: 2 maanden geen inkomen
  const avgMaandUitgaven = maanden.length ? maanden.slice(-3).reduce((a, m) => a + m.uitgaven, 0) / Math.min(3, maanden.length) : vk
  const liquide = (+profile.snapshot?.zicht || 0) + (+profile.snapshot?.spaar || 0) + transactions.reduce((a, t) => a + t.bedrag, 0)
  const naTweeSlechte = liquide - 2 * avgMaandUitgaven

  // Break-even huidige maand
  const dezeMaand = monthKey(todayISO())
  const inkomstenMTD = transactions.filter((t) => monthKey(t.datum) === dezeMaand && t.bedrag > 0).reduce((a, t) => a + t.bedrag, 0)
  const reserveringMaand = (inkomstenMTD * PCT_SOCIALE_BIJDRAGEN) + (inkomstenMTD * PCT_BELASTING(effectiefStatuut))
  const breakEven = vk + reserveringMaand - inkomstenMTD

  const pipeline = commissions.filter((c) => c.status === 'verwacht')
  const pipelineTotaal = pipeline.reduce((a, c) => a + +c.bedrag, 0)

  const toggleStatuut = () => saveProfile({ statuut: profile.statuut === 'student' ? 'zelfstandig' : 'student' })

  const addComm = async () => {
    if (!nieuweComm.bedrag) return
    await supabase.from('commissions').insert({ ...nieuweComm, bedrag: +nieuweComm.bedrag, verwachte_datum: nieuweComm.verwachte_datum || null, user_id: userId })
    setNieuweComm({ klant: '', producttype: '', bedrag: '', verwachte_datum: '', recurring: false })
    refresh()
  }
  const addKost = async () => {
    if (!nieuweKost.bedrag) return
    await supabase.from('expenses_pro').insert({ ...nieuweKost, bedrag: +nieuweKost.bedrag, pct_aftrekbaar: +nieuweKost.pct_aftrekbaar, user_id: userId })
    setNieuweKost({ omschrijving: '', bedrag: '', pct_aftrekbaar: 100 })
    refresh()
  }

  return (
    <div>
      <SectionTitle right={
        <button onClick={toggleStatuut} className="flex items-center gap-2 text-sm">
          <span className={effectiefStatuut === 'student' ? 'text-gold-400 font-semibold' : 'muted'}>Student</span>
          <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${effectiefStatuut === 'zelfstandig' ? 'bg-gold-500' : 'bg-white/15'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${effectiefStatuut === 'zelfstandig' ? 'translate-x-5' : ''}`} />
          </span>
          <span className={effectiefStatuut === 'zelfstandig' ? 'text-gold-400 font-semibold' : 'muted'}>Hoofdberoep</span>
        </button>
      }>
        Zelfstandige intelligence
      </SectionTitle>
      {profile.overgangsdatum && effectiefStatuut === 'student' && (
        <p className="text-xs muted -mt-2 mb-3">Schakelt automatisch naar hoofdberoep op {fmtDate(profile.overgangsdatum)} ({daysBetween(todayISO(), profile.overgangsdatum)} dagen).</p>
      )}

      {effectiefStatuut === 'zelfstandig' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card><div className="label">Sociale bijdragen / kwartaal</div>
              <div className="text-xl font-bold">{fmtEUR0(socialeKwartaal)}</div>
              <div className="text-xs muted mt-1">20,5% van netto belastbaar ({fmtEUR0(nettoBelastbaarJaar)} YTD)</div></Card>
            <Card><div className="label">Belastingprovisie (28%)</div>
              <div className="text-xl font-bold">{fmtEUR0(belastingProvisie)}</div>
              <div className="text-xs muted mt-1">Apart te reserveren</div></Card>
            <Card><div className="label">Veilig te besteden</div>
              <div className="text-xl font-bold text-emerald-400">{fmtEUR0(veiligBesteden)}</div>
              <div className="text-xs muted mt-1">Na alle reserveringen, YTD</div></Card>
            <Card><div className="label">Break-even deze maand</div>
              <div className={`text-xl font-bold ${breakEven <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {breakEven <= 0 ? 'Gehaald ✓' : fmtEUR0(breakEven) + ' tekort'}
              </div>
              <div className="text-xs muted mt-1">Vaste kosten + reserveringen vs inkomsten</div></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-3 mt-3">
            <Card>
              <div className="flex justify-between items-center mb-2">
                <div className="label !mb-0">BTW-vrijstellingsgrens</div>
                {btwPct >= 80 && <Badge tone="red">⚠ {Math.round(btwPct)}% bereikt</Badge>}
              </div>
              <Progress pct={btwPct} color={btwPct >= 80 ? 'bg-red-500' : 'bg-gold-500'} />
              <div className="flex justify-between text-xs muted mt-2">
                <span>{fmtEUR0(beroepsinkomstenYTD)} omzet {jaar}</span>
                <span>grens {fmtEUR0(BTW_VRIJSTELLINGSGRENS)}</span>
              </div>
              {btwPct >= 80 && <p className="text-xs text-red-400 mt-2">Je nadert de vrijstellingsgrens van €25.000. Boven deze grens word je BTW-plichtig. Plan dit met je boekhouder.</p>}
            </Card>
            <Card>
              <div className="label">VAPZ & POZ</div>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span className="muted">Optimale VAPZ-bijdrage (8,17%)</span><b>{fmtEUR0(vapzOptimaal)}</b></div>
                <div className="flex justify-between"><span className="muted">Geschat fiscaal + sociaal voordeel</span><b className="text-emerald-400">{fmtEUR0(vapzVoordeel)}</b></div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="muted">POZ gestort dit jaar</span>
                  <input className="input !w-28 !py-1" type="number" value={poz}
                    onChange={(e) => setPoz(e.target.value)}
                    onBlur={() => saveProfile({ settings: { ...profile.settings, poz: +poz || 0 } })} />
                </div>
              </div>
              <p className="text-xs muted mt-2">Plafond {fmtEUR0(VAPZ_PLAFOND)} is indicatief en wordt jaarlijks geïndexeerd.</p>
            </Card>
          </div>

          <SectionTitle>Kwartaalkalender</SectionTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quarterDeadlines().map((d, i) => {
              const dagen = daysBetween(todayISO(), d)
              const voorbij = dagen < 0
              return (
                <Card key={d} className={`text-center ${!voorbij && dagen <= 14 ? '!border-red-500/50' : ''}`}>
                  <div className="label">Q{i + 1} · {fmtDate(d)}</div>
                  <div className={`text-2xl font-extrabold ${voorbij ? 'muted' : dagen <= 14 ? 'text-red-400' : 'text-gold-400'}`}>
                    {voorbij ? '✓' : dagen}
                  </div>
                  <div className="text-xs muted">{voorbij ? 'afgesloten' : 'dagen'}</div>
                </Card>
              )
            })}
          </div>

          <SectionTitle>Beroepskosten</SectionTitle>
          <Card>
            <div className="flex flex-wrap gap-2 mb-3">
              <input className="input flex-1 min-w-40" placeholder="Bv. Telefoon, wagen, laptop" value={nieuweKost.omschrijving} onChange={(e) => setNieuweKost({ ...nieuweKost, omschrijving: e.target.value })} />
              <input className="input !w-28" type="number" placeholder="€" value={nieuweKost.bedrag} onChange={(e) => setNieuweKost({ ...nieuweKost, bedrag: e.target.value })} />
              <input className="input !w-24" type="number" placeholder="% aftrek" value={nieuweKost.pct_aftrekbaar} onChange={(e) => setNieuweKost({ ...nieuweKost, pct_aftrekbaar: e.target.value })} />
              <button className="btn-gold" onClick={addKost}>+</button>
            </div>
            <p className="text-xs muted mb-2">Richtlijnen: telefoon 75%, laptop 100%, wagen volgens beroepsgebruik.</p>
            {expensesPro.length ? expensesPro.map((e) => (
              <div key={e.id} className="flex justify-between items-center text-sm py-1.5 border-b border-white/5 last:border-0">
                <span>{e.omschrijving} <span className="muted text-xs">({e.pct_aftrekbaar}%)</span></span>
                <span className="flex items-center gap-3">
                  {fmtEUR(e.bedrag)}
                  <span className="text-emerald-400 text-xs">≈ {fmtEUR0(e.bedrag * (e.pct_aftrekbaar / 100) * PCT_BELASTINGPROVISIE)} besparing</span>
                  <button className="text-red-400" onClick={async () => { await supabase.from('expenses_pro').delete().eq('id', e.id); refresh() }}>×</button>
                </span>
              </div>
            )) : <Empty>Nog geen beroepskosten geregistreerd.</Empty>}
            {expensesPro.length > 0 && (
              <div className="flex justify-between text-sm pt-3 mt-1 border-t border-white/10 font-semibold">
                <span>Totaal aftrekbaar: {fmtEUR0(kostenAftrek)}</span>
                <span className="text-emerald-400">Geschatte belastingbesparing: {fmtEUR0(kostenAftrek * PCT_BELASTINGPROVISIE)}</span>
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-3 mt-3">
            <Card>
              <div className="label">Inkomenssmoothing (3-maands gemiddelde)</div>
              {smoothing.length ? smoothing.map((m) => (
                <div key={m.maand} className="flex justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                  <span className="muted">{m.maand}</span>
                  <span>{fmtEUR0(m.inkomsten)} <span className="text-gold-400 text-xs">→ gem. {fmtEUR0(m.gemiddeld)}</span></span>
                </div>
              )) : <Empty>Nog geen inkomensdata.</Empty>}
              <p className="text-xs muted mt-2">Budgetteer op het voortschrijdend gemiddelde, niet op je beste maand.</p>
            </Card>
            <Card>
              <div className="label">Slechte maand simulator</div>
              <p className="text-sm mt-1">Wat als je <b>2 maanden niets verdient</b> en je uitgavenpatroon aanhoudt?</p>
              <div className={`text-3xl font-extrabold mt-3 ${naTweeSlechte >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtEUR0(naTweeSlechte)}</div>
              <p className="text-xs muted mt-1">
                Resterend liquide vermogen na 2 × {fmtEUR0(avgMaandUitgaven)} uitgaven.
                {naTweeSlechte < 0 && ' Je buffer is te klein voor 2 slechte maanden. Bouw eerst je noodfonds op.'}
              </p>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <p className="text-sm muted">
            Je bent momenteel in <b className="text-gold-400">student-modus</b>. De zelfstandige-calculators
            (sociale bijdragen, belastingprovisie, BTW-grens, VAPZ) activeren automatisch op je overgangsdatum
            {profile.overgangsdatum ? ` (${fmtDate(profile.overgangsdatum)})` : ''}, of zet de schakelaar hierboven manueel om.
            De commissietracker hieronder werkt nu al.
          </p>
        </Card>
      )}

      <SectionTitle right={<Badge tone="gold">Pipeline: {fmtEUR0(pipelineTotaal)}</Badge>}>OVB commissietracker</SectionTitle>
      <Card>
        <div className="flex flex-wrap gap-2 mb-4">
          <input className="input flex-1 min-w-32" placeholder="Klant / dossier" value={nieuweComm.klant} onChange={(e) => setNieuweComm({ ...nieuweComm, klant: e.target.value })} />
          <input className="input flex-1 min-w-32" placeholder="Producttype (VAPZ, IPT, tak 23…)" value={nieuweComm.producttype} onChange={(e) => setNieuweComm({ ...nieuweComm, producttype: e.target.value })} />
          <input className="input !w-28" type="number" placeholder="€" value={nieuweComm.bedrag} onChange={(e) => setNieuweComm({ ...nieuweComm, bedrag: e.target.value })} />
          <input className="input !w-40" type="date" value={nieuweComm.verwachte_datum} onChange={(e) => setNieuweComm({ ...nieuweComm, verwachte_datum: e.target.value })} />
          <button className={`btn-ghost !py-2 text-xs ${nieuweComm.recurring ? '!border-gold-500 text-gold-400' : ''}`}
            onClick={() => setNieuweComm({ ...nieuweComm, recurring: !nieuweComm.recurring })}>
            {nieuweComm.recurring ? 'Recurrent ✓' : 'Eenmalig'}
          </button>
          <button className="btn-gold" onClick={addComm}>+</button>
        </div>
        {commissions.length ? commissions.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0 text-sm">
            <span className="truncate">
              <b>{c.klant || 'Onbekend'}</b> · {c.producttype || '—'}{' '}
              <Badge tone={c.recurring ? 'blue' : 'gold'}>{c.recurring ? 'recurrent' : 'eenmalig'}</Badge>
            </span>
            <span className="whitespace-nowrap flex items-center gap-2">
              {fmtEUR(c.bedrag)} · {fmtDate(c.verwachte_datum)}
              {c.status === 'verwacht'
                ? <button className="btn-ghost !py-1 !px-2 text-xs" onClick={async () => { await supabase.from('commissions').update({ status: 'ontvangen' }).eq('id', c.id); refresh() }}>Ontvangen ✓</button>
                : <Badge tone="green">ontvangen</Badge>}
            </span>
          </div>
        )) : <Empty>Voeg je eerste dossier toe om je pipeline op te bouwen.</Empty>}
      </Card>
      <p className="text-xs muted mt-3">De percentages (20,5% sociale bijdragen, 28% provisie) zijn vereenvoudigde vuistregels, geen fiscaal advies. Stem definitieve cijfers af met je sociaal verzekeringsfonds en boekhouder.</p>
    </div>
  )
}

function PCT_BELASTING(statuut) { return statuut === 'zelfstandig' ? 0.28 : 0 }
