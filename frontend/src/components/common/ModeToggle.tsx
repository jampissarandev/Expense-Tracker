import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Theme toggle button for the header.
 * Uses next-themes to switch between light, dark, and system modes.
 * Renders a sun/moon icon based on the current resolved theme.
 * The mounted state prevents hydration mismatch — server and first client
 * render both show the disabled placeholder icon, then the real toggle
 * appears after hydration.
 */
export function ModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Standard next-themes hydration guard.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" disabled aria-label="เปลี่ยนธีม">
        <SunIcon className="size-4" />
      </Button>
    )
  }

  const isLight = resolvedTheme === "light"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="เปลี่ยนธีม"
          >
            {isLight ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-muted" : ""}
        >
          <SunIcon className="mr-2 size-4" />
          สว่าง
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-muted" : ""}
        >
          <MoonIcon className="mr-2 size-4" />
          มืด
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className={theme === "system" ? "bg-muted" : ""}
        >
          <MonitorIcon className="mr-2 size-4" />
          ตามระบบ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
