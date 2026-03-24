import { parseCSV } from '../utils/csvParser';

const HEADER = 'Date,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost';

function makeCsv(rows: string[]): string {
  return [HEADER, ...rows].join('\n');
}

describe('parseCSV', () => {
  it('parses a single valid row', () => {
    const csv = makeCsv([
      '"2026-03-16T10:57:01.747Z","Included","composer-1.5","No","0","85921","134176","3415","223512","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe('composer-1.5');
    expect(result[0].totalTokens).toBe(223512);
    expect(result[0].kind).toBe('Included');
    expect(result[0].maxMode).toBe(false);
  });

  it('parses multiple rows', () => {
    const csv = makeCsv([
      '"2026-03-16T10:00:00.000Z","Included","composer-1.5","No","0","100","200","50","350","Included"',
      '"2026-03-16T11:00:00.000Z","Included","claude-4.6-opus-high-thinking","Yes","0","200","300","100","600","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result).toHaveLength(2);
    expect(result[1].model).toBe('claude-4.6-opus-high-thinking');
    expect(result[1].maxMode).toBe(true);
  });

  it('skips rows with missing Date', () => {
    const csv = makeCsv([
      '"","Included","composer-1.5","No","0","100","200","50","350","Included"',
      '"2026-03-16T10:00:00.000Z","Included","composer-1.5","No","0","100","200","50","350","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result).toHaveLength(1);
  });

  it('skips rows with missing Model', () => {
    const csv = makeCsv([
      '"2026-03-16T10:00:00.000Z","Included","","No","0","100","200","50","350","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result).toHaveLength(0);
  });

  it('converts timestamps to MSK dateStr', () => {
    const csv = makeCsv([
      '"2026-03-16T22:30:00.000Z","Included","default","No","0","100","200","50","350","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result[0].dateStr).toBe('2026-03-17');
    expect(result[0].hour).toBe(1);
  });

  it('handles empty CSV', () => {
    const result = parseCSV(HEADER);
    expect(result).toHaveLength(0);
  });

  it('handles zero token values', () => {
    const csv = makeCsv([
      '"2026-03-16T10:00:00.000Z","Included","default","No","0","0","0","0","0","Included"',
    ]);
    const result = parseCSV(csv);
    expect(result[0].totalTokens).toBe(0);
    expect(result[0].outputTokens).toBe(0);
  });
});
