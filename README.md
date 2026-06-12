# Aula POS — Mobile (Expo / React Native)

A mobile point-of-sale + stock companion for the **Aula ERP** (the `Backend/` API and
`Frontend/` web app in this repo). Built with **Expo SDK 56**, expo-router, a glassmorphism
design system, an offline-first SQLite store, and barcode/QR scanning + label printing.

It deliberately mirrors the web app: same REST API, same permission grants, same visual
language — re-imagined for a cashier / sales-rep on a phone.

---

## The six requirements & where they live

| # | Requirement | Implementation |
|---|-------------|----------------|
| **1** | Uses the **Backend** API | `src/lib/api/client.ts` (bearer auth, CSRF, error envelope) + `src/lib/api/endpoints.ts` (every `/api/v1/*` route the app calls: auth, entities, pos, carts, sales-returns, inventory). |
| **2** | Mobile view of the **Frontend** | A 5-tab app — **Home / Sell (POS) / Carts / Returns / Stock** — plus Product detail, Labels and Settings, redesigned for touch. Mirrors the web POS / Sepet / İadeler / Stock screens. |
| **3** | **Offline** local DB + ordered sync | SQLite (`src/lib/db/*`) caches the catalogue + stock; an **outbox** queues every sale. `src/lib/sync/*` drains the outbox **sequentially (FIFO)** with stable Idempotency-Keys when connectivity returns. |
| **4** | **Barcode/QR** → cart, stock control, label printing | `src/components/ScannerSheet.tsx` (expo-camera), resolve in `src/lib/pos/resolve.ts` (offline cache → `/pos/lookup`), stock via `/inventory/on-hand`, label printing via `src/lib/barcode/*` (bwip-js + expo-print). |
| **5** | **Same permission logic** | `src/lib/auth/permissions.ts` ports the backend's `grantMatches` / grant strings verbatim. Tabs, buttons and screens gate on the grants from `GET /auth/me` (e.g. `pos:checkout`, `salesReturn:create`). |
| **6** | Fast, **glass-morph**, battery-friendly | `expo-glass-effect` (iOS) + `expo-blur` (Android) glass surfaces using the web app's exact tokens; Reanimated worklets, `expo-image` caching, debounced search, lazy SQLite, sequential (not chatty) sync. |

---

## Running it

```bash
cd mobile-app/aula-crm-mobile
npm install
npx expo start          # then press a / i, or scan the QR with Expo Go
```

> Camera barcode scanning, SQLite, secure storage and the glass blur all work in **Expo Go**
> on SDK 56 — no custom dev build required.

### Point the app at the backend

1. Start the backend (`cd Backend && npm run dev`, default `http://localhost:4000`).
2. The app's default API base URL is `http://localhost:4000` (see `app.json → extra.defaultApiBaseUrl`).
3. **On a physical device**, `localhost` is the phone, not your machine — open the login
   screen's **Server** field (or Settings → Backend) and enter your computer's LAN IP, e.g.
   `http://192.168.1.20:4000`. It's saved in SecureStore.

### Signing in

- **Demo personas** (one tap): Admin / Manager / Sales Rep / Accountant — these mint a real
  bearer token from the seeded backend (`AULA_DEV_AUTH`), so the whole permission system is live.
- **Email + password** (with TOTP if the account has 2FA enabled).

Each role sees a different app: a Sales Rep gets Sell/Carts/Returns/Stock; an Accountant
without `pos:checkout` won't see the Sell tab — exactly as the backend would enforce it.

---

## Architecture

```
src/
  app/                       # expo-router routes (file-based)
    _layout.tsx              # providers: Theme -> Auth -> Sync; navigation Stack
    index.tsx                # auth gate (-> tabs or login)
    login.tsx                # credentials + personas + server URL
    (tabs)/                  # Home . Sell(POS) . Carts . Returns . Stock + glass tab bar
    product/[id].tsx         # detail + per-warehouse stock + barcode + print
    cart/[id].tsx            # cart editor (resume/checkout)
    returns/new.tsx          # return composer
    labels.tsx . settings.tsx
  lib/
    api/      client.ts, endpoints.ts          # the Backend contract
    auth/     AuthProvider.tsx, permissions.ts # session + ported grant logic
    db/       schema, database, products, outbox  # SQLite offline store
    sync/     engine.ts, SyncProvider.tsx      # connectivity-driven ordered sync
    barcode/  check-digit, generate, printLabel
    theme/    tokens.ts, ThemeProvider.tsx     # glassmorphism palette (from globals.css)
    hooks/    useReference, useDebounce, useSaleCart
    pos/      resolve.ts                        # scan -> product (offline-first)
  components/  Screen, ScannerSheet, BarcodeView, GlassTabBar, SyncPill,
               pos/{LineItemRow,PaymentSheet}, ui/{Glass,Card,Button,Input,...}
```

### Offline-first sync (requirement 3, in detail)

- **Reads** — `pullCatalog()` caches products, branches, warehouses, dealers, accounts and
  on-hand stock into SQLite on login / reconnect, so scanning, search and stock work offline.
- **Writes** — every sale (`pos.checkout`, `cart.create/checkout`, `return.create/post`) is
  written to the **`outbox`** table first with a stable **Idempotency-Key**, then replayed
  **one-at-a-time in order** by `pushOutbox()`. A network/5xx failure re-queues and pauses the
  drain; a 4xx is surfaced in **Settings → Sync queue** to retry or discard. The Idempotency-Key
  means a retry can never double-charge (the backend's POS service dedupes on it).
- **Triggers** — `expo-network` (reconnect), `AppState` (foreground), post-login, and after
  each queued mutation. The header **SyncPill** shows Offline / queued / Syncing / Synced.

### Auth (requirement 5)

`POST /auth/login` either returns a JWT (persona path) or sets the `aula_session` cookie
(credential path). The client uses **`Authorization: Bearer`** (the backend checks it first);
for the credential path it recovers the token from `Set-Cookie` (which React Native exposes).
`GET /auth/me` provides `grants` + `screens`; `permissions.ts` evaluates them with the
backend's exact `grantMatches` wildcard semantics (`*`, `entity:*`, `*:verb`).

---

## Tech stack

Expo SDK 56 · React Native 0.85 · expo-router · React Compiler · Reanimated 4 ·
expo-camera (scan) · expo-sqlite (offline) · expo-secure-store (token) · expo-network (sync) ·
expo-glass-effect + expo-blur (glass) · expo-print + bwip-js (labels) · react-native-svg
(on-screen barcodes) · expo-image (cached images).

## Notes / limitations

- POS **shifts** and the saved-**carts list** are server resources (need connectivity); the
  sale checkout itself is always offline-safe via the outbox.
- Glass uses native Liquid Glass on iOS 26+, and `expo-blur` (`dimezisBlurViewSdk31Plus`) on
  Android / older iOS, with a translucent fallback below SDK 31.
