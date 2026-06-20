import { useEffect, useCallback, useRef, useMemo } from 'react';
import { usePartnerSpaceStore } from '../store/partnerSpaceStore';
import { useCoupleStore } from '@features/couple/store/coupleStore';
import { useAuthStore } from '@features/auth';
import * as SpaceService from '@infrastructure/partner-space/partnerSpaceService';

/**
 * Main hook to initialise Partner Space.
 * Loads space, items, permissions and sticker packs on mount.
 */
export function usePartnerSpace() {
  const couple = useCoupleStore((s) => s.couple);
  const partner = useCoupleStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);

  // Select individual pieces — never subscribe to the entire store
  const space = usePartnerSpaceStore((s) => s.space);
  const items = usePartnerSpaceStore((s) => s.items);
  const permissions = usePartnerSpaceStore((s) => s.permissions);
  const spaceLoading = usePartnerSpaceStore((s) => s.spaceLoading);

  const initialised = useRef(false);

  const load = useCallback(async () => {
    if (!couple?.id || !user?.id) return;

    const store = usePartnerSpaceStore.getState();
    if (store.spaceLoading === 'loading') return;

    store.setSpaceLoading('loading');
    store.setMyUserId(user.id);

    // Fetch or create space
    const spaceRes = await SpaceService.fetchOrCreateSpace(couple.id);
    if (!spaceRes.success) {
      store.setSpaceLoading('error');
      return;
    }

    store.setSpace(spaceRes.data);

    // Determine roles — for now both partners can control each other's space
    store.setRoles(true, true);

    // Fetch items
    store.setItemsLoading('loading');
    const itemsRes = await SpaceService.fetchItems(spaceRes.data.id);
    if (itemsRes.success) {
      store.setItems(itemsRes.data);
    }
    store.setItemsLoading('idle');

    // Fetch permissions
    store.setPermissionsLoading('loading');
    const permsRes = await SpaceService.fetchPermissions(spaceRes.data.id);
    if (permsRes.success) {
      store.setPermissions(permsRes.data);
      store.setPermissionsLoading('idle');
    } else {
      store.setPermissionsLoading('error');
    }

    // Fetch sticker packs
    store.setStickerPacksLoading('loading');
    const packsRes = await SpaceService.fetchStickerPacks();
    if (packsRes.success) {
      store.setStickerPacks(packsRes.data);
      store.setStickerPacksLoading('idle');
    } else {
      store.setStickerPacksLoading('error');
    }

    // Fetch scheduled drops
    const dropsRes = await SpaceService.fetchScheduledDrops(spaceRes.data.id);
    if (dropsRes.success) {
      store.setScheduledDrops(dropsRes.data);
    }

    store.setSpaceLoading('idle');
  }, [couple?.id, user?.id]);

  useEffect(() => {
    if (!couple?.id || !user?.id) {
      initialised.current = false;
      return;
    }

    if (!initialised.current) {
      initialised.current = true;
      load();
    }
  }, [couple?.id, user?.id, load]);

  const refresh = useCallback(async () => {
    if (!couple?.id || !user?.id) return;
    usePartnerSpaceStore.getState().setSpaceLoading('refreshing');
    await load();
  }, [couple?.id, user?.id, load]);

  // Derive active items with useMemo — stable reference when items don't change
  const activeItems = useMemo(
    () =>
      items.filter(
        (i) =>
          !i.isDeleted &&
          !i.disappeared &&
          !i.isHidden &&
          i.isScheduledPublished
      ),
    [items]
  );

  return {
    space,
    items: activeItems,
    permissions,
    isLoading: spaceLoading === 'loading',
    isRefreshing: spaceLoading === 'refreshing',
    partner,
    refresh,
  };
}
