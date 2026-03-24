import { extractNameFromFile, shortModel, formatTokens, formatNumber, formatDate } from '../utils/formatters';

describe('extractNameFromFile', () => {
  it('extracts name from CSV filename with акк_ prefix', () => {
    expect(extractNameFromFile('акк_Алексей_Смирнов.csv')).toBe('Алексей Смирнов');
  });

  it('extracts name from JSON filename with акк_ prefix', () => {
    expect(extractNameFromFile('акк_Алексей_Смирнов.json')).toBe('Алексей Смирнов');
  });

  it('produces the same name for CSV and JSON of the same person', () => {
    const csv = extractNameFromFile('акк_Дмитрий_Волков.csv');
    const json = extractNameFromFile('акк_Дмитрий_Волков.json');
    expect(csv).toBe(json);
    expect(csv).toBe('Дмитрий Волков');
  });

  it('handles name with ё character', () => {
    expect(extractNameFromFile('акк_Андрей_Королёв.csv')).toBe('Андрей Королёв');
  });

  it('handles filename without акк_ prefix', () => {
    expect(extractNameFromFile('Иван_Петров.csv')).toBe('Иван Петров');
  });

  it('handles filename with multiple underscores in name', () => {
    expect(extractNameFromFile('акк_Анна_Мария_Иванова.csv')).toBe('Анна Мария Иванова');
  });

  it('handles uppercase extension', () => {
    expect(extractNameFromFile('акк_Тест_Тестов.CSV')).toBe('Тест Тестов');
    expect(extractNameFromFile('акк_Тест_Тестов.JSON')).toBe('Тест Тестов');
  });

  it('does not strip non-csv/json extensions', () => {
    expect(extractNameFromFile('акк_Тест_Тестов.txt')).toBe('Тест Тестов.txt');
  });

  it('handles single-word name', () => {
    expect(extractNameFromFile('акк_Алексей.csv')).toBe('Алексей');
  });

  it('handles prefix case insensitivity', () => {
    expect(extractNameFromFile('Акк_Иван_Петров.csv')).toBe('Иван Петров');
  });
});

describe('shortModel', () => {
  it('shortens known models', () => {
    expect(shortModel('composer-1.5')).toBe('Composer 1.5');
    expect(shortModel('claude-4.6-opus-high-thinking')).toBe('Opus 4.6');
    expect(shortModel('claude-4.6-sonnet-medium-thinking')).toBe('Sonnet 4.6');
    expect(shortModel('auto')).toBe('Auto');
  });

  it('returns unknown models as-is', () => {
    expect(shortModel('unknown-model-xyz')).toBe('unknown-model-xyz');
  });
});

describe('formatTokens', () => {
  it('formats billions', () => {
    expect(formatTokens(2_500_000_000)).toBe('2.5B');
  });

  it('formats millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatTokens(45_000)).toBe('45.0K');
  });

  it('formats small numbers as-is', () => {
    expect(formatTokens(500)).toBe('500');
  });

  it('formats zero', () => {
    expect(formatTokens(0)).toBe('0');
  });
});

describe('formatNumber', () => {
  it('formats with locale separators', () => {
    const result = formatNumber(12345);
    expect(result).toContain('12');
    expect(result).toContain('345');
  });

  it('formats small numbers as-is', () => {
    expect(formatNumber(999)).toBe('999');
  });
});

describe('formatDate', () => {
  it('formats ISO date string to human-readable', () => {
    const result = formatDate('2026-03-16');
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/16/);
  });
});
