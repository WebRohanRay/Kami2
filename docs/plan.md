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