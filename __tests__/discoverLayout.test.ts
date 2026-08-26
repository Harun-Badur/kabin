import {
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
  layout.deckPadding;

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

  it('segment → kart nefesi 10–12px token’dır', () => {
    expect(headerToDeckForHeight(640)).toBe(layout.headerToDeck);
    expect(headerToDeckForHeight(1536)).toBe(layout.headerToDeck);
    expect(layout.headerToDeck).toBeGreaterThanOrEqual(10);
    expect(layout.headerToDeck).toBeLessThanOrEqual(12);
  });

  it('search → segment boşluğu 8–10px’dir', () => {
    expect(layout.searchToSegment).toBeGreaterThanOrEqual(8);
    expect(layout.searchToSegment).toBeLessThanOrEqual(10);
  });

  it('segment yüksekliği 34–38 aralığındadır; CTA payı deckPadding’de kalır', () => {
    expect(layout.segmentHeight).toBeGreaterThanOrEqual(34);
    expect(layout.segmentHeight).toBeLessThanOrEqual(38);
    expect(layout.deckPadding).toBeGreaterThanOrEqual(12);
  });
});
