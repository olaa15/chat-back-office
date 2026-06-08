import { getServerClient } from "@/lib/supabase-server";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const STATUS_COLOUR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-400",
};

function formatGBP(amount: number, currency = "GBP") {
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
      <div className="text-center py-20 text-gray-500">
        Your account isn&apos;t linked to a business yet.
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

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatGBP(outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Recent invoices</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{paidCount}</p>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent invoices</h2>
          <a href="/dashboard/invoices" className="text-sm text-gray-500 hover:text-gray-900">
            View all →
          </a>
        </div>
        {invoicesWithUrls.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">
            No invoices yet. Create one via Telegram.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoicesWithUrls.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-gray-700">
                    {inv.invoice_number}
                  </td>
                  <td className="px-6 py-4 text-gray-900">{inv.client_name}</td>
                  <td className="px-6 py-4 text-gray-900">
                    {formatGBP(Number(inv.total), inv.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOUR[inv.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(inv.issue_date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {inv.downloadUrl && (
                      <a
                        href={inv.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-900 transition-colors text-xs"
                      >
                        PDF ↓
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
