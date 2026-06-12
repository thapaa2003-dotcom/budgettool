import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, SectionTitle } from './ui'

export default function Settings({ profile, saveProfile, theme, setTheme }) {
  const [mfa, setMfa] = useState(null) // { qr, secret, factorId }
  const [code, setCode] = useState('')
  const [mfaMsg, setMfaMsg] = useState('')

  const startMfa = async () => {
    setMfaMsg('')
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'ConFin' })
    if (error) { setMfaMsg(error.message.includes('already') ? '2FA is al ingesteld op dit account.' : error.message); return }
    setMfa({ qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id })
  }

  const verifyMfa = async () => {
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfa.factorId })
    if (cErr) { setMfaMsg(cErr.message); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfa.factorId, challengeId: challenge.id, code })
    if (error) setMfaMsg('Code onjuist, probeer opnieuw.')
    else { setMfaMsg('2FA geactiveerd ✓ Vanaf nu vraagt elke login een code.'); setMfa(null) }
  }

  return (
    <div>
      <SectionTitle>Instellingen</SectionTitle>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <div className="label">Weergave</div>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex items-center gap-3 text-sm mt-1">
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-gold-500' : 'bg-slate-300'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`} />
            </span>
            {theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}
          </button>
        </Card>
        <Card>
          <div className="label">Profiel</div>
          <div className="space-y-2 mt-1">
            <input className="input" value={profile.naam || ''} placeholder="Naam"
              onChange={(e) => saveProfile({ naam: e.target.value })} />
            <div className="flex items-center gap-2 text-sm">
              <span className="muted shrink-0">Overgang hoofdberoep:</span>
              <input className="input" type="date" value={profile.overgangsdatum || ''}
                onChange={(e) => saveProfile({ overgangsdatum: e.target.value })} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="label">Tweestapsverificatie (2FA)</div>
          {!mfa ? (
            <>
              <p className="text-sm muted mb-3">Beveilig je account met Google Authenticator of Authy.</p>
              <button className="btn-gold" onClick={startMfa}>2FA instellen</button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm muted">Scan deze QR-code met je authenticator-app en voer de code in:</p>
              <img src={mfa.qr} alt="2FA QR-code" className="w-40 h-40 bg-white rounded-xl p-2" />
              <p className="text-xs muted break-all">Of voer manueel in: {mfa.secret}</p>
              <div className="flex gap-2">
                <input className="input !w-32 text-center tracking-widest" maxLength={6} inputMode="numeric"
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="······" />
                <button className="btn-gold" onClick={verifyMfa}>Activeer</button>
              </div>
            </div>
          )}
          {mfaMsg && <p className="text-sm text-gold-400 mt-2">{mfaMsg}</p>}
        </Card>
        <Card>
          <div className="label">Account</div>
          <p className="text-sm muted mb-3">Je data synct automatisch in realtime tussen je GSM en PC via Supabase.</p>
          <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
        </Card>
      </div>
      <p className="text-xs muted mt-4">CSV-export van al je transacties vind je op het tabblad Transacties.</p>
    </div>
  )
}
