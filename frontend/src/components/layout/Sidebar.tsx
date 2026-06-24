import { NavLink } from "react-router-dom";
import { LayoutDashboardIcon, ReceiptTextIcon, TagsIcon, WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboardIcon;
  end?: boolean;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: "/", label: "แดชบอร์ด", icon: LayoutDashboardIcon, end: true },
  { to: "/transactions", label: "รายการ", icon: ReceiptTextIcon },
  { to: "/categories", label: "หมวดหมู่", icon: TagsIcon },
];

export interface SidebarProps {
  /** Render the brand at the top (e.g. when shown on its own inside a Sheet). */
  showBrand?: boolean;
  /** Optional click handler invoked when a nav link is clicked (e.g. close the mobile sheet). */
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ showBrand = true, onNavigate, className }: SidebarProps) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        "border-border bg-card flex h-full w-64 flex-col gap-2 border-r p-4",
        className,
      )}
    >
      {showBrand ? (
        <div className="flex items-center gap-2 px-2 pb-2">
          <div
            className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md"
            aria-hidden="true"
          >
            <WalletIcon className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-foreground text-sm font-semibold">Expense Tracker</span>
            <span className="text-muted-foreground text-xs">บัญชีของคุณ</span>
          </div>
        </div>
      ) : null}

      <ul className="flex flex-1 flex-col gap-1" role="list">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "bg-primary/10 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
