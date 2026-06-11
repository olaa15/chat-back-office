"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { OverviewIcon, InvoiceIcon, SettingsIcon } from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", label: "Overview", Icon: OverviewIcon, exact: true },
  { href: "/dashboard/invoices", label: "Invoices", Icon: InvoiceIcon, exact: false },
  { href: "/dashboard/settings", label: "Settings", Icon: SettingsIcon, exact: false },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-sidebar-muted hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon
              size={18}
              className={active ? "text-brand" : "text-sidebar-muted group-hover:text-white"}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
