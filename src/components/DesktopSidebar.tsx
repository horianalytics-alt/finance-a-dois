import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3, Database, Download, Settings, LayoutDashboard,
  Plus, Eye, EyeOff, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteSwitcher } from "@/components/PaletteSwitcher";

const NAV_ITEMS = [
  { to: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/carteira" as const, label: "Carteira", icon: CreditCard },
  { to: "/analytics" as const, label: "Análise", icon: BarChart3 },
  { to: "/transaction/new" as const, label: "Nova Transação", icon: Plus },
  { to: "/data" as const, label: "Dados", icon: Database },
  { to: "/export" as const, label: "Exportar", icon: Download },
  { to: "/settings" as const, label: "Configurações", icon: Settings },
];

interface Props {
  hideValues: boolean;
  toggleHideValues: () => void;
}

export function DesktopSidebar({ hideValues, toggleHideValues }: Props) {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:border-r lg:bg-sidebar">
      <div className="flex flex-col h-full">
        {/* Logo / profile */}
        <div className="p-4 border-b border-sidebar-border">
          <ProfileSwitcher />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <button
            onClick={toggleHideValues}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {hideValues ? "Mostrar valores" : "Ocultar valores"}
          </button>
          <div className="flex items-center gap-1 px-2">
            <PaletteSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
