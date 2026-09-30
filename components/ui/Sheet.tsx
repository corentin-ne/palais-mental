import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glass from './Glass';
import { makeStyles, useTheme } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Fraction of the screen the sheet may take. */
  maxHeight?: number;
  /** 'clear' keeps the room fully visible behind the sheet (used while inspecting an object). */
  backdrop?: 'dim' | 'clear';
  scroll?: boolean;
  accessibilityLabel?: string;
}

const SCREEN = Dimensions.get('window').height;

/**
 * Bottom sheet: frosted glass, springs up, follows the finger on its handle and
 * dismisses on a downward fling. Stays mounted just long enough to animate out.
 */
export default function Sheet({
  visible,
  onClose,
  children,
  maxHeight = 0.86,
  backdrop = 'dim',
  scroll = true,
  accessibilityLabel,
}: Props) {
  const { radii } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 210, mass: 0.9 }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.9) onClose();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 240 }).start();
      },
    }),
  ).current;

  if (!mounted) return null;

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [SCREEN * 0.6, 0] }),
    drag,
  );
  const Body = scroll ? ScrollView : View;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: backdrop === 'dim' ? 'rgba(8,30,60,0.22)' : 'transparent', opacity: progress }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={accessibilityLabel} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.anchor}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheetWrap, { maxHeight: `${maxHeight * 100}%`, transform: [{ translateY }] }]}>
          <Glass radius={radii.xl} strong style={styles.glass} contentStyle={styles.glassInner}>
            <View {...pan.panHandlers} style={styles.handleZone}>
              <View style={styles.handle} />
            </View>
            <Body
              style={styles.body}
              contentContainerStyle={scroll ? [styles.content, { paddingBottom: insets.bottom + 24 }] : undefined}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {scroll ? children : <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>{children}</View>}
            </Body>
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles(({ palette }) => ({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 6 },
  glass: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  glassInner: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, flexShrink: 1 },
  handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: palette.hairline },
  body: { flexGrow: 0 },
  content: { paddingHorizontal: 22, paddingTop: 6, gap: 18 },
}));
