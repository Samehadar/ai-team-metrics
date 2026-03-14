export interface RawRow {
  Date: string;
  Kind: string;
  Model: string;
  'Max Mode': string;
  'Input (w/ Cache Write)': string;
  'Input (w/o Cache Write)': string;
  'Cache Read': string;
  'Output Tokens': string;
  'Total Tokens': string;
  Cost: string;
}

export interface ParsedRow {
  date: Date;
  dateStr: string;
  hour: number;
  kind: string;
  model: string;
  maxMode: boolean;
  inputWithCache: number;
  inputWithoutCache: number;
  cacheRead: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ApiModelUsageEntry {
  name: string;
  count?: number;
}

export interface ApiExtensionEntry {
  name: string;
  count: number;
}

export interface DailyApiMetric {
  dateStr: string;
  agentRequests: number;
  linesAdded: number;
  linesDeleted: number;
  acceptedLinesAdded: number;
  acceptedLinesDeleted: number;
  totalApplies: number;
  totalAccepts: number;
  totalRejects: number;
  totalTabsShown: number;
  totalTabsAccepted: number;
  modelUsage: ApiModelUsageEntry[];
  extensionUsage: ApiExtensionEntry[];
}

export interface PersonData {
  name: string;
  fileName: string;
  rows: ParsedRow[];
  dailyApiMetrics?: DailyApiMetric[];
  note: string;
}

export interface DailyActivity {
  date: string;
  count: number;
  tokens: number;
}

export interface HourlyActivity {
  hour: number;
  count: number;
}

export interface ModelUsage {
  model: string;
  count: number;
  percentage: number;
}

export interface PersonSummary {
  name: string;
  totalRequests: number;
  totalTokens: number;
  activeDays: number;
  avgRequestsPerDay: number;
  firstDate: string;
  lastDate: string;
  dailyActivity: DailyActivity[];
  hourlyActivity: HourlyActivity[];
  modelUsage: ModelUsage[];
}

export interface GlobalSummary {
  totalDevelopers: number;
  totalRequests: number;
  totalTokens: number;
  avgRequestsPerDay: number;
  dateRange: { start: string; end: string };
}

export type TabId = 'overview' | 'adoption' | 'codeImpact' | 'timeline' | 'models' | 'person';
