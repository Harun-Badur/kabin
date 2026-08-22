import { useEffect, type ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ONBOARDING_ARROW_DURATION_MS,
  ONBOARDING_PULSE_DURATION_MS,
  ONBOARDING_SCAN_DURATION_MS,
  ONBOARDING_SWAY_DEG,
  ONBOARDING_SWAY_DURATION_MS,
} from '../lib/motion';
import { colors, radius, shadows, spacing } from '../lib/theme';

const STAGE_WIDTH = 280;
const STAGE_HEIGHT = 250;
const CARD_W = 92;
const CARD_H = 124;
const CARD_LEFT = (STAGE_WIDTH - CARD_W) / 2;
const CARD_TOP = (STAGE_HEIGHT - CARD_H) / 2;
const PHONE_W = 132;
const PHONE_H = 220;
const SCAN_TRAVEL_PX = 148;

interface MiniCardProps {
  offsetX: number;
  offsetY: number;
  rotateDeg: number;
  zIndex: number;
  muted?: boolean;
}

function MiniCard({
  offsetX,
  offsetY,
  rotateDeg,
  zIndex,
  muted = false,
}: MiniCardProps) {
  return (
    <View
      style={[
        styles.miniCard,
        {
          zIndex,
          transform: [
            { translateX: offsetX },
            { translateY: offsetY },
            { rotate: `${rotateDeg}deg` },
          ],
        },
        muted ? styles.miniCardMuted : null,
      ]}
    >
      <View style={styles.miniImage} />
      <View style={styles.miniInfo}>
        <View style={styles.miniLineWide} />
        <View style={styles.miniLineNarrow} />
      </View>
    </View>
  );
}

export function DiscoverFanIllustration(): ReactElement {
  const sway = useSharedValue(0);

  useEffect(() => {
    sway.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ONBOARDING_SWAY_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(-1, {
          duration: ONBOARDING_SWAY_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
  }, [sway]);

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -10 },
      { rotate: `${sway.value * ONBOARDING_SWAY_DEG}deg` },
    ],
  }));

  return (
    <View style={styles.stage} accessibilityElementsHidden>
      <MiniCard offsetX={-58} offsetY={18} rotateDeg={-16} zIndex={1} muted />
      <MiniCard offsetX={58} offsetY={22} rotateDeg={14} zIndex={2} muted />
      <Animated.View style={[styles.miniCard, styles.frontCard, topCardStyle]}>
        <View style={styles.miniImage} />
        <View style={styles.miniInfo}>
          <View style={styles.miniLineWide} />
          <View style={styles.miniLineNarrow} />
        </View>
      </Animated.View>
    </View>
  );
}

export function TryOnScanIllustration(): ReactElement {
  const shirtDrop = useSharedValue(0);
  const scan = useSharedValue(0);

  useEffect(() => {
    shirtDrop.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: 700 }),
        withTiming(0, {
          duration: 500,
          easing: Easing.in(Easing.cubic),
        }),
      ),
      -1,
      false,
    );
    scan.value = withRepeat(
      withTiming(1, {
        duration: ONBOARDING_SCAN_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false,
    );
  }, [scan, shirtDrop]);

  const shirtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shirtDrop.value, [0, 0.2, 1], [0, 1, 1]),
    transform: [
      {
        translateY: interpolate(shirtDrop.value, [0, 1], [-36, 8]),
      },
    ],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scan.value, [0, 0.08, 0.92, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(scan.value, [0, 1], [8, SCAN_TRAVEL_PX]) }],
  }));

  return (
    <View style={styles.stage} accessibilityElementsHidden>
      <View style={styles.phone}>
        <View style={styles.phoneSpeaker} />
        <View style={styles.phoneScreen}>
          <View style={styles.silhouette} />
          <Animated.View style={[styles.shirtLayer, shirtStyle]}>
            <View style={styles.shirtSleeveLeft} />
            <View style={styles.shirtBody} />
            <View style={styles.shirtSleeveRight} />
          </Animated.View>
          <Animated.View style={[styles.scanLine, scanStyle]} />
        </View>
      </View>
    </View>
  );
}

export function PriceAlertIllustration(): ReactElement {
  const arrow = useSharedValue(0);
  const strike = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    arrow.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: ONBOARDING_ARROW_DURATION_MS,
          easing: Easing.out(Easing.back(1.4)),
        }),
        withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
    strike.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 180 }),
        withTiming(1, { duration: ONBOARDING_ARROW_DURATION_MS }),
        withTiming(1, { duration: 280 }),
        withTiming(0, { duration: 200 }),
      ),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.16, {
          duration: ONBOARDING_PULSE_DURATION_MS,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, {
          duration: ONBOARDING_PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [arrow, pulse, strike]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(arrow.value, [0, 1], [-18, 10]) },
    ],
  }));

  const strikeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(strike.value, [0, 1], [0.08, 1]) }],
    opacity: interpolate(strike.value, [0, 0.15, 1], [0, 1, 1]),
  }));

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.stage} accessibilityElementsHidden>
      <View style={styles.tag}>
        <View style={styles.tagHole} />
        <View style={styles.oldPriceWrap}>
          <Text style={styles.oldPrice}>1.290 ₺</Text>
          <Animated.View style={[styles.strike, strikeStyle]} />
        </View>
        <Text style={styles.newPrice}>849 ₺</Text>
      </View>
      <Animated.View style={[styles.arrow, arrowStyle]}>
        <View style={styles.arrowStem} />
        <View style={styles.arrowHead} />
      </Animated.View>
      <Animated.View style={[styles.bellWrap, bellStyle]}>
        <Bell color={colors.accent} size={28} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCard: {
    position: 'absolute',
    left: CARD_LEFT,
    top: CARD_TOP,
    width: CARD_W,
    height: CARD_H,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  miniCardMuted: {
    opacity: 0.72,
  },
  frontCard: {
    zIndex: 3,
  },
  miniImage: {
    flex: 1,
    backgroundColor: colors.accentSoft,
  },
  miniInfo: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 6,
    backgroundColor: colors.surface,
  },
  miniLineWide: {
    height: 6,
    width: '78%',
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  miniLineNarrow: {
    height: 6,
    width: '46%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    padding: 8,
    alignItems: 'center',
    ...shadows.card,
  },
  phoneSpeaker: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  phoneScreen: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 18,
  },
  silhouette: {
    width: 48,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  shirtLayer: {
    position: 'absolute',
    top: 36,
    width: 88,
    height: 92,
    alignItems: 'center',
  },
  shirtBody: {
    width: 56,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  shirtSleeveLeft: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: 22,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentDark,
  },
  shirtSleeveRight: {
    position: 'absolute',
    right: 0,
    top: 8,
    width: 22,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accentDark,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  tag: {
    width: 148,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.card,
  },
  tagHole: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  oldPriceWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  oldPrice: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  strike: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
    backgroundColor: colors.stampPass,
    borderRadius: 1,
  },
  newPrice: {
    marginTop: spacing.sm,
    color: colors.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  arrow: {
    position: 'absolute',
    right: 38,
    top: 42,
    alignItems: 'center',
  },
  arrowStem: {
    width: 3,
    height: 28,
    backgroundColor: colors.stampAdd,
    borderRadius: 2,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.stampAdd,
  },
  bellWrap: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
