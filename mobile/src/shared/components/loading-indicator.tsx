import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';

type LoadingIndicatorProps = {
  message: string;
  variant?: 'dots' | 'ring';
  inline?: boolean;
  stacked?: boolean;
  color?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
};

/** Native counterpart of the web's UIball Dot Pulse and Ring indicators. */
export function LoadingIndicator({ message, variant = 'dots', inline = false, stacked = false, color, textStyle, style }: LoadingIndicatorProps) {
  const palette = useTheme();
  // Keep still until the device's motion preference is known.
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [progress] = useState(() => new Animated.Value(0));
  const running = active && !reduceMotion;
  const animationColor = color ?? palette.primary;

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      preferenceChanged = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted && !preferenceChanged) setReduceMotion(enabled);
    }).catch(() => { /* Retain the still indicator if the preference is unavailable. */ });
    const appState = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { mounted = false; motion.remove(); appState.remove(); };
  }, []);

  useEffect(() => {
    progress.setValue(0);
    if (!running) return;
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: variant === 'ring' ? 1600 : 1500,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    }));
    animation.start();
    return () => { animation.stop(); progress.stopAnimation(); };
  }, [progress, running, variant]);

  return <View
    accessible={!inline}
    accessibilityRole={inline ? undefined : 'text'}
    accessibilityLabel={inline ? undefined : message}
    accessibilityLiveRegion={inline ? undefined : 'polite'}
    accessibilityState={inline ? undefined : { busy: true }}
    style={[styles.container, stacked && styles.stacked, style]}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={variant === 'ring' ? styles.ring : styles.dots}>
      {variant === 'ring' ? <>
        <View style={[styles.circle, styles.track, { borderColor: animationColor }]} />
        <Animated.View style={[styles.circle, { borderColor: animationColor, borderTopColor: 'transparent', transform: [{ rotate: running ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) : '0deg' }] }]} />
      </> : [0, 1, 2].map(index => <Animated.View key={index} style={[styles.dot, {
        backgroundColor: animationColor,
        transform: [{ scale: running ? progress.interpolate({
          inputRange: PULSE_INPUT,
          outputRange: PULSE_OUTPUT[index],
        }) : 1 }],
      }]} />)}
    </View>
    <Text style={[styles.message, color && { color }, textStyle]}>{message}</Text>
  </View>;
}

const PULSE_INPUT = Array.from({ length: 17 }, (_, index) => index / 16);
const PULSE_OUTPUT = [0, 1, 2].map(dot => PULSE_INPUT.map(time => Math.max(0, Math.sin((time - dot * 0.125) * Math.PI * 2))));

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: '100%' },
  stacked: { flexDirection: 'column', gap: 14 },
  message: { flexShrink: 1, color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  dots: { width: 28, minHeight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  ring: { width: 18, height: 18, flexShrink: 0 },
  circle: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  track: { opacity: 0.2 },
});
