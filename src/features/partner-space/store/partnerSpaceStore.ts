import { create } from 'zustand';
import type {
  PartnerSpace,
  PartnerSpaceItem,
  PartnerSpaceSnapshot,
  PartnerSpacePermissions,
  StickerPack,
  TimeMood,
  SpaceItemType,
} from '../types';

type LoadingState = 'idle' | 'loading' | 'refreshing' | 'error';

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

interface CanvasAction {
  type: 'add' | 'remove' | 'update';
  item: PartnerSpaceItem;
  previousItem?: PartnerSpaceItem;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface PartnerSpaceState {
  // ── Core Data ───────────────────────────────────────────────
  space: PartnerSpace | null;
  items: PartnerSpaceItem[];
  permissions: PartnerSpacePermissions | null;
  snapshots: PartnerSpaceSnapshot[];
  stickerPacks: StickerPack[];
  scheduledDrops: PartnerSpaceItem[];

  // ── Roles ───────────────────────────────────────────────────
  myUserId: string | null;
  isOwner: boolean;
  isController: boolean;

  // ── Time Mood ───────────────────────────────────────────────
  currentTimeMood: TimeMood;

  // ── Loading States ──────────────────────────────────────────
  spaceLoading: LoadingState;
  itemsLoading: LoadingState;
  snapshotsLoading: LoadingState;
  permissionsLoading: LoadingState;
  stickerPacksLoading: LoadingState;

  // ── Undo / Redo ─────────────────────────────────────────────
  undoStack: CanvasAction[];
  redoStack: CanvasAction[];

  // ── Takeover ────────────────────────────────────────────────
  takeoverSecondsLeft: number;
  takeoverTimerActive: boolean;

  // ── Presence ────────────────────────────────────────────────
  partnerPresenceText: string | null;
  partnerLastActionAt: string | null;

  // ── Notification State ──────────────────────────────────────
  hasNewUpdate: boolean;
  newUpdateDot: boolean;

  // ── Pagination ──────────────────────────────────────────────
  snapshotsPage: number;
  snapshotsHasMore: boolean;

  // ── Toast ───────────────────────────────────────────────────
  toast: { title: string; message: string; icon: string } | null;

  // ── Setters ─────────────────────────────────────────────────
  setSpace: (space: PartnerSpace | null) => void;
  setItems: (items: PartnerSpaceItem[]) => void;
  addItem: (item: PartnerSpaceItem) => void;
  updateItem: (item: PartnerSpaceItem) => void;
  removeItem: (id: string) => void;
  setPermissions: (perms: PartnerSpacePermissions | null) => void;
  setSnapshots: (snapshots: PartnerSpaceSnapshot[]) => void;
  appendSnapshots: (snapshots: PartnerSpaceSnapshot[]) => void;
  setStickerPacks: (packs: StickerPack[]) => void;
  setScheduledDrops: (drops: PartnerSpaceItem[]) => void;
  setMyUserId: (id: string | null) => void;
  setRoles: (isOwner: boolean, isController: boolean) => void;
  setCurrentTimeMood: (mood: TimeMood) => void;
  setSpaceLoading: (s: LoadingState) => void;
  setItemsLoading: (s: LoadingState) => void;
  setSnapshotsLoading: (s: LoadingState) => void;
  setPermissionsLoading: (s: LoadingState) => void;
  setStickerPacksLoading: (s: LoadingState) => void;
  setSnapshotsPage: (p: number) => void;
  setSnapshotsHasMore: (hm: boolean) => void;
  setToast: (t: { title: string; message: string; icon: string } | null) => void;
  setHasNewUpdate: (v: boolean) => void;
  setNewUpdateDot: (v: boolean) => void;

  // ── Takeover Actions ────────────────────────────────────────
  setTakeoverSecondsLeft: (s: number) => void;
  setTakeoverTimerActive: (v: boolean) => void;

  // ── Presence Actions ────────────────────────────────────────
  setPartnerPresenceText: (text: string | null) => void;
  setPartnerLastActionAt: (at: string | null) => void;

  // ── Undo / Redo Actions ─────────────────────────────────────
  pushUndo: (action: CanvasAction) => void;
  undo: () => CanvasAction | null;
  redo: () => CanvasAction | null;
  clearHistory: () => void;

  // ── Helpers ─────────────────────────────────────────────────
  getActiveItems: () => PartnerSpaceItem[];
  getItemsByType: (type: SpaceItemType) => PartnerSpaceItem[];
  getPhotoCount: () => number;

  // ── Reset ───────────────────────────────────────────────────
  reset: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState = {
  space: null as PartnerSpace | null,
  items: [] as PartnerSpaceItem[],
  permissions: null as PartnerSpacePermissions | null,
  snapshots: [] as PartnerSpaceSnapshot[],
  stickerPacks: [] as StickerPack[],
  scheduledDrops: [] as PartnerSpaceItem[],
  myUserId: null as string | null,
  isOwner: false,
  isController: false,
  currentTimeMood: 'afternoon' as TimeMood,
  spaceLoading: 'idle' as LoadingState,
  itemsLoading: 'idle' as LoadingState,
  snapshotsLoading: 'idle' as LoadingState,
  permissionsLoading: 'idle' as LoadingState,
  stickerPacksLoading: 'idle' as LoadingState,
  undoStack: [] as CanvasAction[],
  redoStack: [] as CanvasAction[],
  takeoverSecondsLeft: 0,
  takeoverTimerActive: false,
  partnerPresenceText: null as string | null,
  partnerLastActionAt: null as string | null,
  hasNewUpdate: false,
  newUpdateDot: false,
  snapshotsPage: 1,
  snapshotsHasMore: true,
  toast: null as { title: string; message: string; icon: string } | null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePartnerSpaceStore = create<PartnerSpaceState>((set, get) => ({
  ...initialState,

  // ── Setters ─────────────────────────────────────────────────
  setSpace: (space) => set({ space }),
  setItems: (items) =>
    set({
      items: Array.from(new Map(items.map((item) => [item.id, item])).values()),
    }),
  addItem: (item) =>
    set((s) => {
      const exists = s.items.some((i) => i.id === item.id);
      return {
        items: exists
          ? s.items.map((i) => (i.id === item.id ? item : i))
          : [...s.items, item],
      };
    }),
  updateItem: (item) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? item : i)),
    })),
  removeItem: (id) =>
    set((s) => ({
      items: s.items.filter((i) => i.id !== id),
    })),
  setPermissions: (perms) => set({ permissions: perms }),
  setSnapshots: (snapshots) => set({ snapshots }),
  appendSnapshots: (newSnapshots) =>
    set((s) => ({ snapshots: [...s.snapshots, ...newSnapshots] })),
  setStickerPacks: (packs) => set({ stickerPacks: packs }),
  setScheduledDrops: (drops) =>
    set({
      scheduledDrops: Array.from(new Map(drops.map((drop) => [drop.id, drop])).values()),
    }),
  setMyUserId: (id) => set({ myUserId: id }),
  setRoles: (isOwner, isController) => set({ isOwner, isController }),
  setCurrentTimeMood: (mood) => set({ currentTimeMood: mood }),
  setSpaceLoading: (s) => set({ spaceLoading: s }),
  setItemsLoading: (s) => set({ itemsLoading: s }),
  setSnapshotsLoading: (s) => set({ snapshotsLoading: s }),
  setPermissionsLoading: (s) => set({ permissionsLoading: s }),
  setStickerPacksLoading: (s) => set({ stickerPacksLoading: s }),
  setSnapshotsPage: (p) => set({ snapshotsPage: p }),
  setSnapshotsHasMore: (hm) => set({ snapshotsHasMore: hm }),
  setToast: (t) => set({ toast: t }),
  setHasNewUpdate: (v) => set({ hasNewUpdate: v }),
  setNewUpdateDot: (v) => set({ newUpdateDot: v }),

  // ── Takeover ────────────────────────────────────────────────
  setTakeoverSecondsLeft: (s) => set({ takeoverSecondsLeft: s }),
  setTakeoverTimerActive: (v) => set({ takeoverTimerActive: v }),

  // ── Presence ────────────────────────────────────────────────
  setPartnerPresenceText: (text) => set({ partnerPresenceText: text }),
  setPartnerLastActionAt: (at) => set({ partnerLastActionAt: at }),

  // ── Undo / Redo ─────────────────────────────────────────────
  pushUndo: (action) =>
    set((s) => ({
      undoStack: [...s.undoStack, action],
      redoStack: [], // clear redo on new action
    })),

  undo: () => {
    const { undoStack, items } = get();
    if (undoStack.length === 0) return null;

    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    let newItems = [...items];
    const redoAction: CanvasAction = { ...action };

    switch (action.type) {
      case 'add':
        // Undo add → remove the item
        newItems = newItems.filter((i) => i.id !== action.item.id);
        redoAction.type = 'add';
        break;
      case 'remove':
        // Undo remove → add the item back
        newItems.push(action.item);
        redoAction.type = 'remove';
        break;
      case 'update':
        // Undo update → restore previous state
        if (action.previousItem) {
          newItems = newItems.map((i) =>
            i.id === action.item.id ? action.previousItem! : i
          );
          redoAction.previousItem = action.item;
          redoAction.item = action.previousItem;
        }
        break;
    }

    set((s) => ({
      items: newItems,
      undoStack: newUndoStack,
      redoStack: [...s.redoStack, redoAction],
    }));

    return action;
  },

  redo: () => {
    const { redoStack, items } = get();
    if (redoStack.length === 0) return null;

    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    let newItems = [...items];
    const undoAction: CanvasAction = { ...action };

    switch (action.type) {
      case 'add':
        newItems.push(action.item);
        undoAction.type = 'add';
        break;
      case 'remove':
        newItems = newItems.filter((i) => i.id !== action.item.id);
        undoAction.type = 'remove';
        break;
      case 'update':
        if (action.previousItem) {
          newItems = newItems.map((i) =>
            i.id === action.item.id ? action.item : i
          );
          undoAction.previousItem = action.item;
          undoAction.item = action.previousItem;
        }
        break;
    }

    set((s) => ({
      items: newItems,
      redoStack: newRedoStack,
      undoStack: [...s.undoStack, undoAction],
    }));

    return action;
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),

  // ── Helpers ─────────────────────────────────────────────────
  getActiveItems: () => {
    const { items } = get();
    return items.filter(
      (i) =>
        !i.isDeleted &&
        !i.disappeared &&
        !i.isHidden &&
        i.isScheduledPublished
    );
  },

  getItemsByType: (type) => {
    return get().getActiveItems().filter((i) => i.type === type);
  },

  getPhotoCount: () => {
    return get().getActiveItems().filter((i) => i.type === 'photo').length;
  },

  // ── Reset ───────────────────────────────────────────────────
  reset: () => set(initialState),
}));
