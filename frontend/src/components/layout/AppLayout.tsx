import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Authenticated app shell:
 * - Desktop (lg+): fixed sidebar on the left, sticky header on top, content fills the rest.
 * - Mobile (<lg): hidden sidebar; a hamburger in the header opens a side `Sheet`.
 *
 * Wraps the routed page via `<Outlet />` so individual pages do not have to
 * know about the shell.
 */
export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        aria-label="แถบเมนูหลัก"
        className="sticky top-0 hidden h-screen shrink-0 self-start lg:block"
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" showCloseButton className="w-64 max-w-[80vw] gap-0 border-r p-0">
          <Sidebar showBrand onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
