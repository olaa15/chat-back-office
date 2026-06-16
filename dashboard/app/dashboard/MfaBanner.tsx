'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase-client'

export function MfaBanner() {
  const supabase = getBrowserClient()
  const router = useRouter()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('mfa-banner-dismissed')) return
    ;(async () => {
      const { data } = await supabase.auth.mfa.listFactors()
      const enrolled = data?.totp?.some((f) => f.status === 'verified')
      if (!enrolled) setShow(true)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!show) return null

  function dismiss() {
    sessionStorage.setItem('mfa-banner-dismissed', '1')
    setShow(false)
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="text-amber-800">
        <span className="font-semibold">Recommended:</span> secure your account with
        two-factor authentication.
      </span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/security')}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          Set up
        </button>
        <button
          onClick={dismiss}
          className="text-xs text-amber-700 hover:text-amber-900 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
