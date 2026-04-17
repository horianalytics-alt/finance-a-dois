import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatCreatedTime, isoToBR, maskedBRL } from "@/lib/format";
import type { Category, PaymentMethod, Profile, Transaction } from "@/lib/app-context";

interface Props {
  tx: Transaction;
  category?: Category | null;
  pm?: PaymentMethod | null;
  owner?: Profile | null;
  author?: Profile | null;
  hideValues: boolean;
}

export function TransactionCard({ tx, category, pm, owner, author, hideValues }: Props) {
  const navigate = useNavigate();
  const sign = tx.type === "receita" ? "+" : tx.type === "despesa" ? "-" : "•";
  const valueColor =
    tx.type === "receita"
      ? "text-[color:var(--success)]"
      : tx.type === "despesa"
        ? "text-destructive"
        : "text-[color:var(--investment)]";

  const borderColor = tx.is_benefit
    ? "var(--benefit)"
    : tx.type === "receita"
      ? "var(--success)"
      : tx.type === "despesa"
        ? "var(--destructive)"
        : "var(--investment)";

  const fmt = (n: number) => (hideValues ? maskedBRL() : formatBRL(n));

  return (
    <Card className="border-l-4" style={{ borderLeftColor: borderColor }}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{tx.description}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {isoToBR(tx.date)}
              {category ? ` • ${category.name}` : ""}
              {pm ? ` • ${pm.name}` : ""}
              {tx.recurrence_months > 1
                ? ` • ${tx.recurrence_index}/${tx.recurrence_months}`
                : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {!tx.is_paid && (
                <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--warning-foreground)]">
                  Pendente
                </span>
              )}
              {tx.is_benefit && (
                <span className="rounded-full bg-[color:var(--benefit)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--benefit)]">
                  Benefício
                </span>
              )}
              {owner && (
                <span className="flex items-center gap-1 rounded-full bg-muted/60 pl-0.5 pr-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  <Avatar className="h-3.5 w-3.5">
                    <AvatarImage src={owner.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[7px]">
                      {owner.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {owner.name}
                </span>
              )}
            </div>
            <p className="flex items-center gap-1 pt-1 text-[10px] text-gray-400 dark:text-muted-foreground/70">
              <Clock className="h-2.5 w-2.5" />
              {formatCreatedTime(tx.created_time)}
              {author && owner && author.id !== owner.id && (
                <span className="ml-1 italic">por {author.name}</span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={cn("text-right text-sm font-semibold", valueColor)}>
              {sign}
              {fmt(Number(tx.amount))}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() =>
                navigate({ to: "/transaction/$id", params: { id: tx.id } })
              }
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
