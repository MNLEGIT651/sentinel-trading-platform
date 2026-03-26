import { describe, expect, it } from 'vitest';
import { TICKER_NAMES, SECTOR_MAP, SECTOR_COLORS } from '@/lib/portfolio-data';

// ---------------------------------------------------------------------------
// TICKER_NAMES
// ---------------------------------------------------------------------------

describe('TICKER_NAMES', () => {
  it('is an object', () => {
    expect(typeof TICKER_NAMES).toBe('object');
    expect(TICKER_NAMES).not.toBeNull();
  });

  it('contains core tickers', () => {
    const expectedTickers = [
      'AAPL',
      'MSFT',
      'GOOGL',
      'AMZN',
      'NVDA',
      'TSLA',
      'META',
      'JPM',
      'V',
      'SPY',
      'QQQ',
    ];
    for (const ticker of expectedTickers) {
      expect(TICKER_NAMES).toHaveProperty(ticker);
      expect(typeof TICKER_NAMES[ticker]).toBe('string');
      expect(TICKER_NAMES[ticker]!.length).toBeGreaterThan(0);
    }
  });

  it('maps AAPL to Apple Inc.', () => {
    expect(TICKER_NAMES['AAPL']).toBe('Apple Inc.');
  });

  it('maps SPY to SPDR S&P 500', () => {
    expect(TICKER_NAMES['SPY']).toBe('SPDR S&P 500');
  });

  it('all ticker keys are uppercase', () => {
    for (const key of Object.keys(TICKER_NAMES)) {
      expect(key).toBe(key.toUpperCase());
    }
  });

  it('all values are non-empty strings', () => {
    for (const [key, value] of Object.entries(TICKER_NAMES)) {
      expect(typeof value).toBe('string');
      expect(value.trim().length, `Name for ${key} should be non-empty`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTOR_MAP
// ---------------------------------------------------------------------------

describe('SECTOR_MAP', () => {
  it('is an object', () => {
    expect(typeof SECTOR_MAP).toBe('object');
    expect(SECTOR_MAP).not.toBeNull();
  });

  it('classifies technology tickers correctly', () => {
    const techTickers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AMD', 'NFLX'];
    for (const ticker of techTickers) {
      expect(SECTOR_MAP[ticker], `${ticker} should be Technology`).toBe('Technology');
    }
  });

  it('classifies financial tickers correctly', () => {
    expect(SECTOR_MAP['JPM']).toBe('Financials');
    expect(SECTOR_MAP['V']).toBe('Financials');
  });

  it('classifies consumer tickers correctly', () => {
    expect(SECTOR_MAP['AMZN']).toBe('Consumer');
    expect(SECTOR_MAP['TSLA']).toBe('Consumer');
    expect(SECTOR_MAP['DIS']).toBe('Consumer');
  });

  it('classifies index ETFs correctly', () => {
    expect(SECTOR_MAP['SPY']).toBe('Index');
    expect(SECTOR_MAP['QQQ']).toBe('Index');
  });

  it('classifies Boeing as Industrials', () => {
    expect(SECTOR_MAP['BA']).toBe('Industrials');
  });

  it('all values are non-empty sector name strings', () => {
    for (const [ticker, sector] of Object.entries(SECTOR_MAP)) {
      expect(typeof sector).toBe('string');
      expect(sector.trim().length, `Sector for ${ticker} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('all tickers in SECTOR_MAP are also in TICKER_NAMES', () => {
    for (const ticker of Object.keys(SECTOR_MAP)) {
      expect(TICKER_NAMES, `${ticker} missing from TICKER_NAMES`).toHaveProperty(ticker);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTOR_COLORS
// ---------------------------------------------------------------------------

describe('SECTOR_COLORS', () => {
  it('is an object', () => {
    expect(typeof SECTOR_COLORS).toBe('object');
    expect(SECTOR_COLORS).not.toBeNull();
  });

  it('has a color for each distinct sector in SECTOR_MAP', () => {
    const sectors = new Set(Object.values(SECTOR_MAP));
    for (const sector of sectors) {
      expect(SECTOR_COLORS, `Missing color for sector: ${sector}`).toHaveProperty(sector);
    }
  });

  it('all color values are Tailwind bg-* classes', () => {
    for (const [sector, color] of Object.entries(SECTOR_COLORS)) {
      expect(color, `Color for ${sector} should be a bg-* class`).toMatch(/^bg-[a-z]+-\d+$/);
    }
  });

  it('Technology sector has a color', () => {
    expect(SECTOR_COLORS['Technology']).toBeDefined();
  });

  it('Financials sector has a color', () => {
    expect(SECTOR_COLORS['Financials']).toBeDefined();
  });

  it('Index sector has a color', () => {
    expect(SECTOR_COLORS['Index']).toBeDefined();
  });
});
