import { useLocation } from "react-router-dom"
import { MenuIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/layout/UserMenu"
import { ModeToggle } from "@/components/common/ModeToggle"
import { cn } from "@/lib/utils"

const PAGE_TITLES: ReadonlyArray<{ match: RegExp; title: string; subtitle: string }> = [
  { match: /^\/$/, title: "ภาพรวม", subtitle: "ภาพรวมรายรับรายจ่ายของคุณ" },
  {
    match: /^\/transactions$/,
    title: "รายการทั้งหมด",
    subtitle: "รายรับและรายจ่ายทั้งหมด",
  },
  { match: /^\/categories$/, title: "หมวดหมู่", subtitle: "จัดการหมวดหมู่รายรับรายจ่าย" },
]

function titleForPath(pathname: string): { title: string; subtitle: string } {
  const found = PAGE_TITLES.find((p) => p.match.test(pathname))
  return found
    ? { title: found.title, subtitle: found.subtitle }
    : { title: "", subtitle: "" }
}

export interface TopBarProps {
  /** Opens the mobile navigation sheet. */
  onMenuClick?: () => void
  /** Optional right-aligned actions injected by the page. */
  actions?: React.ReactNode
}

/**
 * Sticky top bar — desktop shows the page title + right-side actions,
 * mobile collapses to a hamburger + the page title only.
 */
export function TopBar({ onMenuClick, actions }: TopBarProps) {
  const { pathname } = useLocation()
  const { title, subtitle } = titleForPath(pathname)
  const hasCustomActions = Boolean(actions)

  return (
    <header
      className={cn(
        "bg-background/85 supports-[backdrop-filter]:bg-background/70 border-border sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6 lg:h-16 lg:px-8",
      )}
    >
      {onMenuClick ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMenuClick}
          aria-label="เปิดเมนูนำทาง"
          className="lg:hidden"
        >
          <MenuIcon />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        <h2 className="text-foreground truncate text-base font-semibold tracking-tight lg:hidden">
          {title}
        </h2>
        <div className="hidden min-w-0 lg:block">
          {hasCustomActions ? (
            <div className="flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {subtitle ? (
          <span className="text-muted-foreground hidden truncate text-sm lg:inline">
            {subtitle}
          </span>
        ) : null}
      </div>

      {hasCustomActions ? (
        <div className="hidden items-center gap-2 lg:hidden">{actions}</div>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
