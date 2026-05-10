# Brackish Pirate

A fishing & boating command center for the Gulf Coast — built with React Native and Expo.

## Features

- **Dashboard** — live conditions strip (air/water temp, waves, wind, tide) and community catch reports
- **Map & Hotspots** — Google Maps with fish activity overlays, spot detail cards, and layer controls
- **Tides** — NOAA tide predictions with an interactive scrubable chart and hi/lo table
- **Solunar** — moon-phase activity scoring, feeding window calculator, and activity curve chart
- **Catch Reports** — community feed with species/time filters, photo uploads, and GPS tagging
- **Auth** — email/password sign-in and sign-up via Supabase

## Stack

| Layer | Tech |
|-------|------|
| Framework | React Native + Expo ~54 |
| Navigation | React Navigation (bottom tabs + stack) |
| Backend / Auth | Supabase |
| Maps | react-native-maps (Google Maps) |
| Location | expo-location |
| Images | expo-image-picker |
| Animations | react-native-reanimated + Animated API |
| Haptics | expo-haptics |

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `a` for Android / `i` for iOS simulator.

## Environment

Supabase URL and anon key are configured in `src/lib/supabase.js`. For production, move these to environment variables.

## Project Structure

```
src/
  components/       # HelmCrest logo, TidesCalendar
  constants/        # theme (colors, typography, spacing)
  hooks/            # useAuth (AuthProvider + context)
  lib/              # supabase client
  navigation/       # AppNavigator (bottom tabs)
  screens/
    auth/           # LoginScreen
    dashboard/      # DashboardScreen
    map/            # MapScreen
    reports/        # ReportsScreen, SubmitReportScreen
    tides/          # TidesScreen, SolunarScreen
```
