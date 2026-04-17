// Utilidades de formatação financeira e de data SEM conversão de timezone.

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Mascara um valor financeiro como asteriscos preservando o "R$" */
export function maskedBRL(): string {
  return "R$ ****";
}

/**
 * Aplica máscara DD/MM/YYYY conforme o usuário digita.
 * Aceita qualquer string e retorna o valor formatado.
 */
export function maskDateBR(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  const len = digits.length;
  if (len <= 2) return digits;
  if (len <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "DD/MM/YYYY" -> "YYYY-MM-DD" (string DATE pura, sem timezone) */
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

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (sem criar Date — evita timezone) */
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
  let month = Number(m[2]) + months; // 1..12 base
  let day = Number(m[3]);
  // normaliza
  year += Math.floor((month - 1) / 12);
  month = ((month - 1) % 12) + 12;
  month = (month % 12) + 1;
  // dia máximo do mês alvo
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) day = daysInMonth;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Retorna chave "YYYY-MM" para agrupamento por mês a partir de string ISO */
export function monthKeyFromISO(iso: string): string {
  return iso.slice(0, 7);
}

/** "YYYY-MM" -> "Abril 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const idx = Number(m) - 1;
  return `${months[idx] ?? m} ${y}`;
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
