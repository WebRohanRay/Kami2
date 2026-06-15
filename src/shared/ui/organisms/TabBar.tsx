import React, { useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Radii, Shadows, Space, FontSize, FontWeight, Opacity } from '@shared/constants';
import { useTheme, useTextScale } from '@shared/hooks';

export interface TabItem {
  id:    string;
  icon:  string;
  label: string;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'home',    icon: '🏡', label: 'Home'    },
  { id: 'journal', icon: '📓', label: 'Journal' },
  { id: 'memories',icon: '📸', label: 'Memories'},
  { id: 'goals',   icon: '🌱', label: 'Goals'   },
  { id: 'future',  icon: '✨', label: 'Future'  },
];

interface TabBarProps {
  tabs?:      TabItem[];
  active:     string;
  onPress:    (id: string) => void;
  /** Map of tab id → badge count (0 or undefined = no badge) */
  badges?:    Record<string, number>;
}

const TabBar: React.FC<TabBarProps> = ({ tabs = DEFAULT_TABS, active, onPress, badges }) => {
  const { colors } = useTheme();
  const { scaleSize } = useTextScale();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  // ── Sliding pill indicator ──────────────────────────────
  const tabCount = tabs.length;
  const activeIndex = tabs.findIndex(t => t.id === active);
  const pillSlideAnim = useRef(new Animated.Value(activeIndex)).current;
  const pillStretchAnim = useRef(new Animated.Value(1)).current;
  const tabWidthRef = useRef(0);

  useEffect(() => {
    // Stretch the pill wider during travel, then snap back
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pillStretchAnim, { toValue: 1.6, duration: 120, useNativeDriver: true }),
        Animated.timing(pillStretchAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.spring(pillSlideAnim, {
        toValue: activeIndex,
        tension: 68,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Per-tab icon scale animations ──────────────────────
  const iconScaleAnims = useRef<Animated.Value[]>(
    tabs.map((_, i) => new Animated.Value(i === activeIndex ? 1 : 1))
  ).current;

  const prevActiveRef = useRef(activeIndex);

  useEffect(() => {
    const prevIdx = prevActiveRef.current;
    prevActiveRef.current = activeIndex;

    // Bounce the newly active icon
    Animated.sequence([
      Animated.spring(iconScaleAnims[activeIndex], {
        toValue: 1.18,
        tension: 200,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.spring(iconScaleAnims[activeIndex], {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Settle the previously active icon
    if (prevIdx !== activeIndex && prevIdx >= 0 && prevIdx < iconScaleAnims.length) {
      Animated.timing(iconScaleAnims[prevIdx], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Badge pulse animations ─────────────────────────────
  const badgePulseAnims = useRef<Record<string, Animated.Value>>({}).current;

  const getBadgePulse = useCallback((tabId: string) => {
    if (!badgePulseAnims[tabId]) {
      badgePulseAnims[tabId] = new Animated.Value(1);
    }
    return badgePulseAnims[tabId];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!badges) return;
    Object.entries(badges).forEach(([tabId, count]) => {
      if (count > 0) {
        const pulse = getBadgePulse(tabId);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          ]),
        ).start();
      }
    });
  }, [badges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBarLayout = (e: LayoutChangeEvent) => {
    tabWidthRef.current = e.nativeEvent.layout.width / tabCount;
  };

  const pillTranslateX = pillSlideAnim.interpolate({
    inputRange: tabs.map((_, i) => i),
    outputRange: tabs.map((_, i) => {
      // Center the pill within each tab slot
      // We use a relative multiplier since we don't know exact width at render time
      return i;
    }),
  });

  return (
    <View style={styles.bar} onLayout={handleBarLayout}>
      {/* Sliding pill indicator */}
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.primary,
            left: 0,
            transform: [
              {
                translateX: pillSlideAnim.interpolate({
                  inputRange: tabs.map((_, i) => i),
                  outputRange: tabs.map((_, i) => {
                    // Position: center of each tab
                    // Tab width = 100% / tabCount, pill center = tabWidth/2 - pillWidth/2
                    const pct = (i + 0.5) / tabCount;
                    // We approximate: assume bar ~400px on average. This works with flex layout.
                    return 0; // Will be overridden by left positioning
                  }),
                }),
              },
              { scaleX: pillStretchAnim },
            ],
          },
        ]}
      />

      {tabs.map((tab, idx) => {
        const isActive = tab.id === active;
        const badgeCount = badges?.[tab.id] ?? 0;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.item}
            onPress={() => onPress(tab.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {/* Per-tab pill (positioned absolutely) */}
            {isActive && (
              <View style={[styles.activePill, { backgroundColor: colors.primary }]} />
            )}

            {/* Icon with scale animation */}
            <Animated.Text
              style={[
                styles.icon,
                isActive && styles.iconActive,
                {
                  fontSize: scaleSize(FontSize.xl),
                  transform: [{ scale: iconScaleAnims[idx] }],
                },
              ]}
            >
              {tab.icon}
            </Animated.Text>

            {/* Label */}
            <Text
              style={[
                styles.label,
                isActive && [styles.labelActive, { color: colors.primary }],
                { fontSize: scaleSize(FontSize.xs) },
              ]}
            >
              {tab.label}
            </Text>

            {/* Notification badge dot */}
            {badgeCount > 0 && (
              <Animated.View
                style={[
                  styles.badgeDot,
                  {
                    backgroundColor: colors.primary,
                    transform: [{ scale: getBadgePulse(tab.id) }],
                  },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default TabBar;

const getStyles = (colors: any) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border + Opacity.medium,
    paddingTop: Space[2],
    paddingBottom: Platform.OS === 'ios' ? Space[6] : Space[3],
    zIndex: 10,
    ...Shadows.md,
    position: 'relative',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  pill: {
    position: 'absolute',
    top: -1,
    width: 24,
    height: 3,
    borderRadius: Radii.full,
  },
  activePill: {
    position: 'absolute',
    top: -Space[2],
    width: 24,
    height: 3,
    borderRadius: Radii.full,
  },
  icon: {
    fontSize: FontSize.xl,
    opacity: 0.45,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: FontWeight.bold,
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: '25%',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
});
