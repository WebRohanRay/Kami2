# Kami — Architecture

## Layer Map

```
App.tsx
└── src/app/
    ├── providers/         — GestureHandler, SafeArea, future: Theme, QueryClient
    └── navigation/        — RootNavigator, AuthNavigator, MainNavigator, types

src/features/              — One folder per product feature
    ├── auth/
    │   ├── types/         — AuthUser, AuthStatus, Result<T>
    │   ├── store/         — Zustand authStore (state only, no logic)
    │   ├── hooks/         — useAuth (the ONLY public auth API for UI)
    │   └── screens/       — Login, SignUp, EmailVerification, ForgotPassword, ResetPassword
    ├── home/
    │   └── screens/       — HomeScreen
    └── settings/
        └── screens/       — SettingsScreen

src/shared/                — No feature knowledge allowed here
    ├── constants/         — tokens (colors, spacing, radii, shadows, sizing)
    ├── hooks/             — useToggle, useForm (generic, reusable)
    ├── utils/             — date, string, number helpers
    ├── lib/
    │   ├── supabase/      — createClient (single instance)
    │   └── storage/       — avatar pick + upload
    └── ui/
        ├── atoms/         — KamiButton, KamiText, InputField, Badge, ProgressBar
        ├── molecules/     — BottomSheet, MoodSelector, MemoryCard, StreakBadge, SocialLoginRow
        ├── organisms/     — HeroSection, FallingPetal, TabBar
        └── templates/     — AuthShell, AppShell

src/infrastructure/        — All external I/O. Features NEVER import Supabase directly.
    ├── auth/              — authService (all supabase.auth.* calls)
    └── profile/           — profileRepository (all profiles table calls)
```

## Rules

1. **Features import from `@shared` and `@infrastructure` only.**
   Features never import from other features.

2. **`@infrastructure` imports from `@shared/lib/supabase` only.**
   Never from features or app.

3. **`@shared` imports nothing from this project.**
   Pure utilities and components only.

4. **Screens never call Supabase.**
   They call hooks, hooks call infrastructure.

5. **`useAuth` is the single public auth API.**
   No screen ever imports `authService` or `profileRepository` directly.

6. **authStore holds state only.**
   No async logic, no API calls — just setters.

7. **All I/O returns `Result<T>`.**
   No throws anywhere in the codebase.

## Adding a new feature

```
src/features/myFeature/
├── types/       index.ts
├── store/       myFeatureStore.ts
├── hooks/       useMyFeature.ts
├── screens/     MyScreen.tsx
└── index.ts     (public API — only export what screens outside need)
```

## Path aliases

| Alias            | Points to               |
|------------------|-------------------------|
| `@features/*`    | src/features/*          || `@shared/*`      | src/shared/*            |
| `@infrastructure/*` | src/infrastructure/* |
| `@app/*`         | src/app/*               |
| `@assets/*`      | assets/*                |
