import { describe, it, expect } from 'vitest';
import { mapActivitiesToHeatmapData, timestampToMskParts } from '../api/externalActivity';

describe('mapActivitiesToHeatmapData', () => {
  it('aggregates eventCount per MSK hour slot', () => {
    const activities = [
      { timestamp: '2026-01-20T14:54:16.918Z', eventCount: 1 },
      { timestamp: '2026-01-20T14:54:30.993Z', eventCount: 2 },
    ];
    const points = mapActivitiesToHeatmapData(activities);
    expect(points.length).toBe(1);
    const p = points[0];
    expect(p.dateStr).toBe('2026-01-20');
    expect(p.hour).toBe(17);
    expect(p.count).toBe(3);
  });

  it('defaults missing eventCount to 1', () => {
    const activities = [{ timestamp: '2026-01-20T12:00:00.000Z' }];
    const points = mapActivitiesToHeatmapData(activities);
    expect(points.length).toBe(1);
    expect(points[0].count).toBe(1);
  });
});

describe('timestampToMskParts', () => {
  it('maps UTC noon to MSK date and hour', () => {
    const { dateStr, hour } = timestampToMskParts('2026-06-01T09:00:00.000Z');
    expect(dateStr).toBe('2026-06-01');
    expect(hour).toBe(12);
  });
});
