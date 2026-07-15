import { Link, useLocation } from "react-router-dom";
import { LogOutIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/use-auth";
import { useLogout } from "@/hooks/useLogout";

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Header user menu: avatar + display name with a dropdown containing
 * "Profile" (placeholder) and "Logout".
 */
export function UserMenu() {
  const { user } = useAuth();
  const { logout, isLoggingOut } = useLogout();
  const location = useLocation();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-2" aria-label="เปิดเมนูผู้ใช้" />
        }
      >
        <Avatar size="sm" className="ring-border ring-1">
          <AvatarFallback>{initialsFor(user.displayName)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{user.displayName}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm font-medium">{user.displayName}</span>
              <span className="text-muted-foreground text-xs">{user.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            render={
              <Link to="/profile" state={{ from: location.pathname }} aria-label="ไปหน้าโปรไฟล์" />
            }
          >
            <UserIcon />
            โปรไฟล์
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logout();
          }}
          disabled={isLoggingOut}
          aria-label="ออกจากระบบ"
        >
          <LogOutIcon />
          {isLoggingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
