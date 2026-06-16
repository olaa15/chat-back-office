'use client'
import { useState, useMemo } from 'react'
import { ImpersonateBtn } from './ImpersonateBtn'

export type UserRow = {
  id: string
  email: string
  business: string
  confirmed: boolean
  lastSignIn: string | null
  createdAt: string
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-ink-faint">
      {children}
    </th>
  )
}

function Td({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <td className={`px-4 py-3 ${className}`} title={title}>{children}</td>
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'verified' && !u.confirmed) return false
      if (filter === 'pending' && u.confirmed) return false
      if (!q) return true
      return u.email.toLowerCase().includes(q) || u.business.toLowerCase().includes(q)
    })
  }, [users, search, filter])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search by email or business…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-paid-fg/30"
        />
        <div className="flex gap-1">
          {(['all', 'verified', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors border ${
                filter === f
                  ? 'bg-ink-faint/15 border-line-strong text-ink'
                  : 'bg-surface border-line text-ink-muted hover:text-ink'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-ink-faint/5">
              {['Email', 'Business', 'Status', 'Last sign-in', 'Joined', 'Actions'].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-b border-line last:border-0 hover:bg-ink-faint/5 transition-colors"
              >
                <Td className="font-medium text-ink">{u.email}</Td>
                <Td className="text-ink-muted">{u.business}</Td>
                <Td>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.confirmed
                        ? 'bg-paid-bg text-paid-fg'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {u.confirmed ? 'Verified' : 'Pending'}
                  </span>
                </Td>
                <Td className="text-ink-faint text-xs" title={u.lastSignIn ?? undefined}>
                  {relativeTime(u.lastSignIn)}
                </Td>
                <Td className="text-ink-faint text-xs">
                  {new Date(u.createdAt).toLocaleDateString('en-GB')}
                </Td>
                <Td>{u.email !== '—' && <ImpersonateBtn email={u.email} />}</Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted text-sm">
                  {search || filter !== 'all' ? 'No users match your filter.' : 'No users found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-faint">
        Showing {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
