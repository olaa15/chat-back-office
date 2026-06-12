'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'users', label: 'Users' },
] as const

export type AdminTab = (typeof TABS)[number]['key']

export function AdminTabs({ active }: { active: AdminTab }) {
  const router = useRouter()
  const params = useSearchParams()

  return (
    <div className="flex gap-1 mb-8 border-b border-line">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => {
            const next = new URLSearchParams(params.toString())
            next.set('tab', t.key)
            router.push(`/admin?${next.toString()}`)
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t.key
              ? 'border-ink text-ink'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
