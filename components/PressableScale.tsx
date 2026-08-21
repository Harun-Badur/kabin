import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PRESS_DURATION_MS, PRESS_SCALE } from '../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function PressableScale({
  children,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!disabled) {
          scale.value = withTiming(PRESS_SCALE, {
            duration: PRESS_DURATION_MS,
          });
        }
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withTiming(1, { duration: PRESS_DURATION_MS });
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
