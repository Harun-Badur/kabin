import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  HINT_BOB_DURATION_MS,
  HINT_BOB_OFFSET_PX,
  HINT_ENTER_DURATION_MS,
  HINT_EXIT_DURATION_MS,
} from '../lib/motion';
import { colors, radius, shadows, spacing } from '../lib/theme';

interface SwipeHintOverlayProps {
  onDismiss: () => void;
}

const HINT_ICON_SIZE = 16;

export default function SwipeHintOverlay({
  onDismiss,
}: SwipeHintOverlayProps) {
  const enterProgress = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    enterProgress.value = withTiming(1, {
      duration: HINT_ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    bob.value = withRepeat(
      withTiming(1, {
        duration: HINT_BOB_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(enterProgress);
      cancelAnimation(bob);
    };
  }, [bob, enterProgress]);

  const handlePress = useCallback((): void => {
    cancelAnimation(bob);
    enterProgress.value = withTiming(
      0,
      { duration: HINT_EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onDismiss)();
        }
      },
    );
  }, [bob, enterProgress, onDismiss]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: enterProgress.value,
    transform: [
      {
        translateY: interpolate(
          enterProgress.value,
          [0, 1],
          [HINT_BOB_OFFSET_PX * 4, 0],
        ),
      },
    ],
  }));

  const bobStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(bob.value, [0, 1], [0, -HINT_BOB_OFFSET_PX]),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.wrap, containerStyle]}>
      <Pressable
        onPress={handlePress}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel="Kaydırma ipucunu kapat"
      >
        <Animated.View style={[styles.row, bobStyle]}>
          <View style={styles.hint}>
            <ArrowRight color={colors.accent} size={HINT_ICON_SIZE} />
            <Text style={styles.hintText}>ekle</Text>
          </View>
          <View style={styles.hint}>
            <ArrowLeft color={colors.accent} size={HINT_ICON_SIZE} />
            <Text style={styles.hintText}>geç</Text>
          </View>
          <View style={styles.hint}>
            <ArrowUp color={colors.accent} size={HINT_ICON_SIZE} />
            <Text style={styles.hintText}>mağazaya</Text>
          </View>
        </Animated.View>
        <Text style={styles.caption}>Kapatmak için dokun</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    zIndex: 8,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hintText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  caption: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
