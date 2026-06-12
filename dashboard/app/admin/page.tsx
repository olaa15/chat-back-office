import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getServerClient } from '@/lib/supabase-server'
import { adminClient } from '@/lib/supabase-admin'
import { AdminTabs, type AdminTab } from './AdminTabs'
import { DeleteBusinessBtn } from './DeleteBusinessBtn'
import { ImpersonateBtn } from './ImpersonateBtn'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n)
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-1">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-ink-faint">
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>
}

// ─── revenue bar chart (SVG, no library) ────────────────────────────────────

function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const barW = 22
  const gap = 6
  const chartH = 80
  const totalW = data.length * (barW + gap) - gap

  return (
    <svg
      width={totalW}
      height={chartH + 28}
      viewBox={`0 0 ${totalW} ${chartH + 28}`}
      aria-label="Monthly revenue"
    >
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, d.value > 0 ? 2 : 0)
        const x = i * (barW + gap)
        const y = chartH - barH
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              className="fill-paid-fg"
              opacity={0.75}
            />
            <text
              x={x + barW / 2}
              y={chartH + 18}
              textAnchor="middle"
              fontSize={9}
              className="fill-ink-faint"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── data fetching ───────────────────────────────────────────────────────────

async function fetchBusinessRows() {
  const { data: businesses } = await adminClient
    .from('businesses')
    .select('id, name, country, currency, created_at')
    .order('created_at', { ascending: false })

  if (!businesses) return []

  return Promise.all(
    businesses.map(async (biz) => {
      const [{ data: invoices }, { data: members }, { data: tgLink }] = await Promise.all([
        adminClient
          .from('invoices')
          .select('total, status, currency, issue_date')
          .eq('business_id', biz.id),
        adminClient.from('business_members').select('user_id').eq('business_id', biz.id),
        adminClient
          .from('telegram_links')
          .select('telegram_user_id')
          .eq('business_id', biz.id)
          .maybeSingle(),
      ])

      const invoiceList = invoices ?? []
      const totalInvoiced = invoiceList.reduce((s, i) => s + Number(i.total ?? 0), 0)
      const paidTotal = invoiceList
        .filter((i) => i.status === 'paid')
        .reduce((s, i) => s + Number(i.total ?? 0), 0)

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const isActive = invoiceList.some(
        (i) => new Date(i.issue_date) >= thirtyDaysAgo,
      )

      let email = '—'
      if (members?.[0]?.user_id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(members[0].user_id)
        email = authUser?.user?.email ?? '—'
      }

      return {
        ...biz,
        email,
        invoiceCount: invoiceList.length,
        paidCount: invoiceList.filter((i) => i.status === 'paid').length,
        totalInvoiced,
        paidTotal,
        telegramLinked: !!tgLink?.telegram_user_id,
        isActive,
      }
    }),
  )
}

async function fetchRevenueChart() {
  const start = new Date()
  start.setMonth(start.getMonth() - 11)
  start.setDate(1)

  const { data: invoices } = await adminClient
    .from('invoices')
    .select('total, issue_date')
    .gte('issue_date', start.toISOString().split('T')[0])

  const monthMap = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, 0)
  }
  for (const inv of invoices ?? []) {
    const key = (inv.issue_date as string).substring(0, 7)
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + Number(inv.total ?? 0))
  }
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return Array.from(monthMap.entries()).map(([key, value]) => ({
    label: MONTHS[new Date(key + '-15').getMonth()],
    value,
  }))
}

async function fetchUsers() {
  const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error || !users) return []

  const { data: members } = await adminClient
    .from('business_members')
    .select('user_id, business_id, businesses(name)')

  const bizByUser = new Map<string, string>()
  for (const m of members ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bizByUser.set(m.user_id, (m as any).businesses?.name ?? '—')
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email ?? '—',
    business: bizByUser.get(u.id) ?? '—',
    confirmed: !!u.email_confirmed_at,
    lastSignIn: u.last_sign_in_at ?? null,
    createdAt: u.created_at,
  }))
}

// ─── tab content ─────────────────────────────────────────────────────────────

async function OverviewTab() {
  const [rows, chart] = await Promise.all([fetchBusinessRows(), fetchRevenueChart()])

  const totalBusinesses = rows.length
  const totalLinked = rows.filter((r) => r.telegramLinked).length
  const activeCount = rows.filter((r) => r.isActive).length
  const grandTotal = rows.reduce((s, r) => s + r.totalInvoiced, 0)
  const grandPaid = rows.reduce((s, r) => s + r.paidTotal, 0)

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card label="Businesses" value={totalBusinesses} />
        <Card label="Active (30 d)" value={`${activeCount} / ${totalBusinesses}`} />
        <Card label="Telegram linked" value={`${totalLinked} / ${totalBusinesses}`} />
        <Card label="Total invoiced" value={fmt(grandTotal)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-4">
            Revenue last 12 months (all currencies)
          </p>
          <div className="overflow-x-auto">
            <RevenueChart data={chart} />
          </div>
        </div>

        {/* Active vs inactive */}
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-4">
            Activity breakdown
          </p>
          <div className="space-y-3">
            {[
              { label: 'Active (invoice in 30 d)', count: activeCount, color: 'bg-paid-fg' },
              { label: 'Inactive', count: totalBusinesses - activeCount, color: 'bg-draft-bg' },
              { label: 'Telegram linked', count: totalLinked, color: 'bg-sent-fg' },
              { label: 'No Telegram', count: totalBusinesses - totalLinked, color: 'bg-line-strong' },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-ink-muted mb-1">
                  <span>{label}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: totalBusinesses > 0 ? `${(count / totalBusinesses) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-line flex justify-between text-sm">
            <span className="text-ink-muted">Total collected</span>
            <span className="font-semibold text-paid-fg">{fmt(grandPaid)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

async function BusinessesTab() {
  const rows = await fetchBusinessRows()

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-ink-faint/5">
            {['Business', 'Email', 'Country', 'Telegram', 'Invoices', 'Invoiced', 'Collected', 'Status', 'Joined', 'Actions'].map(
              (h) => <Th key={h}>{h}</Th>,
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0 hover:bg-ink-faint/5 transition-colors">
              <Td className="font-medium text-ink">{r.name}</Td>
              <Td className="text-ink-muted">{r.email}</Td>
              <Td className="text-ink-muted">{r.country}</Td>
              <Td>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.telegramLinked ? 'bg-paid-bg text-paid-fg' : 'bg-draft-bg text-ink-faint'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {r.telegramLinked ? 'Linked' : 'Not linked'}
                </span>
              </Td>
              <Td className="text-ink-muted">
                {r.invoiceCount} ({r.paidCount} paid)
              </Td>
              <Td className="text-ink-muted">{fmt(r.totalInvoiced, r.currency)}</Td>
              <Td className="font-medium text-paid-fg">{fmt(r.paidTotal, r.currency)}</Td>
              <Td>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.isActive ? 'bg-paid-bg text-paid-fg' : 'bg-draft-bg text-ink-faint'
                  }`}
                >
                  {r.isActive ? 'Active' : 'Inactive'}
                </span>
              </Td>
              <Td className="text-ink-faint text-xs">
                {new Date(r.created_at).toLocaleDateString('en-GB')}
              </Td>
              <Td>
                <DeleteBusinessBtn businessId={r.id} businessName={r.name} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function UsersTab() {
  const users = await fetchUsers()

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-ink-faint/5">
            {['Email', 'Business', 'Confirmed', 'Last sign-in', 'Joined', 'Actions'].map((h) => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0 hover:bg-ink-faint/5 transition-colors">
              <Td className="font-medium text-ink">{u.email}</Td>
              <Td className="text-ink-muted">{u.business}</Td>
              <Td>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.confirmed ? 'bg-paid-bg text-paid-fg' : 'bg-sent-bg text-sent-fg'
                  }`}
                >
                  {u.confirmed ? 'Verified' : 'Unverified'}
                </span>
              </Td>
              <Td className="text-ink-faint text-xs">
                {u.lastSignIn
                  ? new Date(u.lastSignIn).toLocaleDateString('en-GB')
                  : 'Never'}
              </Td>
              <Td className="text-ink-faint text-xs">
                {new Date(u.createdAt).toLocaleDateString('en-GB')}
              </Td>
              <Td>
                {u.email !== '—' && <ImpersonateBtn email={u.email} />}
              </Td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-ink-muted text-sm">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const supabase = await getServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const { tab } = await searchParams
  const activeTab: AdminTab =
    tab === 'businesses' || tab === 'users' ? tab : 'overview'

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">Admin</h1>
        <p className="text-sm text-ink-muted mb-6">All businesses on Ordeva</p>

        <Suspense>
          <AdminTabs active={activeTab} />
        </Suspense>

        <Suspense fallback={<p className="text-ink-muted text-sm">Loading…</p>}>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'businesses' && <BusinessesTab />}
          {activeTab === 'users' && <UsersTab />}
        </Suspense>
      </div>
    </div>
  )
}
