// ============================================================
// tiles.js
// Tile generation, shuffling, and tile property utilities
// ============================================================

// ── Tile ID format ────────────────────────────────────────────
// Suited:  wan1_0 .. wan9_3, tong1_0 .. tong9_3, suo1_0 .. suo9_3
// Honours: east_0 .. east_3, south_0..3, west_0..3, north_0..3
//          zhong_0..3, fa_0..3, bai_0..3
// Bonus:   spring_0, summer_0, autumn_0, winter_0
//          plum_0, orchid_0, chrysanthemum_0, bamboo_b_0

export const SUITS    = ['wan', 'tong', 'suo']
export const WINDS    = ['east', 'south', 'west', 'north']
export const DRAGONS  = ['zhong', 'fa', 'bai']
export const SEASONS  = ['spring', 'summer', 'autumn', 'winter']
export const FLOWERS  = ['plum', 'orchid', 'chrysanthemum', 'bamboo_b']
export const BONUS    = [...SEASONS, ...FLOWERS]

// Seat wind order (counterclockwise in HK mahjong)
export const SEAT_ORDER = ['east', 'south', 'west', 'north']

// Bonus tile → seat number mapping (for 正花/正季 scoring)
export const BONUS_SEAT_NUMBER = {
  spring: 1, plum: 1,
  summer: 2, orchid: 2,
  autumn: 3, chrysanthemum: 3,
  winter: 4, bamboo_b: 4,
}

// Seat → seat number
export const SEAT_NUMBER = { east: 1, south: 2, west: 3, north: 4 }

// ── Generate full 144-tile set ────────────────────────────────
export function generateTiles() {
  const tiles = []

  // Suited tiles: 3 suits × 9 values × 4 copies = 108
  SUITS.forEach(suit => {
    for (let n = 1; n <= 9; n++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push(`${suit}${n}_${copy}`)
      }
    }
  })

  // Honour tiles: 7 types × 4 copies = 28
  ;[...WINDS, ...DRAGONS].forEach(id => {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push(`${id}_${copy}`)
    }
  })

  // Bonus tiles: 8 tiles × 1 copy each = 8
  BONUS.forEach(id => {
    tiles.push(`${id}_0`)
  })

  return tiles // 144 total
}

// ── Fisher-Yates shuffle ──────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Parse a tileId into properties ───────────────────────────
export function parseTile(tileId) {
  if (!tileId) return null
  const base = tileId.replace(/_\d+$/, '').replace(/_b$/, '_b') // keep bamboo_b intact

  // Bonus
  if (BONUS.includes(base)) {
    return {
      tileId,
      category: 'bonus',
      base,
      seatNumber: BONUS_SEAT_NUMBER[base],
    }
  }

  // Winds
  if (WINDS.includes(base)) {
    return { tileId, category: 'honour', type: 'wind', base, wind: base }
  }

  // Dragons
  if (DRAGONS.includes(base)) {
    return { tileId, category: 'honour', type: 'dragon', base, dragon: base }
  }

  // Suited
  const match = tileId.match(/^(wan|tong|suo)(\d)_\d$/)
  if (match) {
    return {
      tileId,
      category: 'suited',
      suit: match[1],
      number: parseInt(match[2]),
      base: `${match[1]}${match[2]}`,
      isTerminal: parseInt(match[2]) === 1 || parseInt(match[2]) === 9,
    }
  }

  return null
}

// ── Tile base (strip copy suffix) ────────────────────────────
export function tileBase(tileId) {
  return tileId.replace(/_\d+$/, '')
}

// ── Check if tile is a bonus tile ────────────────────────────
export function isBonus(tileId) {
  const base = tileBase(tileId)
  return BONUS.includes(base)
}

// ── Check if tile is an honour ────────────────────────────────
export function isHonour(tileId) {
  const base = tileBase(tileId)
  return [...WINDS, ...DRAGONS].includes(base)
}

// ── Check if tile is a terminal (1 or 9) ─────────────────────
export function isTerminal(tileId) {
  const t = parseTile(tileId)
  return t?.category === 'suited' && (t.number === 1 || t.number === 9)
}

// ── Check if terminal or honour ───────────────────────────────
export function isTerminalOrHonour(tileId) {
  return isTerminal(tileId) || isHonour(tileId)
}

// ── Get next seat counterclockwise ────────────────────────────
export function nextSeat(seat) {
  const i = SEAT_ORDER.indexOf(seat)
  return SEAT_ORDER[(i + 1) % 4]
}

// ── Get seat after N steps counterclockwise ───────────────────
export function seatAfter(seat, steps) {
  const i = SEAT_ORDER.indexOf(seat)
  return SEAT_ORDER[(i + steps) % 4]
}
