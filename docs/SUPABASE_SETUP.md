# Kami — Supabase Setup: Zero to Production

---

## STEP 1 — Install Supabase CLI

```bash
# Mac
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm (any OS)
npm install -g supabase

# Verify
supabase --version
```

---

## STEP 2 — Login to Supabase

```bash
supabase login
```
This opens a browser. Sign in with your Supabase account. Your token is saved locally.

---

## STEP 3 — Link your project

Go to https://supabase.com/dashboard → your project → Settings → General.
Copy the **Project Reference ID** (looks like `abcdefghijklmnop`).

```bash
cd Kami2

supabase init          # creates supabase/ config folder (already exists in this project)

supabase link --project-ref YOUR_PROJECT_REF_ID
# It will ask for your database password — enter it
```

---

## STEP 4 — Run migrations (creates all tables + policies)

```bash
supabase db push
```

This runs `supabase/migrations/001_profiles.sql` against your live database.

What it creates:
- `profiles` table (id, email, nickname, avatar_url, created_at, updated_at)
- Auto-create profile trigger (fires on every new auth.users insert)
- Row Level Security — users can only read/write their own profile
- `avatars` storage bucket (private)
- Storage policies — users can only upload/read their own avatar

Verify it worked:
```bash
supabase db diff       # should show no diff if migration applied cleanly
```

Or check in the Supabase dashboard → Table Editor → profiles table.

---

## STEP 5 — Enable Email Auth

Supabase Dashboard → Authentication → Providers → Email
- ✅ Enable Email provider
- ✅ Confirm email — ON (users must verify before signing in)
- ✅ Secure email change — ON

---

## STEP 6 — Enable Google Auth (optional but in the app)

Supabase Dashboard → Authentication → Providers → Google
- ✅ Enable Google provider
- Paste your **Google OAuth Client ID** and **Client Secret**
  (get from https://console.cloud.google.com → APIs & Services → Credentials)
- Authorized redirect URI to add in Google Console:
  `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

In your `.env`:
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id_here
```

---

## STEP 7 — Set redirect URLs (deep links)

Supabase Dashboard → Authentication → URL Configuration

**Site URL:**
```
kami://
```

**Redirect URLs (add all of these):**
```
kami://auth/verify
kami://auth/reset-password
kami://
```

This makes email verification and password reset links open the app instead of a browser.

---

## STEP 8 — Set up your .env file

```bash
# .env (already in project root)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id_here
```

Find these in: Supabase Dashboard → Settings → API
- Project URL → `EXPO_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## STEP 9 — Run the app locally

```bash
npm install

# Start dev server
npx expo start

# Run on Android (needs Android Studio or physical device)
npx expo start --android

# Run on iOS (Mac only, needs Xcode)
npx expo start --ios
```

---

## STEP 10 — Build for production (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure (already done — eas.json exists)
# Just verify your project ID in app.config.js matches your Expo dashboard

# Build Android APK for testing
eas build --platform android --profile preview

# Build Android AAB for Play Store
eas build --platform android --profile production

# Build iOS for App Store
eas build --platform ios --profile production
```

---

## STEP 11 — Submit to stores

```bash
# Submit Android to Play Store (needs service account key)
eas submit --platform android

# Submit iOS to App Store (needs Apple Developer account)
eas submit --platform ios
```

---

## Useful day-to-day commands

```bash
# Check migration status
supabase migration list

# Create a new migration
supabase migration new add_partner_table

# Push new migrations to production
supabase db push

# Pull remote schema changes back locally
supabase db pull

# Open Supabase Studio locally
supabase start       # starts local Supabase (Docker required)
supabase studio      # opens local dashboard at localhost:54323

# Stop local Supabase
supabase stop

# View logs
supabase logs

# Reset local database (wipes everything and reruns migrations)
supabase db reset
```

---

## Adding a future migration (example: adding partner table)

```bash
# 1. Create the migration file
supabase migration new add_partners_table

# 2. Edit the generated file in supabase/migrations/
# 3. Push to production
supabase db push
```

Never edit `001_profiles.sql` directly after it's been applied.
Always create a new numbered migration file.

---

## Production checklist before launch

- [ ] `supabase db push` — all migrations applied
- [ ] Email auth enabled + confirm email ON
- [ ] Redirect URLs set (kami://)
- [ ] Google auth configured (if using)
- [ ] `.env` has real production keys (not placeholders)
- [ ] RLS enabled on all tables (check: Dashboard → Authentication → Policies)
- [ ] `eas build --platform android --profile production` succeeded
- [ ] `eas build --platform ios --profile production` succeeded
- [ ] App tested on real device with production Supabase project
