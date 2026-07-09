import { NavLink } from "react-router-dom"
import {
  LayoutDashboardIcon,
  PlusIcon,
  ReceiptTextIcon,
  TagsIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TabItem {
  to: string
  label: string
  icon: typeof LayoutDashboardIcon
  end?: boolean
  /** Center "Add" button — only one per bar. */
  isPrimary?: boolean
}

const TABS: ReadonlyArray<TabItem> = [
  { to: "/", label: "ภาพรวม", icon: LayoutDashboardIcon, end: true },
  { to: "/transactions", label: "รายการ", icon: ReceiptTextIcon },
  { to: "/categories", label: "หมวดหมู่", icon: TagsIcon },
]

export interface MobileTabBarProps {
  /** Called when the center "Add" button is pressed. */
  onAdd?: () => void
}

/**
 * Bottom tab bar for the mobile (<lg) shell.
 *
 * Two regular tabs on each side of a raised primary "Add" button — the
 * canonical pattern for transactional apps (Cash App, Wise, etc.). The
 * bar uses a top hairline border and a soft elevation so it never
 * competes with page content.
 */
export function MobileTabBar({ onAdd }: MobileTabBarProps) {
  return (
    <nav
      aria-label="เมนูนำทางด้านล่าง"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 border-border fixed inset-x-0 bottom-0 z-40 flex h-16 items-end border-t px-2 pb-2 backdrop-blur lg:hidden"
    >
      <ul
        className="grid w-full grid-cols-5 items-end"
        role="list"
      >
        {TABS.slice(0, 1).map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
        {TABS.slice(1, 2).map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}

        {/* Center primary action — "Add transaction" */}
        <li className="flex justify-center pb-1">
          <button
            type="button"
            onClick={onAdd}
            aria-label="เพิ่มรายการใหม่"
            className={cn(
              "bg-primary text-primary-foreground shadow-sm",
              "flex size-12 items-center justify-center rounded-full",
              "transition-transform active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
            )}
          >
            <PlusIcon className="size-5" aria-hidden="true" />
          </button>
        </li>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
        {/* Spacer to keep grid 5 columns balanced */}
        <li aria-hidden="true" />
      </ul>
    </nav>
  )
}

function TabLink({ tab }: { tab: TabItem }) {
  return (
    <li>
      <NavLink
        to={tab.to}
        end={tab.end}
        className={({ isActive }) =>
          cn(
            "flex h-full min-h-12 flex-col items-center justify-center gap-1 rounded-md py-1.5 text-xs",
            "transition-colors",
            isActive
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )
        }
        aria-label={tab.label}
      >
        {({ isActive }) => (
          <>
            <tab.icon
              className={cn(
                "size-5 shrink-0 transition-opacity",
                isActive ? "opacity-100" : "opacity-80",
              )}
              aria-hidden="true"
            />
            <span className="leading-none">{tab.label}</span>
          </>
        )}
      </NavLink>
    </li>
  )
}
