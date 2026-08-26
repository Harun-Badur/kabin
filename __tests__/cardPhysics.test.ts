import { CARD_SHADOW_SPREAD_PX } from '../lib/theme';
import {
  DECK_OPACITY_BY_DEPTH,
  DECK_PEEK_STEP_PX,
  DECK_PROMOTE_SPRING,
  DECK_SCALE_BY_DEPTH,
  CARD_SPRING_BACK,
  CARD_THROW_SPRING,
  deckClearTravelPx,
  getStackPose,
  getUndoParkY,
  lerp,
  PAN_ACTIVE_OFFSET_Y_PX,
  PAN_FAIL_OFFSET_X_PX,
  PASS_DISTANCE_PX,
  PASS_VELOCITY_PX,
  UNDO_DISTANCE_PX,
  UNDO_PARK_CLEARANCE_PX,
  UNDO_SETTLE_SPRING,
  UNDO_VELOCITY_PX,
  passProgress,
  shouldCommitPass,
  shouldCommitUndo,
  undoReturnProgress,
} from '../lib/motion';

describe('vertical pass intent', () => {
  it('eşiği aşan yukarı sürükleme commit eder', () => {
    expect(shouldCommitPass(-PASS_DISTANCE_PX, 0)).toBe(true);
    expect(shouldCommitPass(-120, -200)).toBe(true);
  });

  it('yüksek yukarı velocity kısa mesafede de commit eder', () => {
    expect(shouldCommitPass(-40, -PASS_VELOCITY_PX)).toBe(true);
  });

  it('eşik altı release spring-back', () => {
    expect(shouldCommitPass(-40, -400)).toBe(false);
  });

  it('aşağı hareket pass değildir', () => {
    expect(shouldCommitPass(120, 1400)).toBe(false);
    expect(shouldCommitPass(0, 0)).toBe(false);
  });
});

describe('vertical undo intent', () => {
  it('eşiği aşan veya hızlı aşağı sürükleme commit eder', () => {
    expect(shouldCommitUndo(UNDO_DISTANCE_PX, 0)).toBe(true);
    expect(shouldCommitUndo(40, UNDO_VELOCITY_PX)).toBe(true);
  });

  it('eşik altı ve yukarı hareket undo değildir', () => {
    expect(shouldCommitUndo(40, 400)).toBe(false);
    expect(shouldCommitUndo(-120, -1400)).toBe(false);
  });
});

describe('vertical pan lock', () => {
  it('yatay fail eşiği Y aktivasyonundan geniştir: hafif çapraz dikey kalır', () => {
    expect(PAN_FAIL_OFFSET_X_PX).toBeGreaterThan(PAN_ACTIVE_OFFSET_Y_PX);
  });
});

describe('vertical progress', () => {
  it('GEÇ damgası yalnız yukarı sürüklemede artar', () => {
    expect(passProgress(-PASS_DISTANCE_PX)).toBe(1);
    expect(passProgress(-2 * PASS_DISTANCE_PX)).toBe(1);
    expect(passProgress(-42)).toBeCloseTo(42 / PASS_DISTANCE_PX, 5);
    expect(passProgress(0)).toBe(0);
    expect(passProgress(120)).toBe(0);
  });

  it('park eden kartın dönüş oranı yalnız aşağı çekişte artar', () => {
    expect(undoReturnProgress(0, 600)).toBe(0);
    expect(undoReturnProgress(-120, 600)).toBe(0);
    expect(undoReturnProgress(300, 600)).toBeCloseTo(0.5, 5);
    expect(undoReturnProgress(900, 600)).toBe(1);
  });

  it('geçersiz yol uzunluğu sıfır oran verir', () => {
    expect(undoReturnProgress(300, 0)).toBe(0);
  });
});

describe('deck clearance', () => {
  const CARD_H = 616;

  it('park clearance kartı clip dışında tutar (en az 24px + gölge)', () => {
    expect(UNDO_PARK_CLEARANCE_PX).toBeGreaterThanOrEqual(24);
    expect(deckClearTravelPx(CARD_H)).toBe(
      CARD_H + UNDO_PARK_CLEARANCE_PX + CARD_SHADOW_SPREAD_PX,
    );
    expect(deckClearTravelPx(CARD_H)).toBeGreaterThanOrEqual(CARD_H + 24);
  });

  it('park pozisyonu çıkış yolunun tam tersidir', () => {
    expect(getUndoParkY(CARD_H)).toBe(-deckClearTravelPx(CARD_H));
  });
});

describe('motion language', () => {
  it('hiçbir release springi overshoot yapmaz', () => {
    expect(CARD_SPRING_BACK.overshootClamping).toBe(true);
    expect(CARD_THROW_SPRING.overshootClamping).toBe(true);
    expect(UNDO_SETTLE_SPRING.overshootClamping).toBe(true);
  });
});

describe('stack geometry', () => {
  const CARD_H = 616;
  /** Kart merkezden ölçeklendiği için alt kenar = translateY - kaybedilen yarım. */
  const bottomEdge = (depth: number): number => {
    const pose = getStackPose(depth, CARD_H);
    return pose.translateY - ((1 - pose.scale) * CARD_H) / 2;
  };

  it('ön kart çerçevede tam oturur', () => {
    const pose = getStackPose(0, CARD_H);
    expect(pose.scale).toBe(1);
    expect(pose.translateY).toBe(0);
    expect(pose.opacity).toBe(1);
  });

  it('yalnız bir arka kart örtülü durur; 2. arka kart gizli', () => {
    expect(bottomEdge(1)).toBeCloseTo(DECK_PEEK_STEP_PX, 5);
    expect(bottomEdge(1)).toBe(0);
    expect(getStackPose(1, CARD_H).opacity).toBe(DECK_OPACITY_BY_DEPTH[1]);
    expect(getStackPose(1, CARD_H).scale).toBe(0.995);
    expect(getStackPose(2, CARD_H).opacity).toBe(0);
    expect(getStackPose(9, CARD_H).opacity).toBe(0);
  });

  it('kenar payı deck padding’ini aşmaz', () => {
    expect(bottomEdge(1)).toBeLessThanOrEqual(12);
    expect(DECK_PEEK_STEP_PX).toBe(0);
  });

  it('taşan derinlik son basamağa sabitlenir', () => {
    expect(getStackPose(9, CARD_H).scale).toBe(
      DECK_SCALE_BY_DEPTH[DECK_SCALE_BY_DEPTH.length - 1],
    );
  });

  it('js lerp worklet interpolate’e ihtiyaç duymaz', () => {
    expect(lerp(0.97, 1, 0)).toBeCloseTo(0.97, 5);
    expect(lerp(0.97, 1, 1)).toBeCloseTo(1, 5);
    expect(lerp(8, 0, 0.5)).toBeCloseTo(4, 5);
  });
});

describe('deck rest pose', () => {
  it('öndeki kart opak; arka katmanların kenarı yok', () => {
    expect(DECK_OPACITY_BY_DEPTH[0]).toBe(1);
    expect(DECK_OPACITY_BY_DEPTH[1]).toBe(0);
    expect(DECK_OPACITY_BY_DEPTH[2]).toBe(0);
  });

  it('görünür arka kart neredeyse tam örtülü (0.99–0.998)', () => {
    expect(DECK_SCALE_BY_DEPTH[1]).toBeGreaterThanOrEqual(0.99);
    expect(DECK_SCALE_BY_DEPTH[1]).toBeLessThanOrEqual(0.998);
  });

  it('scale basamakları teleport etmeyecek kadar dar', () => {
    expect(DECK_SCALE_BY_DEPTH[1]).toBeGreaterThanOrEqual(0.96);
    expect(DECK_SCALE_BY_DEPTH[2]).toBeGreaterThanOrEqual(0.93);
    expect(DECK_SCALE_BY_DEPTH[0] - DECK_SCALE_BY_DEPTH[1]).toBeLessThanOrEqual(
      0.04,
    );
  });

  it('promotion spring overshoot kapatır', () => {
    expect(DECK_PROMOTE_SPRING.overshootClamping).toBe(true);
  });
});
