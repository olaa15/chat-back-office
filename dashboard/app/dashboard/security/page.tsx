'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getBrowserClient } from '@/lib/supabase-client'

type State = 'loading' | 'enrolled' | 'enrolling' | 'done'

export default function SecurityPage() {
  const supabase = getBrowserClient()
  const router = useRouter()

  const [state, setState] = useState<State>('loading')
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    checkStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkStatus() {
    setState('loading')
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find((f) => f.status === 'verified')
    if (verified) {
      setFactorId(verified.id)
      setState('enrolled')
    } else {
      await startEnroll()
    }
  }

  async function startEnroll() {
    // Clear any stale unverified factor before starting fresh
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const stale = factors?.all?.find((f) => f.factor_type === 'totp' && f.status === 'unverified')
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id })

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
    })
    if (error) { setError(error.message); setState('enrolling'); return }
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
    setCode('')
    setError('')
    setState('enrolling')
  }

  async function verify() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    setBusy(false)
    if (error) return setError(error.message)
    setState('done')
  }

  async function remove() {
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (error) return setError(error.message)
    setConfirming(false)
    await startEnroll()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Security</h1>
        <p className="text-sm text-ink-muted">Manage two-factor authentication for your account.</p>
      </div>

      <div className="max-w-md rounded-xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-ink mb-1">Two-factor authentication</h2>

        {state === 'loading' && (
          <p className="text-sm text-ink-muted">Checking status…</p>
        )}

        {state === 'enrolled' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paid-bg px-2.5 py-1 text-xs font-medium text-paid-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Active
              </span>
              <span className="text-sm text-ink-muted">Your account is protected.</span>
            </div>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            {confirming ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-muted">Remove two-factor auth?</span>
                <button
                  disabled={busy}
                  onClick={remove}
                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {busy ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-ink-faint hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {state === 'enrolling' && (
          <div>
            <p className="text-sm text-ink-muted mb-4">
              Scan this QR code with Google Authenticator, Authy, or 1Password, then enter
              the 6-digit code to enable.
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="TOTP QR code" className="w-40 h-40 mb-4 rounded-lg border border-line" />
            )}
            {secret && (
              <p className="text-xs text-ink-muted mb-4">
                Or enter this key manually — save it in your password manager:
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
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ink/20"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={verify}
                disabled={busy || code.length !== 6 || !factorId}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors enabled:bg-ink enabled:text-bg disabled:bg-line disabled:text-ink-faint"
              >
                {busy ? 'Verifying…' : 'Enable two-factor auth'}
              </button>
              <Link href="/dashboard" className="text-xs text-ink-muted hover:text-ink">
                Skip for now
              </Link>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paid-bg px-2.5 py-1 text-xs font-medium text-paid-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Active
              </span>
              <span className="text-sm text-ink-muted">Two-factor auth is now enabled.</span>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-ink hover:underline">
              Back to dashboard →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
