import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { makeStyles, useTheme } from '@/constants/theme';
import { Glass } from '@/spark';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scrolling part (a main action). */
  footer?: ReactNode;
}

/**
 * A glass sheet that rises from the bottom with a spring; the scrim dims the page behind. Pull the handle
 * down (or tap outside) to close it. Content scrolls when it runs long.
 */
export default function Sheet({ visible, onClose, title, subtitle, children, footer }: Props) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { spark } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const y = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.setValue(0);
      Animated.spring(y, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 220, mass: 0.9 }).start();
    } else if (mounted) Animated.timing(y, { toValue: 0, duration: spark.motion.medium, useNativeDriver: true }).start(() => setMounted(false));
  }, [visible, y, mounted, spark.motion.medium]);

  // Dragging the handle: the sheet follows the finger down, and closes past a third of the way.
  const drag = useRef(new Animated.Value(0)).current;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120 || g.vy > 1.1) {
            close.current();
            Animated.timing(drag, { toValue: 0, duration: 1, delay: 300, useNativeDriver: true }).start();
          } else Animated.spring(drag, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 260 }).start();
        },
      }),
    [drag],
  );

  if (!mounted) return null;
  const maxW = Math.min(width, 560);
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: y }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.dock} pointerEvents="box-none">
        <Animated.View
          style={{
            width: maxW,
            maxHeight: height * 0.86,
            transform: [{ translateY: Animated.add(y.interpolate({ inputRange: [0, 1], outputRange: [height * 0.6, 0] }), drag) }],
          }}
        >
          <Glass tone="strong" blur elevated radius={28} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View {...responder.panHandlers} style={styles.grab} accessibilityRole="adjustable" accessibilityLabel={t('common.close')}>
              <View style={styles.handle} />
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
          </Glass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles(({ palette, type }) => ({
  scrim: { backgroundColor: 'rgba(0,0,0,0.42)' },
  dock: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden' },
  grab: { alignItems: 'center', paddingTop: 10, paddingHorizontal: 20, paddingBottom: 10, gap: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: palette.hairline, marginBottom: 8 },
  title: { ...type.title, textAlign: 'center' },
  subtitle: { ...type.small, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 6, gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8 },
}));
