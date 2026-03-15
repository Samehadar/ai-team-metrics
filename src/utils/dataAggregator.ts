import type {
  PersonData,
  PersonSummary,
  GlobalSummary,
  DailyActivity,
  HourlyActivity,
  ModelUsage,
} from '../types';

export function getPersonSummary(person: PersonData): PersonSummary {
  const rows = person.rows;
  const totalRequests = rows.length;
  const totalTokens = rows.reduce((s, r) => s + r.totalTokens, 0);

  const dailyMap = new Map<string, { count: number; tokens: number }>();
  for (const r of rows) {
    const prev = dailyMap.get(r.dateStr) || { count: 0, tokens: 0 };
    dailyMap.set(r.dateStr, {
      count: prev.count + 1,
      tokens: prev.tokens + r.totalTokens,
    });
  }

  const dailyActivity: DailyActivity[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, count: v.count, tokens: v.tokens }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const activeDays = dailyActivity.length;
  const avgRequestsPerDay = activeDays > 0 ? totalRequests / activeDays : 0;

  const hourMap = new Map<number, number>();
  for (const r of rows) {
    hourMap.set(r.hour, (hourMap.get(r.hour) || 0) + 1);
  }
  const hourlyActivity: HourlyActivity[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) || 0,
  }));

  const modelMap = new Map<string, number>();
  for (const r of rows) {
    modelMap.set(r.model, (modelMap.get(r.model) || 0) + 1);
  }
  const modelUsage: ModelUsage[] = Array.from(modelMap.entries())
    .map(([model, count]) => ({
      model,
      count,
      percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const dates = rows.map((r) => r.dateStr).sort();
  const firstDate = dates[0] || '';
  const lastDate = dates[dates.length - 1] || '';

  return {
    name: person.name,
    totalRequests,
    totalTokens,
    activeDays,
    avgRequestsPerDay,
    firstDate,
    lastDate,
    dailyActivity,
    hourlyActivity,
    modelUsage,
  };
}

export function getGlobalSummary(people: PersonData[]): GlobalSummary {
  const totalDevelopers = people.length;
  const totalRequests = people.reduce((s, p) => s + p.rows.length, 0);
  const totalTokens = people.reduce(
    (s, p) => s + p.rows.reduce((ss, r) => ss + r.totalTokens, 0),
    0,
  );

  const allDates = new Set<string>();
  for (const p of people) {
    for (const r of p.rows) allDates.add(r.dateStr);
  }
  const sortedDates = Array.from(allDates).sort();
  const totalDays = sortedDates.length || 1;
  const avgRequestsPerDay = totalRequests / totalDays;

  return {
    totalDevelopers,
    totalRequests,
    totalTokens,
    avgRequestsPerDay,
    dateRange: {
      start: sortedDates[0] || '',
      end: sortedDates[sortedDates.length - 1] || '',
    },
  };
}

export function getAllDates(people: PersonData[]): string[] {
  const dates = new Set<string>();
  for (const p of people) {
    for (const r of p.rows) dates.add(r.dateStr);
  }
  return Array.from(dates).sort();
}

export function getAllModels(people: PersonData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of people) {
    for (const r of p.rows) {
      map.set(r.model, (map.get(r.model) || 0) + 1);
    }
  }
  return map;
}
