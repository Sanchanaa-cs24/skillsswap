# SkillSwap

SkillSwap is a premium-style mentoring and peer-learning app built with Expo, React Native, TypeScript, and an Express API.

## Features

- Register and login with persisted auth
- Profile onboarding and profile editing
- Discover mentors and learners with search and filters
- Connect, save, and book member sessions
- Session status management and calendar export
- Community events, notifications, and message threads
- Learning progress tracking
- Mobile web deployment on Vercel
- Expo development build support for Android and iOS

## Stack

- Frontend: Expo, React Native, TypeScript
- Backend: Node.js, Express
- Persistence: MongoDB-ready backend with libSQL/Turso fallback
- Hosting: Railway for backend, EAS for native builds
- Native build tooling: EAS Build

## Prerequisites

- Node.js 18+
- npm
- Expo account for EAS builds
- Android phone or Android emulator for Android dev builds

## Install

```bash
cd /Users/dev/Desktop/SkillsSwap
npm install
```

The root install now also installs `backend/` dependencies automatically.

Create a local env file before mobile or hosted testing:

```bash
cp .env.example .env
```

## Local Development

Run the backend in one terminal:

```bash
npm run backend
```

Run the Expo app in another terminal:

```bash
npm start
```

If your Android phone is not on the same Wi-Fi as the computer, start Expo in tunnel mode instead:

```bash
npm run start:tunnel
```

This uses Expo's tunnel so the phone can connect over mobile data or a different network.

Backend URL:
- `http://localhost:4000`

Environment:
- Copy [.env.example](/Users/dev/Downloads/skillsswap-main%202/.env.example) to `.env`
- If `MONGODB_URI` is set, the backend uses MongoDB
- For local-only fallback, you can omit Turso credentials and the backend will use a local file database
- For hosted persistence, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- For MongoDB Atlas, set `MONGODB_URI` and optionally `MONGODB_DB_NAME`

Expo shortcuts:
- `a` opens Android
- `i` opens iOS simulator if full Xcode is installed
- `w` opens web

## Web

Start the web app locally:

```bash
npm run web
```

Current hosted web app:
- [https://skills-swap-kappa.vercel.app](https://skills-swap-kappa.vercel.app)

## Railway Backend

This repo is ready to use a Railway backend URL.

Frontend runtime:
- Set `EXPO_PUBLIC_API_BASE` to your Railway backend URL, for example `https://your-service.up.railway.app/api`
- Expo reads this from `.env` during local development and from build environment variables during EAS builds

Backend runtime:
- Railway should run the root project with [railway.json](/Users/dev/Downloads/skillsswap-main%202/railway.json)
- The deploy start command is `npm run start:backend`
- Health check path is `/api/health`

Recommended Railway variables:
- `MONGODB_URI`
- `MONGODB_DB_NAME=skillsswap`
- `AUTH_SECRET`
- `CORS_ORIGIN=*`

Recommended mobile build variable:
- `EXPO_PUBLIC_API_BASE=https://your-service.up.railway.app/api`

After Railway gives you the final domain, put it in:
- `.env` for local Expo runs
- EAS environment variables for Android builds

### Railway Setup Commands

1. Push this project to GitHub.
2. In Railway, create a new project from that GitHub repo.
3. Railway will detect [railway.json](/Users/dev/Downloads/skillsswap-main%202/railway.json) and run:

```bash
npm run start:backend
```

Use these Railway variables:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=skillsswap
AUTH_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=*
```

Optional variable:

```env
TOKEN_TTL_MS=604800000
```

When deployment finishes, copy your Railway backend URL. It will look like:

```text
https://your-service-name.up.railway.app
```

Confirm the backend is live:

```bash
curl https://your-service-name.up.railway.app/api/health
```

Expected response:

```json
{"ok":true}
```

### Local Expo With Railway Backend

Create `.env`:

```env
EXPO_PUBLIC_API_BASE=https://your-service-name.up.railway.app/api
```

Then start Expo:

```bash
npm install
npm run start:tunnel
```

### EAS Android Build Commands

Log in:

```bash
npx eas-cli login
```

Set the Android build environment variable in EAS:

```bash
npx eas-cli env:create --scope project --name EXPO_PUBLIC_API_BASE --value https://your-service-name.up.railway.app/api
```

Build an installable Android APK:

```bash
npx eas-cli build --platform android --profile preview
```

Build an Android development client:

```bash
npx eas-cli build --platform android --profile development
```

Build a production Android app:

```bash
npx eas-cli build --platform android --profile production
```

For the easiest phone-only install, use the `preview` profile first. This repo is configured to generate an APK for that profile in [eas.json](/Users/dev/Downloads/skillsswap-main%202/eas.json).

## Android Development Build

This project is already configured for EAS Android development builds.

Relevant config:
- [app.config.js](/Users/dev/Downloads/skillsswap-main%202/app.config.js)
- [eas.json](/Users/dev/Downloads/skillsswap-main%202/eas.json)

### 1. Log in to Expo

```bash
npx eas-cli login
```

### 2. Start an Android development build

```bash
npx eas-cli build --platform android --profile development
```

### 3. Install the build on Android

When the build finishes, EAS gives you an install link or APK download page. Open that link on your Android phone and install the app.

### 4. Start Metro for the dev client

After the app is installed:

```bash
npm run backend
```

In another terminal:

```bash
npm run start:dev-client
```

Then open the installed SkillSwap development build on the Android phone.

If the phone is not on the same Wi-Fi network as the computer, use tunnel mode:

```bash
npx expo start --dev-client --tunnel
```

For a phone-only experience with no computer needed after install, build a `preview` or `production` Android app with EAS and use the hosted API already configured in [src/api.ts](/Users/dev/Downloads/skillsswap-main%202/src/api.ts) and [app.json](/Users/dev/Downloads/skillsswap-main%202/app.json).

## iOS Notes

- Expo Go was not reliable for this project because of SDK compatibility on the test device.
- iOS development builds require Apple Developer access.
- If Apple blocks the account, use Android development builds or install full Xcode and run the iOS simulator locally.

## Demo Login

- Email: `demo@skillsswap.app`
- Password: `demo123`

## MongoDB

This project now supports MongoDB as the primary backend store.

Required environment variables:
- `MONGODB_URI`
- `MONGODB_DB_NAME` (optional, defaults to `skillsswap`)

Recommended flow:
- Create a MongoDB Atlas cluster
- Create a database user
- Add your IP to Atlas network access
- Copy the driver connection string into `.env` as `MONGODB_URI`
- Start the backend with `npm run backend`

The backend seeds the demo data automatically into MongoDB the first time it starts against an empty database.

## Scripts

- `npm start` starts Expo
- `npm run start:dev-client` starts Expo for a development build
- `npm run start:backend` starts the Express backend for Railway or local backend-only runs
- `npm run backend` starts the Express backend
- `npm run web` starts Expo web
- `npm run android` starts Expo Android flow
- `npm run ios` starts Expo iOS flow
- `npm run build:web` exports the web build

## Verification

Type check:

```bash
npx tsc --noEmit
```

Web build:

```bash
npm run build:web
```

## Troubleshooting

- If Expo prompts for a different port, accept it.
- If the backend is unreachable, make sure `npm run backend` is still running.
- If Android install is blocked, confirm the EAS build finished successfully and use the generated build page link.
- If iOS simulator commands fail on macOS, full Xcode is not active yet. Run Xcode once and switch the active developer directory if needed.
