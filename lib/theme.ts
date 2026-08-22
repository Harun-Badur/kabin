/**
 * Kabin tasarım sistemi: "Beyaz Taban + Mercan Aksan" (60-30-10).
 * 60 beyaz/kırık beyaz zemin, 30 antrasit tipografi, 10 mercan aksan.
 * Ekranlarda ham hex kullanılmaz; tüm renk/ölçü kararları buradan gelir.
 */
export const colors = {
  bg: '#F7F4F0',
  bgSoft: '#FAFAFA',
  /** Ürün ve liste kartlarının sıcak kırık beyaz zemini. */
  surface: '#F5F3EF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#EAE6E1',
  hairline: '#F3F4F6',
  tabInactive: '#9CA3AF',
  /** Arama/filtre kontrollerinin beyaz zemini. */
  input: '#FFFFFF',
  /** Büyüteç ve sliders ikonları. */
  icon: '#1A1A1A',
  /** Input placeholder. */
  placeholder: '#9CA3AF',
  /** Arama/filtre gölge rengi. */
  inputShadow: '#000000',
  accent: '#FE382B',
  /** Küçük metin ve linklerde kontrast için koyu aksan. */
  accentDark: '#D92B1F',
  /** Rozet ve switch zeminleri. */
  accentSoft: 'rgba(254, 56, 43, 0.1)',
  /** Yalnızca minimal kullanım: silme metin butonları. */
  destructive: '#DC2626',
  /** Kaydırma damgaları: traffic-light. */
  stampAdd: '#22C55E',
  stampPass: '#EF4444',
  /** Görsel üzerindeki çip/damga zemini. */
  glass: 'rgba(255, 255, 255, 0.94)',
  /** Toast gibi ters kontrastlı geçici yüzeyler. */
  inverseSurface: 'rgba(17, 24, 39, 0.92)',
  inverseText: '#FFFFFF',
  /** Modal arka perdesi (opaklık animasyonla verilir). */
  backdrop: '#111827',
  likeWash: 'rgba(34, 197, 94, 0.18)',
  passWash: 'rgba(239, 68, 68, 0.18)',
  shadow: '#1E140A',
} as const;

export const radius = {
  card: 24,
  button: 16,
  chip: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Header arama satırı ölçüleri. */
export const layout = {
  headerControl: 48,
  headerGap: 10,
  filterDot: 8,
} as const;

/** Açık zeminde iskelet parıltısı beyaz bir ışık bandıdır. */
export const gradients = {
  shimmer: [
    'rgba(255, 255, 255, 0)',
    'rgba(255, 255, 255, 0.85)',
    'rgba(255, 255, 255, 0)',
  ],
} as const;

/** Geniş, çok hafif, sıcak kart gölgesi — derinlik hissi. */
export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  chip: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    shadowColor: colors.inputShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
