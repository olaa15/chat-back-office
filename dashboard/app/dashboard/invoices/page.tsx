import { getServerClient } from "@/lib/supabase-server";

const STATUSES = [
  { key: undefined, label: "All" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "draft", label: "Draft" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
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
      <div className="text-center py-20 text-gray-500">
        Your account isn&apos;t linked to a business yet.
      </div>
    );
  }

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, client_name, total, currency, status, issue_date, due_date, pdf_path")
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {STATUSES.map((s) => {
          const active = s.key === status || (s.key === undefined && !status);
          const href = s.key ? `/dashboard/invoices?status=${s.key}` : "/dashboard/invoices";
          return (
            <a
              key={s.label}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        {invoicesWithUrls.length === 0 ? (
          <p className="px-6 py-10 text-center text-gray-400 text-sm">
            No invoices found.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Issued</th>
                <th className="px-6 py-3 font-medium">Due</th>
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
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOUR[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(inv.issue_date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {inv.due_date
                      ? new Date(inv.due_date).toLocaleDateString("en-GB")
                      : "—"}
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
