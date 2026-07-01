# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow rule

After completing every task, always run:

```bash
git add -A && git commit -m '[description of what was built]' && git push origin main
```

Never leave work uncommitted.

## Testing rule

After building any game logic module, immediately write unit tests for it before moving to the next feature. Tests go in `src/engine/engine.test.js` and must be run with:

```bash
node src/engine/engine.test.js
```

All tests must pass before proceeding. Never build UI on top of untested game logic.

## Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

To run the game engine unit tests:

```bash
node src/engine/engine.test.js
```

No linter is configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in Firebase project credentials. All variables are prefixed `VITE_FIREBASE_`.

## Architecture

React + Vite SPA. No TypeScript — plain `.jsx`. No CSS files — all styling is done with inline JS style objects defined as `const S = { ... }` at the top of each component file.

### Data layer: Firebase

- `src/firebase/config.js` — initialises Firebase, exports `auth`, `db`, `googleProvider`
- `src/firebase/rooms.js` — all Firestore room logic: create, join, claim seat, set AI seat, subscribe (real-time `onSnapshot`)

Firestore collections:
- `users/{uid}` — profile: `{ uid, email, displayName, lang, createdAt, updatedAt }`
- `rooms/{id}` — game room: `{ roomCode, hostUid, status, seats, settings, createdAt, updatedAt }`
  - `seats` is a map keyed by wind (`east|south|west|north`), each `{ uid, name, lang, type:'human'|'ai', aiLevel? }`
  - `status`: `'waiting'` → `'playing'` → `'finished'`

### Auth / profile flow

`src/hooks/useAuth.js` is the single auth hook. It watches Firebase Auth state and loads the matching Firestore user profile. When `profile.lang` is null the app shows `ProfileSetupPage` (language not yet chosen) before anything else.

### Page routing

There is no router library. `App.jsx` holds a `page` state (`'lobby' | 'room'`) and conditionally renders pages. The render order in `App.jsx` is:

1. Loading spinner while Firebase auth resolves
2. `LoginPage` if no user
3. `ProfileSetupPage` if user has no `lang` set
4. `RoomPage` if `page === 'room'`
5. `LobbyPage` (default)

### i18n

`src/i18n/translations.js` exports a `t(lang, key)` helper and a translation map for `en` and `zh` (Traditional Chinese). All UI strings go through `t()`. Tile graphics always use Chinese characters regardless of language.

### Game settings (room defaults)

```js
{ minFaan: 3, scoringTable: 'half', limitValue: 64,
  claimTimeoutHours: 24, autoDiscard: true, rounds: 1,
  allow13orphans: true, allowHeavenly: true }
```

Scoring tables: `'half'` (半辣) or `'full'` (全辣). The `react-router-dom` dependency is installed but not used; routing is handled manually via the `page` state in `App.jsx`.

### Game Firebase layer (`src/firebase/game.js`)

Firestore sync for active game state. All mutating operations use `runTransaction` for atomicity.

**Private hands** live in a subcollection so players cannot see each other's tiles:
```
rooms/{roomId}/hands/{wind}  →  { hand: string[], exposedMelds: Meld[] }
```

**Shared game state** is written into the room document when `startGame` is called:
```
rooms/{roomId}.game    →  { dealer, prevailingWind, handsPlayed, scores }
rooms/{roomId}.hand    →  { wall, deadWall, discardPool, lastDiscard,
                             currentTurn, phase, claimDeadline, claims,
                             flowers, exposedMelds, handSizes, tilesLeft }
```

**`hand.phase` state machine:**
```
'discard' → (player discards) → 'claim' → (claims resolved, no winner) → 'draw'
         ↑                                                               ↓
         └──────────── (player discards) ──────────────────────────────┘
'draw'   → (kong declared) → 'draw_dead' → 'discard'
'claim'  → (win claimed) → 'finished'
'draw'   → (wall empty) → 'exhausted'
```

Added kong opens a rob-the-kong window by setting `phase = 'claim'` with `lastDiscard` pointing to the kong tile.

**Exports:** `startGame`, `subscribeToHand`, `discardTile`, `submitClaim`, `resolveClaims`, `drawTile`, `drawDeadWallTile`, `declareConcealedKong`, `declareAddedKong`, `getAvailableActions`.

`getAvailableActions(room, myHand, myExposedMelds, myWind)` is a pure function returning what the local player can do given the current phase.

### Game hook (`src/hooks/useGame.js`)

`useGame(roomId, myWind, room)` subscribes to the private hand subcollection and auto-resolves the claim window (fires `resolveClaims` when all non-discarders have submitted or `claimDeadline` has passed). Returns `{ myHand, myExposedMelds, myFlowers, actions, discard, claim, pass, draw, drawDead, concealedKong, addedKong }`.

## Game Engine (`src/engine/`)

Pure JavaScript modules, no React dependency — fully unit-testable. Custom test runner in `engine.test.js` (no external test framework).

### UI components

- **`src/components/tiles/MahjongTile.jsx`** — renders a single tile using Unicode Mahjong block (U+1F000). Props: `tileId` (tile ID string or `'back'`), `size` (`'sm'`=22×30 / `'md'`=28×40), `selected`, `highlighted` (red border), `onClick`, `count` (badge overlay for compressed pool). All tile glyphs are in the `GLYPH` map keyed by `tileBase(tileId)`.

- **`src/pages/GamePage.jsx`** — main in-game screen. Receives `{ room, myWind, game, lang, onBack }`. Layout (top to bottom, fills viewport height): 3 opponent rows → discard pool (flex-grows) → my hand → action bar. The action bar is fully context-driven by `getAvailableActions` output — it renders one of: draw button, discard phase (tile selection + special actions), claim phase (Win/Kong/Pong/Chow/Pass with chow-picker for multiple sequences), or a waiting state. Routing: `App.jsx` renders `GamePage` when `currentRoom.status === 'playing'`, `RoomPage` when `'waiting'`.

### Game engine (`src/engine/`)

Pure JavaScript modules, no React dependency — fully unit-testable. Custom test runner in `engine.test.js` (no external test framework).

- **tiles.js** — generates the 144-tile HK set (108 suited + 28 honours + 8 bonus tiles). Tile ID format: `wan1_0`, `east_3`, `spring_0`. Exports `SUITS`, `WINDS`, `DRAGONS`, `SEASONS`, `FLOWERS`, `SEAT_ORDER`, `BONUS_SEAT_NUMBER`, and utilities `parseTile`, `isBonus`, `isHonour`, `nextSeat`.
- **dealing.js** — Fisher-Yates shuffle, initial hand distribution (`dealHand`), dice rolling, dealer determination.
- **claims.js** — validates `canPong`, `canChow`, `canKongFromDiscard`, `canKongConcealed`; resolves competing claims via `resolveClaims`.
- **winning.js** — detects winning 14-tile hands: standard (4 melds + 1 pair), Seven Pairs, Thirteen Orphans, Nine Gates, All Kongs. Exports `isWinningHand`, `isConcealed`.
