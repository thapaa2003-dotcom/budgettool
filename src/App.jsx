import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Onboarding from './components/Onboarding'
import Dashboard from './components/Dashboard'
import Transactions from './components/Transactions'
import Zelfstandige from './components/Zelfstandige'
import Goals from './components/Goals'
import Reports from './components/Reports'
import Settings from './components/Settings'
import { todayISO, daysBetween, fmtEUR0, monthKey } from './lib/format'
import { vasteKostenTotaal, sumSnapshot, byCategory, nextQuarterDeadline, BTW_VRIJSTELLINGSGRENS, PEER_BENCHMARK } from './lib/calc'

const TABS = [
  ['dashboard', 'Dashboard', '◈'],
  ['transacties', 'Transacties', '⇅'],
  ['zelfstandige', 'Zelfstandige', '€'],
  ['doelen', 'Doelen', '◎'],
  ['rapport', 'Rapport', '▤'],
  ['instellingen', 'Meer', '⚙'],
]

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [expected, setExpected] = useState([])
  const [goals, setGoals] = useState([])
  const [commissions, setCommissions] = useState([])
  const [rules, setRules] = useState([])
  const [expensesPro, setExpensesPro] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [theme, setThemeState] = useState('dark')

  const setTheme = (t) => {
    setThemeState(t)
    document.documentElement.classList.toggle('light', t === 'light')
    document.documentElement.classList.toggle('dark', t === 'dark')
    if (profile) supabase.from('profiles').update({ settings: { ...profile.settings, theme: t } }).eq('id', profile.id).then(() => {})
  }

  useEffect(() => {
    // "Ingelogd blijven" uitgeschakeld: log uit als dit een nieuwe browsersessie is
    if (localStorage.getItem('confin_logout_on_new_session') && !sessionStorage.getItem('confin_alive')) {
      supabase.auth.signOut()
    }
    sessionStorage.setItem('confin_alive', '1')
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (sessionStorage.getItem('confin_session_only')) localStorage.setItem('confin_logout_on_new_session', '1')
      else if (s) localStorage.removeItem('confin_logout_on_new_session')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  const loadAll = useCallback(async () => {
    if (!userId) return
    const [p, t, e, g, c, r, ep] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('transactions').select('*').eq('user_id', userId).order('datum', { ascending: false }).limit(5000),
      supabase.from('expected_income').select('*').eq('user_id', userId).order('verwachte_datum'),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('commissions').select('*').eq('user_id', userId).order('verwachte_datum'),
      supabase.from('rules').select('*').eq('user_id', userId),
      supabase.from('expenses_pro').select('*').eq('user_id', userId).order('datum', { ascending: false }),
    ])
    if (p.data) {
      setProfile(p.data)
      const th = p.data.settings?.theme || 'dark'
      setThemeState(th)
      document.documentElement.classList.toggle('light', th === 'light')
      document.documentElement.classList.toggle('dark', th === 'dark')
    } else if (p.error?.code === 'PGRST116') {
      // Profiel ontbreekt (trigger niet uitgevoerd): maak het aan
      await supabase.from('profiles').insert({ id: userId })
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
    }
    setTransactions(t.data || [])
    setExpected(e.data || [])
    setGoals(g.data || [])
    setCommissions(c.data || [])
    setRules(r.data || [])
    setExpensesPro(ep.data || [])
  }, [userId])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime sync tussen toestellen
  useEffect(() => {
    if (!userId) return
    const ch = supabase.channel('confin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', filter: `user_id=eq.${userId}` }, () => loadAll())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [userId, loadAll])

  const saveProfile = async (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    await supabase.from('profiles').update(patch).eq('id', userId)
  }

  // Automatische statuutswitch op overgangsdatum
  const effectiefStatuut = useMemo(() => {
    if (!profile) return 'student'
    if (profile.statuut === 'zelfstandig') return 'zelfstandig'
    if (profile.overgangsdatum && todayISO() >= profile.overgangsdatum) return 'zelfstandig'
    return 'student'
  }, [profile])

  // Alerts
  const alerts = useMemo(() => {
    if (!profile) return []
    const out = []
    const vk = vasteKostenTotaal(profile.vaste_kosten)
    const liquide = sumSnapshot(profile.snapshot).liquide + transactions.reduce((a, t) => a + t.bedrag, 0)
    const cats = byCategory(transactions.filter((t) => monthKey(t.datum) === monthKey(todayISO())))
    const bench = PEER_BENCHMARK[effectiefStatuut] || PEER_BENCHMARK.student
    for (const c of cats) {
      const budget = bench[c.name]
      if (budget && c.value >= budget * 0.8) out.push({ tone: c.value >= budget ? 'red' : 'gold', txt: `Budget ${c.name}: ${fmtEUR0(c.value)} van ±${fmtEUR0(budget)} (${Math.round((c.value / budget) * 100)}%)` })
    }
    const jaar = todayISO().slice(0, 4)
    const omzet = transactions.filter((t) => t.categorie === 'Beroepsinkomsten' && t.bedrag > 0 && t.datum.startsWith(jaar)).reduce((a, t) => a + t.bedrag, 0)
    if (omzet >= BTW_VRIJSTELLINGSGRENS * 0.8) out.push({ tone: 'red', txt: `BTW-grens nadert: ${fmtEUR0(omzet)} van €25.000 omzet` })
    const dl = nextQuarterDeadline()
    const dagen = daysBetween(todayISO(), dl)
    if (effectiefStatuut === 'zelfstandig' && dagen <= 14) out.push({ tone: 'red', txt: `Kwartaalaangifte over ${dagen} dagen` })
    for (const g of goals) {
      if (g.deadline && g.huidig < g.doelbedrag) {
        const mnd = Math.max(0.5, daysBetween(todayISO(), g.deadline) / 30)
        const nodig = (g.doelbedrag - g.huidig) / mnd
        if (g.maandelijkse_bijdrage > 0 && nodig > g.maandelijkse_bijdrage * 1.1) out.push({ tone: 'gold', txt: `Doel "${g.naam}" achter schema: ${fmtEUR0(nodig)}/mnd nodig` })
      }
    }
    if (vk > 0 && liquide < vk * 6) out.push({ tone: 'gold', txt: `Noodfonds onder target: ${fmtEUR0(liquide)} van ${fmtEUR0(vk * 6)}` })
    return out.slice(0, 5)
  }, [profile, transactions, goals, effectiefStatuut])

  if (session === undefined) return <div className="min-h-screen flex items-center justify-center muted">Laden…</div>
  if (!session) return <Login />
  if (!profile) return <div className="min-h-screen flex items-center justify-center muted">Profiel laden…</div>
  if (!profile.onboarded) return <Onboarding userId={userId} onDone={loadAll} />

  const pageProps = { userId, profile, transactions, expected, goals, commissions, rules, expensesPro, effectiefStatuut, refresh: loadAll, saveProfile }

  return (
    <div className="min-h-screen pb-24 lg:pb-8">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-navy-950/80 border-b border-white/10 no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg border-2 border-gold-500 flex items-center justify-center text-gold-500 font-extrabold text-xs">CF</div>
            <span className="font-extrabold tracking-tight">ConFin</span>
            {effectiefStatuut === 'zelfstandig' && <span className="text-[10px] uppercase tracking-wider text-gold-400 border border-gold-500/40 rounded-full px-2 py-0.5">hoofdberoep</span>}
          </div>
          <nav className="hidden lg:flex gap-1">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3.5 py-1.5 rounded-xl text-sm transition-colors ${tab === id ? 'bg-gold-500/15 text-gold-400 font-semibold' : 'muted hover:text-white'}`}>
                {label}
              </button>
            ))}
          </nav>
          <span className="text-sm muted hidden sm:block">Dag {profile.naam || 'daar'} 👋</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {alerts.length > 0 && tab === 'dashboard' && (
          <div className="space-y-2 mb-5 no-print">
            {alerts.map((a, i) => (
              <div key={i} className={`text-sm rounded-xl px-4 py-2.5 border ${a.tone === 'red' ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-gold-500/10 border-gold-500/30 text-gold-300'}`}>
                {a.tone === 'red' ? '⚠' : '◈'} {a.txt}
              </div>
            ))}
          </div>
        )}
        {tab === 'dashboard' && <Dashboard {...pageProps} />}
        {tab === 'transacties' && <Transactions {...pageProps} />}
        {tab === 'zelfstandige' && <Zelfstandige {...pageProps} />}
        {tab === 'doelen' && <Goals {...pageProps} />}
        {tab === 'rapport' && <Reports {...pageProps} />}
        {tab === 'instellingen' && <Settings {...pageProps} theme={theme} setTheme={setTheme} />}
      </main>

      {/* Mobiele navigatie */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 backdrop-blur-xl bg-navy-950/90 border-t border-white/10 no-print"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-6">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`py-2.5 flex flex-col items-center gap-0.5 text-[10px] ${tab === id ? 'text-gold-400' : 'muted'}`}>
              <span className="text-base leading-none">{icon}</span>{label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
