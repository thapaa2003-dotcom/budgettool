import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, ReferenceLine, CartesianGrid, Legend,
} from 'recharts'
import { Card, Stat, SectionTitle, Badge, Empty } from './ui'
import { fmtEUR, fmtEUR0, fmtDate, monthLabel, monthKey, todayISO, daysBetween } from '../lib/format'
import { CAT_KLEUREN } from '../lib/categorize'
import {
  sumSnapshot, vasteKostenTotaal, groupByMonth, byCategory, healthScore, stdDev,
  nextQuarterDeadline, forecast90, recurringSpending, impulsePurchases, PEER_BENCHMARK,
} from '../lib/calc'

const tooltipStyle = { background: '#0e1f38', border: '1px solid rgba(240,180,41,0.3)', borderRadius: 12, fontSize: 12 }

export default function Dashboard({ profile, transactions, expected, effectiefStatuut }) {
  const [uren, setUren] = useState(120)
  const snap = sumSnapshot(profile.snapshot)
  const vk = vasteKostenTotaal(profile.vaste_kosten)
  const maanden = useMemo(() => groupByMonth(transactions), [transactions])
  const catData = useMemo(() => byCategory(transactions.filter((t) => monthKey(t.datum) === monthKey(todayISO()))), [transactions])
  const recurring = useMemo(() => recurringSpending(transactions), [transactions])
  const impulses = useMemo(() => impulsePurchases(transactions), [transactions])

  const laatste3 = maanden.slice(-3)
  const avgIn = laatste3.length ? laatste3.reduce((a, m) => a + m.inkomsten, 0) / laatste3.length : 0
  const avgUit = laatste3.length ? laatste3.reduce((a, m) => a + m.uitgaven, 0) / laatste3.length : 0
  const overschot = avgIn - avgUit

  // Liquide = snapshot liquide + netto transacties sinds onboarding
  const txNetto = transactions.reduce((a, t) => a + t.bedrag, 0)
  const liquide = snap.liquide + txNetto
  const nettoVermogen = snap.netto + txNetto

  const score = healthScore({
    avgInkomsten: avgIn, avgUitgaven: avgUit, liquide, vasteKosten: vk,
    schulden: +profile.snapshot?.schulden || 0, incomeStd: stdDev(maanden.map((m) => m.inkomsten)),
  })

  const deadline = nextQuarterDeadline()
  const dagenTotDeadline = daysBetween(todayISO(), deadline)

  // Running balance
  const running = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => a.datum.localeCompare(b.datum))
    let s = snap.liquide
    return sorted.map((t) => { s += t.bedrag; return { datum: t.datum, saldo: Math.round(s) } })
  }, [transactions, snap.liquide])

  // Vermogensgroei per maand
  const vermogensgroei = useMemo(() => {
    let s = snap.netto
    return maanden.map((m) => { s += m.inkomsten - m.uitgaven; return { maand: monthLabel(m.maand), vermogen: Math.round(s) } })
  }, [maanden, snap.netto])

  const avgDagVariabel = avgUit > vk ? (avgUit - vk) / 30 : avgUit / 30
  const fc = forecast90({ startSaldo: liquide, vasteKosten: vk, avgDagVariabel, expected, startDate: todayISO() })
  const overlevingsbudget = vk * 1.25
  const gevaarDagen = fc.filter((d) => d.saldo < overlevingsbudget).length

  // Projecties
  const proj = (m) => nettoVermogen + overschot * m

  // Kwartaalvergelijking
  const kwartaal = useMemo(() => {
    const q = (iso) => { const [y, m] = iso.split('-'); return `${y}-Q${Math.ceil(+m / 3)}` }
    const map = {}
    for (const m of maanden) {
      const k = q(m.maand + '-01')
      if (!map[k]) map[k] = { k, inkomsten: 0, uitgaven: 0 }
      map[k].inkomsten += m.inkomsten; map[k].uitgaven += m.uitgaven
    }
    return Object.values(map).slice(-2)
  }, [maanden])

  // Heatmap per weekdag (laatste 90 dagen)
  const heatmap = useMemo(() => {
    const dagen = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
    const tot = Array(7).fill(0)
    const grens = new Date(); grens.setDate(grens.getDate() - 90)
    for (const t of transactions) {
      if (t.bedrag >= 0 || new Date(t.datum) < grens) continue
      tot[(new Date(t.datum).getDay() + 6) % 7] += -t.bedrag
    }
    const max = Math.max(...tot, 1)
    return dagen.map((d, i) => ({ dag: d, bedrag: tot[i], pct: tot[i] / max }))
  }, [transactions])

  const laatsteM = maanden[maanden.length - 1]
  const vorigeM = maanden[maanden.length - 2]
  const benchmark = PEER_BENCHMARK[effectiefStatuut] || PEER_BENCHMARK.student
  const nettoUurloon = uren > 0 ? (avgIn * (1 - 0.205) * (1 - 0.28)) / uren : 0

  return (
    <div>
      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Netto vermogen" value={fmtEUR0(nettoVermogen)} sub={`Liquide: ${fmtEUR0(liquide)}`} accent="text-gold-400" />
        <Stat label="Gezondheidsscore" value={`${score.totaal}/100`}
          sub={score.breakdown.map((b) => `${b.naam} ${b.score}/${b.max}`).join(' · ')}
          accent={score.totaal >= 70 ? 'text-emerald-400' : score.totaal >= 40 ? 'text-gold-400' : 'text-red-400'} />
        <Stat label="Maandelijks overschot" value={(overschot >= 0 ? '+' : '') + fmtEUR0(overschot)}
          sub="Gemiddelde laatste 3 maanden" accent={overschot >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Stat label="Kwartaalaangifte" value={`${dagenTotDeadline} dagen`} sub={`Deadline ${fmtDate(deadline)}`}
          accent={dagenTotDeadline <= 14 ? 'text-red-400' : ''} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {[3, 6, 12].map((m) => (
          <Card key={m} className="text-center !p-3">
            <div className="text-[11px] uppercase tracking-wider muted">+{m} mnd</div>
            <div className="font-bold text-sm mt-0.5">{fmtEUR0(proj(m))}</div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <SectionTitle>Inkomsten vs uitgaven</SectionTitle>
      <Card>
        {maanden.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={maanden.map((m) => ({ ...m, label: monthLabel(m.maand) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEUR0(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="inkomsten" name="Inkomsten" fill="#34d399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="uitgaven" name="Uitgaven" fill="#f87171" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty>Importeer of voeg transacties toe om je grafieken te zien.</Empty>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-3 mt-3">
        <Card>
          <div className="label">Uitgaven deze maand per categorie</div>
          {catData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {catData.map((c) => <Cell key={c.name} fill={CAT_KLEUREN[c.name] || '#94a3b8'} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEUR0(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty>Nog geen uitgaven deze maand.</Empty>}
        </Card>
        <Card>
          <div className="label">Running balance</div>
          {running.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={running}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="datum" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEUR0(v)} labelFormatter={fmtDate} />
                <Line type="monotone" dataKey="saldo" stroke="#f0b429" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty>Nog geen transacties.</Empty>}
        </Card>
      </div>

      <SectionTitle right={gevaarDagen > 0 ? <Badge tone="red">{gevaarDagen} dagen in gevarenzone</Badge> : <Badge tone="green">Geen gevarenzone</Badge>}>
        90-dagen cashflow forecast
      </SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={fc}>
            <defs>
              <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0b429" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#f0b429" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="datum" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEUR0(v)} labelFormatter={fmtDate} />
            <ReferenceLine y={overlevingsbudget} stroke="#f87171" strokeDasharray="6 4"
              label={{ value: 'Overlevingsbudget', fill: '#f87171', fontSize: 10, position: 'insideTopRight' }} />
            <Area type="monotone" dataKey="saldo" stroke="#f0b429" strokeWidth={2} fill="url(#fcGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-xs muted mt-2">Forecast op basis van vaste kosten, gemiddelde variabele uitgaven en verwachte inkomsten uit je pipeline. Dagen onder de rode lijn zijn de gevarenzone.</p>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3 mt-3">
        <Card>
          <div className="label">Vermogensgroei</div>
          {vermogensgroei.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={vermogensgroei}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="maand" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtEUR0(v)} />
                <Line type="monotone" dataKey="vermogen" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty>Nog geen historiek.</Empty>}
        </Card>
        <Card>
          <div className="label">Uitgaven per weekdag (90 dagen)</div>
          <div className="flex items-end gap-2 h-[170px] mt-4 px-2">
            {heatmap.map((d) => (
              <div key={d.dag} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="text-[10px] muted">{d.bedrag ? fmtEUR0(d.bedrag) : ''}</div>
                <div className="w-full rounded-t-lg transition-all duration-500"
                  style={{ height: `${Math.max(4, d.pct * 120)}px`, background: `rgba(240,180,41,${0.25 + d.pct * 0.75})` }} />
                <div className="text-xs muted">{d.dag}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Gedragsanalyse */}
      <SectionTitle>Gedragsanalyse</SectionTitle>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <div className="label">Terugkerende verspilling</div>
          {recurring.length ? recurring.map((r) => (
            <div key={r.naam} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 text-sm">
              <span>Je geeft al <b>{r.maanden} maanden</b> gemiddeld <b className="text-gold-400">{fmtEUR0(r.perMaand)}/mnd</b> uit aan <span className="capitalize">{r.naam}</span></span>
              <span className="muted text-xs whitespace-nowrap ml-2">{fmtEUR0(r.totaal)} totaal</span>
            </div>
          )) : <Empty>Nog te weinig data (minstens 3 maanden nodig).</Empty>}
        </Card>
        <Card>
          <div className="label">Mogelijke impulsaankopen</div>
          {impulses.length ? impulses.map((t) => (
            <div key={t.id} className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
              <span className="truncate mr-2">{t.omschrijving}</span>
              <span className="text-red-400 whitespace-nowrap">{fmtEUR(t.bedrag)} · {fmtDate(t.datum)}</span>
            </div>
          )) : <Empty>Geen opvallende uitschieters gedetecteerd. 👌</Empty>}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mt-3">
        <Card>
          <div className="label">Maand-op-maand</div>
          {laatsteM && vorigeM ? (
            <DeltaRows a={vorigeM} b={laatsteM} la={monthLabel(vorigeM.maand)} lb={monthLabel(laatsteM.maand)} />
          ) : <Empty>Minstens 2 maanden data nodig.</Empty>}
        </Card>
        <Card>
          <div className="label">Kwartaal-op-kwartaal</div>
          {kwartaal.length === 2 ? (
            <DeltaRows a={kwartaal[0]} b={kwartaal[1]} la={kwartaal[0].k} lb={kwartaal[1].k} />
          ) : <Empty>Minstens 2 kwartalen data nodig.</Empty>}
        </Card>
        <Card>
          <div className="label">Netto uurloon</div>
          <div className="flex items-center gap-2 mt-1">
            <input className="input !w-24" type="number" value={uren} onChange={(e) => setUren(+e.target.value)} />
            <span className="text-sm muted">uren/maand</span>
          </div>
          <div className="text-2xl font-bold text-gold-400 mt-3">{fmtEUR(nettoUurloon)}/u</div>
          <p className="text-xs muted mt-1">Na sociale bijdragen (20,5%) en belastingprovisie (28%) op je gemiddeld inkomen.</p>
        </Card>
      </div>

      <SectionTitle>Benchmark Belgische {effectiefStatuut === 'zelfstandig' ? 'starters' : 'studenten'}</SectionTitle>
      <Card>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
          {Object.entries(benchmark).map(([cat, bench]) => {
            const eigen = catData.find((c) => c.name === cat)?.value || 0
            const diff = eigen - bench
            return (
              <div key={cat} className="flex justify-between items-center text-sm py-1.5 border-b border-white/5">
                <span>{cat}</span>
                <span>
                  <b>{fmtEUR0(eigen)}</b> <span className="muted text-xs">vs {fmtEUR0(bench)} gem.</span>{' '}
                  <span className={diff <= 0 ? 'text-emerald-400 text-xs' : 'text-red-400 text-xs'}>
                    {diff <= 0 ? '▼' : '▲'} {fmtEUR0(Math.abs(diff))}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs muted mt-3">Indicatieve gemiddelden, hardcoded ter referentie.</p>
      </Card>
    </div>
  )
}

function DeltaRows({ a, b, la, lb }) {
  const row = (label, va, vb, goedAlsHoger) => {
    const d = vb - va
    const goed = goedAlsHoger ? d >= 0 : d <= 0
    return (
      <div className="flex justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
        <span className="muted">{label}</span>
        <span><b>{fmtEUR0(vb)}</b> <span className={`text-xs ${goed ? 'text-emerald-400' : 'text-red-400'}`}>{d >= 0 ? '+' : ''}{fmtEUR0(d)}</span></span>
      </div>
    )
  }
  return (
    <div>
      <div className="text-xs muted mb-1">{la} → {lb}</div>
      {row('Inkomsten', a.inkomsten, b.inkomsten, true)}
      {row('Uitgaven', a.uitgaven, b.uitgaven, false)}
      {row('Overschot', a.inkomsten - a.uitgaven, b.inkomsten - b.uitgaven, true)}
    </div>
  )
}
