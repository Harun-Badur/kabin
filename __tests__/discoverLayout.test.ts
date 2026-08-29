import {
  deckPeekStepForHeight,
  discoverCardLiftForHeight,
  estimateDiscoverCardHeight,
  headerToDeckForHeight,
  layout,
} from '../lib/theme';

const chromeFor = (screenHeight: number): number =>
  layout.statusBarFallback +
  layout.headerPaddingTop +
  layout.headerControl +
  layout.searchToSegment +
  layout.segmentHeight +
  headerToDeckForHeight(screenHeight) +
  layout.tabBarContentHeight +
  layout.tabBarFallbackPadding +
  layout.deckPadding +
  discoverCardLiftForHeight(screenHeight);

describe('discover layout', () => {
  it.each([640, 691, 720, 800, 844, 915, 1536])(
    '%i px ekranda kart chrome ile taşmaz',
    (screenHeight: number) => {
      const cardHeight = estimateDiscoverCardHeight(screenHeight);
      expect(cardHeight).toBeGreaterThan(0);
      expect(cardHeight + chromeFor(screenHeight)).toBeLessThanOrEqual(
        screenHeight,
      );
    },
  );

  it('segment → kart nefesi kısa ekranda 4px, uzunda 6px’dir', () => {
    expect(headerToDeckForHeight(640)).toBe(layout.headerToDeckMin);
    expect(headerToDeckForHeight(1536)).toBe(layout.headerToDeck);
    expect(layout.headerToDeckMin).toBe(4);
    expect(layout.headerToDeck).toBe(6);
  });

  it('search → segment boşluğu ~%25 sıkıdır (6px)', () => {
    expect(layout.searchToSegment).toBe(6);
  });

  it('kart kaldırması 8–12px’dir; kart yüksekliği korunur', () => {
    expect(discoverCardLiftForHeight(640)).toBeGreaterThanOrEqual(8);
    expect(discoverCardLiftForHeight(640)).toBeLessThanOrEqual(12);
    expect(discoverCardLiftForHeight(1536)).toBeGreaterThanOrEqual(8);
    expect(discoverCardLiftForHeight(1536)).toBeLessThanOrEqual(12);
  });

  it('segment yüksekliği 34–38 aralığındadır; CTA payı deckPadding’de kalır', () => {
    expect(layout.segmentHeight).toBeGreaterThanOrEqual(34);
    expect(layout.segmentHeight).toBeLessThanOrEqual(38);
    expect(layout.deckPadding).toBeGreaterThanOrEqual(12);
  });

  it('deste peek adımı kısa ekranda 4px, uzunda 6px’dir', () => {
    expect(deckPeekStepForHeight(640)).toBe(layout.deckPeekStepMin);
    expect(deckPeekStepForHeight(1536)).toBe(layout.deckPeekStepMax);
    expect(layout.deckPeekStepMin).toBe(4);
    expect(layout.deckPeekStepMax).toBe(6);
    expect(layout.deckPeekStep).toBe(4);
    expect(layout.deckPeekStepMax).toBeLessThanOrEqual(12);
    expect(layout.deckPeekStepMin).toBeGreaterThanOrEqual(4);
  });
});
