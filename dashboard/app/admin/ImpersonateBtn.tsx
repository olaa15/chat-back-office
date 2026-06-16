'use client'
import { useState, useTransition } from 'react'
import { getImpersonateLinkAction } from './actions'

export function ImpersonateBtn({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function confirm() {
    startTransition(async () => {
      try {
        const url = await getImpersonateLinkAction(email)
        setLink(url)
        setConfirming(false)
      } catch {
        alert('Failed to generate login link.')
        setConfirming(false)
      }
    })
  }

  if (link) {
    return (
      <span className="flex items-center gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="text-xs font-medium text-ink-muted hover:text-ink transition-colors"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-paid-fg hover:underline"
        >
          Open
        </a>
        <button onClick={() => setLink(null)} className="text-xs text-ink-faint hover:text-ink">
          ✕
        </button>
      </span>
    )
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs text-ink-muted">Impersonate {email}?</span>
        <button
          disabled={pending}
          onClick={confirm}
          className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-50"
        >
          {pending ? 'Generating…' : 'Yes, generate link'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-ink-muted hover:text-amber-600 transition-colors"
    >
      Impersonate
    </button>
  )
}
