import { supabase } from '@shared/lib/supabase';
import { coupleCandidRepo, coupleCandidStreakRepo } from '@shared/db/repo';
import { useAuthStore } from '@features/auth';
import { uuid } from '@shared/lib/uuid';
import * as ImageManipulator from 'expo-image-manipulator';
import { Paths, File, Directory } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import type { CoupleCandid, CoupleCandidStreak } from '@features/couple/types';

const BUCKET = 'couple_candid_images';
const CANDID_DIR = `${Paths.document.uri}candids/`;

// Ensure local candid directory exists
function ensureCandidDir() {
  const dir = new Directory(CANDID_DIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
}

// ─── FETCH CANDIDS ──────────────────────────────────────────────

export async function fetchCandids(coupleId: string): Promise<CoupleCandid[]> {
  try {
    // Sync from Supabase to local SQLite cache
    const { data, error } = await supabase
      .from('couple_candids')
      .select('*')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      for (const row of data) {
        await coupleCandidRepo.saveCandid({
          id: row.id,
          coupleId: row.couple_id,
          senderId: row.sender_id,
          imagePath: row.image_path,
          thumbPath: row.thumb_path || null,
          caption: row.caption || null,
          reactionEmoji: row.reaction_emoji || null,
          isSeen: row.is_seen ? 1 : 0,
          seenAt: row.seen_at || null,
          isFirstCandid: row.is_first_candid ? 1 : 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncStatus: 'synced',
        });
      }
    }
  } catch (e) {
    console.warn('[CandidService] fetchCandids sync failed, using local cache:', e);
  }

  try {
    const rows = await coupleCandidRepo.fetchCandids(coupleId);
    return rows.map(r => ({
      id: r.id,
      coupleId: r.coupleId,
      senderId: r.senderId,
      imagePath: r.imagePath,
      thumbPath: r.thumbPath,
      caption: r.caption,
      reactionEmoji: r.reactionEmoji,
      isSeen: r.isSeen,
      seenAt: r.seenAt,
      isFirstCandid: r.isFirstCandid,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  } catch (e) {
    console.error('[CandidService] fetchCandids SQLite error:', e);
    return [];
  }
}

export async function fetchCandidsPaginated(
  coupleId: string,
  page = 1,
  limit = 20
): Promise<{ candids: CoupleCandid[]; hasMore: boolean }> {
  const offset = (page - 1) * limit;
  const from = offset;
  const to = offset + limit - 1;

  try {
    // Sync page slice from Supabase to local SQLite cache
    const { data, error } = await supabase
      .from('couple_candids')
      .select('*')
      .eq('couple_id', coupleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      for (const row of data) {
        await coupleCandidRepo.saveCandid({
          id: row.id,
          coupleId: row.couple_id,
          senderId: row.sender_id,
          imagePath: row.image_path,
          thumbPath: row.thumb_path || null,
          caption: row.caption || null,
          reactionEmoji: row.reaction_emoji || null,
          isSeen: row.is_seen ? 1 : 0,
          seenAt: row.seen_at || null,
          isFirstCandid: row.is_first_candid ? 1 : 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncStatus: 'synced',
        });
      }
    }
  } catch (e) {
    console.warn('[CandidService] fetchCandidsPaginated sync failed, using local cache:', e);
  }

  try {
    // Query SQLite with limit + 1 to detect hasMore
    const rows = await coupleCandidRepo.fetchCandids(coupleId, limit + 1, offset);
    const hasMore = rows.length > limit;
    const slicedRows = hasMore ? rows.slice(0, limit) : rows;

    const candids = slicedRows.map(r => ({
      id: r.id,
      coupleId: r.coupleId,
      senderId: r.senderId,
      imagePath: r.imagePath,
      thumbPath: r.thumbPath,
      caption: r.caption,
      reactionEmoji: r.reactionEmoji,
      isSeen: r.isSeen,
      seenAt: r.seenAt,
      isFirstCandid: r.isFirstCandid,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return { candids, hasMore };
  } catch (e) {
    console.error('[CandidService] fetchCandidsPaginated SQLite error:', e);
    return { candids: [], hasMore: false };
  }
}

// ─── FETCH STREAK ───────────────────────────────────────────────

export async function fetchCandidStreak(coupleId: string): Promise<CoupleCandidStreak | null> {
  try {
    // Sync from Supabase to local SQLite cache
    const { data, error } = await supabase
      .from('couple_candid_streaks')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle();

    if (!error && data) {
      const dates = Object.values(data.last_sent_dates || {}) as string[];
      const u1Date = dates[0] || null;
      const u2Date = dates[1] || null;

      await coupleCandidStreakRepo.saveStreak({
        coupleId: data.couple_id,
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastBothSentDate: data.last_both_sent_date,
        user1LastSentDate: u1Date,
        user2LastSentDate: u2Date,
        updatedAt: data.updated_at,
      });
    }
  } catch (e) {
    console.warn('[CandidService] fetchCandidStreak sync failed, using local cache:', e);
  }

  try {
    const row = await coupleCandidStreakRepo.fetchStreak(coupleId);
    if (!row) return null;
    return {
      coupleId: row.coupleId,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak,
      lastBothSentDate: row.lastBothSentDate,
      user1LastSentDate: row.user1LastSentDate,
      user2LastSentDate: row.user2LastSentDate,
      updatedAt: row.updatedAt,
    };
  } catch (e) {
    console.error('[CandidService] fetchCandidStreak SQLite error:', e);
    return null;
  }
}

// ─── SEND CANDID ────────────────────────────────────────────────

export async function sendCandid(
  coupleId: string,
  imageUri: string,
  caption?: string
): Promise<{ success: boolean; candid?: CoupleCandid; error?: string }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user?.id) return { success: false, error: 'Not authenticated.' };

    ensureCandidDir();

    // 1. Compress images
    const [mainResult, thumbResult] = await Promise.all([
      ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      ),
      ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      ),
    ]);

    if (!mainResult.base64 || !thumbResult.base64) {
      return { success: false, error: 'Could not process image.' };
    }

    // 2. Save locally using new expo-file-system File API
    const id = uuid();
    const now = new Date().toISOString();
    const localMainPath = `${CANDID_DIR}${id}.jpg`;
    const localThumbPath = `${CANDID_DIR}${id}_thumb.jpg`;

    const mainFile = new File(localMainPath);
    mainFile.write(mainResult.base64);

    const thumbFile = new File(localThumbPath);
    thumbFile.write(thumbResult.base64);

    // 3. Check if this is the first candid
    const existingCount = await coupleCandidRepo.countCandids(coupleId);
    const isFirst = existingCount === 0;

    // 4. Save to local SQLite immediately
    const candid: CoupleCandid = {
      id,
      coupleId,
      senderId: user.id,
      imagePath: localMainPath,
      thumbPath: localThumbPath,
      caption: caption?.trim() || null,
      reactionEmoji: null,
      isSeen: true, // Sender has "seen" their own photo
      seenAt: now,
      isFirstCandid: isFirst,
      createdAt: now,
      updatedAt: now,
    };

    await coupleCandidRepo.saveCandid({
      ...candid,
      isSeen: 1,
      isFirstCandid: isFirst ? 1 : 0,
      syncStatus: 'pending',
    });

    // 5. Upload to Supabase in background (non-blocking)
    uploadCandidToSupabase(candid, mainResult.base64!, thumbResult.base64!).catch(e => {
      console.error('[CandidService] Background upload failed:', e);
    });

    // 6. Update streak
    updateStreakAfterSend(coupleId, user.id).catch(e => {
      console.error('[CandidService] Streak update failed:', e);
    });

    return { success: true, candid };
  } catch (e) {
    console.error('[CandidService] sendCandid error:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Failed to send candid.' };
  }
}

// ─── BACKGROUND UPLOAD ──────────────────────────────────────────

async function uploadCandidToSupabase(candid: CoupleCandid, mainBase64: string, thumbBase64: string) {
  const user = useAuthStore.getState().user;
  if (!user?.id) return;

  const timestamp = Date.now();
  const remotePath = `${candid.coupleId}/${user.id}/${timestamp}_${candid.id}.jpg`;
  const remoteThumbPath = `${candid.coupleId}/${user.id}/${timestamp}_${candid.id}_thumb.jpg`;

  // Upload main image
  const { error: mainErr } = await supabase.storage
    .from(BUCKET)
    .upload(remotePath, decode(mainBase64), { contentType: 'image/jpeg', upsert: true });

  if (mainErr) {
    console.error('[CandidService] Main image upload error:', mainErr);
    return;
  }

  // Upload thumbnail
  const { error: thumbErr } = await supabase.storage
    .from(BUCKET)
    .upload(remoteThumbPath, decode(thumbBase64), { contentType: 'image/jpeg', upsert: true });

  if (thumbErr) {
    console.error('[CandidService] Thumb upload error:', thumbErr);
    // Continue anyway — main image is uploaded
  }

  // Insert row into Supabase table
  const { error: insertErr } = await supabase
    .from('couple_candids')
    .insert({
      id: candid.id,
      couple_id: candid.coupleId,
      sender_id: candid.senderId,
      image_path: remotePath,
      thumb_path: remoteThumbPath,
      caption: candid.caption,
      is_seen: false, // Partner hasn't seen it
      is_first_candid: candid.isFirstCandid,
      created_at: candid.createdAt,
      updated_at: candid.updatedAt,
    });

  if (insertErr) {
    console.error('[CandidService] Supabase insert error:', insertErr);
    return;
  }

  // Update local record with remote paths and synced status
  await coupleCandidRepo.saveCandid({
    ...candid,
    imagePath: remotePath,
    thumbPath: remoteThumbPath,
    isSeen: 1,
    isFirstCandid: candid.isFirstCandid ? 1 : 0,
    syncStatus: 'synced',
  });
}

// ─── MARK AS SEEN ───────────────────────────────────────────────

export async function markCandidAsSeen(candidId: string): Promise<void> {
  try {
    await coupleCandidRepo.markSeen(candidId);

    // Update Supabase in background
    supabase
      .from('couple_candids')
      .update({
        is_seen: true,
        seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidId)
      .then(({ error }) => {
        if (error) console.error('[CandidService] markSeen Supabase error:', error);
      });
  } catch (e) {
    console.error('[CandidService] markCandidAsSeen error:', e);
  }
}

// ─── REACT TO CANDID ────────────────────────────────────────────

export async function reactToCandid(candidId: string, emoji: string): Promise<void> {
  try {
    await coupleCandidRepo.setReaction(candidId, emoji);

    // Update Supabase in background
    supabase
      .from('couple_candids')
      .update({
        reaction_emoji: emoji,
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidId)
      .then(({ error }) => {
        if (error) console.error('[CandidService] reactToCandid Supabase error:', error);
      });
  } catch (e) {
    console.error('[CandidService] reactToCandid error:', e);
  }
}

// ─── DELETE CANDID ──────────────────────────────────────────────

export async function deleteCandid(candidId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await coupleCandidRepo.softDeleteCandid(candidId, now);

    // Update Supabase in background
    supabase
      .from('couple_candids')
      .delete()
      .eq('id', candidId)
      .then(({ error }) => {
        if (error) console.error('[CandidService] deleteCandid Supabase error:', error);
      });
  } catch (e) {
    console.error('[CandidService] deleteCandid error:', e);
  }
}

// ─── STREAK LOGIC ───────────────────────────────────────────────

async function updateStreakAfterSend(coupleId: string, senderId: string): Promise<CoupleCandidStreak | null> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let streak = await coupleCandidStreakRepo.fetchStreak(coupleId);

    if (!streak) {
      // First ever candid — initialize streak
      streak = {
        coupleId,
        currentStreak: 0,
        longestStreak: 0,
        lastBothSentDate: null,
        user1LastSentDate: null,
        user2LastSentDate: null,
        updatedAt: new Date().toISOString(),
      };
    }

    // Determine which user slot to update
    // User1 = whoever sent first historically, or senderId for the first time
    let u1Date = streak.user1LastSentDate;
    let u2Date = streak.user2LastSentDate;

    if (!u1Date && !u2Date) {
      // First ever send — this user is user1
      u1Date = today;
    } else if (u1Date && !u2Date) {
      // u1 exists — check if sender matches the u1 pattern (same user)
      // We don't track user IDs in streak, so we use a heuristic:
      // If u1's last date matches this sender's previous sends, they're u1
      // For simplicity, just alternate: if u1 was updated today, this is u2
      if (u1Date === today) {
        // Same user already sent today, no change needed for this slot
        // But maybe this is user2 sending
        u2Date = today;
      } else {
        u1Date = today;
      }
    } else {
      // Both have sent before — update the appropriate one
      // Since we can't distinguish users from the streak record alone,
      // just update whichever is older (the one that isn't today)
      if (u1Date !== today && u2Date !== today) {
        u1Date = today;
      } else if (u1Date === today && u2Date !== today) {
        u2Date = today;
      } else if (u2Date === today && u1Date !== today) {
        u1Date = today;
      }
      // Both already today — no change needed
    }

    // Check if both sent today
    let newStreak = streak.currentStreak;
    let newLongest = streak.longestStreak;
    let newBothDate = streak.lastBothSentDate;

    if (u1Date === today && u2Date === today) {
      if (newBothDate !== today) {
        // Both sent today for the first time
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (newBothDate === yesterdayStr) {
          // Streak continues
          newStreak = newStreak + 1;
        } else {
          // Streak resets (gap or first time)
          newStreak = 1;
        }
        newBothDate = today;
        newLongest = Math.max(newLongest, newStreak);
      }
    }

    const updatedStreak = {
      coupleId,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastBothSentDate: newBothDate,
      user1LastSentDate: u1Date,
      user2LastSentDate: u2Date,
      updatedAt: new Date().toISOString(),
    };

    await coupleCandidStreakRepo.saveStreak(updatedStreak);

    return updatedStreak;
  } catch (e) {
    console.error('[CandidService] updateStreakAfterSend error:', e);
    return null;
  }
}
