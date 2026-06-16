'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase-client'

export default function EnrollMfa() {
  const supabase = getBrowserClient()
  const router = useRouter()
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      // Clear any half-finished factor from a previous attempt before enrolling
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const stale = factors?.all?.find((f) => f.factor_type === 'totp' && f.status === 'unverified')
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id })

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Admin',
      })
      if (error) return setError(error.message)
      setQr(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) return setError(error.message)
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Set up two-factor</h1>
        <p className="text-sm text-ink-muted mb-6">
          Scan this with Google Authenticator, Authy, or 1Password, then enter the 6-digit code.
        </p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="TOTP QR code" className="w-44 h-44 mb-4 rounded-lg border border-line" />
        )}
        {secret && (
          <p className="text-xs text-ink-muted mb-4">
            Or enter this key manually — save it in your password manager as backup:
            <br />
            <code className="text-ink font-mono break-all">{secret}</code>
          </p>
        )}
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !busy && verify()}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button
          onClick={verify}
          disabled={busy || code.length !== 6 || !factorId}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors enabled:bg-ink enabled:text-bg disabled:bg-line disabled:text-ink-faint"
        >
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
      </div>
    </div>
  )
}
