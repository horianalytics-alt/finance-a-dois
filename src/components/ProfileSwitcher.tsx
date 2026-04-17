import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/lib/app-context";
import { Check, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileSwitcher() {
  const { members, activeProfile, setActiveProfile, onlineProfiles } = useApp();

  if (!activeProfile) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2.5 transition-colors hover:bg-accent/40">
        <div className="relative">
          <Avatar className="h-9 w-9 border-2 border-primary/40">
            <AvatarImage src={activeProfile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {activeProfile.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
              onlineProfiles.has(activeProfile.id) ? "bg-[color:var(--success)]" : "bg-muted-foreground/40",
            )}
          />
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Perfil ativo</span>
          <span className="text-sm font-semibold">{activeProfile.name}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Trocar perfil
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {members.map((m) => {
          const online = onlineProfiles.has(m.id);
          const active = m.id === activeProfile.id;
          return (
            <DropdownMenuItem
              key={m.id}
              onSelect={() => setActiveProfile(m.id)}
              className="flex items-center gap-3 py-2.5"
            >
              <div className="relative">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={m.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {m.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-popover",
                    online ? "bg-[color:var(--success)]" : "bg-muted-foreground/40",
                  )}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium leading-none">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {online ? "Online agora" : "Offline"}
                </p>
              </div>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
