import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SHIMMER_DURATION_MS } from '../lib/motion';

interface SkeletonShimmerProps {
  width: number;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const SHIMMER_WIDTH_RATIO = 0.42;

export default function SkeletonShimmer({
  width,
  height,
  borderRadius = 16,
  style,
}: SkeletonShimmerProps) {
  const travel = width + width * SHIMMER_WIDTH_RATIO;
  const translateX = useSharedValue(-width * SHIMMER_WIDTH_RATIO);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(travel, {
        duration: SHIMMER_DURATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [translateX, travel]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel="Yükleniyor"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          { width: width * SHIMMER_WIDTH_RATIO, height },
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(248, 250, 252, 0)',
            'rgba(248, 250, 252, 0.72)',
            'rgba(248, 250, 252, 0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});
