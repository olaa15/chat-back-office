'use client'
import { useState, useTransition } from 'react'
import { getImpersonateLinkAction } from './actions'

export function ImpersonateBtn({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function generate() {
    startTransition(async () => {
      try {
        const url = await getImpersonateLinkAction(email)
        setLink(url)
      } catch {
        alert('Failed to generate login link.')
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

  return (
    <button
      disabled={pending}
      onClick={generate}
      className="text-xs text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
    >
      {pending ? 'Generating…' : 'Impersonate'}
    </button>
  )
}
