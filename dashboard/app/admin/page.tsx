import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase-server";
import { adminClient } from "@/lib/supabase-admin";

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-paid-bg text-paid-fg",
  sent: "bg-sent-bg text-sent-fg",
};

function fmt(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
}

export default async function AdminPage() {
  // Guard: only the admin email may access this page
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) redirect("/dashboard");

  // Fetch all businesses
  const { data: businesses } = await adminClient
    .from("businesses")
    .select("id, name, country, currency, created_at")
    .order("created_at", { ascending: false });

  if (!businesses) return <p className="p-8 text-ink-muted">No data.</p>;

  // For each business, fetch invoice stats + linked telegram user
  const rows = await Promise.all(
    businesses.map(async (biz) => {
      const [{ data: invoices }, { data: members }, { data: tgLink }] = await Promise.all([
        adminClient
          .from("invoices")
          .select("total, status, currency")
          .eq("business_id", biz.id),
        adminClient
          .from("business_members")
          .select("user_id")
          .eq("business_id", biz.id),
        adminClient
          .from("telegram_links")
          .select("telegram_user_id")
          .eq("business_id", biz.id)
          .maybeSingle(),
      ]);

      const invoiceList = invoices ?? [];
      const totalInvoiced = invoiceList.reduce((sum, i) => sum + Number(i.total ?? 0), 0);
      const paidTotal = invoiceList
        .filter((i) => i.status === "paid")
        .reduce((sum, i) => sum + Number(i.total ?? 0), 0);
      const paidCount = invoiceList.filter((i) => i.status === "paid").length;

      // Resolve member email from auth.users
      let email = "—";
      if (members?.[0]?.user_id) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(members[0].user_id);
        email = authUser?.user?.email ?? "—";
      }

      return {
        ...biz,
        email,
        invoiceCount: invoiceList.length,
        paidCount,
        totalInvoiced,
        paidTotal,
        telegramLinked: !!tgLink?.telegram_user_id,
      };
    })
  );

  const totalBusinesses = rows.length;
  const totalLinked = rows.filter((r) => r.telegramLinked).length;
  const grandTotal = rows.reduce((s, r) => s + r.totalInvoiced, 0);
  const grandPaid = rows.reduce((s, r) => s + r.paidTotal, 0);

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-semibold text-ink mb-1">Admin</h1>
        <p className="text-sm text-ink-muted mb-8">All businesses on Ordeva</p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Businesses", value: totalBusinesses },
            { label: "Telegram linked", value: `${totalLinked} / ${totalBusinesses}` },
            { label: "Total invoiced", value: fmt(grandTotal) },
            { label: "Total collected", value: fmt(grandPaid) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-1">{label}</p>
              <p className="text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-ink-faint/5">
                {["Business", "Email", "Country", "Telegram", "Invoices", "Invoiced", "Collected", "Joined"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-ink-faint/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.email}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.country}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${r.telegramLinked ? "bg-paid-bg text-paid-fg" : "bg-draft-bg text-ink-faint"}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {r.telegramLinked ? "Linked" : "Not linked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{r.invoiceCount} ({r.paidCount} paid)</td>
                  <td className="px-4 py-3 text-ink-muted">{fmt(r.totalInvoiced, r.currency)}</td>
                  <td className="px-4 py-3 font-medium text-paid-fg">{fmt(r.paidTotal, r.currency)}</td>
                  <td className="px-4 py-3 text-ink-faint text-xs">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
