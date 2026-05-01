export function getWeekKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((p) => parseInt(p, 10));
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay();
  const offset = (day + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - offset);
  return utc.toISOString().slice(0, 10);
}

export function enumerateWeeks(startKey: string, endKey: string): string[] {
  if (!startKey || !endKey) return [];
  const out: string[] = [];
  const [sy, sm, sd] = startKey.split('-').map((p) => parseInt(p, 10));
  const [ey, em, ed] = endKey.split('-').map((p) => parseInt(p, 10));
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  if (cursor.getTime() > end.getTime()) return [];
  const HARD_CAP = 520;
  let safety = 0;
  while (cursor.getTime() <= end.getTime() && safety < HARD_CAP) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    safety++;
  }
  return out;
}
