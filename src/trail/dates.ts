// Datas da Trilha: dias locais no formato AAAA-MM-DD (como no artefato). Puro.

export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): Day {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s: Day): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(s: Day, n: number): Day {
  const d = parseDay(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Dias de `a` até `b` (b − a). */
export function diffDays(a: Day, b: Day): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Número do dia (para alternar os blocos dia a dia, como no artefato). */
export function dayNumber(s: Day): number {
  return Math.floor(parseDay(s).getTime() / 86_400_000);
}

/** Os 7 dias (segunda a domingo) da semana de `s`. */
export function weekOf(s: Day): Day[] {
  const weekday = (parseDay(s).getDay() + 6) % 7;
  const monday = addDays(s, -weekday);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "6/11" */
export function shortDay(s: Day): string {
  const d = parseDay(s);
  return `${d.getDate()}/${pad(d.getMonth() + 1)}`;
}

/** Quando vence uma revisão, em palavras. */
export function dueText(today: Day, due: Day | null): string {
  if (!due) return '—';
  const k = diffDays(today, due);
  if (k < 0) return `atrasada ${-k} d`;
  if (k === 0) return 'hoje';
  if (k === 1) return 'amanhã';
  return `em ${k} dias`;
}
