import { supabase } from '@shared/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import type { Result } from '@shared/types/result';
import type {
  PartnerSpace,
  PartnerSpaceItem,
  PartnerSpaceSnapshot,
  PartnerSpacePermissions,
  StickerPack,
  SpaceItemType,
  ItemContent,
  DisappearCondition,
  SpaceTheme,
} from '@features/partner-space/types';

const SPACE_NICKNAME_MAX = 30;
const GOODNIGHT_MESSAGE_MAX = 160;
const ITEM_CONTENT_MAX_BYTES = 8192;
const ITEM_MIN_SIZE = 40;
const ITEM_MAX_SIZE = 320;
const ITEM_MAX_POSITION = 1000;
const ITEM_MAX_ROTATION = 30;
const ITEM_MAX_Z = 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function contentTooLarge(content: unknown): boolean {
  try {
    return JSON.stringify(content).length > ITEM_CONTENT_MAX_BYTES;
  } catch {
    return true;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function friendly(raw: string): string {
  if (__DEV__) console.warn('[PartnerSpace Error]', raw);
  if (raw.includes('JWT') || raw.includes('not authenticated'))
    return 'Your session expired. Please sign in again.';
  if (raw.includes('network') || raw.includes('fetch'))
    return 'No connection. Please check your internet.';
  return 'Something went wrong. Please try again.';
}

function err(e: unknown): string {
  if (__DEV__) console.warn('[PartnerSpace Exception]', e);
  if (e instanceof Error) return friendly(e.message);
  if (typeof e === 'string') return friendly(e);
  return 'Something went wrong.';
}

function mapSpace(r: any): PartnerSpace {
  return {
    id: r.id,
    coupleId: r.couple_id,
    nickname: r.nickname || 'Our Wall',
    theme: r.theme || 'cork_board',
    widgetSize: r.widget_size || 'medium',
    customColor: r.custom_color,
    timeMoodEnabled: r.time_mood_enabled ?? true,
    goodnightActive: r.goodnight_active ?? false,
    goodnightMessage: r.goodnight_message,
    goodnightActivatedAt: r.goodnight_activated_at,
    takeoverActive: r.takeover_active ?? false,
    takeoverStartedAt: r.takeover_started_at,
    takeoverBy: r.takeover_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapItem(r: any): PartnerSpaceItem {
  return {
    id: r.id,
    spaceId: r.space_id,
    addedBy: r.added_by,
    type: r.type,
    content: r.content || {},
    positionX: r.position_x ?? 0,
    positionY: r.position_y ?? 0,
    width: r.width ?? 100,
    height: r.height ?? 100,
    rotation: r.rotation ?? 0,
    zIndex: r.z_index ?? 0,
    isHidden: r.is_hidden ?? false,
    isDeleted: r.is_deleted ?? false,
    reactionEmoji: r.reaction_emoji,
    reactedBy: r.reacted_by,
    disappearCondition: r.disappear_condition,
    disappearAt: r.disappear_at,
    disappeared: r.disappeared ?? false,
    isGiftOpened: r.is_gift_opened ?? false,
    scheduledAt: r.scheduled_at,
    isScheduledPublished: r.is_scheduled_published ?? true,
    seenAt: r.seen_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    addedByNickname: r.profiles?.nickname,
  };
}

function mapSnapshot(r: any): PartnerSpaceSnapshot {
  return {
    id: r.id,
    spaceId: r.space_id,
    snapshotData: r.snapshot_data || { items: [], nickname: '', theme: 'cork_board' },
    thumbnailUrl: r.thumbnail_url,
    snapshotType: r.snapshot_type || 'auto',
    createdAt: r.created_at,
  };
}

function mapPermissions(r: any): PartnerSpacePermissions {
  return {
    spaceId: r.space_id,
    allowPhotos: r.allow_photos ?? true,
    allowNotes: r.allow_notes ?? true,
    allowStickers: r.allow_stickers ?? true,
    allowDrawings: r.allow_drawings ?? true,
    allowGifts: r.allow_gifts ?? true,
    allowScheduledDrops: r.allow_scheduled_drops ?? true,
    allowDisappearing: r.allow_disappearing ?? true,
    allowTakeover: r.allow_takeover ?? true,
    allowPartnerMove: r.allow_partner_move ?? true,
    allowPartnerDelete: r.allow_partner_delete ?? true,
    updatedAt: r.updated_at,
  };
}

// ─── SPACE CRUD ──────────────────────────────────────────────────────────────

/** Fetch existing space for a couple, or create one if it doesn't exist */
export async function fetchOrCreateSpace(coupleId: string): Promise<Result<PartnerSpace>> {
  try {
    // Try to fetch existing
    const { data: existing, error: fetchErr } = await supabase
      .from('partner_spaces')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle();

    if (fetchErr) return { success: false, error: friendly(fetchErr.message) };

    if (existing) return { success: true, data: mapSpace(existing) };

    // Create new space
    const { data: created, error: createErr } = await supabase
      .from('partner_spaces')
      .insert({ couple_id: coupleId })
      .select('*')
      .single();

    if (createErr) {
      // Race condition — another partner created it simultaneously
      const { data: retry } = await supabase
        .from('partner_spaces')
        .select('*')
        .eq('couple_id', coupleId)
        .single();
      if (retry) return { success: true, data: mapSpace(retry) };
      return { success: false, error: friendly(createErr.message) };
    }

    // Also create default permissions row
    await supabase
      .from('partner_space_permissions')
      .insert({ space_id: created.id })
      .select()
      .single();

    return { success: true, data: mapSpace(created) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update space settings (nickname, theme, etc.) */
export async function updateSpace(
  spaceId: string,
  updates: Partial<Pick<PartnerSpace, 'nickname' | 'theme' | 'widgetSize' | 'customColor' | 'timeMoodEnabled'>>
): Promise<Result<PartnerSpace>> {
  try {
    const payload: any = {};
    if (updates.nickname !== undefined) {
      payload.nickname = (updates.nickname.trim() || 'Our Wall').slice(0, SPACE_NICKNAME_MAX);
    }
    if (updates.theme !== undefined) payload.theme = updates.theme;
    if (updates.widgetSize !== undefined) payload.widget_size = updates.widgetSize;
    if (updates.customColor !== undefined) payload.custom_color = updates.customColor;
    if (updates.timeMoodEnabled !== undefined) payload.time_mood_enabled = updates.timeMoodEnabled;

    const { data, error } = await supabase
      .from('partner_spaces')
      .update(payload)
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSpace(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── ITEMS CRUD ──────────────────────────────────────────────────────────────

/** Fetch all active (non-deleted, non-disappeared) items for a space */
export async function fetchItems(spaceId: string): Promise<Result<PartnerSpaceItem[]>> {
  try {
    const { data, error } = await supabase
      .from('partner_space_items')
      .select('*, profiles!partner_space_items_added_by_fkey(nickname)')
      .eq('space_id', spaceId)
      .eq('is_deleted', false)
      .eq('disappeared', false)
      .order('z_index', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapItem) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Add a new item to the canvas */
export async function addItem(
  spaceId: string,
  type: SpaceItemType,
  content: ItemContent,
  options?: {
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    rotation?: number;
    zIndex?: number;
    scheduledAt?: string;
    disappearCondition?: DisappearCondition;
  }
): Promise<Result<PartnerSpaceItem>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const isScheduled = !!options?.scheduledAt;
    const disappearAt = options?.disappearCondition === 'after_24h'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    if (contentTooLarge(content)) {
      return { success: false, error: 'This item is too large to add.' };
    }

    const { data, error } = await supabase
      .from('partner_space_items')
      .insert({
        space_id: spaceId,
        added_by: userRes.user.id,
        type,
        content,
        position_x: clamp(options?.positionX ?? Math.random() * 200, 0, ITEM_MAX_POSITION),
        position_y: clamp(options?.positionY ?? Math.random() * 200, 0, ITEM_MAX_POSITION),
        width: clamp(options?.width ?? 120, ITEM_MIN_SIZE, ITEM_MAX_SIZE),
        height: clamp(options?.height ?? 120, ITEM_MIN_SIZE, ITEM_MAX_SIZE),
        rotation: clamp(options?.rotation ?? (Math.random() * 10 - 5), -ITEM_MAX_ROTATION, ITEM_MAX_ROTATION),
        z_index: clamp(options?.zIndex ?? 0, 0, ITEM_MAX_Z),
        scheduled_at: options?.scheduledAt ?? null,
        is_scheduled_published: !isScheduled,
        disappear_condition: options?.disappearCondition ?? null,
        disappear_at: disappearAt,
      })
      .select('*, profiles!partner_space_items_added_by_fkey(nickname)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapItem(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update an item (move, resize, hide, react, etc.) */
export async function updateItem(
  itemId: string,
  updates: Partial<Pick<
    PartnerSpaceItem,
    'positionX' | 'positionY' | 'width' | 'height' | 'rotation' |
    'zIndex' | 'isHidden' | 'reactionEmoji' | 'reactedBy' |
    'isGiftOpened' | 'seenAt' | 'content'
  >>
): Promise<Result<PartnerSpaceItem>> {
  try {
    const payload: any = {};
    if (updates.positionX !== undefined) payload.position_x = clamp(updates.positionX, 0, ITEM_MAX_POSITION);
    if (updates.positionY !== undefined) payload.position_y = clamp(updates.positionY, 0, ITEM_MAX_POSITION);
    if (updates.width !== undefined) payload.width = clamp(updates.width, ITEM_MIN_SIZE, ITEM_MAX_SIZE);
    if (updates.height !== undefined) payload.height = clamp(updates.height, ITEM_MIN_SIZE, ITEM_MAX_SIZE);
    if (updates.rotation !== undefined) payload.rotation = clamp(updates.rotation, -ITEM_MAX_ROTATION, ITEM_MAX_ROTATION);
    if (updates.zIndex !== undefined) payload.z_index = clamp(updates.zIndex, 0, ITEM_MAX_Z);
    if (updates.isHidden !== undefined) payload.is_hidden = updates.isHidden;
    if (updates.reactionEmoji !== undefined) payload.reaction_emoji = updates.reactionEmoji;
    if (updates.reactedBy !== undefined) payload.reacted_by = updates.reactedBy;
    if (updates.isGiftOpened !== undefined) payload.is_gift_opened = updates.isGiftOpened;
    if (updates.seenAt !== undefined) payload.seen_at = updates.seenAt;
    if (updates.content !== undefined) {
      if (contentTooLarge(updates.content)) {
        return { success: false, error: 'This item is too large to save.' };
      }
      payload.content = updates.content;
    }

    const { data, error } = await supabase
      .from('partner_space_items')
      .update(payload)
      .eq('id', itemId)
      .select('*, profiles!partner_space_items_added_by_fkey(nickname)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapItem(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Soft-delete an item */
export async function softDeleteItem(itemId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('partner_space_items')
      .update({ is_deleted: true })
      .eq('id', itemId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Mark an item as disappeared (soft fade-out) */
export async function markItemDisappeared(itemId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('partner_space_items')
      .update({ disappeared: true })
      .eq('id', itemId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Mark an item as seen by owner */
export async function markItemSeen(itemId: string): Promise<Result<void>> {
  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('partner_space_items')
      .update({ seen_at: now })
      .eq('id', itemId);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── SCHEDULED DROPS ─────────────────────────────────────────────────────────

/** Fetch all scheduled (not yet published) drops for a space */
export async function fetchScheduledDrops(spaceId: string): Promise<Result<PartnerSpaceItem[]>> {
  try {
    const { data, error } = await supabase
      .from('partner_space_items')
      .select('*, profiles!partner_space_items_added_by_fkey(nickname)')
      .eq('space_id', spaceId)
      .eq('is_scheduled_published', false)
      .eq('is_deleted', false)
      .order('scheduled_at', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapItem) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update a scheduled drop (change time or content) */
export async function updateScheduledDrop(
  itemId: string,
  updates: { scheduledAt?: string; content?: ItemContent }
): Promise<Result<PartnerSpaceItem>> {
  try {
    const payload: any = {};
    if (updates.scheduledAt !== undefined) payload.scheduled_at = updates.scheduledAt;
    if (updates.content !== undefined) payload.content = updates.content;

    const { data, error } = await supabase
      .from('partner_space_items')
      .update(payload)
      .eq('id', itemId)
      .select('*, profiles!partner_space_items_added_by_fkey(nickname)')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapItem(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Cancel a scheduled drop */
export async function cancelScheduledDrop(itemId: string): Promise<Result<void>> {
  return softDeleteItem(itemId);
}

/** Trigger server-side publishing of due scheduled drops */
export async function publishDueDrops(): Promise<Result<number>> {
  try {
    const { data, error } = await supabase.rpc('publish_scheduled_drops');
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: data ?? 0 };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── SNAPSHOTS / HISTORY ─────────────────────────────────────────────────────

/** Create a snapshot of the current canvas state */
export async function createSnapshot(
  spaceId: string,
  items: PartnerSpaceItem[],
  nickname: string,
  theme: SpaceTheme,
  snapshotType: 'auto' | 'goodnight' | 'takeover' | 'manual' = 'auto'
): Promise<Result<PartnerSpaceSnapshot>> {
  try {
    const snapshotData = { items, nickname, theme };

    const { data, error } = await supabase
      .from('partner_space_snapshots')
      .insert({
        space_id: spaceId,
        snapshot_data: snapshotData,
        snapshot_type: snapshotType,
      })
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSnapshot(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Fetch history snapshots with pagination */
export async function fetchSnapshots(
  spaceId: string,
  limit = 20,
  page = 1,
  dateFilter?: { from?: string; to?: string }
): Promise<Result<PartnerSpaceSnapshot[]>> {
  try {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('partner_space_snapshots')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dateFilter?.from) query = query.gte('created_at', dateFilter.from);
    if (dateFilter?.to) query = query.lte('created_at', dateFilter.to);

    const { data, error } = await query;

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: (data ?? []).map(mapSnapshot) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── PERMISSIONS ─────────────────────────────────────────────────────────────

/** Fetch space permissions */
export async function fetchPermissions(spaceId: string): Promise<Result<PartnerSpacePermissions>> {
  try {
    const { data, error } = await supabase
      .from('partner_space_permissions')
      .select('*')
      .eq('space_id', spaceId)
      .single();

    if (error) {
      const { data: created, error: createErr } = await supabase
        .from('partner_space_permissions')
        .insert({ space_id: spaceId })
        .select('*')
        .single();

      if (created) return { success: true, data: mapPermissions(created) };

      const { data: retry } = await supabase
        .from('partner_space_permissions')
        .select('*')
        .eq('space_id', spaceId)
        .single();

      if (retry) return { success: true, data: mapPermissions(retry) };
      return { success: false, error: friendly(createErr?.message || error.message) };
    }

    return { success: true, data: mapPermissions(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Update space permissions */
export async function updatePermissions(
  spaceId: string,
  updates: Partial<Omit<PartnerSpacePermissions, 'spaceId' | 'updatedAt'>>
): Promise<Result<PartnerSpacePermissions>> {
  try {
    const payload: any = {};
    if (updates.allowPhotos !== undefined) payload.allow_photos = updates.allowPhotos;
    if (updates.allowNotes !== undefined) payload.allow_notes = updates.allowNotes;
    if (updates.allowStickers !== undefined) payload.allow_stickers = updates.allowStickers;
    if (updates.allowDrawings !== undefined) payload.allow_drawings = updates.allowDrawings;
    if (updates.allowGifts !== undefined) payload.allow_gifts = updates.allowGifts;
    if (updates.allowScheduledDrops !== undefined) payload.allow_scheduled_drops = updates.allowScheduledDrops;
    if (updates.allowDisappearing !== undefined) payload.allow_disappearing = updates.allowDisappearing;
    if (updates.allowTakeover !== undefined) payload.allow_takeover = updates.allowTakeover;
    if (updates.allowPartnerMove !== undefined) payload.allow_partner_move = updates.allowPartnerMove;
    if (updates.allowPartnerDelete !== undefined) payload.allow_partner_delete = updates.allowPartnerDelete;

    const { data, error } = await supabase
      .from('partner_space_permissions')
      .update(payload)
      .eq('space_id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapPermissions(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── GOODNIGHT MODE ──────────────────────────────────────────────────────────

/** Activate goodnight mode */
export async function activateGoodnight(spaceId: string, message: string): Promise<Result<PartnerSpace>> {
  try {
    const { data, error } = await supabase
      .from('partner_spaces')
      .update({
        goodnight_active: true,
        goodnight_message: (message.trim() || 'Good night, love').slice(0, GOODNIGHT_MESSAGE_MAX),
        goodnight_activated_at: new Date().toISOString(),
      })
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSpace(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Deactivate goodnight mode */
export async function deactivateGoodnight(spaceId: string): Promise<Result<PartnerSpace>> {
  try {
    const { data, error } = await supabase
      .from('partner_spaces')
      .update({
        goodnight_active: false,
        goodnight_message: null,
        goodnight_activated_at: null,
      })
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSpace(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── WIDGET TAKEOVER ─────────────────────────────────────────────────────────

/** Start a widget takeover */
export async function startTakeover(spaceId: string): Promise<Result<PartnerSpace>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const { data, error } = await supabase
      .from('partner_spaces')
      .update({
        takeover_active: true,
        takeover_started_at: new Date().toISOString(),
        takeover_by: userRes.user.id,
      })
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSpace(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** End a widget takeover */
export async function endTakeover(spaceId: string): Promise<Result<PartnerSpace>> {
  try {
    const { data, error } = await supabase
      .from('partner_spaces')
      .update({
        takeover_active: false,
        takeover_started_at: null,
        takeover_by: null,
      })
      .eq('id', spaceId)
      .select('*')
      .single();

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: mapSpace(data) };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── STICKER PACKS ───────────────────────────────────────────────────────────

/** Fetch all active sticker packs from server */
export async function fetchStickerPacks(): Promise<Result<StickerPack[]>> {
  try {
    const { data, error } = await supabase
      .from('partner_space_sticker_packs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return { success: false, error: friendly(error.message) };

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      stickers: r.stickers || [],
      isActive: r.is_active,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));

    return { success: true, data: mapped };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── CLEAR WIDGET ────────────────────────────────────────────────────────────

/** Soft-delete all items in a space (Clear Widget) */
export async function clearAllItems(spaceId: string): Promise<Result<void>> {
  try {
    const { error } = await supabase
      .from('partner_space_items')
      .update({ is_deleted: true })
      .eq('space_id', spaceId)
      .eq('is_deleted', false);

    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: undefined };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── PHOTO UPLOAD ────────────────────────────────────────────────────────────

/** Upload a photo to partner-space storage bucket */
export async function uploadPhoto(
  spaceId: string,
  imageUri: string,
  fileName: string
): Promise<Result<string>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const compressed = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.82,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!compressed.base64) {
      return { success: false, error: 'Could not process your photo.' };
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'photo.jpg';
    const filePath = `${spaceId}/${userRes.user.id}/${Date.now()}_${safeName}`;

    const { data, error } = await supabase.storage
      .from('partner-space')
      .upload(filePath, decode(compressed.base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) return { success: false, error: friendly(error.message) };

    return { success: true, data: data.path };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Upload a drawing PNG to partner-space storage bucket */
export async function uploadDrawing(
  spaceId: string,
  base64Data: string
): Promise<Result<string>> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return { success: false, error: 'Not authenticated.' };

    const filePath = `${spaceId}/${userRes.user.id}/drawing_${Date.now()}.png`;
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

    const { data, error } = await supabase.storage
      .from('partner-space')
      .upload(filePath, decode(cleanBase64), {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) return { success: false, error: friendly(error.message) };

    return { success: true, data: data.path };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

// ─── PROCESS DISAPPEARING ITEMS (client-side) ────────────────────────────────

/** Process disappearing items via RPC */
export async function processDisappearingItems(): Promise<Result<number>> {
  try {
    const { data, error } = await supabase.rpc('process_disappearing_items');
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: data ?? 0 };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}

/** Reset goodnight mode via RPC */
export async function resetGoodnightMode(): Promise<Result<number>> {
  try {
    const { data, error } = await supabase.rpc('reset_goodnight_mode');
    if (error) return { success: false, error: friendly(error.message) };
    return { success: true, data: data ?? 0 };
  } catch (e) {
    return { success: false, error: err(e) };
  }
}
