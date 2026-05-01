import type { DailyApiMetric, ApiModelUsageEntry, ApiExtensionEntry, PlanUsageSnapshot } from '../types';

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

interface RawIndividualPlan {
  enabled?: boolean;
  used?: number;
  limit?: number | null;
  remaining?: number | null;
  totalPercentUsed?: number;
  apiPercentUsed?: number;
  autoPercentUsed?: number;
  breakdown?: { included?: number; bonus?: number; total?: number };
}

interface RawUsageSummary {
  billingCycleStart?: string;
  billingCycleEnd?: string;
  membershipType?: string;
  isUnlimited?: boolean;
  individualUsage?: { plan?: RawIndividualPlan };
}

interface RawApiResponse {
  dailyMetrics: RawApiDay[];
  period?: { startDate: string; endDate: string };
  totalMembersInTeam?: number;
  usageSummary?: RawUsageSummary | null;
  meta?: { exportedAt?: string };
}

export interface ParsedApiJson {
  metrics: DailyApiMetric[];
  planUsage?: PlanUsageSnapshot;
}

function extractPlanUsage(data: RawApiResponse): PlanUsageSnapshot | undefined {
  const us = data.usageSummary;
  if (!us) return undefined;
  const plan = us.individualUsage?.plan;
  if (!plan) return undefined;

  const used = plan.used ?? 0;
  const limit = plan.limit ?? null;
  const remaining = plan.remaining ?? null;
  const totalPercentUsed = plan.totalPercentUsed ?? 0;
  const apiPercentUsed = plan.apiPercentUsed ?? 0;

  return {
    capturedAt: data.meta?.exportedAt || new Date().toISOString(),
    membershipType: us.membershipType,
    billingCycleStart: us.billingCycleStart,
    billingCycleEnd: us.billingCycleEnd,
    used,
    limit,
    remaining,
    totalPercentUsed,
    apiPercentUsed,
    autoPercentUsed: plan.autoPercentUsed,
    isUnlimited: us.isUnlimited,
    breakdown: plan.breakdown
      ? {
          included: plan.breakdown.included ?? 0,
          bonus: plan.breakdown.bonus ?? 0,
          total: plan.breakdown.total ?? 0,
        }
      : undefined,
  };
}

export function parseApiJson(text: string): ParsedApiJson {
  const data: RawApiResponse = JSON.parse(text);

  if (!data.dailyMetrics || !Array.isArray(data.dailyMetrics)) {
    throw new Error('Invalid JSON: missing dailyMetrics array');
  }

  const metrics = data.dailyMetrics.map((day) => {
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

  return { metrics, planUsage: extractPlanUsage(data) };
}
