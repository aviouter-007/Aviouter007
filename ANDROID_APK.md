# Aviouter — Android APK build guide

The mobile app is a **native Android shell** (Capacitor) around the same game UI. The **backend must run on a PC or server** — the APK connects over Wi‑Fi.

## Requirements

1. **Node.js 18+**
2. **Android Studio** (includes JDK & Android SDK)
   - Download: https://developer.android.com/studio
3. During install, enable **Android SDK** and **SDK Build-Tools**

## One-time setup

```powershell
cd c:\Users\IIC\Videos\Aviouter
npm run install:all
cd client
npm install
npx cap add android
```

If `android` folder already exists, skip `cap add android`.

## Build debug APK

```powershell
cd c:\Users\IIC\Videos\Aviouter
npm run android:apk
```

APK output:

```
client\android\app\build\outputs\apk\debug\app-debug.apk
```

Copy this file to your phone and install (enable “Install unknown apps” if asked).

## Open in Android Studio (optional)

```powershell
npm run android:open
```

Then **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## Run backend for the phone

On your PC:

```powershell
cd c:\Users\IIC\Videos\Aviouter
npm run start
```

Find your PC **LAN IP** (same Wi‑Fi as phone):

```powershell
ipconfig
```

Look for **IPv4 Address** (e.g. `192.168.1.5`).

## Configure the app on phone

1. Install `app-debug.apk`
2. Open **Aviouter**
3. On login screen, set **Server connection** to:
   `http://YOUR_PC_IP:3001`  
   Example: `http://192.168.1.5:3001`
4. Tap **Save server URL**
5. Sign in (admin: `miansabmi6@gmail.com` / `12345six@`)

Phone and PC must be on the **same Wi‑Fi**. Windows Firewall may need to allow port **3001**.

## Release APK (Play Store)

1. Create a signing key in Android Studio
2. Build **signed release** APK/AAB
3. Host the backend on a real server (HTTPS recommended)
4. Set production URL in app or `client/.env.production`:

```
VITE_API_URL=https://your-server.com
```

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Cannot connect | Check server running, IP correct, same Wi‑Fi, firewall |
| Gradle fails | Open project in Android Studio, let it sync SDK |
| `gradlew.bat` not found | Run `npx cap add android` in `client` folder |
