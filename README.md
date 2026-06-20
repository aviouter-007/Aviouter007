# Aviouter

Aviator-style **crash game** with **virtual coins only** (no real money). Includes user dashboard, admin panel, live chat, leaderboards, and customizable plane avatars.

## Features

- **Crash gameplay**: Rising multiplier, cash out before crash, provably fair rounds
- **Virtual currency**: Coins for betting, daily rewards, admin-managed balance
- **User dashboard**: Game, profile, avatars, transaction history, leaderboards
- **Admin dashboard**: Users, coin requests, settings, chat moderation
- **Real-time**: Socket.io for rounds, bets, and chat

## Admin login (pre-seeded)

| Field    | Value                 |
|----------|-----------------------|
| Email    | `miansabmi6@gmail.com` |
| Password | `12345six@`           |

After login, open **Admin** in the navigation bar.

## Quick start

### Requirements

- Node.js 18+

### Install

```bash
npm run install:all
```

### Run development

```bash
npm run dev
```

- **App**: http://localhost:5173  
- **API**: http://localhost:3001  

### Production build

```bash
npm run build
npm start
```

Serve the `client/dist` folder behind your API or configure static hosting.

## Android APK (installed app)

A native **Android APK** is included. Build or rebuild:

```bash
npm run android:apk
```

**Ready APK (after build):** `Aviouter-debug.apk` in the project root, or  
`client/android/app/build/outputs/apk/debug/app-debug.apk`

See **[ANDROID_APK.md](./ANDROID_APK.md)** for install steps, server IP setup, and Play Store notes.

## Play Store / App Store

This repo ships a **responsive web app** and **Android APK** ready for:

1. **PWA** – add a manifest and service worker for installable web app
2. **Capacitor** – wrap `client/dist` for native Android/iOS builds
3. Store listing – category **Games / Casual**, emphasize **no real-money gambling**

## Tech stack

| Layer    | Technology        |
|----------|-------------------|
| Backend  | Node.js, Express, Socket.io, SQLite |
| Frontend | React, Vite       |
| Auth     | JWT, bcrypt       |

## Legal note

Virtual currency only. Comply with local laws and Google Play / Apple App Store policies. Do not label the app as real-money gambling.

## Project structure

```
Aviouter/
├── client/          # React UI (English)
├── server/          # API + game engine + WebSockets
├── package.json     # Root scripts
└── README.md
```
