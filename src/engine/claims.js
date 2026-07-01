// ============================================================
// claims.js
// Validates 吃 (chow) / 碰 (pong) / 槓 (kong) / 胡 (win) claims
// ============================================================

import { tileBase, isBonus, SEAT_ORDER } from './tiles.js'
import { isWinningHand } from './winning.js'

// ── Can a player PONG (碰) the last discard? ─────────────────
// Need 2 matching tiles in hand
export function canPong(hand, discardTileId) {
  const base  = tileBase(discardTileId)
  const count = hand.filter(t => tileBase(t) === base).length
  return count >= 2
}

// ── Can a player KONG (槓) the last discard? ─────────────────
// Need 3 matching tiles in hand (exposed kong from discard)
export function canKongFromDiscard(hand, discardTileId) {
  const base  = tileBase(discardTileId)
  const count = hand.filter(t => tileBase(t) === base).length
  return count >= 3
}

// ── Can a player declare concealed KONG (暗槓)? ───────────────
// Need 4 matching tiles in hand (from drawn tile)
export function canKongConcealed(hand) {
  const counts = {}
  hand.forEach(t => {
    const b = tileBase(t)
    counts[b] = (counts[b] || 0) + 1
  })
  return Object.entries(counts)
    .filter(([, count]) => count >= 4)
    .map(([base]) => base)
}

// ── Can a player add to existing pong (加槓)? ─────────────────
// Need 1 matching tile in hand + existing pong meld
export function canKongAdded(hand, exposedMelds) {
  const pongs    = exposedMelds.filter(m => m.type === 'pong')
  const pongBases = pongs.map(m => tileBase(m.tiles[0]))
  return pongBases.filter(base => hand.some(t => tileBase(t) === base))
}

// ── Can a player CHOW (吃) the last discard? ─────────────────
// Only the next player (counterclockwise) can chow
// Need 2 tiles in hand that form a sequence with the discard
// Honours cannot be chowed
export function canChow(hand, discardTileId, discardedBySeat, claimingSeat) {
  // Only next player counterclockwise can chow
  const discardIdx = SEAT_ORDER.indexOf(discardedBySeat)
  const nextSeat   = SEAT_ORDER[(discardIdx + 1) % 4]
  if (claimingSeat !== nextSeat) return []

  const t = parseForChow(discardTileId)
  if (!t) return [] // honours cannot be chowed

  const { suit, number } = t
  const handBases = hand.map(tileBase)

  const sequences = []

  // Check all 3 possible sequences involving this tile
  // Sequence where discard is the LOW tile:  discard, +1, +2
  if (number <= 7) {
    const needs = [`${suit}${number + 1}`, `${suit}${number + 2}`]
    if (needs.every(n => handBases.includes(n))) {
      sequences.push({
        tiles:    [discardTileId, findTile(hand, needs[0]), findTile(hand, needs[1])],
        sequence: [number, number + 1, number + 2],
      })
    }
  }

  // Sequence where discard is the MID tile: -1, discard, +1
  if (number >= 2 && number <= 8) {
    const needs = [`${suit}${number - 1}`, `${suit}${number + 1}`]
    if (needs.every(n => handBases.includes(n))) {
      sequences.push({
        tiles:    [findTile(hand, needs[0]), discardTileId, findTile(hand, needs[1])],
        sequence: [number - 1, number, number + 1],
      })
    }
  }

  // Sequence where discard is the HIGH tile: -2, -1, discard
  if (number >= 3) {
    const needs = [`${suit}${number - 2}`, `${suit}${number - 1}`]
    if (needs.every(n => handBases.includes(n))) {
      sequences.push({
        tiles:    [findTile(hand, needs[0]), findTile(hand, needs[1]), discardTileId],
        sequence: [number - 2, number - 1, number],
      })
    }
  }

  return sequences
}

// ── Can a player WIN (胡) with the last discard? ─────────────
export function canWinFromDiscard(hand, discardTileId, seat, exposedMelds, flowers, settings, prevailingWind) {
  if (isBonus(discardTileId)) return false
  const fullHand = [...hand, discardTileId]
  return isWinningHand(fullHand, exposedMelds, {
    seat,
    prevailingWind,
    flowers,
    selfDraw: false,
    settings,
  })
}

// ── Can a player WIN (胡) by self-draw? ──────────────────────
export function canWinSelfDraw(hand, seat, exposedMelds, flowers, settings, prevailingWind) {
  return isWinningHand(hand, exposedMelds, {
    seat,
    prevailingWind,
    flowers,
    selfDraw: true,
    settings,
  })
}

// ── Can a player ROB THE KONG (搶槓胡)? ──────────────────────
// When another player adds to a pong (加槓), can this player win with that tile?
// Cannot rob a concealed kong
export function canRobKong(hand, kongTileId, seat, exposedMelds, flowers, settings, prevailingWind) {
  const fullHand = [...hand, kongTileId]
  return isWinningHand(fullHand, exposedMelds, {
    seat,
    prevailingWind,
    flowers,
    selfDraw: false,
    robbingKong: true,
    settings,
  })
}

// ── Resolve claim priority ────────────────────────────────────
// Given multiple claims on a discard, determine which wins
// Priority: 胡 > 槓 > 碰 > 吃
// Ties broken by seat order from discarder (next clockwise = higher priority)
export function resolveClaims(claims, discardedBySeat) {
  if (!claims || Object.keys(claims).length === 0) return null

  const PRIORITY = { win: 4, kong: 3, pong: 2, chow: 1 }

  // Sort by priority descending, then by seat proximity to discarder
  const sorted = Object.entries(claims).sort(([seatA, claimA], [seatB, claimB]) => {
    const pa = PRIORITY[claimA.type] || 0
    const pb = PRIORITY[claimB.type] || 0
    if (pa !== pb) return pb - pa

    // Same priority — closer seat wins (counterclockwise from discarder)
    const discardIdx = SEAT_ORDER.indexOf(discardedBySeat)
    const distA = (SEAT_ORDER.indexOf(seatA) - discardIdx + 4) % 4
    const distB = (SEAT_ORDER.indexOf(seatB) - discardIdx + 4) % 4
    return distA - distB
  })

  const [winningSeat, winningClaim] = sorted[0]
  return { seat: winningSeat, claim: winningClaim }
}

// ── Apply a PONG claim ────────────────────────────────────────
export function applyPong(hand, discardTileId, exposedMelds) {
  const base   = tileBase(discardTileId)
  const matching = hand.filter(t => tileBase(t) === base).slice(0, 2)
  const newHand  = removeFromHand(hand, matching)
  const meld     = {
    type:        'pong',
    tiles:       [...matching, discardTileId],
    claimedFrom: null, // set by caller
  }
  return { hand: newHand, exposedMelds: [...exposedMelds, meld] }
}

// ── Apply a KONG from discard ─────────────────────────────────
export function applyKongFromDiscard(hand, discardTileId, exposedMelds, claimedFrom) {
  const base     = tileBase(discardTileId)
  const matching = hand.filter(t => tileBase(t) === base).slice(0, 3)
  const newHand  = removeFromHand(hand, matching)
  const meld     = {
    type:        'kong_exposed',
    tiles:       [...matching, discardTileId],
    claimedFrom,
  }
  return { hand: newHand, exposedMelds: [...exposedMelds, meld] }
}

// ── Apply a concealed KONG ────────────────────────────────────
export function applyKongConcealed(hand, base, exposedMelds) {
  const matching = hand.filter(t => tileBase(t) === base)
  const newHand  = removeFromHand(hand, matching)
  const meld     = {
    type:        'kong_concealed',
    tiles:       matching,
    claimedFrom: null,
  }
  return { hand: newHand, exposedMelds: [...exposedMelds, meld] }
}

// ── Apply an added KONG (加槓) ────────────────────────────────
export function applyKongAdded(hand, base, exposedMelds) {
  const tile     = hand.find(t => tileBase(t) === base)
  const newHand  = hand.filter(t => t !== tile)
  const newMelds = exposedMelds.map(m => {
    if (m.type === 'pong' && tileBase(m.tiles[0]) === base) {
      return { ...m, type: 'kong_added', tiles: [...m.tiles, tile] }
    }
    return m
  })
  return { hand: newHand, exposedMelds: newMelds }
}

// ── Apply a CHOW ─────────────────────────────────────────────
export function applyChow(hand, chowTiles, discardTileId, exposedMelds, claimedFrom) {
  // chowTiles includes the discard; remove the 2 hand tiles
  const handTiles = chowTiles.filter(t => t !== discardTileId)
  const newHand   = removeFromHand(hand, handTiles)
  const meld      = {
    type:        'chow',
    tiles:       chowTiles,
    claimedFrom,
  }
  return { hand: newHand, exposedMelds: [...exposedMelds, meld] }
}

// ── Helpers ───────────────────────────────────────────────────
function parseForChow(tileId) {
  const match = tileId.match(/^(wan|tong|suo)(\d)_\d$/)
  if (!match) return null
  return { suit: match[1], number: parseInt(match[2]) }
}

function findTile(hand, base) {
  return hand.find(t => tileBase(t) === base)
}

function removeFromHand(hand, tilesToRemove) {
  const copy   = [...hand]
  tilesToRemove.forEach(tile => {
    const idx = copy.indexOf(tile)
    if (idx !== -1) copy.splice(idx, 1)
  })
  return copy
}
