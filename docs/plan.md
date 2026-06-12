# Kami Hardening Implementation Plan

## Purpose

This plan turns the architecture audit into a step-by-step implementation backlog that any AI coding agent can execute safely.

Rule for agents: do exactly one issue at a time. Do not combine unrelated fixes. Do not start the next issue until the current issue is implemented, validated, and summarized.

## Operating Rules For Any Agent

1. Work from the app repository root, not from this audit workspace.
2. Read the relevant files before editing.
3. Make the smallest safe change for the selected issue.
4. Do not refactor unrelated files.
5. Do not change behavior outside the issue scope unless required.
6. Add or update tests where the app has a test setup.
7. If no tests exist, add validation notes and do not fake test results.
8. Preserve existing user-visible copy unless the issue explicitly changes UX.
9. Never store auth tokens, journal text, letter body, image URLs, or private notes in logs.
10. After each issue, provide:
    - changed files
    - what changed
    - validation performed
    - remaining risks

## Priority System

Impact:

- Critical: security/auth/data-loss/public-launch blocker
- High: major production/scaling/performance blocker
- Medium: important hardening or maintainability improvement

Effort:

- Low: hours to 1 day
- Medium: 1-4 days
- High: 1+ week or backend coordination required

## Phase 0 - Safety Baseline

Before implementing any issue, the agent should inspect:

- `src/shared/lib/supabase/client.ts`
- `src/features/auth/hooks/useAuth.ts`
- `src/features/auth/store/authStore.ts`
- `src/core/navigation/RootNavigator.tsx`
- `src/core/navigation/useDeepLink.ts`
- `src/infrastructure/auth/authService.ts`
- package scripts and test setup

Validation baseline:

- Run type check if available.
- Run lint if available.
- Run tests if available.
- Record missing scripts if they do not exist.

---

# Phase 1 - Critical Auth And Security Fixes

## Issue 1 - Split Auth Lifecycle From Auth Actions

Impact: Critical
Effort: Low to Medium
Primary risk fixed: unexpected logouts, duplicate auth listeners, auth races

Problem:

`useAuth()` currently performs global lifecycle work and also exposes screen actions. It is called by the root navigator and auth screens, which can duplicate listeners and session restoration.

Files to inspect:

- `src/features/auth/hooks/useAuth.ts`
- `src/core/navigation/RootNavigator.tsx`
- `src/features/auth/screens/LoginScreen.tsx`
- `src/features/auth/screens/SignUpScreen.tsx`
- `src/features/auth/screens/ForgotPasswordScreen.tsx`
- `src/features/auth/screens/ResetPasswordScreen.tsx`
- `src/features/auth/screens/EmailVerificationScreen.tsx`
- `src/features/settings/screens/SettingsScreen.tsx`

Implementation steps:

1. Create `src/features/auth/providers/AuthProvider.tsx`.
2. Move auth lifecycle effects from `useAuth()` into `AuthProvider`.
3. Create `src/features/auth/hooks/useAuthActions.ts`.
4. Move action methods into `useAuthActions()`:
   - `signUp`
   - `login`
   - `loginWithGoogle`
   - `resendVerificationEmail`
   - `refreshUser`
   - `forgotPassword`
   - `resetPassword`
   - `signOut`
   - `deleteAccount`
   - `updateProfile`
   - `exportData`
5. Update `RootNavigator` or app provider tree to mount `AuthProvider` once.
6. Update screens to call `useAuthActions()` only.
7. Keep store reads through `useAuthStore`.
8. Preserve existing public exports if possible for compatibility, but avoid lifecycle work inside action hooks.

Acceptance criteria:

- Auth lifecycle is mounted once.
- Screens no longer call a lifecycle hook.
- There is only one Supabase `onAuthStateChange` subscription from auth lifecycle.
- Login/signup/logout behavior remains the same.
- Unexpected auth listener duplication is eliminated.

Validation:

- Type check passes.
- Manual smoke test:
  - cold app start
  - email login
  - Google login if available
  - logout
  - signup to unverified state
  - settings update profile

Do not:

- Rewrite auth UI.
- Change database schema.
- Change Supabase auth behavior beyond lifecycle separation.

---

## Issue 2 - Remove Forced 4-Second Logout Fallback

Impact: Critical
Effort: Low
Primary risk fixed: real users being logged out on slow session restore

Problem:

The auth lifecycle sets status to unauthenticated if `getSession()` takes longer than 4 seconds.

Files to inspect:

- `src/features/auth/hooks/useAuth.ts`
- new `AuthProvider` file if Issue 1 is complete
- `src/features/auth/store/authStore.ts`
- `src/features/auth/types/index.ts`

Implementation steps:

1. Find the session restore timeout.
2. Remove behavior that sets `unauthenticated` due only to timeout.
3. Add or use status `restoring` if the type supports it. If not, keep `loading` and add a visible retry state later.
4. On timeout, set a non-destructive error message or `restoreSlow` flag if needed.
5. Never call `signOut()` because of timeout.
6. Only set unauthenticated when Supabase returns no session or explicit auth invalidation.

Acceptance criteria:

- Slow session restore does not log out users.
- Network slowness does not clear local session.
- Existing no-session startup still routes to unauthenticated.

Validation:

- Type check passes.
- Simulate delayed `getSession()` if test setup allows.
- Manual smoke test app start with existing session.

Do not:

- Add offline database in this issue.
- Change login/signup screens.

---

## Issue 3 - Replace AsyncStorage Auth Token Storage With SecureStore

Impact: Critical
Effort: Low to Medium
Primary risk fixed: unencrypted auth tokens

Problem:

Supabase access and refresh tokens are persisted in AsyncStorage.

Files to inspect:

- `src/shared/lib/supabase/client.ts`
- package dependencies
- Expo config

Implementation steps:

1. Add dependency if missing:
   - `expo-secure-store`
2. Create `src/shared/lib/auth/secureSessionStorage.ts`.
3. Implement Supabase-compatible storage adapter:
   - `getItem(key)`
   - `setItem(key, value)`
   - `removeItem(key)`
4. Replace AsyncStorage in Supabase client auth config with secure adapter.
5. Keep `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.
6. Add a migration fallback only if needed:
   - read old AsyncStorage session once
   - copy to SecureStore
   - remove old AsyncStorage key
7. Ensure no auth tokens are logged.

Acceptance criteria:

- Supabase auth uses SecureStore/keychain-backed storage.
- Existing users are not unnecessarily logged out if migration is implemented.
- No tokens are printed to console.

Validation:

- Type check passes.
- Login persists across app restart.
- Logout removes session.

Do not:

- Store general app data in SecureStore.
- Use SecureStore for large offline records.

---

## Issue 4 - Fix Reset Password Deep-Link Routing

Impact: Critical
Effort: Low
Primary risk fixed: broken or inconsistent password recovery

Problem:

Deep link handling detects recovery links but navigates only to the Auth stack root.

Files to inspect:

- `src/core/navigation/useDeepLink.ts`
- `src/core/navigation/types.ts`
- `src/core/navigation/AuthNavigator.tsx`
- `src/features/auth/screens/ResetPasswordScreen.tsx`
- `src/features/auth/screens/EmailVerificationScreen.tsx`

Implementation steps:

1. Parse initial URL and runtime URL events.
2. Detect recovery/reset-password links.
3. Extract access and refresh tokens from query or hash fragments.
4. Call `supabase.auth.setSession({ access_token, refresh_token })` when tokens exist.
5. Navigate explicitly to `Auth -> ResetPassword`.
6. Detect verification links separately and route to `EmailVerification` if required.
7. Avoid infinite retry timers.

Acceptance criteria:

- Password reset link opens ResetPassword screen.
- Recovery tokens are set before password update.
- Existing auth navigation still works.
- Verification links are not broken.

Validation:

- Type check passes.
- Manual test with sample recovery URL.
- Manual test with sample verification URL.

Do not:

- Rewrite the whole navigation stack.
- Change Supabase redirect URLs unless needed.

---

## Issue 5 - Add Recommended Auth State Machine

Impact: High
Effort: Medium
Primary risk fixed: ambiguous auth states and offline/session edge cases

Problem:

Current auth status is too coarse for production offline and recovery behavior.

Files to inspect:

- `src/features/auth/types/index.ts`
- `src/features/auth/store/authStore.ts`
- `src/features/auth/hooks/useAuth.ts` or `AuthProvider`
- `src/core/navigation/RootNavigator.tsx`
- `src/core/navigation/AuthNavigator.tsx`

Implementation steps:

1. Add explicit statuses:
   - `loading`
   - `restoring`
   - `authenticated_online`
   - `authenticated_offline`
   - `unverified`
   - `expired_requires_reauth`
   - `unauthenticated`
   - `error`
2. Update route decisions in RootNavigator.
3. Map Supabase session restore results into the new statuses.
4. Do not treat network error as unauthenticated.
5. Add UI fallback for restoring/error.

Acceptance criteria:

- Auth state transitions are explicit.
- Offline authenticated user can remain in app.
- Expired auth is distinct from no auth.

Validation:

- Type check passes.
- Manual smoke test all auth routes.

Do not:

- Implement full offline database here.

---

# Phase 2 - Critical Backend Security Hardening

## Issue 6 - Move Destructive Couple Operations To RPCs

Impact: Critical
Effort: Medium to High
Primary risk fixed: client-trusted destructive shared-data actions

Problem:

The mobile client directly deletes and updates shared couple records.

Files to inspect:

- `src/infrastructure/couple/coupleService.ts`
- Supabase SQL migrations if available
- screens/hooks calling couple deletes

Operations to move:

- delete couple journal
- delete couple memory
- delete couple goal
- delete couple letter
- schedule couple deletion
- cancel couple deletion

Implementation steps:

1. Define RPC names:
   - `delete_couple_journal`
   - `delete_couple_memory`
   - `delete_couple_goal`
   - `delete_couple_letter`
   - `request_couple_deletion`
   - `cancel_couple_deletion`
2. RPCs must validate:
   - authenticated user
   - membership in couple
   - authorization to delete
   - record belongs to user's couple
3. RPCs should write tombstones or deletion audit logs.
4. Client calls RPC instead of direct `.delete()` / unsafe `.update()`.
5. Preserve existing UI behavior.

Acceptance criteria:

- Client no longer directly deletes shared couple records.
- Server validates membership.
- Failed unauthorized deletion returns safe error.

Validation:

- Type check passes.
- Supabase policy/RPC tests if backend is available.
- Manual smoke test delete flows.

Do not:

- Change personal data deletion in this issue.
- Implement full offline tombstone system here unless needed by RPC.

---

## Issue 7 - Add RLS And Storage Policy Tests

Impact: Critical
Effort: High
Primary risk fixed: unknown Supabase policy correctness

Problem:

The app trusts RLS and storage policies, but there are no visible tests.

Files to inspect:

- Supabase migrations/policies
- Supabase test setup
- tables and buckets referenced by services

Tables to test:

- profiles
- mood_logs
- journal_entries
- goals
- memories
- future_letters
- couples
- couple_members
- couple_invitations
- couple_journals
- couple_journal_comments
- couple_journal_reactions
- couple_memories
- couple_goals
- couple_letters
- couple_letter_reactions
- relationship_events

Buckets to test:

- avatars
- journal_images
- goal_images
- memory_images
- letter_images
- couple_journal_images
- couple_memory_images
- couple_letter_images

Implementation steps:

1. Create Supabase policy test suite.
2. Create test users:
   - user A
   - user B
   - partner pair
   - unrelated user
3. For every table, test:
   - authorized select
   - unauthorized select
   - authorized insert
   - unauthorized insert
   - authorized update
   - unauthorized update
   - authorized delete
   - unauthorized delete
4. For storage, test:
   - own upload
   - unauthorized upload path
   - own read signed URL
   - unauthorized read
   - authorized remove
   - unauthorized remove
5. Add these tests to CI.

Acceptance criteria:

- Unauthorized cross-user access fails.
- Couple partner access works only for members.
- Storage paths cannot be escaped.
- Tests run in CI.

Validation:

- Supabase policy tests pass.
- CI blocks failures.

Do not:

- Assume policies are correct without tests.

---

## Issue 8 - Remove Email From Partner KAMI ID Search

Impact: High
Effort: Low
Primary risk fixed: user enumeration and privacy leakage

Problem:

Partner search returns email before the user accepts an invitation.

Files to inspect:

- `src/infrastructure/couple/coupleService.ts`
- `src/features/settings/screens/SettingsScreen.tsx`
- couple types

Implementation steps:

1. Change partner search result type to exclude email.
2. Update Supabase select to avoid email.
3. Update Settings UI to not display email in search result.
4. Show nickname/avatar only.
5. Only show partner email after accepted connection if needed.

Acceptance criteria:

- Search by KAMI ID does not return email.
- Existing invite flow still works.
- Accepted partner display still works.

Validation:

- Type check passes.
- Manual search/invite test.

---

## Issue 9 - Add Rate Limits For Sensitive Endpoints

Impact: High
Effort: Medium
Primary risk fixed: abuse, enumeration, spam, upload abuse

Sensitive actions:

- signup
- password reset
- partner lookup
- invite sending
- image upload
- resend verification
- delete account

Implementation steps:

1. Add server-side rate-limit checks through RPCs or Edge Functions.
2. For partner lookup, move search behind RPC.
3. Track action attempts by user/IP/device where available.
4. Return generic error messages.
5. Update client to handle rate-limit error code.

Acceptance criteria:

- Repeated abusive attempts are blocked.
- Legitimate users get clear retry messaging.

Validation:

- Backend tests for rate-limit behavior.
- Manual repeated attempt test.

---

## Issue 10 - Scrub Sensitive Data From Production Logs

Impact: High
Effort: Low
Primary risk fixed: private data leakage through logs

Files to inspect:

- all files with `console.log`
- all files with `console.warn`
- all files with `console.error`
- notification/error reporting code if added

Implementation steps:

1. Create `src/shared/lib/logging/logger.ts`.
2. Add redaction for:
   - auth tokens
   - emails
   - signed URLs
   - image URLs
   - journal body
   - letter body
   - mood notes
   - comments
3. Replace direct console calls in infrastructure/services with logger.
4. Keep dev logs useful but safe.
5. Ensure production logs are minimal.

Acceptance criteria:

- No sensitive app content logged.
- Error logs keep category/code/context only.

Validation:

- Search for remaining console calls.
- Type check passes.

---

# Phase 3 - Critical Performance Fixes

## Issue 11 - Replace ScrollView Lists With FlashList

Impact: Critical
Effort: Medium
Primary risk fixed: slow/janky large lists

Problem:

The app has many ScrollViews and no virtualized list usage.

Files to inspect:

- `src/features/journal/screens/JournalScreen.tsx`
- `src/features/memories/screens/MemoriesScreen.tsx`
- `src/features/goals/screens/GoalsScreen.tsx`
- `src/features/future/screens/FutureScreen.tsx`
- `src/features/home/screens/HomeScreen.tsx`
- `src/features/home/screens/TimelineScreen.tsx`
- `src/features/couple/screens/TimelineScreen.tsx`

Implementation steps:

1. Add `@shopify/flash-list`.
2. Start with one screen only, preferably Memories or Journal.
3. Identify actual list data.
4. Extract row component.
5. Replace list ScrollView with FlashList.
6. Set `estimatedItemSize`.
7. Add `keyExtractor`.
8. Add empty/loading/footer states.
9. Repeat in separate issues for other screens.

Acceptance criteria:

- Target screen uses FlashList for main list.
- UI behavior remains equivalent.
- Scroll performance improves on large data.

Validation:

- Type check passes.
- Manual test with many items.
- No nested full-list rendering inside ScrollView.

Do not:

- Convert all 55 ScrollViews in one PR.
- Change visual design unnecessarily.

---

## Issue 12 - Add Pagination To Supabase Queries

Impact: High
Effort: Medium
Primary risk fixed: unbounded queries and slow heavy accounts

Targets:

- journals: 20/page
- memories: 15/page
- letters: 20/page
- goals: 20/page
- comments: 10/page

Files to inspect:

- `src/infrastructure/home/homeService.ts`
- `src/infrastructure/home/memoryService.ts`
- `src/infrastructure/home/futureService.ts`
- `src/infrastructure/couple/coupleService.ts`
- feature hooks using these services

Implementation steps:

1. Add page/cursor params to one service at a time.
2. Prefer cursor pagination using `created_at` or `updated_at`.
3. Add `limit`.
4. Add `loadMore` to hooks.
5. Update UI list footer.
6. Keep refresh loading first page.

Acceptance criteria:

- Queries no longer fetch unbounded history.
- UI can load more.
- Initial screen load is faster.

Validation:

- Type check passes.
- Manual first page/load more/refresh test.

---

## Issue 13 - Patch Realtime Events Instead Of Full Refetch

Impact: High
Effort: Medium
Primary risk fixed: backend load amplification

Files to inspect:

- `src/features/couple/components/CoupleRealtimeListener.tsx`
- `src/features/home/hooks/useHome.ts`
- Zustand stores

Implementation steps:

1. Pick one realtime table first.
2. Add store methods:
   - upsert item
   - remove item
3. In realtime handler:
   - INSERT: map payload and add
   - UPDATE: map payload and replace
   - DELETE: remove by ID
4. Keep full refetch fallback only for payloads missing required fields.
5. Debounce any fallback refetch.
6. Repeat per table in separate issues.

Acceptance criteria:

- One realtime table updates local store without full fetch.
- No duplicate records.
- Delete removes locally.

Validation:

- Type check passes.
- Manual realtime insert/update/delete test.

---

## Issue 14 - Cache Signed Image URLs By Storage Path

Impact: High
Effort: Low to Medium
Primary risk fixed: repeated signed URL generation

Files to inspect:

- `src/shared/lib/storage/media.ts`
- `src/shared/lib/storage/avatar.ts`
- services resolving signed URLs

Implementation steps:

1. Create `src/shared/lib/storage/signedUrlCache.ts`.
2. Cache:
   - bucket
   - path
   - signedUrl
   - expiresAt
3. Before calling Supabase `createSignedUrl(s)`, check cache.
4. Refresh when less than 5 minutes from expiry.
5. Return cached URL where valid.

Acceptance criteria:

- Repeated renders do not regenerate the same signed URLs.
- Expired URLs are refreshed.

Validation:

- Type check passes.
- Manual inspect fewer signed URL calls if logging/instrumentation exists.

---

## Issue 15 - Add Image Thumbnail Pipeline

Impact: High
Effort: High
Primary risk fixed: loading full-size images in lists

Implementation steps:

1. Define image variants:
   - avatar_small
   - card_thumbnail
   - detail_image
   - original
2. Update upload manager to create variants.
3. Store paths per variant.
4. Use thumbnails in lists.
5. Use detail/original only in preview modals.

Acceptance criteria:

- List screens render thumbnails.
- Detail screens can show larger images.
- Existing images have fallback behavior.

Validation:

- Manual upload and view image in list/detail.
- Measure memory/scroll improvement.

---

## Issue 16 - Memoize Expensive Derived Data

Impact: Medium
Effort: Low
Primary risk fixed: unnecessary CPU work on render

Targets:

- `.filter().sort().map()` chains in render
- countdown data
- timeline derivation
- active/completed goal derivation

Implementation steps:

1. Pick one large screen.
2. Identify expensive render-time derived values.
3. Move to `useMemo`.
4. Ensure dependency arrays are correct.
5. Avoid mutating original arrays with `.sort()` directly.

Acceptance criteria:

- Derived data no longer recalculates on unrelated state updates.
- No mutation of store arrays during sort.

Validation:

- Type check passes.
- Manual screen behavior unchanged.

---

## Issue 17 - Reduce One-Second Timers

Impact: Medium
Effort: Low
Primary risk fixed: battery drain and frequent rerenders

Implementation steps:

1. Find all `setInterval(..., 1000)`.
2. Run timers only when screen is focused.
3. Use minute-level updates for events more than 1 hour away.
4. Isolate countdown timers into memoized components.
5. Clear intervals on blur/unmount.

Acceptance criteria:

- Timers stop when screen is not focused.
- Far-future countdowns do not rerender every second.

Validation:

- Type check passes.
- Manual focus/background test.

---

# Phase 4 - Offline-First Foundation

## Issue 18 - Add NetInfo And Explicit Offline State

Impact: High
Effort: Low
Primary risk fixed: silent failures during network loss

Files to inspect:

- app provider tree
- shared hooks/providers
- screens with network actions

Implementation steps:

1. Add `@react-native-community/netinfo`.
2. Create `src/shared/network/NetworkProvider.tsx`.
3. Expose `useNetworkStatus()`.
4. Add global offline banner.
5. Disable online-only actions:
   - login
   - signup
   - Google auth
   - password reset
   - partner search
   - account deletion
   - data export
6. Add clear message: "This action requires internet."

Acceptance criteria:

- App detects offline state.
- User sees offline indicator.
- Online-only actions do not silently fail.

Validation:

- Manual airplane mode test.
- Type check passes.

---

## Issue 19 - Add SQLite And Drizzle ORM Local Database

Impact: Critical
Effort: High
Primary risk fixed: no durable offline data

Implementation steps:

1. Add dependencies:
   - `expo-sqlite`
   - Drizzle ORM packages suitable for Expo SQLite
2. Create:
   - `src/data/db/client.ts`
   - `src/data/db/schema.ts`
   - `src/data/db/migrations/`
3. Start with limited schema:
   - profiles
   - mood_logs
   - journal_entries
   - goals
   - memories
   - future_letters
   - sync_metadata
4. Add migration runner.
5. Add local repository for one entity first, preferably journals.

Acceptance criteria:

- App can create/open local DB.
- Migrations run once.
- One entity can be read/written locally.

Validation:

- Type check passes.
- Manual app restart keeps local test data.

Do not:

- Convert all features in one issue.

---

## Issue 20 - Add Mutation Outbox Queue

Impact: Critical
Effort: High
Primary risk fixed: offline writes lost or failed

Schema:

```text
outbox_mutations
  id
  entity_type
  entity_id
  operation
  payload_json
  status
  retry_count
  next_retry_at
  last_error
  created_at
  updated_at
```

Implementation steps:

1. Add outbox table to SQLite schema.
2. Create `src/data/sync/outbox.ts`.
3. Add enqueue mutation function.
4. Add status transitions:
   - pending
   - syncing
   - failed
   - synced
5. Add retry count and backoff.
6. Integrate with one create flow first, preferably journal create.

Acceptance criteria:

- Offline create is saved locally.
- Outbox row is created.
- Outbox survives app restart.

Validation:

- Manual airplane mode create/restart test.

---

## Issue 21 - Add Image Upload Queue

Impact: High
Effort: High
Primary risk fixed: image upload failures and no offline image support

Implementation steps:

1. Add `file_upload_queue` table.
2. On image selection:
   - compress
   - save local file
   - create queue record
   - reference local URI in local entity
3. On sync:
   - upload file
   - replace local URI with storage path
   - mark upload complete
4. Add retry/backoff.

Acceptance criteria:

- User can attach image offline.
- Upload resumes when online.
- Failed upload can retry.

Validation:

- Manual offline attach/restart/reconnect test.

---

## Issue 22 - Add Tombstone Delete Strategy

Impact: High
Effort: Medium
Primary risk fixed: delete conflicts and data loss during sync

Implementation steps:

1. Add fields:
   - `deleted_at`
   - `sync_status`
2. Local delete marks row deleted instead of removing.
3. Add outbox delete mutation.
4. Server confirms delete.
5. Local cleanup happens after confirmation and retention window.

Acceptance criteria:

- Deletes are durable offline.
- Reconnect sync can process delete.
- Deleted rows do not show in normal UI.

Validation:

- Manual offline delete/restart/reconnect test.

---

## Issue 23 - Add Sync Status UI

Impact: Medium
Effort: Medium
Primary risk fixed: users do not know whether data is saved or synced

Implementation steps:

1. Add per-record sync badge component.
2. Add statuses:
   - saved on device
   - syncing
   - synced
   - failed
   - conflict
3. Add global sync summary:
   - "3 changes waiting to sync"
4. Add retry button for failed mutations.

Acceptance criteria:

- User can see pending/failed sync.
- Failed writes are recoverable.

Validation:

- Manual forced failure test.

---

## Issue 24 - Add Conflict Resolution Per Entity

Impact: Medium
Effort: High
Primary risk fixed: silent overwrites after offline edits

Rules:

- moods: last write wins
- journals: local wins if server unchanged, conflict if both changed
- goals: field-level merge
- memories: metadata merge, image conflict if both changed
- letters: server authority for sealed/sent letters
- couple membership: server always authoritative

Implementation steps:

1. Add version fields or server revision.
2. Detect conflict during pull/push.
3. Store conflict record.
4. Add conflict UI for one entity first.
5. Add user choice:
   - keep mine
   - keep server
   - merge manually

Acceptance criteria:

- Conflicts are not silently overwritten.
- User can resolve at least journal conflicts.

Validation:

- Manual two-device conflict test if possible.

---

# Phase 5 - Maintainability And Refactoring

## Issue 25 - Split HomeScreen

Impact: High
Effort: Medium
Primary risk fixed: huge screen causing performance and maintainability problems

Files to inspect:

- `src/features/home/screens/HomeScreen.tsx`

Target structure:

```text
src/features/home/
  components/
    HomeHeader.tsx
    PersonalDashboard.tsx
    CoupleDashboard.tsx
    MoodCard.tsx
    DailyQuestionCard.tsx
    LetterCarousel.tsx
    TimelinePreview.tsx
  hooks/
    useHomeDashboard.ts
    usePersonalLetters.ts
    useCoupleHome.ts
```

Implementation steps:

1. Extract one component at a time.
2. Preserve props and visual output.
3. Wrap expensive pure components in `React.memo`.
4. Move derived data into hooks.
5. Keep HomeScreen as orchestration only.

Acceptance criteria:

- HomeScreen is meaningfully smaller.
- UI unchanged.
- No unrelated behavior changes.

Validation:

- Type check passes.
- Manual Home personal/couple modes test.

---

## Issue 26 - Split All Screens Over 500 Lines

Impact: High
Effort: High

Targets:

- HomeScreen
- JournalScreen
- MemoriesScreen
- FutureScreen
- GoalsScreen
- SettingsScreen

Implementation rule:

- One screen per issue.
- One component extraction per commit if possible.

Acceptance criteria:

- Screens become orchestration layers.
- Modals, cards, lists, and hooks are extracted.
- UI remains unchanged.

---

## Issue 27 - Move Business Logic Out Of UI Files

Impact: High
Effort: High

Implementation steps:

1. Find direct Supabase calls in screens.
2. Move them to infrastructure services or repositories.
3. Move derived domain rules to hooks/domain utilities.
4. Keep UI components focused on rendering and user events.

Acceptance criteria:

- Screens do not directly call Supabase.
- Business rules are testable outside UI.

---

## Issue 28 - Add Zod Validation On All Inputs

Impact: High
Effort: Medium

Implementation steps:

1. Add Zod.
2. Create schemas per feature:
   - auth
   - profile
   - journal
   - memory
   - goal
   - letter
   - couple
3. Validate before service calls.
4. Show user-friendly validation errors.
5. Validate realtime payloads where practical.

Acceptance criteria:

- Invalid input is caught before Supabase.
- Service layer receives typed valid data.

---

## Issue 29 - Replace Math.random IDs With crypto.randomUUID

Impact: High
Effort: Low

Implementation steps:

1. Search for UUID helpers and `Math.random()` ID generation.
2. Add crypto UUID polyfill if needed.
3. Replace ID generation with `crypto.randomUUID()`.
4. For KAMI short IDs, move generation to server if possible.

Acceptance criteria:

- No security-sensitive IDs use `Math.random()`.

---

## Issue 30 - Remove TypeScript `any` Usage

Impact: Medium
Effort: Medium to High
## Issue 30 - TypeScript 'any' Elimination

We will systematically eliminate all references to `any` across the local data sync layer, common libraries/hooks, and UI components. 

#### Types to Introduce:
In [repo.ts](file:///c:/Users/rohan/Desktop/Kami2/src/shared/db/repo.ts), we will declare explicit model types representing local database entities (mapped from SQLite/Drizzle schemas):
- `ProfileModel`: Clean representation of the user profile, with boolean toggles.
- `ProfileInput`: Input type for profile upsert operations.
- `MoodInput`: Input structure for saving daily mood entries.
- `JournalEntryModel`: Structure representing saved journal entries, incorporating stringified arrays mapping back to JS string arrays.
- `JournalInput`: Write properties allowed when saving a journal entry.
- `GoalInput`: Write properties allowed when saving goals.
- `MemoryModel` and `MemoryInput`: Model representation and input structures for memory cards.
- `LetterModel`, `LetterModelDetail`, and `LetterInput`: Models and input structures representing future letters.

#### Files to Modify:
1. **[repo.ts](file:///c:/Users/rohan/Desktop/Kami2/src/shared/db/repo.ts)**:
   - Use the new model types and input interfaces.
   - Replace generic `any` signature on helper `toJSON`.
   - Remove manual `(r: any)` type annotations from map callbacks where TypeScript can infer the underlying Drizzle schema row type automatically.
2. **[sync.ts](file:///c:/Users/rohan/Desktop/Kami2/src/shared/db/sync.ts)**:
   - Update `enqueueMutation` payload to type `unknown` rather than `any`.
   - Change `mapPayloadToSupabase` payload type to `Partial<ProfileInput & MoodInput & JournalInput & GoalInput & MemoryInput & LetterInput>` and return `Record<string, unknown>`.
   - Replace catch block annotations `catch (err: any)` with `catch (err: unknown)` and handle message formatting safely.
3. **[uploadManager.ts](file:///c:/Users/rohan/Desktop/Kami2/src/shared/lib/storage/uploadManager.ts)**:
   - Convert catch block `catch (e: any)` to standard `catch (e: unknown)`.
4. **[usePaginatedList.ts](file:///c:/Users/rohan/Desktop/Kami2/src/shared/hooks/usePaginatedList.ts)**:
   - Change `dependencies?: any[]` to `dependencies?: React.DependencyList`.
   - Convert catch block `catch (err: any)` to `catch (err: unknown)`.
5. **[KamiImage.tsx](file:///c:/Users/rohan/Desktop/Kami2/src/shared/ui/atoms/KamiImage.tsx)**:
   - Change `fallbackSrc?: any` to `ImageSourcePropType` from `react-native`.
6. **[notificationService.ts](file:///c:/Users/rohan/Desktop/Kami2/src/infrastructure/notifications/notificationService.ts)**:
   - Change `data?: any` to `Record<string, unknown>` on `triggerLocalNotificationAsync`.
7. **UI Feature Components**:
   - Explicitly type the props of `EntryCard`, `PreviewModal`, `MemoryTimelineCard`, `MemoryNetflixCard`, and `MemoryPreviewModal` with their concrete models to completely eliminate `any`.

---

## Verification Plan

### Automated Tests
- Run `npx tsc --noEmit` to verify type safety.

### Manual Verification
- Smoke test all navigation tabs, writing features, dashboard widgets, and settings selectors. Ensure there are zero regression changes to screen layouts, styles, animations, or responsiveness.

Acceptance criteria:

- Target file has no avoidable `any`.
- Type check passes.

---

## Issue 31 - Extract Shared Result And AppError Types

Impact: Medium
Effort: Medium

Implementation steps:

1. Create `src/shared/types/result.ts`.
2. Create `src/shared/errors/AppError.ts`.
3. Replace duplicated Result types gradually.
4. Add standard error codes:
   - auth/session-expired
   - network/offline
   - validation/invalid-input
   - security/forbidden
   - storage/upload-failed
   - sync/conflict

Acceptance criteria:

- One feature uses shared Result/AppError.
- Existing behavior unchanged.

---

## Issue 32 - Extract Reusable usePaginatedList Hook

Impact: Medium
Effort: Low to Medium

Implementation steps:

1. Create `src/shared/hooks/usePaginatedList.ts`.
2. Inputs:
   - fetcher
   - pageSize
   - dependencies
3. Outputs:
   - data
   - loading
   - refreshing
   - error
   - hasMore
   - loadMore
   - refresh
4. Adopt in one screen first.

Acceptance criteria:

- One list screen uses reusable pagination hook.

---

## Issue 33 - Extract Storage Upload Manager

Impact: Medium
Effort: Medium

Implementation steps:

1. Create `src/shared/lib/storage/uploadManager.ts`.
2. Centralize:
   - image pick
   - compression
   - upload
   - signed URL cache
   - cleanup on failure
3. Replace one feature usage first.

Acceptance criteria:

- One feature no longer has custom upload logic.
- Upload behavior unchanged.

---

# Phase 6 - Product Privacy And Operational Hardening

## Issue 34 - Add Privacy Threat Model Document

Impact: High
Effort: Low

Deliverable:

- `docs/privacy-threat-model.md`

Must include:

- stolen phone
- abusive partner
- account takeover
- broken RLS
- notification disclosure
- backend/admin misuse
- sensitive logs
- storage URL leakage
- table-by-table access matrix
- bucket-by-bucket access matrix

Acceptance criteria:

- Document exists and maps threats to mitigations.

---

## Issue 35 - Add App Lock With Biometric And PIN

Impact: High
Effort: Medium

Implementation steps:

1. Add Expo LocalAuthentication.
2. Add app lock settings:
   - off
   - biometric
   - PIN fallback
3. Store PIN hash in SecureStore.
4. Auto-lock after timeout:
   - immediately
   - 1 minute
   - 5 minutes
   - 15 minutes
5. Hide sensitive UI when app backgrounded.

Acceptance criteria:

- App can lock on background/start.
- User can unlock with biometric/PIN.

---

## Issue 36 - Add Abuse Controls For Partner Search

Impact: High
Effort: Medium

Implementation steps:

1. Add block/unblock user.
2. Add report user.
3. Add invite cooldown.
4. Add KAMI ID regeneration.
5. Add discoverability toggle.
6. Prevent repeated invites after decline.

Acceptance criteria:

- User can prevent unwanted partner contact.
- Search and invite flows respect blocks.

---

## Issue 37 - Add Privacy-Safe Analytics

Impact: High
Effort: Medium

Track:

- signup/login status
- verification success/failure
- unexpected logout
- mood logged
- journal created
- memory created
- goal completed
- image upload failed
- sync failed
- screen load time

Never track:

- journal body
- letter body
- mood notes
- comments
- partner email
- tokens
- signed URLs
- image URLs

Acceptance criteria:

- Analytics events pass through redaction layer.
- No sensitive content in payloads.

---

## Issue 38 - Add Feature Flags And Kill Switches

Impact: High
Effort: Medium

Flags:

- realtime
- uploads
- invitations
- export
- account deletion
- couple deletion
- offline writes
- sync engine
- maintenance mode
- minimum app version

Implementation steps:

1. Add remote config source.
2. Cache flags locally.
3. Add hook `useFeatureFlag`.
4. Add emergency kill switch behavior for risky systems.

Acceptance criteria:

- Feature can be disabled remotely without app release.

---

## Issue 39 - Add Legal Basics

Impact: Critical
Effort: Medium

Required:

- privacy policy
- terms of service
- account deletion flow
- data export flow
- data retention policy
- notification consent explanation
- age gate if applicable
- support contact
- abuse/reporting policy

Acceptance criteria:

- Public launch has legal/compliance minimums.

---

## Issue 40 - Add Release Gates

Impact: Critical
Effort: Medium

Minimum gates:

- no known auth logout bug
- no unencrypted auth tokens
- RLS tests pass
- crash-free sessions >= 99.5%
- unexpected logout rate < 0.2%
- image upload success >= 98%
- home screen interactive < 2.5s on mid-range Android
- sync success within 5 minutes >= 99%
- no sensitive data in logs

Acceptance criteria:

- Release checklist exists.
- CI/monitoring supports gates where possible.

---

# Phase 7 - CI, Monitoring, And Scale

## Issue 41 - Add Sentry Crash Reporting And Performance Monitoring

Impact: Critical
Effort: Low to Medium

Implementation steps:

1. Add Sentry RN SDK.
2. Configure DSN through environment.
3. Add release/environment tags.
4. Add performance tracing for:
   - cold start
   - screen navigation
   - Supabase request duration
   - image upload duration
5. Add privacy redaction.

Acceptance criteria:

- Crashes report to Sentry.
- No private content is sent.

---

## Issue 42 - Add CI Pipeline With Lint, Type Check, Test

Impact: High
Effort: Low

Implementation steps:

1. Add GitHub Actions or equivalent.
2. Run:
   - install
   - lint
   - type check
   - tests
3. Block merge on failure.

Acceptance criteria:

- CI runs on PR.
- Type errors fail CI.

---

## Issue 43 - Add Indexes On FK And Sort Columns

Impact: High
Effort: Low to Medium

Columns:

- user_id
- couple_id
- sender_id
- receiver_id
- created_at
- updated_at
- entry_date
- memory_date
- deliver_at
- status

Implementation steps:

1. Inspect query patterns.
2. Add indexes through Supabase migrations.
3. Verify query plans for heavy queries.

Acceptance criteria:

- Frequent queries avoid full table scans.

---

## Issue 44 - Add Server-Side Export With Pagination

Impact: Medium
Effort: Medium

Problem:

Current export fetches all user data in one client operation.

Implementation steps:

1. Move export to Edge Function/background job.
2. Paginate server-side.
3. Store export file securely.
4. Return progress endpoint.
5. Notify user when ready.

Acceptance criteria:

- Large account export does not OOM or timeout.

---

## Issue 45 - Add Server Sync Endpoints

Impact: High
Effort: High

Problem:

Direct table reads and realtime fan-out are not enough for offline-first sync.

Implementation steps:

1. Define sync cursor format.
2. Add endpoints/RPCs:
   - pull changes after cursor
   - push mutations
3. Include deleted/tombstoned records.
4. Return server versions.
5. Add tests.

Acceptance criteria:

- Client can incrementally sync without full table refetch.

---

## Public Launch Blockers

Do not publicly launch until these are complete:

1. Auth lifecycle split.
2. Forced logout timeout removed.
3. Secure token storage.
4. RLS/storage policy tests passing.
5. Destructive couple operations moved to server validation.
6. Sentry installed.
7. Release gates defined.
8. No sensitive logs.
9. Basic pagination.
10. Legal basics in place.

## First Bug To Fix

Start with Issue 1: Split Auth Lifecycle From Auth Actions.

Reason:

- It is likely causing unexpected logout.
- It is low effort compared with the risk.
- It makes later auth/offline work cleaner.
- It should be completed before changing token storage or auth state machine.