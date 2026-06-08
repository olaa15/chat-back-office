import { getServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import Nav from "./Nav";
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

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar px-4 py-5 lg:flex">
        <div className="px-2 pb-6">
          <Logo tone="dark" />
        </div>

        <Nav />

        <div className="mt-auto border-t border-sidebar-line pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-semibold text-brand">
              {initial}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-sidebar-muted">
              {user.email}
            </span>
          </div>
          <div className="px-1 pt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-sidebar px-4 py-3 lg:hidden">
        <Logo tone="dark" />
        <SignOutButton />
      </header>

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
