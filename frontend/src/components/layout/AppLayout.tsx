import { useState, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/**
 * Authenticated app shell:
 * - Desktop (lg+): fixed sidebar on the left, sticky TopBar on top, content fills the rest.
 * - Mobile (<lg): hidden sidebar; a hamburger in the TopBar opens a side `Sheet`;
 *   a bottom `MobileTabBar` provides primary navigation.
 *
 * Wraps the routed page via `<Outlet />` so individual pages do not have to
 * know about the shell.
 */
export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleAddTransaction = useCallback(() => {
    navigate("/transactions");
  }, [navigate]);

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
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="flex-1 px-4 py-6 pb-16 sm:px-6 lg:px-8 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar onAdd={handleAddTransaction} />
    </div>
  );
}
