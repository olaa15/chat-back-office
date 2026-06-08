import { getServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SignOutButton from "./SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-900">My Back Office</span>
            <nav className="flex gap-4 text-sm">
              <a
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Overview
              </a>
              <a
                href="/dashboard/invoices"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Invoices
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
