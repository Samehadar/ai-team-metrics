import { parseApiJson } from '../utils/jsonParser';

function makeApiJson(dailyMetrics: Record<string, unknown>[]): string {
  return JSON.stringify({ dailyMetrics });
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

    const result = parseApiJson(json);
    expect(result).toHaveLength(1);
    expect(result[0].agentRequests).toBe(15);
    expect(result[0].linesAdded).toBe(500);
    expect(result[0].linesDeleted).toBe(100);
    expect(result[0].acceptedLinesAdded).toBe(300);
    expect(result[0].acceptedLinesDeleted).toBe(50);
    expect(result[0].totalApplies).toBe(10);
    expect(result[0].totalAccepts).toBe(8);
    expect(result[0].totalRejects).toBe(2);
    expect(result[0].totalTabsShown).toBe(20);
    expect(result[0].totalTabsAccepted).toBe(15);
  });

  it('merges extensionUsage and tabExtensionUsage into one array', () => {
    const json = makeApiJson([
      {
        date: '1742083200000',
        extensionUsage: [{ name: '.ts', count: 5 }],
        tabExtensionUsage: [{ name: '.tsx', count: 3 }],
      },
    ]);
    const result = parseApiJson(json);
    expect(result[0].extensionUsage).toEqual([
      { name: '.ts', count: 5 },
      { name: '.tsx', count: 3 },
    ]);
  });

  it('handles missing extensionUsage gracefully', () => {
    const json = makeApiJson([
      { date: '1742083200000', tabExtensionUsage: [{ name: '.py', count: 2 }] },
    ]);
    const result = parseApiJson(json);
    expect(result[0].extensionUsage).toEqual([{ name: '.py', count: 2 }]);
  });

  it('handles missing tabExtensionUsage gracefully', () => {
    const json = makeApiJson([
      { date: '1742083200000', extensionUsage: [{ name: '.ts', count: 5 }] },
    ]);
    const result = parseApiJson(json);
    expect(result[0].extensionUsage).toEqual([{ name: '.ts', count: 5 }]);
  });

  it('defaults all numeric fields to 0 when missing', () => {
    const json = makeApiJson([{ date: '1742083200000' }]);
    const result = parseApiJson(json);
    expect(result[0].agentRequests).toBe(0);
    expect(result[0].linesAdded).toBe(0);
    expect(result[0].linesDeleted).toBe(0);
    expect(result[0].acceptedLinesAdded).toBe(0);
    expect(result[0].acceptedLinesDeleted).toBe(0);
    expect(result[0].totalApplies).toBe(0);
    expect(result[0].totalAccepts).toBe(0);
    expect(result[0].totalRejects).toBe(0);
    expect(result[0].totalTabsShown).toBe(0);
    expect(result[0].totalTabsAccepted).toBe(0);
    expect(result[0].extensionUsage).toEqual([]);
    expect(result[0].modelUsage).toEqual([]);
  });

  it('converts timestamp to Moscow Time dateStr (UTC+3)', () => {
    // 2026-03-15 23:00:00 UTC -> 2026-03-16 02:00:00 MSK
    const utcTimestamp = Date.UTC(2026, 2, 15, 23, 0, 0);
    const json = makeApiJson([{ date: String(utcTimestamp) }]);
    const result = parseApiJson(json);
    expect(result[0].dateStr).toBe('2026-03-16');
  });

  it('keeps same calendar date for midnight UTC (03:00 MSK)', () => {
    const utcMidnight = Date.UTC(2026, 2, 16, 0, 0, 0);
    const json = makeApiJson([{ date: String(utcMidnight) }]);
    const result = parseApiJson(json);
    expect(result[0].dateStr).toBe('2026-03-16');
  });

  it('parses multiple days and preserves order', () => {
    const json = makeApiJson([
      { date: String(Date.UTC(2026, 2, 14, 0, 0, 0)), agentRequests: 5 },
      { date: String(Date.UTC(2026, 2, 15, 0, 0, 0)), agentRequests: 10 },
      { date: String(Date.UTC(2026, 2, 16, 0, 0, 0)), agentRequests: 15 },
    ]);
    const result = parseApiJson(json);
    expect(result).toHaveLength(3);
    expect(result[0].agentRequests).toBe(5);
    expect(result[1].agentRequests).toBe(10);
    expect(result[2].agentRequests).toBe(15);
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

  it('returns empty array when dailyMetrics is empty', () => {
    const result = parseApiJson(JSON.stringify({ dailyMetrics: [] }));
    expect(result).toEqual([]);
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
    const result = parseApiJson(json);
    expect(result[0].modelUsage).toEqual([
      { name: 'claude-4.6-opus', count: 10 },
      { name: 'gpt-5.3', count: 5 },
    ]);
  });
});
