import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // login | register | mfa
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState(null)

  const handleLogin = async () => {
    setBusy(true); setError(''); setInfo('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(vertaal(error.message)); setBusy(false); return }
    // "Ingelogd blijven" uit: sessie eindigt bij sluiten van het tabblad
    if (!stayLoggedIn) sessionStorage.setItem('confin_session_only', '1')
    else sessionStorage.removeItem('confin_session_only')
    // Controleer of 2FA vereist is
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal?.nextLevel !== aal?.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (totp) { setMfaFactorId(totp.id); setMode('mfa'); setBusy(false); return }
    }
    setBusy(false)
  }

  const handleMfa = async () => {
    setBusy(true); setError('')
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (cErr) { setError(vertaal(cErr.message)); setBusy(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code })
    if (error) setError('Code onjuist. Probeer opnieuw.')
    setBusy(false)
  }

  const handleRegister = async () => {
    setBusy(true); setError(''); setInfo('')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(vertaal(error.message))
    else setInfo('Account aangemaakt. Controleer je mailbox om je e-mailadres te bevestigen, en log daarna in.')
    setBusy(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-sky-500/5 blur-3xl" />
      </div>
      <div className="glass w-full max-w-md p-8 relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl border-2 border-gold-500 flex items-center justify-center text-gold-500 font-extrabold text-xl mb-4">CF</div>
          <h1 className="text-2xl font-extrabold tracking-tight">ConFin</h1>
          <p className="text-sm muted mt-1">Jouw financieel commandocentrum</p>
        </div>

        {mode === 'mfa' ? (
          <div className="space-y-4">
            <p className="text-sm muted">Voer de 6-cijferige code uit je authenticator-app in.</p>
            <input className="input text-center text-lg tracking-[0.4em]" maxLength={6} inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="······" />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="btn-gold w-full" disabled={busy || code.length !== 6} onClick={handleMfa}>Verifieer</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">E-mailadres</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="naam@voorbeeld.be" />
            </div>
            <div>
              <label className="label">Wachtwoord</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())} />
            </div>
            {mode === 'login' && (
              <button onClick={() => setStayLoggedIn(!stayLoggedIn)} className="flex items-center gap-2.5 text-sm muted">
                <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${stayLoggedIn ? 'bg-gold-500' : 'bg-white/15'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${stayLoggedIn ? 'translate-x-4' : ''}`} />
                </span>
                Ingelogd blijven
              </button>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {info && <p className="text-emerald-400 text-sm">{info}</p>}
            <button className="btn-gold w-full" disabled={busy || !email || !password} onClick={mode === 'login' ? handleLogin : handleRegister}>
              {busy ? 'Even geduld…' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
            <button className="w-full text-sm muted hover:text-gold-400 transition-colors" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo('') }}>
              {mode === 'login' ? 'Nog geen account? Registreer' : 'Al een account? Log in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function vertaal(msg = '') {
  if (msg.includes('Invalid login credentials')) return 'Onjuist e-mailadres of wachtwoord.'
  if (msg.includes('Email not confirmed')) return 'Bevestig eerst je e-mailadres via de mail die je ontving.'
  if (msg.includes('Password should be')) return 'Wachtwoord moet minstens 6 tekens bevatten.'
  if (msg.includes('already registered')) return 'Dit e-mailadres is al geregistreerd.'
  return msg
}
