import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SPINNER_ROTATION_DURATION_MS } from '../lib/motion';
import { colors, shadows, spacing } from '../lib/theme';

interface RefreshSpinnerProps {
  visible: boolean;
}

export default function RefreshSpinner({ visible }: RefreshSpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(rotation);
      rotation.value = 0;
      return;
    }

    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, {
        duration: SPINNER_ROTATION_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation, visible]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={spinStyle}>
        <RefreshCw color={colors.accent} size={22} strokeWidth={2.4} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    zIndex: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.chip,
  },
});
