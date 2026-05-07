import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CreditCard,
  Plus,
  BarChart3,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/dashboard" as const, label: "Início", icon: LayoutDashboard },
  { to: "/carteira" as const, label: "Carteira", icon: CreditCard },
  { to: "/transaction/new" as const, label: "Nova", icon: Plus, primary: true },
  { to: "/analytics" as const, label: "Análise", icon: BarChart3 },
  { to: "/metas" as const, label: "Metas", icon: Target },
];

export function BottomTabBar() {
  const location = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          if (item.primary) {
            return (
              <li key={item.to} className="flex items-center justify-center">
                <Link
                  to={item.to}
                  className={cn(
                    "-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95",
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
