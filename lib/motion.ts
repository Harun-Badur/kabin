/** Ortak süreler: JS thread’de interpolasyon yok, hepsi Reanimated worklet’e gider. */
export const PRESS_SCALE = 0.95;
export const PRESS_DURATION_MS = 100;

export const TAB_TRANSITION_MS = 200;
export const STACK_TRANSITION_MS = 200;

/** Deste hissi: aktif kartın arkasındaki iki kartın derinlik basamakları. */
export const DECK_VISIBLE_COUNT = 3;
export const DECK_SCALE_BY_DEPTH = [1, 0.95, 0.9] as const;
export const DECK_TRANSLATE_Y_BY_DEPTH = [0, 12, 24] as const;
export const DECK_OPACITY_BY_DEPTH = [1, 0.7, 0.45] as const;
export const DECK_SPRING = { damping: 16, stiffness: 160 } as const;

export const HINT_ENTER_DURATION_MS = 260;
export const HINT_EXIT_DURATION_MS = 180;
export const HINT_BOB_DURATION_MS = 900;
export const HINT_BOB_OFFSET_PX = 6;

export const CARD_MAX_ROTATION_DEG = 15;
export const CARD_SNAP_SCALE = 0.9;
export const CARD_SNAP_DURATION_MS = 200;
export const CARD_EXIT_DURATION_MS = 300;
export const CARD_EXIT_LIFT_PX = 200;

export const ONBOARDING_PAGE_COUNT = 3;
export const ONBOARDING_STAGGER_MS = 90;
export const ONBOARDING_ENTER_SPRING = { damping: 14, stiffness: 170 } as const;
export const ONBOARDING_DOT_SPRING = { damping: 16, stiffness: 220 } as const;
export const ONBOARDING_PARALLAX_FACTOR = 0.28;
export const ONBOARDING_SWAY_DEG = 7;
export const ONBOARDING_SWAY_DURATION_MS = 1400;
export const ONBOARDING_SCAN_DURATION_MS = 1800;
export const ONBOARDING_PULSE_DURATION_MS = 900;
export const ONBOARDING_ARROW_DURATION_MS = 1100;

export const MODAL_SLIDE_DURATION_MS = 280;
export const MODAL_BACKDROP_MAX_OPACITY = 0.56;
export const CONSENT_ENTER_DURATION_MS = 200;
export const HERO_GROW_DURATION_MS = 280;

export const SHIMMER_DURATION_MS = 1200;
export const SPINNER_ROTATION_DURATION_MS = 800;
