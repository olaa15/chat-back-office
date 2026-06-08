import { getServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import { DownloadIcon, InvoiceIcon } from "@/components/icons";

const STATUSES = [
  { key: undefined, label: "All" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "draft", label: "Draft" },
];

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

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
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

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, client_name, total, currency, status, issue_date, due_date, pdf_path"
    )
    .eq("business_id", businessId)
    .order("issue_date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: invoices } = await query;

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

  return (
    <div className="space-y-7">
      <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Invoices</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            All invoices
          </h1>
        </div>

        {/* Segmented filter */}
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
          {STATUSES.map((s) => {
            const active = s.key === status || (s.key === undefined && !status);
            const href = s.key ? `/dashboard/invoices?status=${s.key}` : "/dashboard/invoices";
            return (
              <Link
                key={s.label}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-ink text-white"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </header>

      <section
        className="animate-rise overflow-hidden rounded-card border border-line bg-surface shadow-card"
        style={{ animationDelay: "100ms" }}
      >
        {invoicesWithUrls.length === 0 ? (
          <div className="grid place-items-center px-6 py-16 text-center">
            <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-paper text-ink-faint">
              <InvoiceIcon size={22} />
            </span>
            <p className="text-sm font-medium text-ink">No invoices found</p>
            <p className="mt-1 text-sm text-ink-muted">Try a different filter, or create one via Telegram.</p>
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
                  <th className="px-6 py-3 font-medium">Issued</th>
                  <th className="px-6 py-3 font-medium">Due</th>
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
                    <td className="px-6 py-4 text-ink-muted">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GB") : "—"}
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
