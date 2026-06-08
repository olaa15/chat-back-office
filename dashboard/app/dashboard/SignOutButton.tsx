"use client";

import { getBrowserClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/icons";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white"
    >
      <LogoutIcon size={16} />
      Sign out
    </button>
  );
}
