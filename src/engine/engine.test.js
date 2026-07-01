// ============================================================
// engine.test.js
// Tests for tiles, dealing, claims, and win detection
// Run with: node src/engine/engine.test.js
// ============================================================

import { generateTiles, shuffle, parseTile, isBonus, isHonour, nextSeat } from './tiles.js'
import { dealHand, rollDice, determineDealer } from './dealing.js'
import { canPong, canChow, canKongFromDiscard, canKongConcealed, resolveClaims } from './claims.js'
import { isWinningHand, isConcealed } from './winning.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}`)
    console.log(`    ${e.message}`)
    failed++
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`)
}

// ── Tile generation ───────────────────────────────────────────
console.log('\n── Tile Generation ──')

test('generates 144 tiles', () => {
  const tiles = generateTiles()
  assertEqual(tiles.length, 144, `Expected 144 tiles, got ${tiles.length}`)
})

test('contains 36 wan tiles', () => {
  const tiles = generateTiles()
  const wan   = tiles.filter(t => t.startsWith('wan'))
  assertEqual(wan.length, 36)
})

test('contains 36 tong tiles', () => {
  const tiles = generateTiles()
  assertEqual(tiles.filter(t => t.startsWith('tong')).length, 36)
})

test('contains 36 suo tiles', () => {
  const tiles = generateTiles()
  assertEqual(tiles.filter(t => t.startsWith('suo')).length, 36)
})

test('contains 28 honour tiles', () => {
  const tiles   = generateTiles()
  const honours = tiles.filter(t => isHonour(t))
  assertEqual(honours.length, 28)
})

test('contains 8 bonus tiles', () => {
  const tiles = generateTiles()
  const bonus = tiles.filter(t => isBonus(t))
  assertEqual(bonus.length, 8)
})

test('shuffle changes order', () => {
  const tiles     = generateTiles()
  const shuffled  = shuffle(tiles)
  assert(shuffled.length === tiles.length, 'Length preserved')
  assert(shuffled.join(',') !== tiles.join(','), 'Order changed')
})

// ── Tile parsing ───────────────────────────────────────────────
console.log('\n── Tile Parsing ──')

test('parses wan tile', () => {
  const t = parseTile('wan3_0')
  assertEqual(t.suit, 'wan')
  assertEqual(t.number, 3)
  assertEqual(t.category, 'suited')
})

test('parses tong tile', () => {
  const t = parseTile('tong7_2')
  assertEqual(t.suit, 'tong')
  assertEqual(t.number, 7)
})

test('parses wind tile', () => {
  const t = parseTile('east_0')
  assertEqual(t.category, 'honour')
  assertEqual(t.type, 'wind')
  assertEqual(t.wind, 'east')
})

test('parses dragon tile', () => {
  const t = parseTile('zhong_1')
  assertEqual(t.category, 'honour')
  assertEqual(t.type, 'dragon')
})

test('parses bonus tile', () => {
  const t = parseTile('spring_0')
  assertEqual(t.category, 'bonus')
  assertEqual(t.seatNumber, 1)
})

test('identifies terminals', () => {
  const t1 = parseTile('wan1_0')
  const t9 = parseTile('suo9_3')
  const t5 = parseTile('tong5_1')
  assert(t1.isTerminal, 'wan1 is terminal')
  assert(t9.isTerminal, 'suo9 is terminal')
  assert(!t5.isTerminal, 'tong5 is not terminal')
})

// ── Dealing ───────────────────────────────────────────────────
console.log('\n── Dealing ──')

test('deals correct hand sizes', () => {
  const state = dealHand('east')
  assertEqual(state.hands.east.length, 14, 'East has 14 tiles')
  assertEqual(state.hands.south.length, 13, 'South has 13 tiles')
  assertEqual(state.hands.west.length, 13, 'West has 13 tiles')
  assertEqual(state.hands.north.length, 13, 'North has 13 tiles')
})

test('no bonus tiles in starting hands', () => {
  const state = dealHand('east')
  Object.values(state.hands).forEach(hand => {
    assert(!hand.some(isBonus), 'No bonus tiles in hand')
  })
})

test('total tiles accounted for', () => {
  const state = dealHand('east')
  const inHands   = Object.values(state.hands).reduce((s, h) => s + h.length, 0)
  const inFlowers = Object.values(state.flowers).reduce((s, f) => s + f.length, 0)
  const inWall    = state.wall.length
  const inDead    = state.deadWall.length
  assertEqual(inHands + inFlowers + inWall + inDead, 144, `Total: ${inHands + inFlowers + inWall + inDead}`)
})

test('no duplicate tiles', () => {
  const state   = dealHand('east')
  const allTiles = [
    ...state.hands.east,
    ...state.hands.south,
    ...state.hands.west,
    ...state.hands.north,
    ...state.flowers.east,
    ...state.flowers.south,
    ...state.flowers.west,
    ...state.flowers.north,
    ...state.wall,
    ...state.deadWall,
  ]
  const unique = new Set(allTiles)
  assertEqual(unique.size, 144, `Duplicates found: ${allTiles.length - unique.size}`)
})

test('dice roll returns 2-12', () => {
  for (let i = 0; i < 100; i++) {
    const roll = rollDice()
    assert(roll >= 2 && roll <= 12, `Roll ${roll} out of range`)
  }
})

test('dealer determination works', () => {
  const rolls  = { east: 8, south: 5, west: 11, north: 3 }
  const dealer = determineDealer(rolls)
  assertEqual(dealer, 'west', 'West wins with 11')
})

test('dealer determination handles ties', () => {
  const rolls = { east: 7, south: 7, west: 3, north: 2 }
  const dealer = determineDealer(rolls)
  assertEqual(dealer, null, 'Tie returns null')
})

// ── Claim validation ──────────────────────────────────────────
console.log('\n── Claim Validation ──')

test('canPong with 2 matching tiles', () => {
  const hand    = ['wan3_0', 'wan3_1', 'tong5_0']
  const discard = 'wan3_2'
  assert(canPong(hand, discard), 'Can pong wan3')
})

test('canPong fails with 1 matching tile', () => {
  const hand    = ['wan3_0', 'tong5_0', 'suo7_0']
  const discard = 'wan3_2'
  assert(!canPong(hand, discard), 'Cannot pong with only 1 matching')
})

test('canKongFromDiscard with 3 matching tiles', () => {
  const hand    = ['wan3_0', 'wan3_1', 'wan3_2', 'tong5_0']
  const discard = 'wan3_3'
  assert(canKongFromDiscard(hand, discard), 'Can kong wan3 from discard')
})

test('canKongConcealed finds quads', () => {
  const hand  = ['wan3_0', 'wan3_1', 'wan3_2', 'wan3_3', 'tong5_0', 'tong5_1', 'tong5_2', 'east_0']
  const quads = canKongConcealed(hand)
  assert(quads.includes('wan3'), 'Found wan3 quad')
  assert(!quads.includes('tong5'), 'tong5 not a quad (only 3)')
})

test('canChow for next player only', () => {
  const hand    = ['wan4_0', 'wan5_0', 'tong1_0']
  const discard = 'wan3_0'
  // South is next after East
  const sequences = canChow(hand, discard, 'east', 'south')
  assert(sequences.length > 0, 'South can chow east discard')

  // West cannot chow east discard (not next player)
  const westSeq = canChow(hand, discard, 'east', 'west')
  assertEqual(westSeq.length, 0, 'West cannot chow')
})

test('canChow finds all valid sequences', () => {
  const hand    = ['wan2_0', 'wan4_0', 'wan5_0', 'wan6_0']
  const discard = 'wan3_0'
  const seqs    = canChow(hand, discard, 'east', 'south')
  assert(seqs.length >= 2, `Expected ≥2 sequences, got ${seqs.length}`)
})

test('canChow rejects honours', () => {
  const hand    = ['east_0', 'east_1', 'south_0']
  const discard = 'east_2'
  const seqs    = canChow(hand, discard, 'north', 'east')
  assertEqual(seqs.length, 0, 'Cannot chow honours')
})

test('resolveClaims: win beats pong', () => {
  const claims = {
    south: { type: 'pong' },
    west:  { type: 'win' },
  }
  const result = resolveClaims(claims, 'east')
  assertEqual(result.seat, 'west', 'Win beats pong')
})

test('resolveClaims: pong beats chow', () => {
  const claims = {
    south: { type: 'chow' },
    west:  { type: 'pong' },
  }
  const result = resolveClaims(claims, 'east')
  assertEqual(result.seat, 'west', 'Pong beats chow')
})

test('resolveClaims: seat proximity breaks ties', () => {
  const claims = {
    south: { type: 'win' },
    west:  { type: 'win' },
  }
  // Both win — south is closer to east (1 step vs 2 steps)
  const result = resolveClaims(claims, 'east')
  assertEqual(result.seat, 'south', 'South wins (closer to east)')
})

// ── Win detection ─────────────────────────────────────────────
console.log('\n── Win Detection ──')

test('standard win: 4 chows + pair', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0',
    'wan4_0','wan5_0','wan6_0',
    'tong1_0','tong2_0','tong3_0',
    'suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  assert(isWinningHand(hand, []), 'Standard win detected')
})

test('standard win: 4 pongs + pair', () => {
  const hand = [
    'wan1_0','wan1_1','wan1_2',
    'tong2_0','tong2_1','tong2_2',
    'suo3_0','suo3_1','suo3_2',
    'east_0','east_1','east_2',
    'zhong_0','zhong_1',
  ]
  assert(isWinningHand(hand, []), '4 pongs + pair wins')
})

test('seven pairs wins', () => {
  const hand = [
    'wan1_0','wan1_1',
    'wan2_0','wan2_1',
    'wan3_0','wan3_1',
    'wan4_0','wan4_1',
    'wan5_0','wan5_1',
    'wan6_0','wan6_1',
    'wan7_0','wan7_1',
  ]
  assert(isWinningHand(hand, []), 'Seven pairs wins')
})

test('thirteen orphans wins', () => {
  const hand = [
    'wan1_0','wan9_0','tong1_0','tong9_0','suo1_0','suo9_0',
    'east_0','south_0','west_0','north_0','zhong_0','fa_0','bai_0',
    'wan1_1', // duplicate
  ]
  assert(isWinningHand(hand, [], { settings: { allow13orphans: true } }), '13 orphans wins')
})

test('incomplete hand does not win', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0',
    'tong1_0','tong2_0','tong3_0',
    'suo1_0','suo2_0','suo3_0',
    'east_0','east_1','east_2',
    'zhong_0','south_0', // mismatched pair
  ]
  assert(!isWinningHand(hand, []), 'Incomplete hand should not win')
})

test('win with exposed melds', () => {
  // 1 exposed pong + 3 more melds + pair in concealed hand
  const exposedMelds = [{ type: 'pong', tiles: ['zhong_0','zhong_1','zhong_2'], claimedFrom: 'east' }]
  const hand = [
    'wan1_0','wan2_0','wan3_0',
    'tong4_0','tong5_0','tong6_0',
    'suo7_0','suo8_0','suo9_0',
    'east_0','east_1',
  ]
  assert(isWinningHand(hand, exposedMelds), 'Win with exposed meld')
})

test('nine gates wins', () => {
  const hand = [
    'wan1_0','wan1_1','wan1_2',
    'wan2_0','wan3_0','wan4_0','wan5_0',
    'wan6_0','wan7_0','wan8_0',
    'wan9_0','wan9_1','wan9_2',
    'wan5_1', // extra tile
  ]
  assert(isWinningHand(hand, []), 'Nine gates wins')
})

// ── Summary ───────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
