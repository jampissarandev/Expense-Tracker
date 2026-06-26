import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { ModeToggle } from "@/components/common/ModeToggle";

export interface HeaderProps {
  /** Opens the mobile navigation sheet. */
  onMenuClick?: () => void;
  /** Optional element rendered to the left of the user menu (e.g. page title). */
  children?: React.ReactNode;
}

export function Header({ onMenuClick, children }: HeaderProps) {
  return (
    <header className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
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
      <div className="flex-1">{children}</div>
      <ModeToggle />
      <UserMenu />
    </header>
  );
}
