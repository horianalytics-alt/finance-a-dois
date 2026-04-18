import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/format";

interface Props {
  monthKey: string; // "YYYY-MM"
  onChange: (next: string) => void;
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  let year = y;
  let month = m + delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function MonthNavigator({ monthKey, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(shiftMonth(monthKey, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-[140px] text-center">
        <p className="text-base font-semibold capitalize tracking-tight">
          {monthLabel(monthKey)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(shiftMonth(monthKey, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
