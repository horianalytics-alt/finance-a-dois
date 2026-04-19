// Utilidades de formatação financeira e de data SEM conversão de timezone.

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number): string {
  // SEM Math.round/floor/ceil — preserva centavos
  return BRL_FORMATTER.format(Number(value));
}

export function formatBRLCompact(value: number): string {
  // Mesmo no "compact" mantemos 2 casas decimais por requisito de auditoria.
  return BRL_COMPACT_FORMATTER.format(Number(value));
}

/** Mascara um valor financeiro como asteriscos preservando o "R$" */
export function maskedBRL(): string {
  return "R$ ••••";
}

/**
 * Converte uma string digitada pelo usuário ("1.234,56", "1234.56", "1234,5")
 * em number com precisão decimal, sem perder centavos. Retorna NaN se inválido.
 */
export function parseBRLInput(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim();
  // Caso BR com vírgula decimal: "1.234,56" → "1234.56"
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Mantém só dígitos e ponto
  s = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/**
 * Aplica máscara DD/MM/YYYY conforme o usuário digita.
 */
export function maskDateBR(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const len = digits.length;
  if (len <= 2) return digits;
  if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "DD/MM/YYYY" -> "YYYY-MM-DD" */
export function brToISO(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" -> "DD/MM/YYYY" */
export function isoToBR(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Soma N meses a uma data ISO "YYYY-MM-DD" mantendo string pura */
export function addMonthsISO(iso: string, months: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  let year = Number(m[1]);
  let month = Number(m[2]) + months;
  let day = Number(m[3]);
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) day = daysInMonth;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Diferença em dias entre 2 ISO (b - a). */
export function diffDaysISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

export function monthKeyFromISO(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const idx = Number(m) - 1;
  return `${months[idx] ?? m} ${y}`;
}

export function monthLabelShort(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const idx = Number(m) - 1;
  return `${months[idx] ?? m}/${y.slice(2)}`;
}

/** Formata timestamp ISO -> "DD/MM/YYYY HH:mm" no fuso local */
export function formatCreatedTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function todayBR(): string {
  return isoToBR(todayISO());
}

export function startOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function endOfWeekISO(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
