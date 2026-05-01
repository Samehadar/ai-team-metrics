import { parseApiJson } from '../utils/jsonParser';

function makeApiJson(dailyMetrics: Record<string, unknown>[], extras: Record<string, unknown> = {}): string {
  return JSON.stringify({ dailyMetrics, ...extras });
}

describe('parseApiJson', () => {
  it('parses a single day metric with all fields', () => {
    const json = makeApiJson([
      {
        date: '1742083200000',
        agentRequests: 15,
        linesAdded: 500,
        linesDeleted: 100,
        acceptedLinesAdded: 300,
        acceptedLinesDeleted: 50,
        totalApplies: 10,
        totalAccepts: 8,
        totalRejects: 2,
        totalTabsShown: 20,
        totalTabsAccepted: 15,
        extensionUsage: [{ name: '.ts', count: 5 }],
        tabExtensionUsage: [{ name: '.tsx', count: 3 }],
      },
    ]);

    const { metrics } = parseApiJson(json);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].agentRequests).toBe(15);
    expect(metrics[0].linesAdded).toBe(500);
    expect(metrics[0].linesDeleted).toBe(100);
    expect(metrics[0].acceptedLinesAdded).toBe(300);
    expect(metrics[0].acceptedLinesDeleted).toBe(50);
    expect(metrics[0].totalApplies).toBe(10);
    expect(metrics[0].totalAccepts).toBe(8);
    expect(metrics[0].totalRejects).toBe(2);
    expect(metrics[0].totalTabsShown).toBe(20);
    expect(metrics[0].totalTabsAccepted).toBe(15);
  });

  it('merges extensionUsage and tabExtensionUsage into one array', () => {
    const json = makeApiJson([
      {
        date: '1742083200000',
        extensionUsage: [{ name: '.ts', count: 5 }],
        tabExtensionUsage: [{ name: '.tsx', count: 3 }],
      },
    ]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].extensionUsage).toEqual([
      { name: '.ts', count: 5 },
      { name: '.tsx', count: 3 },
    ]);
  });

  it('handles missing extensionUsage gracefully', () => {
    const json = makeApiJson([
      { date: '1742083200000', tabExtensionUsage: [{ name: '.py', count: 2 }] },
    ]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].extensionUsage).toEqual([{ name: '.py', count: 2 }]);
  });

  it('handles missing tabExtensionUsage gracefully', () => {
    const json = makeApiJson([
      { date: '1742083200000', extensionUsage: [{ name: '.ts', count: 5 }] },
    ]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].extensionUsage).toEqual([{ name: '.ts', count: 5 }]);
  });

  it('defaults all numeric fields to 0 when missing', () => {
    const json = makeApiJson([{ date: '1742083200000' }]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].agentRequests).toBe(0);
    expect(metrics[0].linesAdded).toBe(0);
    expect(metrics[0].linesDeleted).toBe(0);
    expect(metrics[0].acceptedLinesAdded).toBe(0);
    expect(metrics[0].acceptedLinesDeleted).toBe(0);
    expect(metrics[0].totalApplies).toBe(0);
    expect(metrics[0].totalAccepts).toBe(0);
    expect(metrics[0].totalRejects).toBe(0);
    expect(metrics[0].totalTabsShown).toBe(0);
    expect(metrics[0].totalTabsAccepted).toBe(0);
    expect(metrics[0].extensionUsage).toEqual([]);
    expect(metrics[0].modelUsage).toEqual([]);
  });

  it('converts timestamp to Moscow Time dateStr (UTC+3)', () => {
    const utcTimestamp = Date.UTC(2026, 2, 15, 23, 0, 0);
    const json = makeApiJson([{ date: String(utcTimestamp) }]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].dateStr).toBe('2026-03-16');
  });

  it('keeps same calendar date for midnight UTC (03:00 MSK)', () => {
    const utcMidnight = Date.UTC(2026, 2, 16, 0, 0, 0);
    const json = makeApiJson([{ date: String(utcMidnight) }]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].dateStr).toBe('2026-03-16');
  });

  it('parses multiple days and preserves order', () => {
    const json = makeApiJson([
      { date: String(Date.UTC(2026, 2, 14, 0, 0, 0)), agentRequests: 5 },
      { date: String(Date.UTC(2026, 2, 15, 0, 0, 0)), agentRequests: 10 },
      { date: String(Date.UTC(2026, 2, 16, 0, 0, 0)), agentRequests: 15 },
    ]);
    const { metrics } = parseApiJson(json);
    expect(metrics).toHaveLength(3);
    expect(metrics[0].agentRequests).toBe(5);
    expect(metrics[1].agentRequests).toBe(10);
    expect(metrics[2].agentRequests).toBe(15);
  });

  it('throws on invalid JSON string', () => {
    expect(() => parseApiJson('not json')).toThrow();
  });

  it('throws when dailyMetrics key is missing', () => {
    expect(() => parseApiJson(JSON.stringify({ something: 'else' }))).toThrow('missing dailyMetrics');
  });

  it('throws when dailyMetrics is not an array', () => {
    expect(() => parseApiJson(JSON.stringify({ dailyMetrics: 'not array' }))).toThrow('missing dailyMetrics');
  });

  it('returns empty metrics array when dailyMetrics is empty', () => {
    const { metrics } = parseApiJson(JSON.stringify({ dailyMetrics: [] }));
    expect(metrics).toEqual([]);
  });

  it('preserves modelUsage data when present', () => {
    const json = makeApiJson([
      {
        date: '1742083200000',
        modelUsage: [
          { name: 'claude-4.6-opus', count: 10 },
          { name: 'gpt-5.3', count: 5 },
        ],
      },
    ]);
    const { metrics } = parseApiJson(json);
    expect(metrics[0].modelUsage).toEqual([
      { name: 'claude-4.6-opus', count: 10 },
      { name: 'gpt-5.3', count: 5 },
    ]);
  });

  it('extracts plan usage snapshot from usageSummary bundle', () => {
    const json = makeApiJson([], {
      usageSummary: {
        billingCycleStart: '2026-04-28T16:54:38.000Z',
        billingCycleEnd: '2026-05-28T16:54:38.000Z',
        membershipType: 'ultra',
        isUnlimited: false,
        individualUsage: {
          plan: {
            enabled: true,
            used: 15730,
            limit: 40000,
            remaining: 24270,
            totalPercentUsed: 10.4866,
            apiPercentUsed: 31.46,
            autoPercentUsed: 0,
            breakdown: { included: 15730, bonus: 0, total: 15730 },
          },
        },
      },
      meta: { exportedAt: '2026-04-30T20:30:00.000Z' },
    });
    const { planUsage } = parseApiJson(json);
    expect(planUsage).toBeDefined();
    expect(planUsage?.used).toBe(15730);
    expect(planUsage?.limit).toBe(40000);
    expect(planUsage?.remaining).toBe(24270);
    expect(planUsage?.totalPercentUsed).toBeCloseTo(10.4866, 3);
    expect(planUsage?.apiPercentUsed).toBeCloseTo(31.46, 2);
    expect(planUsage?.membershipType).toBe('ultra');
    expect(planUsage?.billingCycleStart).toBe('2026-04-28T16:54:38.000Z');
    expect(planUsage?.capturedAt).toBe('2026-04-30T20:30:00.000Z');
    expect(planUsage?.breakdown?.total).toBe(15730);
  });

  it('returns undefined planUsage when usageSummary missing', () => {
    const { planUsage } = parseApiJson(makeApiJson([{ date: '1742083200000' }]));
    expect(planUsage).toBeUndefined();
  });
});
