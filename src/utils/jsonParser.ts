import type { DailyApiMetric, ApiModelUsageEntry, ApiExtensionEntry } from '../types';

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

interface RawApiDay {
  date: string;
  agentRequests?: number;
  subscriptionIncludedReqs?: number;
  linesAdded?: number;
  linesDeleted?: number;
  acceptedLinesAdded?: number;
  acceptedLinesDeleted?: number;
  totalApplies?: number;
  totalAccepts?: number;
  totalRejects?: number;
  totalTabsShown?: number;
  totalTabsAccepted?: number;
  modelUsage?: ApiModelUsageEntry[];
  extensionUsage?: ApiExtensionEntry[];
  tabExtensionUsage?: ApiExtensionEntry[];
}

interface RawApiResponse {
  dailyMetrics: RawApiDay[];
  period?: { startDate: string; endDate: string };
  totalMembersInTeam?: number;
}

export function parseApiJson(text: string): DailyApiMetric[] {
  const data: RawApiResponse = JSON.parse(text);

  if (!data.dailyMetrics || !Array.isArray(data.dailyMetrics)) {
    throw new Error('Invalid JSON: missing dailyMetrics array');
  }

  return data.dailyMetrics.map((day) => {
    const ts = parseInt(day.date, 10);
    const msk = new Date(ts + MSK_OFFSET_MS);
    const dateStr = msk.toISOString().split('T')[0];

    return {
      dateStr,
      agentRequests: day.agentRequests ?? 0,
      linesAdded: day.linesAdded ?? 0,
      linesDeleted: day.linesDeleted ?? 0,
      acceptedLinesAdded: day.acceptedLinesAdded ?? 0,
      acceptedLinesDeleted: day.acceptedLinesDeleted ?? 0,
      totalApplies: day.totalApplies ?? 0,
      totalAccepts: day.totalAccepts ?? 0,
      totalRejects: day.totalRejects ?? 0,
      totalTabsShown: day.totalTabsShown ?? 0,
      totalTabsAccepted: day.totalTabsAccepted ?? 0,
      modelUsage: day.modelUsage ?? [],
      extensionUsage: [
        ...(day.extensionUsage ?? []),
        ...(day.tabExtensionUsage ?? []),
      ],
    };
  });
}
