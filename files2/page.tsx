import { getServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import { CoinIcon, StackIcon, CheckIcon, DownloadIcon, ArrowIcon } from "@/components/icons";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-draft-bg text-draft-fg",
  sent: "bg-sent-bg text-sent-fg",
  paid: "bg-paid-bg text-paid-fg",
  overdue: "bg-overdue-bg text-overdue-fg",
  cancelled: "bg-draft-bg text-ink-faint",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLE[status] ?? "bg-draft-bg text-draft-fg"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function formatMoney(amount: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export default async function DashboardPage() {
  const supabase = await getServerClient();

  const { data: memberships } = await supabase
    .from("business_members")
    .select("business_id")
    .limit(1)
    .single();

  const businessId = memberships?.business_id;

  if (!businessId) {
    return (
      <div className="grid place-items-center rounded-card border border-line bg-surface py-24 text-center shadow-soft">
        <p className="text-ink-muted">Your account isn&apos;t linked to a business yet.</p>
      </div>
    );
  }

  const [{ data: invoices }, { data: outstandingRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, client_name, total, currency, status, issue_date, pdf_path")
      .eq("business_id", businessId)
      .order("issue_date", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("total")
      .eq("business_id", businessId)
      .in("status", ["sent", "overdue"]),
  ]);

  const outstanding = (outstandingRows ?? []).reduce((s, r) => s + Number(r.total), 0);
  const totalInvoices = invoices?.length ?? 0;
  const paidCount = (invoices ?? []).filter((i) => i.status === "paid").length;

  const invoicesWithUrls = await Promise.all(
    (invoices ?? []).map(async (inv) => {
      let downloadUrl: string | null = null;
      if (inv.pdf_path) {
        const { data } = await supabase.storage
          .from("invoices")
          .createSignedUrl(inv.pdf_path, 300);
        downloadUrl = data?.signedUrl ?? null;
      }
      return { ...inv, downloadUrl };
    })
  );

  const stats = [
    { label: "Outstanding", value: formatMoney(outstanding), Icon: CoinIcon, accent: true },
    { label: "Recent invoices", value: String(totalInvoices), Icon: StackIcon, accent: false },
    { label: "Paid", value: String(paidCount), Icon: CheckIcon, accent: false },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <header className="animate-rise">
        <p className="text-sm font-medium text-brand">Overview</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
          Your business at a glance
        </h1>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-rise rounded-card border border-line bg-surface p-5 shadow-soft"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-ink-muted">{s.label}</p>
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  s.accent ? "bg-brand-soft text-brand" : "bg-paper text-ink-faint"
                }`}
              >
                <s.Icon size={18} />
              </span>
            </div>
            <p
              className={`mt-3 font-display text-3xl font-semibold tracking-tight tnum ${
                s.accent ? "text-brand-strong" : "text-ink"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent invoices */}
      <section
        className="animate-rise overflow-hidden rounded-card border border-line bg-surface shadow-card"
        style={{ animationDelay: "320ms" }}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Recent invoices</h2>
          <Link
            href="/dashboard/invoices"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-brand"
          >
            View all
            <ArrowIcon size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {invoicesWithUrls.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-paper text-ink-faint">
              <StackIcon size={22} />
            </span>
            <p className="text-sm font-medium text-ink">No invoices yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Create your first one by messaging the bot on Telegram.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoicesWithUrls.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-paper/70">
                    <td className="px-6 py-4 font-mono text-xs font-medium text-ink-muted">
                      {inv.invoice_number}
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">{inv.client_name}</td>
                    <td className="px-6 py-4 tnum text-ink">
                      {formatMoney(Number(inv.total), inv.currency)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-6 py-4 text-ink-muted">
                      {new Date(inv.issue_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.downloadUrl && (
                        <a
                          href={inv.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand hover:text-brand"
                        >
                          <DownloadIcon size={14} />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
