'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase-client'

export default function VerifyMfa() {
  const supabase = getBrowserClient()
  const router = useRouter()
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = data?.totp?.find((f) => f.status === 'verified')
      if (!totp) return router.replace('/admin/enroll')
      setFactorId(totp.id)
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
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">Enter your code</h1>
        <p className="text-sm text-ink-muted mb-6">
          Open your authenticator app and enter the 6-digit code.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !busy && verify()}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        <button
          onClick={verify}
          disabled={busy || code.length !== 6 || !factorId}
          className="rounded-lg bg-ink text-bg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {busy ? 'Verifying…' : 'Verify & continue'}
        </button>
      </div>
    </div>
  )
}
