import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@shared/hooks';
import { FontSize, FontWeight, Space, Radii, Shadows, FontFamily } from '@shared/constants';
import { usePartnerSpace } from '../hooks/usePartnerSpace';
import { usePresence } from '../hooks/usePresence';
import Canvas from '../components/Canvas';
import FloatingAddButton from '../components/FloatingAddButton';
import QuickComposeSheet from '../components/QuickComposeSheet';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';

/**
 * Screen 1 — Space Tab (Home)
 * Live widget preview, partner info, presence, and CTAs.
 */
const SpaceHomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { space, items, permissions, isLoading, isRefreshing, partner, refresh } = usePartnerSpace();
  const { presenceText } = usePresence();
  const addItemToStore = usePartnerSpaceStore((s) => s.addItem);
  const pushUndo = usePartnerSpaceStore((s) => s.pushUndo);
  const [showComposeSheet, setShowComposeSheet] = useState(false);

  const navigateToCanvas = useCallback(() => {
    navigation.navigate('PartnerCanvas');
  }, [navigation]);

  const navigateToPermissions = useCallback(() => {
    navigation.navigate('SpacePermissions');
  }, [navigation]);

  const navigateToHistory = useCallback(() => {
    navigation.navigate('SpaceHistory');
  }, [navigation]);

  const navigateToSettings = useCallback(() => {
    navigation.navigate('SpaceSettings');
  }, [navigation]);

  const navigateToPreview = useCallback(() => {
    navigation.navigate('WidgetPreview');
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.backArrow, { color: colors.textSecondary }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.widgetNickname, { color: colors.primary }]}>
              {space?.nickname || 'Our Wall'}
            </Text>
          </View>
          <TouchableOpacity onPress={navigateToSettings}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Partner info */}
        {partner && (
          <View
            style={[styles.partnerCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          >
            <View style={styles.partnerInfo}>
              {partner.avatarUrl ? (
                <Image source={{ uri: partner.avatarUrl }} style={styles.partnerAvatar} />
              ) : (
                <View style={[styles.partnerAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={styles.partnerAvatarEmoji}>💕</Text>
                </View>
              )}
              <View style={styles.partnerTextContainer}>
                <Text style={[styles.partnerLabel, { color: colors.textSecondary }]}>
                  This widget is controlled by
                </Text>
                <Text style={[styles.partnerName, { color: colors.textPrimary }]}>
                  {partner.nickname || 'Your Partner'}
                </Text>
              </View>
            </View>

            {/* Presence line */}
            {presenceText && (
              <View style={styles.presenceRow}>
                <View style={[styles.presenceDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.presenceText, { color: colors.textMuted }]}>
                  {presenceText}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Live canvas preview */}
        <View style={styles.canvasContainer}>
          <Canvas
            editable={false}
            canvasHeight={320}
          />
        </View>

        {/* Action buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            onPress={navigateToPreview}
            style={[styles.actionCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          >
            <Text style={styles.actionEmoji}>📱</Text>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              Customize{'\n'}Widget
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={navigateToPermissions}
            style={[styles.actionCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          >
            <Text style={styles.actionEmoji}>🔒</Text>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              Permissions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={navigateToHistory}
            style={[styles.actionCard, { backgroundColor: colors.cardBg, ...Shadows.sm }]}
          >
            <Text style={styles.actionEmoji}>📅</Text>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>
              Widget{'\n'}History
            </Text>
          </TouchableOpacity>
        </View>

        {/* CTA to leave something on partner's canvas */}
        <View>
          <TouchableOpacity
            onPress={navigateToCanvas}
            activeOpacity={0.85}
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.ctaEmoji}>💌</Text>
            <Text style={styles.ctaText}>
              Leave something on {partner?.nickname || 'Partner'}'s widget
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating + button */}
      <FloatingAddButton onPress={() => setShowComposeSheet(true)} />

      {showComposeSheet && (
        <QuickComposeSheet
          onDismiss={() => setShowComposeSheet(false)}
          onItemAdded={(item) => {
            addItemToStore(item);
            pushUndo({ type: 'add', item });
            setShowComposeSheet(false);
          }}
        />
      )}
    </View>
  );
};

export default SpaceHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Space[4],
    paddingTop: Space[12],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space[4],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[2],
  },
  backButton: {
    padding: Space[1],
  },
  backArrow: {
    fontSize: 22,
    fontWeight: FontWeight.medium,
  },
  widgetNickname: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.display,
    fontWeight: FontWeight.semibold,
  },
  settingsIcon: {
    fontSize: 24,
  },
  partnerCard: {
    borderRadius: Radii.card,
    padding: Space[4],
    marginBottom: Space[4],
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space[3],
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  partnerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarEmoji: {
    fontSize: 22,
  },
  partnerTextContainer: {
    flex: 1,
  },
  partnerLabel: {
    fontSize: FontSize.xs,
    marginBottom: 2,
  },
  partnerName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space[3],
    gap: Space[2],
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  presenceText: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    fontFamily: FontFamily.handwriting,
  },
  canvasContainer: {
    alignItems: 'center',
    marginBottom: Space[4],
  },
  actionGrid: {
    flexDirection: 'row',
    gap: Space[3],
    marginBottom: Space[4],
  },
  actionCard: {
    flex: 1,
    borderRadius: Radii.lg,
    padding: Space[3],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  actionEmoji: {
    fontSize: 28,
    marginBottom: Space[2],
  },
  actionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space[2],
    paddingVertical: Space[4],
    paddingHorizontal: Space[5],
    borderRadius: Radii.button,
  },
  ctaEmoji: {
    fontSize: 20,
  },
  ctaText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
