# Iris

Tablet-first POS and inventory receiving app for iOS/Android. Point the camera at a product and Iris uses OpenAI vision to identify it, extract details, and add it to your inventory or sale ticket — no barcode scanning required.

## What it does

**Receiving mode** — Create purchase orders, then scan incoming products one by one. Iris identifies each item via AI, extracts brand, size, category, and description, generates a semantic embedding for future duplicate detection, and logs it against the open PO. Items can be reviewed and confirmed before the PO is closed.

**Sale mode** — A checkout-style ticket. Scan or select items from inventory to build a ticket, then process cash or card payment.

## Stack

| | |
|---|---|
| **App** | Expo SDK 54, React Native 0.81, expo-router, TypeScript |
| **Styling** | NativeWind 4, Tailwind CSS, landscape-only orientation |
| **Backend** | Express (Node ESM), deployable to Vercel |
| **AI** | OpenAI GPT-4 Vision (product identification), Roboflow (CLIP embeddings, object detection) |
| **Database** | Supabase (Postgres + Storage + RLS) |

## Project structure

```
app/              # Expo Router screens
components/       # UI components (camera, panels, ticket, payment, sheets)
lib/              # Supabase client, types, hooks, SQL migrations, utilities
backend/          # Express API server
  routes/
    receive-item.js       # POST /ai/receive-item — vision + product extraction
    generate-embedding.js # POST /ai/generate-embedding — CLIP embedding via Roboflow
    detect-items.js       # POST /ai/detect-items — object detection
    admin.js              # Admin/cleanup utilities
```

## Setup

### 1. Install dependencies

```bash
npm install
cd backend && npm install
```

### 2. Environment variables

Create `.env` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

Create `backend/.env`:

```
OPENAI_API_KEY=your_openai_key
ROBOFLOW_API_KEY=your_roboflow_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PORT=3000
```

### 3. Database

Run the migrations in `lib/` against your Supabase project (in order by filename). The main schema is in `lib/database.sql`.

### 4. Run

Start the backend:

```bash
cd backend && npm run dev
```

Start the app (requires a development build — Expo Go won't work due to native camera dependencies):

```bash
npx expo run:ios   # or run:android
```

## Deploying the backend

The backend is set up for Vercel. `backend/vercel.json` routes all requests through `api/index.js`. Set the same environment variables in your Vercel project settings, then update `EXPO_PUBLIC_BACKEND_URL` in the app to point at your deployment.

## Notes

- The app is locked to landscape orientation and optimized for iPad.
- Duplicate detection uses cosine similarity on CLIP embeddings stored in Supabase — when a previously seen product is scanned again, Iris matches it rather than creating a new inventory entry.
- The Expo app slug/name in `app.json` still reads `test-tempo` from an earlier name — rename if needed before submitting to the App Store.
