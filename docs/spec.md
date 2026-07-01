# 香港麻雀 Hong Kong Mahjong — Technical Specification
**Version 1.1 | Project: hk-mahjong**
**Stack: React + Vite + Vercel (frontend) | Firebase Auth + Firestore + Realtime Database (backend)**

---

## 1. Project Overview

A web-based async multiplayer Hong Kong-style Mahjong game supporting 1–4 human players across any combination of devices (desktop, tablet, mobile). AI players fill empty seats. Each human player has their own account, chooses their language, and takes their turn whenever they open the app.

Designed for a small circle of friends. No public room browser — games are started by a host who shares an invite link. Spectators can watch and participate in chat.

### 1.1 Player Modes
| Mode | Humans | AI |
|---|---|---|
| Solo | 1 | 3 |
| Duo | 2 | 2 |
| Three-player | 3 | 1 |
| Full human | 4 | 0 |

### 1.2 Language Support
- Each human player selects their own UI language: **Traditional Chinese** or **English**
- All mahjong tiles always display Chinese characters regardless of language setting
- AI players have no language preference

---

## 2. Tile Set

Total: **144 tiles**

### 2.1 Suited Tiles (108 tiles)
| Suit | Display | Colour Strip | Tiles | Count |
|---|---|---|---|---|
| 萬 Characters | Chinese numeral + 萬 | Red #c0392b | 一萬 to 九萬 × 4 | 36 |
| 筒 Circles | Rings (SVG) | Blue #1a6ab5 | 一筒 to 九筒 × 4 | 36 |
| 索 Bamboo | Bean sticks (SVG) | Green #1e8c4e | 一索 to 九索 × 4 | 36 |

**一索 special case:** displays as a bird (sparrow), not sticks.

### 2.2 Honour Tiles (28 tiles)
| Tile | Display | Colour Strip |
|---|---|---|
| 東風 | 東 | Brown #7c5c1e |
| 南風 | 南 | Brown #7c5c1e |
| 西風 | 西 | Brown #7c5c1e |
| 北風 | 北 | Brown #7c5c1e |
| 紅中 | 中 (red) | Red #c0392b |
| 發財 | 發 (green) | Green #1e8c4e |
| 白板 | Blank + blue border outline | Grey #bbbbbb |

Each × 4 = 28 tiles.

### 2.3 Bonus Tiles (8 tiles — not part of hand)
| Set | Tiles |
|---|---|
| Seasons 季 | 春(1) 夏(2) 秋(3) 冬(4) |
| Flowers 花 | 梅(1) 蘭(2) 菊(3) 竹(4) |

Flower/season number corresponds to seat: East=1, South=2, West=3, North=4.

### 2.4 Tile Graphics
- Left colour strip: 8px wide, suit-specific colour
- 萬: Chinese numeral (red) stacked above 萬 (blue), same font size
- 筒: SVG double-ring circles, count matches tile number, colour varies by tile
- 索: SVG bean sticks in tricolour arrangement (see layout spec below)
- Honours: single or double character, large, colour-coded
- 白板: empty tile with blue rectangle border
- Bonus tiles: emoji + season/flower name + number

#### 索 Layout Reference
| Tile | Layout |
|---|---|
| 一索 | Bird (sparrow) |
| 二索 | 1 top, 1 bottom |
| 三索 | 1 top, 2 bottom |
| 四索 | 2×2 grid |
| 五索 | 3 top, 2 bottom (left + right, skip middle) |
| 六索 | 3×2 grid |
| 七索 | 1 top, 3 middle, 3 bottom |
| 八索 | 4×2 grid (4 top, 4 bottom) |
| 九索 | 3×3 grid |

---

## 3. Game Rules

### 3.1 Setup
- 4 players: East (莊/Dealer), South, West, North
- **Seating:** Players freely choose their seat (East/South/West/North) when joining via invite link. First come first served.
- **Who goes first:** Once all seats are filled, a simulated dice roll determines the starting dealer. Each player "rolls" two dice (animated); highest roll becomes the actual East (dealer) for round 1. Wind positions rotate from that point counterclockwise.
- East deals first; East position rotates after each non-dealer win
- Prevailing wind starts at East, advances after all 4 players have held East seat

### 3.2 Dealing
- Shuffle all 144 tiles
- Each player draws 13 tiles; East draws 14 (one extra, plays first)
- Draw any bonus tiles immediately, replace from wall, reveal publicly

### 3.3 Turn Structure
```
Player's turn:
  IF tiles in wall:
    Draw 1 tile from wall
    IF drawn tile is bonus → reveal, draw replacement, repeat
    Player may: Declare 槓 (Kong) → draw replacement → continue
    Player must: Discard 1 tile → place in shared pool
  ELSE:
    荒牌 (Draw — no winner)

After discard:
  Claim window opens (see 3.4)
  IF no claim → next player's turn
```

### 3.4 Claim Priority & Async Rules
Claims on a discarded tile follow strict priority:

| Priority | Claim | Who | Condition |
|---|---|---|---|
| 1 (highest) | 胡 Win | Any player | Completes winning hand |
| 2 | 槓 Kong | Any player | Has 3 matching tiles in hand |
| 3 | 碰 Pong | Any player | Has 2 matching tiles in hand |
| 4 (lowest) | 吃 Chow | Next player only | Forms sequence with 2 hand tiles |

**Async claim resolution:**
- After a discard, all eligible claimants have **24 hours** (configurable per room) to submit their claim
- System resolves by priority: highest priority claim wins regardless of submission time
- If equal priority claims (e.g. two players can 胡): seat order from discarder determines winner
- If no claim submitted within window → auto-pass, next player draws

**AI claim resolution:** Instant. AI decides immediately when it is eligible to claim.

### 3.5 Kong (槓) Rules
| Type | Description |
|---|---|
| 明槓 Exposed Kong | Pong an opponent's discard, then upgrade with 4th tile |
| 暗槓 Concealed Kong | Draw 4th matching tile from wall; all face down |
| 加槓 Added Kong | Add 4th tile to existing Pong meld |

After any Kong: draw replacement tile from dead wall.

**搶槓胡 Robbing the Kong:** If a player adds a tile to an existing Pong (加槓) and another player can win with that tile → that player may declare 胡 (overrides the Kong).

### 3.6 Winning
A winning hand consists of:
- **Standard:** 4 melds (sequences or triplets/quads) + 1 pair = 14 tiles
- **Special hands:** see Section 5

A win requires meeting the **minimum faan threshold** (room setting, default 3 faan). Bonus tiles (flowers/seasons) do NOT count toward minimum.

### 3.7 Draw Conditions (荒牌)
- Wall exhausted with no winner
- No one scores; dealer retains East position; redeal

---

## 4. Scoring System

### 4.1 Faan Table

**Source: mahjonggame.hk — adopted as the authoritative reference for this app (Patrick's mahjong-playing friend deferred to this source as more reliable than his own knowledge).**

#### Standard Hands
| Hand | Chinese | Faan |
|---|---|---|
| All Chows (no triplets) | 平糊 | 1 |
| All Triplets | 對對胡 | 3 |
| Half Flush (one suit + honours) | 混一色 | 3 |
| Voided Suit (missing one of 萬/筒/索 entirely) | 缺一門 | 2 |
| Full Flush (one suit only, no honours) | 清一色 | 7 |
| Small Three Dragons | 小三元 | 5 |
| Great Three Dragons | 大三元 | 8 |
| Small Four Winds | 小四喜 | 8 |
| Great Four Winds | 大四喜 | 10 |
| All Honours | 字一色 | 10 |
| Seven Pairs | 七對子 | 4 |
| Mixed Terminals & Honours | 混么九 | 1 |

#### Bonus Faan
| Bonus | Chinese | Faan |
|---|---|---|
| Self-draw | 自摸 | 1 |
| Concealed hand (win by discard, no exposed melds) | 門前清 | 1 |
| Dragon pung/kong (中/發/白) | 箭刻 | 1 each |
| Seat wind pung/kong | 門風 | 1 |
| Prevailing wind pung/kong | 圈風 | 1 |
| No flowers/seasons at all | 無花 | 1 |
| Own flower (seat match) | 正花 | 1 each |
| Own season (seat match) | 正季 | 1 each |
| All 4 flowers | 齊花 | 1 |
| All 4 seasons | 齊季 | 1 |
| Last tile from wall | 海底撈月 | 1 |
| Last tile by discard | 河底撈魚 | 1 |
| Win after Kong draw | 槓上開花 | 1 |
| Robbing the Kong | 搶槓胡 | 1 |
| Double Kong | 槓上槓 | 2 |

**Note:** Faan stack/accumulate — e.g. 門前清 (1) + 對對胡 (3) + 清一色 (7) = 11 faan. Limit hands (滿貫) below do not stack with other faan — they always score the table maximum regardless of other qualifying hands.

### 4.2 Limit Hands (滿貫)
Limit hands score the table maximum regardless of other faan. No stacking with other faan types.

| Hand | Chinese |
|---|---|
| Thirteen Orphans | 十三么 |
| All Kongs | 十八羅漢 |
| Heavenly Hand (dealer wins with starting 14 tiles) | 天胡 |
| Earthly Hand (non-dealer wins on their first draw, before anyone has claimed) | 地胡 |

**Engine note:** 九蓮寶燈 (Nine Gates) is supported in our win-detection engine (`winning.js`) but is not listed on the reference site's table — treat as an optional/house-rule limit hand, toggle via room settings if desired.

### 4.3 Faan → Points Conversion

**Room setting:** Host selects Full Spicy (全辣) or Half Spicy (半辣) before game starts.

**Full Spicy (全辣):** Points = 2^faan

| Faan | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10+ |
|---|---|---|---|---|---|---|---|---|---|---|
| Points | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | Limit |

**Half Spicy (半辣):** Same as full up to 4 faan; above 4, doubles every 2 faan; odd faan = 1.5× previous.

**Limit hand:** Room-configurable maximum (default: 64 points).

### 4.4 Payment Rules

**Win by discard (食糊):**
- Discarder pays winner: 2× base points
- Other 2 players pay winner: 1× base points each

**Win by self-draw (自摸):**
- All 3 opponents pay winner: 2× base points each

**Dealer modifier:**
- If winner is East (dealer): all payments doubled
- If East is a losing player: East pays double

**Example:** 3 faan, win by discard (non-dealer wins from non-East discarder)
- Base = 8 points
- Discarder pays: 16 points
- Other 2 pay: 8 points each
- Total received: 32 points

---

## 5. Special Hands Detail

### 5.1 Thirteen Orphans (十三么)
One each of: 一萬 九萬 一筒 九筒 一索 九索 東 南 西 北 中 發 白 + any duplicate of these 13.
Must be fully concealed.

### 5.2 Nine Gates (九蓮寶燈)
1112345678999 of one suit + any one tile of same suit.
Must be fully concealed.

### 5.3 Seven Pairs (七對子)
Seven distinct pairs. No identical quads allowed as two pairs.

### 5.4 All Kongs (十八羅漢)
Four Kongs + one pair = 18 tiles.

---

## 6. Room Settings

Configured by host when creating a room:

| Setting | Options | Default |
|---|---|---|
| Min faan to win | 1 / 2 / 3 / 4 | 3 |
| Scoring table | Full Spicy / Half Spicy | Half Spicy |
| Limit hand value | 32 / 64 / 128 points | 64 |
| Claim timeout | 12h / 24h / 48h / 72h | 24h |
| Auto-discard on timeout | Yes / No | Yes |
| Number of rounds | 1 round (East only) / 2 rounds / 4 rounds | 1 round |
| Allow 十三么 | Yes / No | Yes |
| Allow 天糊/地糊 | Yes / No | Yes |

---

## 7. UI Layout

### 7.1 Overall Structure (all devices, portrait and landscape)

```
┌─────────────────────────────────────────────┐
│ HEADER: Room code | Round | Prevailing wind  │
├─────────────────────────────────────────────┤
│ OPPONENT ROW: Player North                  │
│   [hand count ×N] | [exposed melds] | [花]  │
├─────────────────────────────────────────────┤
│ OPPONENT ROW: Player West                   │
├─────────────────────────────────────────────┤
│ OPPONENT ROW: Player East                   │
├─────────────────────────────────────────────┤
│ DISCARD POOL (shared, compressed view)      │
│   一萬×3  五筒×2  東×1  [六筒 ← LAST]      │
├─────────────────────────────────────────────┤
│ YOUR HAND (face up, interactive)            │
│   [tiles...] | [exposed melds] | [花]       │
│   [胡] [碰] [吃] [槓] [出牌 Discard]       │
└─────────────────────────────────────────────┘
```

### 7.2 Tile Display Rules
- **Your hand:** large tiles (40×54px), tap to select, tap again to deselect
- **Opponent hands:** face-down tile backs + count badge only
- **Exposed melds:** medium tiles (28×38px), face up, for all players
- **Discard pool:** compressed — each unique tile shown once with count badge (×N)
- **Last discard:** highlighted with red border + 最新出牌 label, slightly enlarged
- **Bonus tiles:** shown in each player's row, face up, emoji + name

### 7.3 Action Buttons
Buttons shown only when action is valid for current game state:
- **胡 Win** — always shown when player has winning hand
- **碰 Pong** — shown when last discard can be ponged
- **吃 Chow** — shown when last discard can form sequence (next player only)
- **槓 Kong** — shown when Kong is possible (from hand or claiming discard)
- **出牌 Discard** — shown when player has selected a tile and it is their turn

Button labels: player's chosen language (Chinese or English).

### 7.4 Chat
- WhatsApp-style chat panel accessible during game via a floating chat button
- Notification dot appears on button when new messages arrive while panel is closed
- All players in the room see the same chat (humans + spectators)
- Messages show player name + wind badge e.g. "東 Patrick: 哈哈！"
- Emoji support
- Spectators can chat but are labelled "👁 Spectator"
- Stored in Firebase Realtime Database (lower latency than Firestore for chat)
- Messages persist for the duration of the game

### 7.5 Rules Reference Panel
- Floating **?** button always visible during gameplay
- Opens a slide-up/side panel with collapsible sections:
  - How to play (turn structure)
  - Valid winning hands
  - 番 scoring table
  - Special hands (十三么, 七對子 etc.)
  - Payment rules
- Fully bilingual — matches player's own language setting
- Non-blocking — game state is preserved while panel is open

### 7.6 Notifications
- App badge / push notification when it is the player's turn
- In-app indicator: "Your turn" banner
- Countdown timer showing claim window remaining time
- Notification when a new chat message arrives

---

## 8. Firestore Data Schema

### 8.1 Collection: `rooms`
```
rooms/{roomId}
  roomCode: string (4-char, e.g. "DWLJ")
  inviteUrl: string (full shareable URL)
  hostUid: string
  status: "waiting" | "rolling_dice" | "playing" | "finished"
  waitUntil: timestamp (auto-start time; null = host starts manually)
  settings: {
    minFaan: number
    scoringTable: "full" | "half"
    limitValue: number
    claimTimeoutHours: number
    autoDiscard: boolean
    rounds: number
    allow13orphans: boolean
    allowHeavenly: boolean
  }
  seats: {
    east:  { uid: string | "AI", name: string, lang: "zh" | "en", type: "human" | "ai", aiLevel?: string }
    south: { uid: string | "AI", name: string, lang: "zh" | "en", type: "human" | "ai", aiLevel?: string }
    west:  { uid: string | "AI", name: string, lang: "zh" | "en", type: "human" | "ai", aiLevel?: string }
    north: { uid: string | "AI", name: string, lang: "zh" | "en", type: "human" | "ai", aiLevel?: string }
  }
  spectators: { [uid]: { name: string, lang: string } }
  diceRolls: { east: number, south: number, west: number, north: number } | null
  actualDealer: "east" | "south" | "west" | "north" | null
  createdAt: timestamp
  updatedAt: timestamp
```

### 8.2 Collection: `games`
```
games/{gameId}
  roomId: string
  roundNumber: number
  prevailingWind: "east" | "south" | "west" | "north"
  dealerSeat: "east" | "south" | "west" | "north"
  status: "dealing" | "playing" | "claiming" | "finished" | "draw"
  wall: string[]           (remaining tile IDs, ordered)
  deadWall: string[]       (replacement tiles for Kong)
  discardPool: {
    tileId: string
    discardedBy: seat
    timestamp: timestamp
  }[]
  lastDiscard: {
    tileId: string
    discardedBy: seat
    timestamp: timestamp
    claimDeadline: timestamp
  } | null
  currentTurn: seat
  phase: "draw" | "discard" | "claim_window" | "resolving"
  scores: { east: number, south: number, west: number, north: number }
  hands: {              (subcollection — each player sees only their own)
    east:  { tiles: string[], exposed: meld[], flowers: string[] }
    south: { tiles: string[], exposed: meld[], flowers: string[] }
    west:  { tiles: string[], exposed: meld[], flowers: string[] }
    north: { tiles: string[], exposed: meld[], flowers: string[] }
  }
  handCounts: { east: number, south: number, west: number, north: number }
  claims: {             (temporary, cleared after resolution)
    [seat]: { type: "win"|"kong"|"pong"|"chow", tiles: string[], timestamp: timestamp }
  }
  winner: {
    seat: seat
    hand: string[]
    fanList: { name: string, faan: number }[]
    totalFaan: number
    payment: { east: number, south: number, west: number, north: number }
  } | null
  startedAt: timestamp
  updatedAt: timestamp
```

### 8.3 Tile ID Format
`{suit}{number}_{copy}` e.g. `wan1_0`, `wan1_1`, `wan1_2`, `wan1_3`, `tong5_2`, `zhong_0`, `flower_spring_0`

### 8.4 Meld Format
```
{
  type: "chow" | "pong" | "kong_exposed" | "kong_concealed" | "kong_added"
  tiles: string[]
  claimedFrom: seat | null
}
```

### 8.6 Realtime Database: `chat/{roomId}/messages`
```
{
  messageId: {
    uid: string
    name: string
    wind: "east" | "south" | "west" | "north" | "spectator"
    text: string
    timestamp: number (Unix ms)
  }
}
```
Chat stored in Firebase Realtime Database for low latency. Messages are kept for the life of the game only.
- Players can only read their own hand document
- Players can only write claims for their own seat
- Game state writes go through Cloud Functions (or host-client pattern)
- Room creation requires authenticated user

---

## 9. AI Behaviour

### 9.1 Easy AI
- Discards: random tile from hand
- Claims: only declares 胡 when hand is complete
- Never 吃, 碰, or 槓

### 9.2 Medium AI
- Discards: prefers isolated tiles (no connections to other hand tiles)
- Claims: 胡, 碰, 槓 when beneficial
- 吃: only if it forms a clear sequence toward a target hand
- No defensive awareness

### 9.3 Hard AI
- Discards: scores hand combinations, prioritises tiles least likely to complete the hand
- Defensive: avoids discarding tiles that opponents have shown interest in (碰/吃 history)
- Claims: full claim logic including 搶槓胡 awareness
- Tracks discard pool to estimate tile availability

### 9.4 AI Turn Execution
- AI turns resolve **instantly** (no simulated delay needed, but optional 1–2s cosmetic delay for UX)
- AI runs client-side on the browser that is currently "hosting" the game state sync
- If host disconnects, next human player's browser takes over AI execution on reconnect

---

## 10. Application Flow

### 10.1 Auth Flow
1. User opens app → Firebase Auth (email/password or Google)
2. User sets display name + language preference (stored in Firestore `users/{uid}`)

### 10.2 Lobby Flow

**Host creates game:**
1. Host taps "New Game"
2. Sets game settings (番数, scoring table, etc.)
3. Sets **wait time** — how long to wait for humans to join (15 min / 30 min / 1 hour / 2 hours / custom)
4. App generates a **shareable invite link** e.g. `hk-mahjong.vercel.app/join/DWLJ`
5. Host shares link via WhatsApp/iMessage/etc.

**Friends join:**
1. Friend clicks link → lands on seat selection screen
2. Sees countdown timer + available seats
3. Taps a seat to claim it (free choice — first come first served)
4. Waits for game to start

**Game starts when:**
- All expected human seats are filled → host can start immediately, OR
- Wait timer expires → AI fills any remaining empty seats → game starts automatically

**Spectators:**
- Can join via the same link after game has started
- See all public game state (discard pool, exposed melds, tile counts, scores)
- Cannot see any player's hidden hand
- Can participate in game chat
- Link shows "Game in progress — joining as spectator"

### 10.3 Game Turn Flow
```
[Player opens app]
  → Load game state from Firestore
  → IF it's player's turn AND phase = "draw":
      Draw tile (Firestore transaction)
      IF bonus tile: auto-reveal, draw replacement
      Show hand with new tile
      Player selects tile → taps 出牌 → Discard (Firestore write)
      Claim window opens
  → IF phase = "claim_window":
      Show last discard highlighted
      Show eligible action buttons (胡/碰/吃/槓/Pass)
      Player submits claim OR passes
  → IF phase = "resolving":
      Show result (who claimed, what)
  → IF not player's turn:
      Show current state, whose turn it is, time remaining
```

### 10.4 Win Flow
1. Player declares 胡
2. System validates hand (faan engine)
3. IF valid and meets min faan:
   - Calculate faan list
   - Calculate payments
   - Update scores
   - Show win screen with full faan breakdown
4. IF invalid (詐糊):
   - Penalty: player pays each opponent limit hand value
5. Next hand deals

---

## 11. Build Phases

| Phase | Scope | Dependencies |
|---|---|---|
| 1 | Firebase setup, Auth, user profiles, invite link, seat selection, wait timer | None |
| 2 | Tile rendering component (all 34 types, all sizes) | Phase 1 |
| 3 | Game engine: deal, draw, discard, 吃碰槓胡 validation, dice roll | Phase 2 |
| 4 | Firestore sync: real-time state, claim window, turn management, spectators | Phase 3 |
| 5 | Faan scoring engine (full calculation + payment) | Phase 3 |
| 6 | Win detection UI, score display, hand history | Phase 5 |
| 7 | AI players (Easy first, then Medium, then Hard) | Phase 3 |
| 8 | Chat (Firebase Realtime Database, all players + spectators) | Phase 4 |
| 9 | Rules reference panel (bilingual, always accessible) | Phase 4 |
| 10 | Polish: notifications, claim timer, mobile landscape prompt | Phase 4 |

---

## 12. Design Decisions & Edge Cases

| Decision | Resolution |
|---|---|
| Minimum faan | 3 (room configurable) |
| Flowers count to minimum | No |
| 詐糊 penalty | Pay each opponent limit value |
| 同時胡 (simultaneous win) | Seat order from discarder; first eligible wins |
| 荒牌 (draw) | No scoring; dealer keeps; redeal |
| 搶槓胡 | Allowed; overrides 加槓 only (cannot rob concealed Kong) |
| 十三么 | Allowed by default (room toggle) |
| 天糊/地糊 | Allowed by default (room toggle) |
| 雙風 scoring | Counts as 2 faan (both seat and round wind) |
| Scoring cap | Room-configurable limit (default 64 pts) |
| Timeout action | Auto-discard a random tile (configurable off) |
| Device switching | Supported — state in Firestore, any device loads current state |
| Tile graphics language | Always Chinese characters, regardless of UI language |
| Discard pool display | Compressed: unique tiles × count; exposed melds not included |
| Last discard | Red border highlight + 最新出牌 label |
| Room discovery | No public room list — invite link only |
| Seating | Players freely choose seat when joining (first come first served) |
| Who goes first | Simulated dice roll animation; highest roll = actual East dealer |
| Late joiners | Can join as spectators after game starts; same invite link |
| Spectators | View all public state; participate in chat; cannot see hidden hands |
| Chat | WhatsApp-style; Firebase Realtime Database; all players + spectators |
| Rules reference | Floating ? button; always accessible; bilingual; non-blocking |
| Wait timer | Host sets; AI fills empty seats when expired; game auto-starts |

---

*End of Specification v1.1*
*Next step: Phase 3 — Game engine (deal, draw, discard, 吃碰槓胡 validation, dice roll)*
