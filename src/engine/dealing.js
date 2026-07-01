// ============================================================
// dealing.js
// Handles tile dealing, wall management, bonus tile replacement
// ============================================================

import { generateTiles, shuffle, isBonus, SEAT_ORDER } from './tiles.js'

// Dead wall size: 14 tiles reserved for Kong replacements
const DEAD_WALL_SIZE = 14

// ── Deal a new hand ───────────────────────────────────────────
// Returns the initial game state after dealing
// dealer: the seat that is East for this hand
export function dealHand(dealer) {
  const allTiles  = shuffle(generateTiles())

  // Separate bonus tiles — they go back into the wall at random positions
  // In real mahjong bonus tiles are mixed in; players draw replacements when found
  // We keep them in the wall and handle them on draw

  // Reserve dead wall (last 14 tiles)
  const deadWall = allTiles.slice(allTiles.length - DEAD_WALL_SIZE)
  const liveWall = allTiles.slice(0, allTiles.length - DEAD_WALL_SIZE)

  // Deal 13 tiles to each player, dealer gets 14
  // HK style: 4 tiles at a time × 3 rounds = 12 each, then 1 each, then dealer gets 1 more
  const hands = { east: [], south: [], west: [], north: [] }
  const wallCopy = [...liveWall]

  // 3 rounds of 4 tiles each
  for (let round = 0; round < 3; round++) {
    SEAT_ORDER.forEach(seat => {
      hands[seat].push(...wallCopy.splice(0, 4))
    })
  }

  // 1 tile each
  SEAT_ORDER.forEach(seat => {
    hands[seat].push(wallCopy.splice(0, 1)[0])
  })

  // Dealer gets 1 extra (14 total)
  hands[dealer].push(wallCopy.splice(0, 1)[0])

  // Handle initial bonus tiles
  // Any bonus tiles in starting hands are set aside and replaced from dead wall
  const { hands: cleanHands, flowers, deadWallRemaining } = handleInitialBonus(
    hands, deadWall
  )

  return {
    wall:       wallCopy,          // remaining live wall
    deadWall:   deadWallRemaining, // remaining dead wall
    hands:      cleanHands,        // { east: [...], south: [...], west: [...], north: [...] }
    flowers:    flowers,           // { east: [...], south: [...], west: [...], north: [...] }
    dealer,
    currentTurn: dealer,
    phase:      'discard',         // dealer has 14 tiles, must discard first
    discardPool: [],
    lastDiscard: null,
    claims:      {},
  }
}

// ── Handle bonus tiles in initial deal ───────────────────────
function handleInitialBonus(hands, deadWall) {
  const flowers    = { east: [], south: [], west: [], north: [] }
  const deadCopy   = [...deadWall]
  const cleanHands = {}

  SEAT_ORDER.forEach(seat => {
    let hand = [...hands[seat]]
    // Keep pulling bonus tiles out and replacing until hand is clean
    let changed = true
    while (changed) {
      changed = false
      const bonusInHand = hand.filter(t => isBonus(t))
      if (bonusInHand.length > 0) {
        changed = true
        flowers[seat].push(...bonusInHand)
        hand = hand.filter(t => !isBonus(t))
        // Replace from dead wall
        bonusInHand.forEach(() => {
          if (deadCopy.length > 0) {
            const replacement = deadCopy.shift()
            hand.push(replacement)
          }
        })
      }
    }
    cleanHands[seat] = hand
  })

  return { hands: cleanHands, flowers, deadWallRemaining: deadCopy }
}

// ── Draw a tile from the live wall ───────────────────────────
// Returns { tile, newWall, isBonus, replacement } 
export function drawFromWall(wall, deadWall, hand, flowers, seat) {
  if (wall.length === 0) {
    return { exhausted: true }
  }

  const wallCopy    = [...wall]
  const deadCopy    = [...deadWall]
  const handCopy    = [...hand]
  const flowersCopy = [...flowers]

  const tile = wallCopy.shift()

  if (isBonus(tile)) {
    // Auto-replace from dead wall
    flowersCopy.push(tile)
    let replacement = null
    if (deadCopy.length > 0) {
      replacement = deadCopy.shift()
    }
    return {
      drawnTile:    tile,
      isBonus:      true,
      replacement,
      hand:         replacement ? [...handCopy, replacement] : handCopy,
      flowers:      flowersCopy,
      wall:         wallCopy,
      deadWall:     deadCopy,
      exhausted:    false,
    }
  }

  return {
    drawnTile: tile,
    isBonus:   false,
    hand:      [...handCopy, tile],
    flowers:   flowersCopy,
    wall:      wallCopy,
    deadWall:  deadCopy,
    exhausted: false,
  }
}

// ── Draw replacement tile from dead wall (after Kong) ─────────
export function drawFromDeadWall(wall, deadWall, hand, flowers) {
  if (deadWall.length === 0) {
    return { exhausted: true }
  }

  const deadCopy    = [...deadWall]
  const handCopy    = [...hand]
  const flowersCopy = [...flowers]

  const tile = deadCopy.shift()

  if (isBonus(tile)) {
    flowersCopy.push(tile)
    // Recurse to get another replacement
    return drawFromDeadWall(wall, deadCopy, handCopy, flowersCopy)
  }

  return {
    drawnTile: tile,
    isBonus:   false,
    hand:      [...handCopy, tile],
    flowers:   flowersCopy,
    wall,
    deadWall:  deadCopy,
    exhausted: false,
  }
}

// ── Discard a tile ────────────────────────────────────────────
export function discardTile(hand, tileId, discardPool, seat) {
  const idx = hand.indexOf(tileId)
  if (idx === -1) throw new Error(`Tile ${tileId} not in hand`)

  const newHand = [...hand]
  newHand.splice(idx, 1)

  const discard = {
    tileId,
    discardedBy: seat,
    timestamp:   Date.now(),
  }

  return {
    hand:        newHand,
    discardPool: [...discardPool, discard],
    lastDiscard: discard,
  }
}

// ── Dice roll (2 dice) ────────────────────────────────────────
export function rollDice() {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1
}

// ── Determine dealer from dice rolls ─────────────────────────
// Each seat rolls; highest becomes East (dealer)
// Tie: repeat (handled by re-rolling tied seats)
export function determineDealer(rolls) {
  // rolls: { east: number, south: number, west: number, north: number }
  const maxRoll   = Math.max(...Object.values(rolls))
  const winners   = Object.entries(rolls).filter(([, v]) => v === maxRoll).map(([k]) => k)
  if (winners.length === 1) return winners[0]
  return null // tie — need re-roll for tied seats
}

// ── Wall stats ────────────────────────────────────────────────
export function wallStats(wall, deadWall) {
  return {
    liveWallCount: wall.length,
    deadWallCount: deadWall.length,
    total:         wall.length + deadWall.length,
  }
}
