// ============================================================
// winning.js
// Win detection — checks if a hand is a valid winning hand
// Supports standard hands + all special hands
// ============================================================

import { tileBase, isHonour, isTerminal, isTerminalOrHonour, WINDS, DRAGONS } from './tiles.js'

// ── Main entry point ──────────────────────────────────────────
// hand: all 14 tiles (concealed, including drawn/claimed tile)
// exposedMelds: already-declared melds (pong/kong/chow)
// context: { seat, prevailingWind, flowers, selfDraw, settings, robbingKong }
// Returns: { valid: bool, hands: [...possible interpretations with faan] }
export function isWinningHand(hand, exposedMelds = [], context = {}) {
  const { settings = {} } = context

  // Must have the correct total tile count.
  // Each kong meld adds 1 extra tile beyond the standard 14
  // (the dead wall replacement draw), so the expected total is 14 + kongCount.
  const exposedTileCount = exposedMelds.reduce((sum, m) => sum + m.tiles.length, 0)
  const kongCount        = exposedMelds.filter(m => m.type?.startsWith('kong')).length
  const totalTiles       = hand.length + exposedTileCount
  if (totalTiles !== 14 + kongCount) return false

  // ── Check special hands first ──────────────────────────────
  if (exposedMelds.length === 0) {
    // Thirteen Orphans (十三么) — fully concealed only
    if (settings.allow13orphans !== false && isThirteenOrphans(hand)) return true

    // Seven Pairs (七對子) — fully concealed only
    if (isSevenPairs(hand)) return true

    // Nine Gates (九蓮寶燈) — fully concealed only
    if (isNineGates(hand)) return true
  }

  // All Kongs (十八羅漢)
  if (isAllKongs(hand, exposedMelds)) return true

  // ── Standard hand: 4 melds + 1 pair ───────────────────────
  return isStandardWin(hand, exposedMelds)
}

// ── Standard win: 4 melds + 1 pair ───────────────────────────
function isStandardWin(hand, exposedMelds) {
  // Number of melds needed from concealed hand
  const meldsNeeded = 4 - exposedMelds.length

  // Try all possible pairs from the hand
  const handBases = hand.map(tileBase)
  const tried     = new Set()

  for (let i = 0; i < hand.length; i++) {
    const pairBase = tileBase(hand[i])
    if (tried.has(pairBase)) continue
    tried.add(pairBase)

    // Need at least 2 of this tile for a pair
    if (handBases.filter(b => b === pairBase).length < 2) continue

    // Remove the pair and try to form meldsNeeded melds from remaining tiles
    const remaining = [...hand]
    const pairIdx   = remaining.indexOf(hand[i])
    remaining.splice(pairIdx, 1)
    const pairIdx2  = remaining.findIndex(t => tileBase(t) === pairBase)
    remaining.splice(pairIdx2, 1)

    if (canFormMelds(remaining, meldsNeeded)) return true
  }

  return false
}

// ── Recursive meld formation ──────────────────────────────────
function canFormMelds(tiles, meldsNeeded) {
  if (meldsNeeded === 0) return tiles.length === 0
  if (tiles.length === 0) return meldsNeeded === 0

  // Sort tiles for consistent processing
  const sorted = [...tiles].sort()
  const first  = sorted[0]
  const base   = tileBase(first)

  // Try forming a triplet (pong) with first tile
  const matching = sorted.filter(t => tileBase(t) === base)
  if (matching.length >= 3) {
    const rest = removeN(sorted, base, 3)
    if (canFormMelds(rest, meldsNeeded - 1)) return true
  }

  // Try forming a sequence (chow) with first tile — suited only
  const suitMatch = base.match(/^(wan|tong|suo)(\d)$/)
  if (suitMatch) {
    const suit = suitMatch[1]
    const num  = parseInt(suitMatch[2])
    if (num <= 7) {
      const n1 = `${suit}${num}`
      const n2 = `${suit}${num + 1}`
      const n3 = `${suit}${num + 2}`
      if (
        sorted.some(t => tileBase(t) === n1) &&
        sorted.some(t => tileBase(t) === n2) &&
        sorted.some(t => tileBase(t) === n3)
      ) {
        const rest = removeOne(removeOne(removeOne(sorted, n1), n2), n3)
        if (canFormMelds(rest, meldsNeeded - 1)) return true
      }
    }
  }

  return false
}

// ── Special hand checks ───────────────────────────────────────

// Thirteen Orphans (十三么): one each of terminal/honour + any duplicate
const ORPHAN_BASES = [
  'wan1','wan9','tong1','tong9','suo1','suo9',
  'east','south','west','north','zhong','fa','bai'
]

function isThirteenOrphans(hand) {
  if (hand.length !== 14) return false
  const bases   = hand.map(tileBase)
  const unique  = new Set(bases)

  // Must have all 13 orphan types
  if (!ORPHAN_BASES.every(b => unique.has(b))) return false

  // Must have exactly one duplicate (the 14th tile is a duplicate of one orphan)
  const counts = {}
  bases.forEach(b => counts[b] = (counts[b] || 0) + 1)
  const pairs = Object.values(counts).filter(c => c === 2).length
  return pairs === 1
}

// Seven Pairs (七對子): 7 distinct pairs
function isSevenPairs(hand) {
  if (hand.length !== 14) return false
  const counts = {}
  hand.forEach(t => {
    const b = tileBase(t)
    counts[b] = (counts[b] || 0) + 1
  })
  const values = Object.values(counts)
  // All must be exactly 2 (no quads allowed as two pairs)
  return values.length === 7 && values.every(c => c === 2)
}

// Nine Gates (九蓮寶燈): 1112345678999 of one suit + any one duplicate
function isNineGates(hand) {
  if (hand.length !== 14) return false
  const bases = hand.map(tileBase)

  // All must be same suit
  const suits = ['wan','tong','suo']
  for (const suit of suits) {
    if (!bases.every(b => b.startsWith(suit))) continue

    const numbers = bases.map(b => parseInt(b.replace(suit, ''))).sort((a,b) => a-b)
    // Base pattern: 1,1,1,2,3,4,5,6,7,8,9,9,9 + one extra of any
    const base = [1,1,1,2,3,4,5,6,7,8,9,9,9]
    const extra = [...numbers]
    for (const n of base) {
      const idx = extra.indexOf(n)
      if (idx === -1) break
      extra.splice(idx, 1)
    }
    if (extra.length === 1 && extra[0] >= 1 && extra[0] <= 9) return true
  }
  return false
}

// All Kongs (十八羅漢): 4 kongs + 1 pair
function isAllKongs(hand, exposedMelds) {
  const kongMelds = exposedMelds.filter(m =>
    m.type === 'kong_exposed' || m.type === 'kong_concealed' || m.type === 'kong_added'
  )
  if (kongMelds.length !== 4) return false

  // Hand should just be a pair (2 tiles)
  if (hand.length !== 2) return false
  return tileBase(hand[0]) === tileBase(hand[1])
}

// ── Discard pool analysis ─────────────────────────────────────
// Returns frequency map of discarded tile bases
export function discardPoolFrequency(discardPool) {
  const freq = {}
  discardPool.forEach(({ tileId }) => {
    const base = tileBase(tileId)
    freq[base] = (freq[base] || 0) + 1
  })
  return freq
}

// ── Is hand fully concealed? ──────────────────────────────────
export function isConcealed(exposedMelds) {
  return exposedMelds.every(m => m.type === 'kong_concealed')
}

// ── Count specific tile in hand ───────────────────────────────
export function countInHand(hand, base) {
  return hand.filter(t => tileBase(t) === base).length
}

// ── Helpers ───────────────────────────────────────────────────
function removeN(arr, base, n) {
  const copy = [...arr]
  let removed = 0
  for (let i = copy.length - 1; i >= 0 && removed < n; i--) {
    if (tileBase(copy[i]) === base) {
      copy.splice(i, 1)
      removed++
    }
  }
  return copy
}

function removeOne(arr, base) {
  const copy = [...arr]
  const idx  = copy.findIndex(t => tileBase(t) === base)
  if (idx !== -1) copy.splice(idx, 1)
  return copy
}
