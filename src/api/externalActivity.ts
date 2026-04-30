export interface ActivityEvent {
  timestamp: string;
  source?: string;
  activityType?: string;
  eventWeight?: number;
  eventCount?: number;
  externalId?: string;
}

export interface ActivityResponse {
  employeeId?: number | string;
  activities: ActivityEvent[];
}

interface EnvSource {
  apiBase?: string;
  defaultUserId?: string;
  authUser?: string;
  authPassword?: string;
}

function readEnv(): EnvSource {
  const env = (import.meta as any).env ?? {};
  const apiBase = (env.VITE_ACTIVITY_API_BASE ?? '').trim();
  const defaultUserId = (env.VITE_ACTIVITY_DEFAULT_USER_ID ?? '').trim();
  const authUser = (env.VITE_ACTIVITY_BASIC_AUTH_USER ?? '').trim();
  const authPassword = (env.VITE_ACTIVITY_BASIC_AUTH_PASSWORD ?? '').trim();
  return { apiBase, defaultUserId, authUser, authPassword };
}

export function isActivityProviderConfigured(): boolean {
  const env = readEnv();
  return Boolean(env.apiBase && env.authUser && env.authPassword);
}

export function getDefaultExternalUserId(): string | undefined {
  const env = readEnv();
  return env.defaultUserId || undefined;
}

export function timestampToMskParts(iso: string): { dateStr: string; hour: number } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateStr: '1970-01-01', hour: 0 };
  }
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const y = get('year');
  const m = get('month');
  const day = get('day');
  const h = get('hour');
  return {
    dateStr: `${y}-${m}-${day}`,
    hour: Math.min(23, Math.max(0, parseInt(h, 10) || 0)),
  };
}

export function mapActivitiesToHeatmapData(
  activities: ActivityEvent[],
): Array<{ dateStr: string; hour: number; count: number }> {
  const bucket = new Map<string, number>();
  for (const a of activities) {
    const { dateStr, hour } = timestampToMskParts(a.timestamp);
    const key = `${dateStr}\t${hour}`;
    const add =
      typeof a.eventCount === 'number' && !Number.isNaN(a.eventCount) ? a.eventCount : 1;
    bucket.set(key, (bucket.get(key) ?? 0) + add);
  }
  const out: Array<{ dateStr: string; hour: number; count: number }> = [];
  for (const [key, count] of bucket) {
    const tab = key.indexOf('\t');
    const dateStr = key.slice(0, tab);
    const hour = parseInt(key.slice(tab + 1), 10);
    out.push({ dateStr, hour, count });
  }
  return out;
}

function buildEventsUrl(
  base: string,
  externalUserId: string,
  dateFrom: string,
  dateTo: string,
): string {
  const root = base.replace(/\/$/, '');
  const qs = new URLSearchParams({
    dateFrom,
    dateTo,
    sources: 'GITLAB_LOCAL',
  });
  const path = `${root}/api/v2/activities/employee/${encodeURIComponent(externalUserId)}/events?${qs}`;
  if (root.startsWith('http')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return new URL(p, window.location.origin).toString();
}

export async function fetchUserActivity(params: {
  externalUserId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ActivityResponse> {
  const env = readEnv();
  const base = env.apiBase ?? '';
  const url = buildEventsUrl(base, params.externalUserId, params.dateFrom, params.dateTo);
  const auth = btoa(`${env.authUser}:${env.authPassword}`);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
    });
  } catch (e) {
    const isNetwork =
      e instanceof TypeError &&
      (e.message === 'Failed to fetch' || e.message.includes('Load failed'));
    if (isNetwork) {
      const crossOriginHint =
        typeof window !== 'undefined' &&
        base.trim().startsWith('http') &&
        !url.startsWith(`${window.location.origin}/`);
      throw new Error(crossOriginHint ? 'ACTIVITY_FETCH_CORS' : 'ACTIVITY_FETCH_NETWORK');
    }
    throw e;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text ? `Activity ${res.status}: ${text.slice(0, 200)}` : `Activity HTTP ${res.status}`);
  }
  return res.json() as Promise<ActivityResponse>;
}
