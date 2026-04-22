import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione",
  emptyText = "Nenhum item encontrado",
  allowClear = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // fuzzy: split query into chars and check if they appear in order
    return options.filter((o) => {
      const label = o.label.toLowerCase();
      // first try includes (fast path)
      if (label.includes(q)) return true;
      // fuzzy match
      let idx = 0;
      for (const ch of q) {
        const found = label.indexOf(ch, idx);
        if (found === -1) return false;
        idx = found + 1;
      }
      return true;
    }).sort((a, b) => {
      const al = a.label.toLowerCase();
      const bl = b.label.toLowerCase();
      const q2 = query.trim().toLowerCase();
      // exact start match first
      const aStarts = al.startsWith(q2) ? 0 : 1;
      const bStarts = bl.startsWith(q2) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      // then includes
      const aIncludes = al.includes(q2) ? 0 : 1;
      const bIncludes = bl.includes(q2) ? 0 : 1;
      return aIncludes - bIncludes;
    });
  }, [options, query]);

  // Instant match: if exactly one result and query is non-empty, highlight it
  const instantMatch = query.trim().length > 0 && filtered.length === 1 ? filtered[0] : null;

  // Handle Enter key to auto-select instant match
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && instantMatch) {
      e.preventDefault();
      onChange(instantMatch.value);
      setOpen(false);
      setQuery("");
    }
  };

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar..."
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {instantMatch && (
            <span className="ml-1 flex items-center gap-0.5 text-[10px] text-primary whitespace-nowrap">
              <Zap className="h-3 w-3" /> Enter
            </span>
          )}
        </div>
        <ul className="max-h-64 overflow-auto py-1">
          {allowClear && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
              >
                — Limpar seleção —
              </button>
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                    instantMatch?.value === o.value && "bg-primary/10 font-medium",
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
