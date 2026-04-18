import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette, Check } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { PALETTES } from "@/lib/palettes";
import { cn } from "@/lib/utils";

export function PaletteSwitcher() {
  const { palette, setPalette } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Trocar tema de cor">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Tema de cor
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PALETTES.map((p) => {
          const active = p.id === palette;
          return (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => setPalette(p.id)}
              className="flex items-center gap-3"
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full border-2",
                  active ? "border-foreground" : "border-border",
                )}
                style={{ backgroundColor: p.swatch }}
              />
              <span className="flex-1 text-sm">{p.label}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
