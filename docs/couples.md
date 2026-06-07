# Kami — Couples Space & Security Architecture

The Couples Space in Kami is a highly secure, premium private sanctuary designed for couples to interact, reflect, and grow together. It provides private real-time communications, shared goals, journals with threaded commenting, sealed letters, and visual memory timelines.

---

## 1. Feature Map & Directory Structure

All components and logic for the couples features are isolated to ensure modularity and maintain clean architecture:

```
src/features/couple/
├── components/
│   ├── CoupleRealtimeListener.tsx   — Subscribes to Postgres CDC channels for instant UI updates
│   └── RelationshipCalendar.tsx    — Shared calendar view for relationship events
├── hooks/
│   └── useCouple.ts                — Custom hook wrapping actions (journals, letters, goals, etc.)
├── store/
│   └── coupleStore.ts              — Zustand store managing active state, partner activity, and caches
├── types/
│   └── index.ts                    — TypeScript interface contracts for database schema
└── screens/
    ├── CoupleDashboard.tsx         — Main dashboard interface containing the Mood Ring widget
    ├── CoupleSetupScreen.tsx       — Screen to send/receive couple invitations
    ├── GoalsScreen.tsx             — Shared organic goals timeline
    ├── JournalScreen.tsx           — Shared journal feed with comments & reactions
    └── MemoriesScreen.tsx          — Glowing dashed memories connector timeline
```

---

## 2. Secure Invitation Protocol (Transaction-Safe)

To prevent race conditions where multiple users try to accept invites simultaneously or a user connects to more than one couple space, invitation acceptance is handled atomically inside the database using an RPC (Remote Procedure Call) database transaction: `accept_couple_invitation`.

### How the Protocol Works:
1. **Validation**: The function verifies the user is the intended recipient of the invitation and that neither user is currently linked to an active couple.
2. **Locking**: Row-level locking is established for the invitation record.
3. **Creation**: A new couple record is inserted inside the `couples` table.
4. **Linking**: Both users are inserted as members of the new couple within `couple_members` in a single transaction.
5. **Clean up**: The invitation status is updated to `accepted`.

### The SQL Implementation:
```sql
CREATE OR REPLACE FUNCTION public.accept_couple_invitation(
  p_invitation_id UUID,
  p_couple_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_new_couple_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Lock invitation row
  SELECT sender_id, receiver_id INTO v_sender_id, v_receiver_id
  FROM public.couple_invitations
  WHERE id = p_invitation_id AND status = 'pending' AND receiver_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already processed, or unauthorized.';
  END IF;

  -- 2. Verify neither user is already in a couple
  IF EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = v_sender_id) OR
     EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = v_receiver_id) THEN
    RAISE EXCEPTION 'One or both users are already in a couple.';
  END IF;

  -- 3. Create Couple Record
  INSERT INTO public.couples (name)
  VALUES (p_couple_name)
  RETURNING id INTO v_new_couple_id;

  -- 4. Create Couple Memberships
  INSERT INTO public.couple_members (couple_id, user_id)
  VALUES 
    (v_new_couple_id, v_sender_id),
    (v_new_couple_id, v_receiver_id);

  -- 5. Complete Invitation
  UPDATE public.couple_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = p_invitation_id;

  -- 6. Switch both users profile active spaces to 'couple'
  UPDATE public.profiles SET active_space = 'couple' WHERE id IN (v_sender_id, v_receiver_id);

  SELECT json_build_object('couple_id', v_new_couple_id, 'couple_name', p_couple_name) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Database Security & Row Level Security (RLS)

Every table under the couple namespace is hardened using Row Level Security (RLS) policies. Authenticated users cannot read, write, or delete any record without belonging to the matching `couple_id`.

### RLS Verification Helper
A secure helper function, `public.is_couple_member(couple_id)`, checks membership without exposing queries:
```sql
CREATE OR REPLACE FUNCTION public.is_couple_member(p_couple_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.couple_members
    WHERE couple_id = p_couple_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### RLS Policies Matrix
The following security rules apply to the database tables:

| Table Name | RLS Enabled | Policies |
|---|---|---|
| `couples` | Yes | SELECT/UPDATE if `is_couple_member(id)` |
| `couple_members` | Yes | SELECT if member of matching couple |
| `couple_journals` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |
| `couple_journal_comments` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |
| `couple_journal_reactions` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |
| `couple_memories` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |
| `couple_goals` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |
| `couple_letters` | Yes | SELECT (if released), INSERT (draft), UPDATE/DELETE (author only) |
| `couple_daily_questions` | Yes | SELECT if `is_couple_member(couple_id)` |
| `couple_answers` | Yes | SELECT/INSERT/UPDATE if `is_couple_member(couple_id)` |
| `relationship_events` | Yes | SELECT/INSERT/UPDATE/DELETE if `is_couple_member(couple_id)` |

---

## 4. Key Feature Implementation Details

### A. Couple Mood Ring & Sharing Widget
- **Functionality**: Logs user mood and exposes partner's real-time mood instantly on the home dashboard.
- **Sync Model**: Combines standard profile updates with a Postgres changes subscription (`supabase.channel('public:profiles')`) filtering updates where `id` equals the partner's UUID. Updates are dispatched to the Zustand store state parameters `currentMoodEmoji` and `currentMoodLabel`.

### B. Shared Goals (Garden Theme)
- **Concept**: Shared milestones are styled as an organic grow garden.
- **Milestone States**:
  - **Sprouting Stage 🌱** (0% - 29% progress): Small sprout icon representation.
  - **Growing Stage 🌿** (30% - 99% progress): Spreads into a leaf vine track.
  - **Full Bloom 🌸** (100% progress): Renders a completion mint card with a glowing blossom badge.
- **Progress Track**: Features interactive milestone notches along a growth timeline (vine).

### C. Future Sealed Letters
- **Concept**: Physical warmth-paper style envelopes containing letters delivered to the future.
- **States**:
  - **Locked (Wax Sealed) ✉️**: Displays a dark crimson `waxSealCircle` stamp featuring double borders and a golden insignia (`⚜️`). The unlock countdown is shown beneath.
  - **Unlocked (Stationery Sheet) 📄**: Clicking opens a paper-textured canvas with elegant handwritten margins and photo attachment cards.
- **Privacy Enforcement**: The database hides letter bodies using a secure RPC `fetch_unlocked_couple_letter` which throws an error if caller tries to view content before `deliver_at`.

### D. Shared Journals Feed
- **Concept**: A collaborative journal.
- **Interactions**:
  - **Comments**: Styled as left-aligned slate gray bubbles (partner) and right-aligned rose-tinted bubbles (you) with speech corners.
  - **Reactions**: High-fidelity rounded pills with active-state counter increments.
