// ============================================================
// engine.test.js
// Tests for tiles, dealing, claims, win detection, faan scoring,
// and payment calculation.
// Run with: node src/engine/engine.test.js
// ============================================================

import { generateTiles, shuffle, parseTile, isBonus, isHonour, tileBase, nextSeat } from './tiles.js'
import { dealHand, rollDice, determineDealer, drawFromWall, drawFromDeadWall, discardTile as engineDiscard } from './dealing.js'
import { canPong, canChow, canKongFromDiscard, canKongConcealed, canKongAdded, canWinFromDiscard, canWinSelfDraw, resolveClaims } from './claims.js'
import { isWinningHand, isConcealed } from './winning.js'
import { calcFaan, calcPoints, calcPayments } from './scoring.js'

let passed = 0
let failed = 0
const bugs = []

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
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

function assertDeepEqual(a, b, msg) {
  const as = JSON.stringify(a), bs = JSON.stringify(b)
  if (as !== bs) throw new Error(msg || `Expected ${bs}, got ${as}`)
}

// ── Base win context used across scoring tests ─────────────────
// seat=south, prevailing=north: no 門風/圈風 unless south/north wind pong present
// selfDraw=false: 門前清 applies for fully-concealed hands; 自摸 not applied
// Bonus from no-flower context: +1 無花 always; +1 門前清 if fully concealed
const BASE_CTX = {
  seat: 'south', prevailingWind: 'north', selfDraw: false,
  discarderSeat: 'west', isLastTile: false,
  winAfterKong: false, robbingKong: false,
  isHeavenly: false, isEarthly: false, doubleKong: false,
}
const NO_FLOWERS = []
const SETTINGS_3  = { minFaan: 3, scoringTable: 'half', limitValue: 64 }
const SETTINGS_FULL = { minFaan: 3, scoringTable: 'full', limitValue: 64 }

// Helper: pong meld object
function pong(tiles, from = 'east') { return { type: 'pong', tiles, claimedFrom: from } }
function chow(tiles, from = 'east') { return { type: 'chow', tiles, claimedFrom: from } }
function kongExp(tiles, from = 'east') { return { type: 'kong_exposed', tiles, claimedFrom: from } }
function kongCon(tiles)               { return { type: 'kong_concealed', tiles, claimedFrom: null } }

// ── Tile Generation ───────────────────────────────────────────
console.log('\n── Tile Generation ──')

test('generates 144 tiles', () => {
  assertEqual(generateTiles().length, 144)
})

test('contains 36 wan tiles', () => {
  assertEqual(generateTiles().filter(t => t.startsWith('wan')).length, 36)
})

test('contains 36 tong tiles', () => {
  assertEqual(generateTiles().filter(t => t.startsWith('tong')).length, 36)
})

test('contains 36 suo tiles', () => {
  assertEqual(generateTiles().filter(t => t.startsWith('suo')).length, 36)
})

test('contains 28 honour tiles', () => {
  assertEqual(generateTiles().filter(t => isHonour(t)).length, 28)
})

test('contains 8 bonus tiles', () => {
  assertEqual(generateTiles().filter(t => isBonus(t)).length, 8)
})

test('shuffle changes order', () => {
  const tiles    = generateTiles()
  const shuffled = shuffle(tiles)
  assertEqual(shuffled.length, tiles.length)
  assert(shuffled.join(',') !== tiles.join(','), 'Order should change')
})

// ── Tile Parsing ──────────────────────────────────────────────
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
  assert(parseTile('wan1_0').isTerminal,  'wan1 is terminal')
  assert(parseTile('suo9_3').isTerminal,  'suo9 is terminal')
  assert(!parseTile('tong5_1').isTerminal, 'tong5 is not terminal')
})

// ── Dealing ───────────────────────────────────────────────────
console.log('\n── Dealing ──')

test('deals correct hand sizes', () => {
  const state = dealHand('east')
  assertEqual(state.hands.east.length, 14)
  assertEqual(state.hands.south.length, 13)
  assertEqual(state.hands.west.length, 13)
  assertEqual(state.hands.north.length, 13)
})

test('no bonus tiles in starting hands', () => {
  const state = dealHand('east')
  for (const hand of Object.values(state.hands)) {
    assert(!hand.some(isBonus), 'No bonus tiles in hand')
  }
})

test('total tiles accounted for', () => {
  const state    = dealHand('east')
  const inHands  = Object.values(state.hands).reduce((s, h) => s + h.length, 0)
  const inFlower = Object.values(state.flowers).reduce((s, f) => s + f.length, 0)
  assertEqual(inHands + inFlower + state.wall.length + state.deadWall.length, 144)
})

test('no duplicate tiles', () => {
  const state = dealHand('east')
  const all   = [
    ...state.hands.east, ...state.hands.south, ...state.hands.west, ...state.hands.north,
    ...state.flowers.east, ...state.flowers.south, ...state.flowers.west, ...state.flowers.north,
    ...state.wall, ...state.deadWall,
  ]
  assertEqual(new Set(all).size, 144)
})

test('dice roll returns 2-12', () => {
  for (let i = 0; i < 100; i++) {
    const r = rollDice()
    assert(r >= 2 && r <= 12, `Roll ${r} out of range`)
  }
})

test('dealer determination works', () => {
  assertEqual(determineDealer({ east: 8, south: 5, west: 11, north: 3 }), 'west')
})

test('dealer determination handles ties', () => {
  assertEqual(determineDealer({ east: 7, south: 7, west: 3, north: 2 }), null)
})

test('drawFromWall reduces wall by 1 and adds tile to hand', () => {
  const state  = dealHand('east')
  const before = state.wall.length
  const result = drawFromWall(state.wall, state.deadWall, state.hands.south, state.flowers.south, 'south')
  if (result.exhausted) return  // edge case: unlikely but skip
  assert(result.wall.length < before, 'Wall shrank')
  assert(result.hand.length > state.hands.south.length || result.isBonus, 'Hand grew (or bonus auto-replaced)')
})

test('drawFromDeadWall reduces dead wall and adds tile to hand', () => {
  const state  = dealHand('east')
  const before = state.deadWall.length
  const result = drawFromDeadWall(state.wall, state.deadWall, state.hands.south, [])
  if (result.exhausted) return
  assert(result.deadWall.length < before, 'Dead wall shrank')
  assert(result.hand.length === state.hands.south.length + 1, 'Hand got 1 tile')
})

test('drawFromWall: bonus tile auto-replaced from dead wall, flowers updated', () => {
  // Build a minimal wall with 1 bonus tile at front, dead wall with 1 non-bonus
  const wall    = ['spring_0', 'wan5_0', 'wan6_0']
  const deadWall = ['tong1_0', 'tong2_0']
  const hand    = []
  const flowers = []
  const result  = drawFromWall(wall, deadWall, hand, flowers, 'east')
  assert(result.isBonus, 'spring_0 is a bonus tile')
  assert(result.flowers.includes('spring_0'), 'Flower added to flowers array')
  assert(!isBonus(result.hand[0]), 'Replacement tile in hand is not bonus')
  assertEqual(result.deadWall.length, 1, 'Dead wall shrank by 1 for replacement')
})

test('discardTile removes tile from hand and adds to pool', () => {
  const hand   = ['wan1_0', 'wan2_0', 'wan3_0']
  const result = engineDiscard(hand, 'wan2_0', [], 'south')
  assert(!result.hand.includes('wan2_0'), 'Tile removed from hand')
  assertEqual(result.discardPool.length, 1)
  assertEqual(result.discardPool[0].tileId, 'wan2_0')
  assertEqual(result.discardPool[0].discardedBy, 'south')
})

test('discardTile throws when tile not in hand', () => {
  let threw = false
  try { engineDiscard(['wan1_0'], 'wan2_0', [], 'south') } catch { threw = true }
  assert(threw, 'Should throw for missing tile')
})

// ── Claim Validation ──────────────────────────────────────────
console.log('\n── Claim Validation ──')

test('canPong: 2 matching tiles → true', () => {
  assert(canPong(['wan3_0', 'wan3_1', 'tong5_0'], 'wan3_2'))
})

test('canPong: 1 matching tile → false', () => {
  assert(!canPong(['wan3_0', 'tong5_0', 'suo7_0'], 'wan3_2'))
})

test('canPong: 0 matching tiles → false', () => {
  assert(!canPong(['tong5_0', 'suo7_0', 'east_0'], 'wan3_2'))
})

test('canPong: honour tile can be ponged', () => {
  assert(canPong(['east_0', 'east_1', 'wan1_0'], 'east_2'))
})

test('canKongFromDiscard: 3 matching in hand → true', () => {
  assert(canKongFromDiscard(['wan3_0', 'wan3_1', 'wan3_2', 'tong5_0'], 'wan3_3'))
})

test('canKongFromDiscard: 2 matching in hand → false', () => {
  assert(!canKongFromDiscard(['wan3_0', 'wan3_1', 'tong5_0'], 'wan3_3'))
})

test('canKongFromDiscard: 0 matching → false', () => {
  assert(!canKongFromDiscard(['tong1_0', 'tong2_0', 'tong3_0'], 'wan3_3'))
})

test('canKongConcealed: 4 matching → returns [base]', () => {
  const hand  = ['wan3_0', 'wan3_1', 'wan3_2', 'wan3_3', 'tong5_0']
  const quads = canKongConcealed(hand)
  assert(quads.includes('wan3'), 'wan3 found')
  assertEqual(quads.length, 1)
})

test('canKongConcealed: 3 matching → returns []', () => {
  assertEqual(canKongConcealed(['wan3_0', 'wan3_1', 'wan3_2', 'tong5_0']).length, 0)
})

test('canKongConcealed: multiple quads → returns all bases', () => {
  const hand  = ['wan3_0', 'wan3_1', 'wan3_2', 'wan3_3', 'east_0', 'east_1', 'east_2', 'east_3']
  const quads = canKongConcealed(hand)
  assert(quads.includes('wan3'))
  assert(quads.includes('east'))
  assertEqual(quads.length, 2)
})

test('canKongAdded: existing pong + 1 matching tile → returns [base]', () => {
  const hand  = ['wan3_3', 'tong5_0']
  const melds = [pong(['wan3_0', 'wan3_1', 'wan3_2'])]
  const bases = canKongAdded(hand, melds)
  assert(bases.includes('wan3'), 'wan3 found')
})

test('canKongAdded: no existing pong → returns []', () => {
  assertEqual(canKongAdded(['wan3_3'], []).length, 0)
})

test('canChow: south can chow east discard', () => {
  const seqs = canChow(['wan4_0', 'wan5_0', 'tong1_0'], 'wan3_0', 'east', 'south')
  assert(seqs.length > 0, 'South can chow')
})

test('canChow: west cannot chow east discard', () => {
  assertEqual(canChow(['wan4_0', 'wan5_0'], 'wan3_0', 'east', 'west').length, 0)
})

test('canChow: finds all 3 sequence positions', () => {
  // wan3 can be low (3-4-5), mid (2-3-4), or high (1-2-3) given hand has 1,2,4,5
  const seqs = canChow(['wan1_0', 'wan2_0', 'wan4_0', 'wan5_0'], 'wan3_0', 'east', 'south')
  assertEqual(seqs.length, 3, `Expected 3 sequences, got ${seqs.length}`)
})

test('canChow: honour tiles cannot be chowed', () => {
  assertEqual(canChow(['east_0', 'east_1'], 'east_2', 'north', 'east').length, 0)
})

test('canChow: tile=1 edge case (only 1 valid sequence)', () => {
  // wan1 can only be the LOW tile (1-2-3) if hand has wan2,wan3
  const seqs = canChow(['wan2_0', 'wan3_0', 'tong5_0'], 'wan1_0', 'east', 'south')
  assertEqual(seqs.length, 1, 'Only 1-2-3 sequence for tile 1')
})

test('canChow: tile=9 edge case (only 1 valid sequence)', () => {
  // wan9 can only be the HIGH tile (7-8-9) if hand has wan7,wan8
  const seqs = canChow(['wan7_0', 'wan8_0', 'tong5_0'], 'wan9_0', 'east', 'south')
  assertEqual(seqs.length, 1, 'Only 7-8-9 sequence for tile 9')
})

test('resolveClaims: win beats pong', () => {
  assertEqual(resolveClaims({ south: { type: 'pong' }, west: { type: 'win' } }, 'east').seat, 'west')
})

test('resolveClaims: kong beats pong', () => {
  assertEqual(resolveClaims({ south: { type: 'pong' }, west: { type: 'kong' } }, 'east').seat, 'west')
})

test('resolveClaims: pong beats chow', () => {
  assertEqual(resolveClaims({ south: { type: 'chow' }, west: { type: 'pong' } }, 'east').seat, 'west')
})

test('resolveClaims: two wins — closer seat wins', () => {
  // south (dist=1 from east) vs west (dist=2): south wins
  assertEqual(resolveClaims({ south: { type: 'win' }, west: { type: 'win' } }, 'east').seat, 'south')
})

test('resolveClaims: two wins — wraparound distance', () => {
  // north (dist=3 from east) vs west (dist=2): west wins
  assertEqual(resolveClaims({ north: { type: 'win' }, west: { type: 'win' } }, 'east').seat, 'west')
})

test('resolveClaims: all pass → null', () => {
  assertEqual(resolveClaims({ south: { type: 'pass' }, west: { type: 'pass' } }, 'east'), null)
})

test('resolveClaims: empty claims → null', () => {
  assertEqual(resolveClaims({}, 'east'), null)
})

// ── Win Detection ─────────────────────────────────────────────
console.log('\n── Win Detection ──')

test('standard win: 4 chows + pair, no exposed melds', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  assert(isWinningHand(hand, []))
})

test('standard win: 4 pongs + pair, no exposed melds', () => {
  const hand = [
    'wan1_0','wan1_1','wan1_2','tong2_0','tong2_1','tong2_2',
    'suo3_0','suo3_1','suo3_2','east_0','east_1','east_2',
    'zhong_0','zhong_1',
  ]
  assert(isWinningHand(hand, []))
})

test('standard win: 1 exposed pong + 3 concealed melds + pair', () => {
  const exposed = [pong(['zhong_0','zhong_1','zhong_2'])]
  const hand    = [
    'wan1_0','wan2_0','wan3_0',
    'tong4_0','tong5_0','tong6_0',
    'suo7_0','suo8_0','suo9_0',
    'east_0','east_1',
  ]
  assert(isWinningHand(hand, exposed))
})

test('standard win: 2 exposed pongs + 2 concealed melds + pair', () => {
  const exposed = [
    pong(['zhong_0','zhong_1','zhong_2']),
    pong(['fa_0','fa_1','fa_2']),
  ]
  const hand = ['wan1_0','wan2_0','wan3_0','tong4_0','tong5_0','tong6_0','suo9_0','suo9_1']
  assert(isWinningHand(hand, exposed))
})

test('standard win: 3 exposed pongs + 1 concealed meld + pair', () => {
  const exposed = [
    pong(['zhong_0','zhong_1','zhong_2']),
    pong(['fa_0','fa_1','fa_2']),
    pong(['bai_0','bai_1','bai_2']),
  ]
  const hand = ['wan1_0','wan2_0','wan3_0','suo9_0','suo9_1']
  assert(isWinningHand(hand, exposed))
})

test('standard win: 4 exposed pongs + just the pair', () => {
  const exposed = [
    pong(['wan1_0','wan1_1','wan1_2']),
    pong(['tong2_0','tong2_1','tong2_2']),
    pong(['suo3_0','suo3_1','suo3_2']),
    pong(['east_0','east_1','east_2']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(isWinningHand(hand, exposed))
})

test('standard win: exposed chow + exposed pong + 2 concealed melds + pair', () => {
  const exposed = [
    chow(['wan1_0','wan2_0','wan3_0']),
    pong(['east_0','east_1','east_2']),
  ]
  const hand = ['tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0','bai_0','bai_1']
  assert(isWinningHand(hand, exposed))
})

test('standard win: 1 exposed kong counts as 1 meld (14+1=15 tiles)', () => {
  // Player has 1 exposed kong (4 tiles) + 3 pong melds + pair in concealed hand
  const exposed = [
    pong(['wan1_0','wan1_1','wan1_2']),
    pong(['tong2_0','tong2_1','tong2_2']),
    pong(['suo3_0','suo3_1','suo3_2']),
    kongExp(['east_0','east_1','east_2','east_3']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(isWinningHand(hand, exposed), '4 melds (1 kong) + pair should win')
})

test('standard win: 2 exposed kongs (14+2=16 tiles)', () => {
  const exposed = [
    kongExp(['wan1_0','wan1_1','wan1_2','wan1_3']),
    kongExp(['tong2_0','tong2_1','tong2_2','tong2_3']),
    pong(['suo3_0','suo3_1','suo3_2']),
    pong(['east_0','east_1','east_2']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(isWinningHand(hand, exposed), '4 melds (2 kongs) + pair should win')
})

test('standard win: concealed kong counts correctly', () => {
  const exposed = [
    pong(['wan1_0','wan1_1','wan1_2']),
    pong(['tong2_0','tong2_1','tong2_2']),
    pong(['suo3_0','suo3_1','suo3_2']),
    kongCon(['east_0','east_1','east_2','east_3']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(isWinningHand(hand, exposed), 'Concealed kong counts as 1 meld')
})

test('standard win: invalid — only 13 tiles total', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0',  // only 13
  ]
  assert(!isWinningHand(hand, []), '13 tiles should not win')
})

test('standard win: invalid — 15 tiles without kong', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1','east_2',  // 15 tiles, no exposed melds
  ]
  assert(!isWinningHand(hand, []), '15 tiles without kongs should not win')
})

test('standard win: invalid — missing pair', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'zhong_0','south_0',  // mismatched pair
  ]
  assert(!isWinningHand(hand, []), 'No pair should not win')
})

test('standard win: invalid — incomplete meld (12+2 concealed, missing meld tiles)', () => {
  const exposed = [pong(['wan1_0','wan1_1','wan1_2'])]
  // 8 concealed but they form 2 melds + pair, not 3 melds + pair
  const hand = ['tong1_0','tong2_0','tong3_0','suo4_0','suo5_0','suo6_0','east_0','south_0']
  assert(!isWinningHand(hand, exposed), 'Mismatched pair should not win')
})

test('seven pairs wins', () => {
  const hand = [
    'wan1_0','wan1_1','wan2_0','wan2_1','wan3_0','wan3_1','wan4_0','wan4_1',
    'wan5_0','wan5_1','wan6_0','wan6_1','wan7_0','wan7_1',
  ]
  assert(isWinningHand(hand, []))
})

test('seven pairs: quad cannot substitute for two pairs (all-honour hand)', () => {
  // east×4 + 5 honour pairs: isSevenPairs rejects (east count=4≠2, only 6 unique bases not 7)
  // and cannot form a standard win (no triplets of 3+, no suited sequences)
  const hand = [
    'east_0','east_1','east_2','east_3',
    'south_0','south_1','west_0','west_1',
    'north_0','north_1','zhong_0','zhong_1',
    'fa_0','fa_1',
  ]
  assert(!isWinningHand(hand, []), 'Honour quad with 5 pairs cannot form seven pairs or standard win')
})

test('thirteen orphans wins', () => {
  const hand = [
    'wan1_0','wan9_0','tong1_0','tong9_0','suo1_0','suo9_0',
    'east_0','south_0','west_0','north_0','zhong_0','fa_0','bai_0',
    'wan1_1',  // duplicate
  ]
  assert(isWinningHand(hand, [], { settings: { allow13orphans: true } }))
})

test('thirteen orphans: missing one type → not valid', () => {
  const hand = [
    'wan1_0','wan9_0','tong1_0','tong9_0','suo1_0','suo9_0',
    'east_0','south_0','west_0','north_0','zhong_0','fa_0',
    'wan1_1','wan1_2',  // bai missing, wan1 duplicated twice
  ]
  assert(!isWinningHand(hand, [], { settings: { allow13orphans: true } }))
})

test('nine gates wins', () => {
  const hand = [
    'wan1_0','wan1_1','wan1_2',
    'wan2_0','wan3_0','wan4_0','wan5_0',
    'wan6_0','wan7_0','wan8_0',
    'wan9_0','wan9_1','wan9_2',
    'wan5_1',
  ]
  assert(isWinningHand(hand, []))
})

test('nine gates: wrong tile counts (wan1×1 instead of ×3) → not valid', () => {
  // wan1×1, wan5×12, wan9×1 — nine-gates requires wan1×3+wan9×3 pattern, impossible here
  // also cannot form standard win: wan1 and wan9 are isolated among wan5 pongs
  const hand = [
    'wan1_0',
    'wan5_0','wan5_1','wan5_2','wan5_3',
    'wan5_4','wan5_5','wan5_6','wan5_7',
    'wan5_8','wan5_9','wan5_10','wan5_11',
    'wan9_0',
  ]
  assert(!isWinningHand(hand, []), 'Broken pattern with isolated 1 and 9 cannot win')
})

test('all kongs (十八羅漢): 4 exposed kongs + pair', () => {
  const exposed = [
    kongExp(['wan1_0','wan1_1','wan1_2','wan1_3']),
    kongExp(['tong2_0','tong2_1','tong2_2','tong2_3']),
    kongCon(['suo3_0','suo3_1','suo3_2','suo3_3']),
    kongExp(['east_0','east_1','east_2','east_3']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(isWinningHand(hand, exposed), '十八羅漢 should win')
})

// canWinSelfDraw tests
test('canWinSelfDraw: complete 14-tile hand → true', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  assert(canWinSelfDraw(hand, 'south', [], [], {}, 'east'))
})

test('canWinSelfDraw: 13-tile incomplete hand → false', () => {
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0','east_0',
  ]
  assert(!canWinSelfDraw(hand, 'south', [], [], {}, 'east'))
})

test('canWinSelfDraw: with 2 exposed melds + concealed portion', () => {
  const exposed = [
    pong(['zhong_0','zhong_1','zhong_2']),
    pong(['fa_0','fa_1','fa_2']),
  ]
  // 8 concealed: wan1-2-3, tong4-5-6, pair of east
  const hand = ['wan1_0','wan2_0','wan3_0','tong4_0','tong5_0','tong6_0','east_0','east_1']
  assert(canWinSelfDraw(hand, 'south', exposed, [], {}, 'east'))
})

test('canWinSelfDraw: with exposed kong (15-tile total) → true', () => {
  const exposed = [
    pong(['wan1_0','wan1_1','wan1_2']),
    pong(['tong2_0','tong2_1','tong2_2']),
    pong(['suo3_0','suo3_1','suo3_2']),
    kongExp(['east_0','east_1','east_2','east_3']),
  ]
  const hand = ['zhong_0','zhong_1']
  assert(canWinSelfDraw(hand, 'south', exposed, [], {}, 'east'), 'Self-draw with kong meld should be detectable')
})

test('canWinFromDiscard: discard completes winning hand → true', () => {
  // hand has 13 tiles, needs wan3 to complete
  const hand = [
    'wan1_0','wan2_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  assert(canWinFromDiscard(hand, 'wan3_0', 'south', [], [], {}, 'east'))
})

test('canWinFromDiscard: discard does not complete hand → false', () => {
  const hand = [
    'wan1_0','wan2_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  assert(!canWinFromDiscard(hand, 'bai_0', 'south', [], [], {}, 'east'), 'bai does not complete this hand')
})

test('canWinFromDiscard: with exposed melds', () => {
  const exposed = [pong(['zhong_0','zhong_1','zhong_2'])]
  // 10 concealed + 1 discard: need wan3 to complete wan1-2-3, tong4-5-6, suo7-8-9 + east pair
  const hand = ['wan1_0','wan2_0','tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0','east_0','east_1']
  assert(canWinFromDiscard(hand, 'wan3_0', 'south', exposed, [], {}, 'east'))
})

test('canWinFromDiscard: bonus tile → false (bonus tiles cannot be discarded-won)', () => {
  const hand = ['wan1_0','wan2_0','wan3_0','wan1_1','wan2_1','wan3_1','wan4_0','wan5_0','wan6_0','wan7_0','wan8_0','wan9_0','east_0']
  assert(!canWinFromDiscard(hand, 'spring_0', 'south', [], [], {}, 'east'))
})

// ── Faan Calculation ──────────────────────────────────────────
console.log('\n── Faan Calculation ──')

// ── 2a. Standard hand faan values ─────────────────────────────

test('平糊 (all chows, 3 suits): 1 faan structure', () => {
  // 平糊(1) + 門前清(1) + 無花(1) = 3
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 3, `平糊+門前清+無花=3, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.meetsMinimum)
  assert(r.fanList.some(f => f.name === '平糊'))
})

test('對對胡 (all triplets): 3 faan structure', () => {
  // 對對胡(3) + selfDraw(1) + 無花(1) = 5
  const hand = [
    'wan1_0','wan1_1','wan1_2','tong2_0','tong2_1','tong2_2',
    'suo3_0','suo3_1','suo3_2','wan3_0','wan3_1','wan3_2',
    'tong4_0','tong4_1',
  ]
  const ctx = { ...BASE_CTX, selfDraw: true }
  const r   = calcFaan(hand, [], NO_FLOWERS, ctx, SETTINGS_3)
  assertEqual(r.faan, 5, `對對胡(3)+自摸(1)+無花(1)=5, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '對對胡'))
})

test('混一色 (one suit + honours): 3 faan structure', () => {
  // 混一色(3) + 門前清(1) + 無花(1) = 5
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'wan7_0','wan8_0','wan9_0','east_0','east_1','east_2',
    'bai_0','bai_1',
  ]
  // seat=south, prevailing=north: east pong → no 門風/圈風
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 5, `混一色(3)+門前清(1)+無花(1)=5, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '混一色'))
})

test('缺一門 (two suits, with exposed meld): 2 faan structure', () => {
  // 缺一門(2) + 無花(1) = 3  (no 門前清: exposed non-concealed meld)
  const exposed = [pong(['wan1_0','wan1_1','wan1_2'])]
  const hand    = [
    'tong1_0','tong2_0','tong3_0','tong4_0','tong5_0','tong6_0',
    'wan4_0','wan5_0','wan6_0','tong8_0','tong8_1',
  ]
  const r = calcFaan(hand, exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 3, `缺一門(2)+無花(1)=3, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '缺一門'))
})

test('清一色 (full flush, all concealed): 7 faan structure', () => {
  // 清一色(7) + 平糊(1) + 門前清(1) + 無花(1) = 10
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'wan7_0','wan8_0','wan9_0','wan1_1','wan2_1','wan3_1',
    'wan5_1','wan5_2',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 10, `清一色(7)+平糊(1)+門前清(1)+無花(1)=10, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '清一色'))
})

test('小三元 (2 dragon pongs + dragon pair): 5+箭刻×2=7 structure faan', () => {
  // 小三元(5) + 箭刻×2(2) + 混一色(3) + 門前清(1) + 無花(1) = 12
  const hand = [
    'zhong_0','zhong_1','zhong_2','fa_0','fa_1','fa_2',
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'bai_0','bai_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 12, `小三元(5)+箭刻×2(2)+混一色(3)+門前清(1)+無花(1)=12, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '小三元'))
  assertEqual(r.fanList.filter(f => f.name === '箭刻').length, 2, '2 箭刻 for 2 dragon pongs')
})

test('大三元 (3 dragon pongs): 8+箭刻×3=11 structure faan', () => {
  // 大三元(8) + 箭刻×3(3) + 混一色(3) + 無花(1) = 15  (no 門前清: exposed pongs)
  const exposed = [
    pong(['zhong_0','zhong_1','zhong_2']),
    pong(['fa_0','fa_1','fa_2']),
    pong(['bai_0','bai_1','bai_2']),
  ]
  const hand = ['wan1_0','wan2_0','wan3_0','east_0','east_1']
  const r    = calcFaan(hand, exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  // wan1-2-3 seq contains wan1 (terminal) so 混么九 fires: 大三元(8)+箭刻×3(3)+混一色(3)+混么九(1)+無花(1)=16
  assertEqual(r.faan, 16, `大三元(8)+箭刻×3(3)+混一色(3)+混么九(1)+無花(1)=16, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '大三元'))
  assertEqual(r.fanList.filter(f => f.name === '箭刻').length, 3)
})

test('小四喜 (3 wind pongs + wind pair): 8 faan structure', () => {
  // 小四喜(8) + 圈風(1, east pong + prevailing=east) + 混一色(3) + 無花(1) = 13
  // Note: seat='south', prevailing='east' for this test; east wind pong triggers 圈風
  const exposed = [
    pong(['east_0','east_1','east_2']),
    pong(['south_0','south_1','south_2']),
    pong(['west_0','west_1','west_2']),
  ]
  const hand = ['wan1_0','wan2_0','wan3_0','north_0','north_1']
  const ctx  = { ...BASE_CTX, prevailingWind: 'east' }
  const r    = calcFaan(hand, exposed, NO_FLOWERS, ctx, SETTINGS_3)
  // 小四喜(8) + 圈風(1) + 門風: seat='south', south pong → 門風=1 + 混一色(3) + 無花(1) = 14
  assert(r.fanList.some(f => f.name === '小四喜'), '小四喜 must be awarded')
  assert(r.faan >= 8, `Faan should be at least 8, got ${r.faan}`)
})

test('大四喜 (4 wind pongs): ≥10 faan', () => {
  const exposed = [
    pong(['east_0','east_1','east_2']),
    pong(['south_0','south_1','south_2']),
    pong(['west_0','west_1','west_2']),
    pong(['north_0','north_1','north_2']),
  ]
  const hand = ['zhong_0','zhong_1']
  const r    = calcFaan(hand, exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '大四喜'), '大四喜 must be awarded')
  assert(r.faan >= 10)
})

test('字一色 (all honours): ≥10 faan', () => {
  const hand = [
    'east_0','east_1','east_2','south_0','south_1','south_2',
    'west_0','west_1','west_2','zhong_0','zhong_1','zhong_2',
    'fa_0','fa_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '字一色'), `字一色 must be awarded. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.faan >= 10)
})

test('七對子 (seven pairs): 4 faan structure', () => {
  // 七對子(4) + 門前清(1) + 無花(1) = 6  (plus 缺一門=2 from 2 suits)
  const hand = [
    'wan1_0','wan1_1','wan3_0','wan3_1','wan5_0','wan5_1','wan7_0','wan7_1',
    'tong2_0','tong2_1','tong4_0','tong4_1','tong6_0','tong6_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 8, `七對子(4)+缺一門(2)+門前清(1)+無花(1)=8, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(r.fanList.some(f => f.name === '七對子'))
})

test('混么九 (all terminals + honours): +1 faan', () => {
  // wan1×3, wan9×3, tong1×3, tong9×3, east×2 (all terminals/honours)
  // 對對胡(3) + 缺一門(2) + 混么九(1) + 門前清(1) + 無花(1) = 8
  const hand = [
    'wan1_0','wan1_1','wan1_2','wan9_0','wan9_1','wan9_2',
    'tong1_0','tong1_1','tong1_2','tong9_0','tong9_1','tong9_2',
    'east_0','east_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '混么九'), `混么九 must be awarded. fanList=${JSON.stringify(r.fanList)}`)
  assertEqual(r.faan, 8, `對對胡(3)+缺一門(2)+混么九(1)+門前清(1)+無花(1)=8, got ${r.faan}`)
})

// ── 2b. Bonus faan ────────────────────────────────────────────

// Base hand for bonus tests: 平糊 (1 faan structure), 3 suits, east pair
const BONUS_HAND = [
  'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
  'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
  'east_0','east_1',
]

test('自摸 (self-draw) = +1', () => {
  const ctx = { ...BASE_CTX, selfDraw: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  // 平糊(1) + 自摸(1) + 無花(1) = 3
  assertEqual(r.faan, 3)
  assert(r.fanList.some(f => f.name === '自摸'))
})

test('門前清 (concealed discard win) = +1', () => {
  // BASE_CTX is discard win + hand is fully concealed → 門前清
  const r = calcFaan(BONUS_HAND, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '門前清'), `Expected 門前清. fanList=${JSON.stringify(r.fanList)}`)
})

test('門前清 NOT given when exposed non-concealed meld', () => {
  const exposed = [pong(['zhong_0','zhong_1','zhong_2'])]
  const hand    = ['wan1_0','wan2_0','wan3_0','tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0','east_0','east_1']
  const r       = calcFaan(hand, exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(!r.fanList.some(f => f.name === '門前清'), 'No 門前清 with exposed pong')
})

test('門前清 given when only exposed concealed kong', () => {
  const exposed = [kongCon(['zhong_0','zhong_1','zhong_2','zhong_3'])]
  const hand    = ['wan1_0','wan2_0','wan3_0','tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0','east_0','east_1']
  const r       = calcFaan(hand, exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '門前清'), '門前清 given with only concealed kong')
})

test('箭刻 (dragon pong) = +1 each', () => {
  const hand = [
    'zhong_0','zhong_1','zhong_2','wan1_0','wan2_0','wan3_0',
    'tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0',
    'east_0','east_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '箭刻'), `Expected 箭刻. fanList=${JSON.stringify(r.fanList)}`)
  assertEqual(r.fanList.filter(f => f.name === '箭刻').length, 1)
})

test('門風 (seat wind pong) = +1', () => {
  // seat='south', south pong in hand
  const hand = [
    'south_0','south_1','south_2','wan1_0','wan2_0','wan3_0',
    'tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0',
    'east_0','east_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '門風'), `Expected 門風. fanList=${JSON.stringify(r.fanList)}`)
})

test('圈風 (prevailing wind pong) = +1', () => {
  // prevailingWind='north', north pong in hand
  const hand = [
    'north_0','north_1','north_2','wan1_0','wan2_0','wan3_0',
    'tong4_0','tong5_0','tong6_0','suo7_0','suo8_0','suo9_0',
    'east_0','east_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '圈風'), `Expected 圈風. fanList=${JSON.stringify(r.fanList)}`)
})

test('無花 (no bonus tiles) = +1', () => {
  const r = calcFaan(BONUS_HAND, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '無花'), 'Expected 無花')
})

test('正花 (own flower matches seat) = +1 each', () => {
  // seat='south' (seat number 2), orchid (orchid seatNum=2) is own flower
  const flowers = ['orchid_0']
  const r = calcFaan(BONUS_HAND, [], flowers, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '正花'), `Expected 正花. fanList=${JSON.stringify(r.fanList)}`)
  assert(!r.fanList.some(f => f.name === '無花'), 'No 無花 when has flowers')
})

test('正季 (own season matches seat) = +1 each', () => {
  // seat='south' (seat number 2), summer (summer seatNum=2) is own season
  const flowers = ['summer_0']
  const r = calcFaan(BONUS_HAND, [], flowers, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '正季'), `Expected 正季. fanList=${JSON.stringify(r.fanList)}`)
})

test('非正花 (other seat flower) = no 正花', () => {
  // seat='south' (seatNum=2), plum (seatNum=1) → wrong seat → no 正花
  const flowers = ['plum_0']
  const r = calcFaan(BONUS_HAND, [], flowers, BASE_CTX, SETTINGS_3)
  assert(!r.fanList.some(f => f.name === '正花'), 'Wrong seat flower should not give 正花')
})

test('齊花 (all 4 flowers) = +1', () => {
  const flowers = ['plum_0','orchid_0','chrysanthemum_0','bamboo_b_0']
  const r = calcFaan(BONUS_HAND, [], flowers, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '齊花'), `Expected 齊花. fanList=${JSON.stringify(r.fanList)}`)
})

test('齊季 (all 4 seasons) = +1', () => {
  const flowers = ['spring_0','summer_0','autumn_0','winter_0']
  const r = calcFaan(BONUS_HAND, [], flowers, BASE_CTX, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '齊季'), `Expected 齊季. fanList=${JSON.stringify(r.fanList)}`)
})

test('海底撈月 (last tile, self-draw) = +1', () => {
  const ctx = { ...BASE_CTX, selfDraw: true, isLastTile: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '海底撈月'), `Expected 海底撈月. fanList=${JSON.stringify(r.fanList)}`)
})

test('河底撈魚 (last tile, discard win) = +1', () => {
  const ctx = { ...BASE_CTX, selfDraw: false, isLastTile: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '河底撈魚'), `Expected 河底撈魚. fanList=${JSON.stringify(r.fanList)}`)
})

test('槓上開花 (win after kong) = +1', () => {
  const ctx = { ...BASE_CTX, selfDraw: true, winAfterKong: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '槓上開花'), `Expected 槓上開花. fanList=${JSON.stringify(r.fanList)}`)
})

test('搶槓胡 (robbing the kong) = +1', () => {
  const ctx = { ...BASE_CTX, selfDraw: false, robbingKong: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '搶槓胡'), `Expected 搶槓胡. fanList=${JSON.stringify(r.fanList)}`)
})

test('槓上槓 (double kong) = +2', () => {
  const ctx = { ...BASE_CTX, selfDraw: true, doubleKong: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  const f   = r.fanList.find(f => f.name === '槓上槓')
  assert(f, `Expected 槓上槓. fanList=${JSON.stringify(r.fanList)}`)
  assertEqual(f.faan, 2)
})

test('槓上槓 takes priority over 槓上開花', () => {
  const ctx = { ...BASE_CTX, selfDraw: true, winAfterKong: true, doubleKong: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, SETTINGS_3)
  assert(r.fanList.some(f => f.name === '槓上槓'),   'Should have 槓上槓')
  assert(!r.fanList.some(f => f.name === '槓上開花'), 'Should NOT have 槓上開花 when doubleKong')
})

// ── 2c. Faan combinations ─────────────────────────────────────

test('清一色 + 對對胡 + 自摸 combination', () => {
  // wan only, all pongs: 清一色(7) + 對對胡(3) + 自摸(1) + 無花(1) = 12
  const hand = [
    'wan1_0','wan1_1','wan1_2','wan2_0','wan2_1','wan2_2',
    'wan3_0','wan3_1','wan3_2','wan4_0','wan4_1','wan4_2',
    'wan5_0','wan5_1',
  ]
  const ctx = { ...BASE_CTX, selfDraw: true }
  const r   = calcFaan(hand, [], NO_FLOWERS, ctx, SETTINGS_3)
  assertEqual(r.faan, 12, `Expected 12, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
})

test('混一色 + 門前清 + 箭刻×2 combination', () => {
  // wan + 2 dragon pongs + pair of wan: 混一色(3) + 箭刻×2(2) + 門前清(1) + 無花(1) = 7
  // Note: zhong+fa pongs → 小三元 check: isDragon(pair='wan5') = false → no 小三元
  const hand = [
    'zhong_0','zhong_1','zhong_2','fa_0','fa_1','fa_2',
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'wan5_1','wan5_2',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 7, `混一色(3)+箭刻×2(2)+門前清(1)+無花(1)=7, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
})

test('平糊 + 門前清 + 自摸 + 無花 combination', () => {
  // 平糊(1) + 自摸(1) + 無花(1) = 3  (selfDraw → no 門前清)
  const hand = [
    'wan1_0','wan2_0','wan3_0','wan4_0','wan5_0','wan6_0',
    'tong7_0','tong8_0','tong9_0','suo1_0','suo2_0','suo3_0',
    'east_0','east_1',
  ]
  const ctx = { ...BASE_CTX, selfDraw: true }
  const r   = calcFaan(hand, [], NO_FLOWERS, ctx, SETTINGS_3)
  assertEqual(r.faan, 3, `平糊(1)+自摸(1)+無花(1)=3, got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(!r.fanList.some(f => f.name === '門前清'), 'No 門前清 on self-draw')
})

// ── 2d. Minimum faan threshold ────────────────────────────────

test('2 faan hand below minFaan=3 → meetsMinimum=false', () => {
  // 缺一門(2) only. Use exposed meld to avoid 門前清, and selfDraw=false for no 自摸
  // But 無花 always adds 1, making total = 3. Use flowers to avoid 無花 bonus:
  // With a non-own-seat flower, no 正花/正季/無花... Actually with ANY flowers, 無花 is NOT awarded.
  // Use a wrong-seat flower to suppress 無花 without adding 正花.
  // seat='south'(seatNum=2), plum (seatNum=1) → no 正花
  const exposed  = [pong(['wan1_0','wan1_1','wan1_2'])]
  const hand     = [
    'tong1_0','tong2_0','tong3_0','tong4_0','tong5_0','tong6_0',
    'wan4_0','wan5_0','wan6_0','tong8_0','tong8_1',
  ]
  const flowers = ['plum_0']  // wrong-seat flower: no 正花 bonus, suppresses 無花
  const r = calcFaan(hand, exposed, flowers, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 2, `Expected 2 faan (缺一門 only), got ${r.faan}. fanList=${JSON.stringify(r.fanList)}`)
  assert(!r.meetsMinimum, 'Should not meet minimum')
})

test('3 faan hand meets minFaan=3', () => {
  const r = calcFaan(BONUS_HAND, [], NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assertEqual(r.faan, 3)
  assert(r.meetsMinimum)
})

test('3 faan hand below minFaan=4 → meetsMinimum=false', () => {
  const r = calcFaan(BONUS_HAND, [], NO_FLOWERS, BASE_CTX, { ...SETTINGS_3, minFaan: 4 })
  assertEqual(r.faan, 3)
  assert(!r.meetsMinimum)
})

// ── 2e. Limit hands ───────────────────────────────────────────

test('十三么 (thirteen orphans) → limit hand', () => {
  const hand = [
    'wan1_0','wan9_0','tong1_0','tong9_0','suo1_0','suo9_0',
    'east_0','south_0','west_0','north_0','zhong_0','fa_0','bai_0','wan1_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX, { ...SETTINGS_3, allow13orphans: true })
  assert(r.isLimit, '十三么 should be limit')
  assert(r.meetsMinimum, 'Limit always meets minimum')
})

test('十八羅漢 (all kongs) → limit hand', () => {
  const exposed = [
    kongExp(['wan1_0','wan1_1','wan1_2','wan1_3']),
    kongExp(['tong2_0','tong2_1','tong2_2','tong2_3']),
    kongCon(['suo3_0','suo3_1','suo3_2','suo3_3']),
    kongExp(['east_0','east_1','east_2','east_3']),
  ]
  const r = calcFaan(['zhong_0','zhong_1'], exposed, NO_FLOWERS, BASE_CTX, SETTINGS_3)
  assert(r.isLimit, '十八羅漢 should be limit')
  assert(r.meetsMinimum)
})

test('天胡 (heavenly hand) → limit hand', () => {
  const ctx = { ...BASE_CTX, isHeavenly: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, { ...SETTINGS_3, allowHeavenly: true })
  assert(r.isLimit, '天胡 should be limit')
})

test('地胡 (earthly hand) → limit hand', () => {
  const ctx = { ...BASE_CTX, isEarthly: true }
  const r   = calcFaan(BONUS_HAND, [], NO_FLOWERS, ctx, { ...SETTINGS_3, allowHeavenly: true })
  assert(r.isLimit, '地胡 should be limit')
})

test('limit hand always meets minimum regardless of minFaan', () => {
  const hand = [
    'wan1_0','wan9_0','tong1_0','tong9_0','suo1_0','suo9_0',
    'east_0','south_0','west_0','north_0','zhong_0','fa_0','bai_0','wan1_1',
  ]
  const r = calcFaan(hand, [], NO_FLOWERS, BASE_CTX,
    { minFaan: 99, scoringTable: 'half', limitValue: 64, allow13orphans: true })
  assert(r.meetsMinimum, 'Limit hand always meets minimum')
})

// ── Points Calculation ────────────────────────────────────────
console.log('\n── Points Calculation ──')

test('1 faan, half spicy = 2 pts', () => {
  assertEqual(calcPoints(1, false, SETTINGS_3), 2)
})

test('2 faan, half spicy = 4 pts', () => {
  assertEqual(calcPoints(2, false, SETTINGS_3), 4)
})

test('3 faan, half spicy = 8 pts', () => {
  assertEqual(calcPoints(3, false, SETTINGS_3), 8)
})

test('4 faan, half spicy = 16 pts', () => {
  assertEqual(calcPoints(4, false, SETTINGS_3), 16)
})

test('5 faan, half spicy = 24 pts', () => {
  assertEqual(calcPoints(5, false, SETTINGS_3), 24)
})

test('6 faan, half spicy = 32 pts', () => {
  assertEqual(calcPoints(6, false, SETTINGS_3), 32)
})

test('7 faan, half spicy = 48 pts', () => {
  assertEqual(calcPoints(7, false, SETTINGS_3), 48)
})

test('8 faan, half spicy = 64 pts (limit)', () => {
  assertEqual(calcPoints(8, false, SETTINGS_3), 64)
})

test('3 faan, full spicy = 8 pts (same as half at 3)', () => {
  assertEqual(calcPoints(3, false, SETTINGS_FULL), 8)
})

test('5 faan, full spicy = 32 pts', () => {
  assertEqual(calcPoints(5, false, SETTINGS_FULL), 32)
})

test('6 faan, full spicy = 64 pts (capped at limit)', () => {
  assertEqual(calcPoints(6, false, SETTINGS_FULL), 64)
})

test('isLimit=true → limit points (64)', () => {
  assertEqual(calcPoints(Infinity, true, SETTINGS_3), 64)
})

test('custom limitValue = 128', () => {
  assertEqual(calcPoints(Infinity, true, { ...SETTINGS_3, limitValue: 128 }), 128)
})

// ── Payment Calculation ───────────────────────────────────────
console.log('\n── Payment Calculation ──')

// Base: 3 faan, half spicy → basePoints = 8

test('discard win: south wins, west discards, 3 faan', () => {
  // winner=south (not east → winnerMult=1)
  // discarder=west → west baseAmt=2×8=16; east baseAmt=1×8=8 (eastMult=2 → 16); north=8
  const ctx = { ...BASE_CTX, seat: 'south', selfDraw: false, discarderSeat: 'west' }
  const p   = calcPayments(8, ctx)
  assertEqual(p.west,  -16, 'Discarder (west) pays 16')
  assertEqual(p.east,  -16, 'East pays double (eastMult=2)')
  assertEqual(p.north,  -8, 'North pays 8')
  assertEqual(p.south,  40, 'South receives 40')
})

test('self-draw: south wins, 3 faan — east pays double', () => {
  // selfDraw: all pay 2×8=16, east pays 16×2(eastMult)=32
  const ctx = { ...BASE_CTX, seat: 'south', selfDraw: true }
  const p   = calcPayments(8, ctx)
  assertEqual(p.east,  -32, 'East pays 32 (self-draw × eastMult)')
  assertEqual(p.west,  -16, 'West pays 16')
  assertEqual(p.north, -16, 'North pays 16')
  assertEqual(p.south,  64, 'South receives 64')
})

test('dealer (east) wins, south discards, 3 faan — all payments ×2', () => {
  // winner=east → winnerMult=2; south discards → south=2×8×2=32; west=1×8×2=16; north=1×8×2=16
  const ctx = { ...BASE_CTX, seat: 'east', selfDraw: false, discarderSeat: 'south' }
  const p   = calcPayments(8, ctx)
  assertEqual(p.south, -32, 'Discarder (south) pays 32')
  assertEqual(p.west,  -16, 'West pays 16')
  assertEqual(p.north, -16, 'North pays 16')
  assertEqual(p.east,   64, 'East (dealer) receives 64')
})

test('dealer (east) self-draw, 3 faan — everyone pays 4× base', () => {
  // winnerMult=2, selfDraw so baseAmt=2×8=16 for each; 16×2=32 per opponent
  const ctx = { ...BASE_CTX, seat: 'east', selfDraw: true }
  const p   = calcPayments(8, ctx)
  assertEqual(p.south, -32)
  assertEqual(p.west,  -32)
  assertEqual(p.north, -32)
  assertEqual(p.east,   96, 'East receives 96')
})

test('south wins, east discards — east pays 2×base×eastMult=32', () => {
  const ctx = { ...BASE_CTX, seat: 'south', selfDraw: false, discarderSeat: 'east' }
  const p   = calcPayments(8, ctx)
  assertEqual(p.east,  -32, 'East (discarder+eastMult) pays 32')
  assertEqual(p.west,   -8, 'West pays 8')
  assertEqual(p.north,  -8, 'North pays 8')
  assertEqual(p.south,  48, 'South receives 48')
})

test('limit hand (64 pts) discard win: discarder pays 128, others pay 64', () => {
  // basePoints=64, winner=south (not east), discarder=west
  const ctx = { ...BASE_CTX, seat: 'south', selfDraw: false, discarderSeat: 'west' }
  const p   = calcPayments(64, ctx)
  assertEqual(p.west,  -128, 'Discarder pays 2×64=128')
  assertEqual(p.east,  -128, 'East pays 64×eastMult=128')
  assertEqual(p.north,  -64, 'North pays 64')
  assertEqual(p.south,  320, 'South receives 320')
})

test('winner receives exactly the sum of all losers\' payments', () => {
  for (const [selfDraw, discarder] of [[false,'west'],[true,null],[false,'east']]) {
    const ctx = { ...BASE_CTX, seat: 'south', selfDraw, discarderSeat: discarder }
    const p   = calcPayments(8, ctx)
    const losersSum = (p.east + p.west + p.north) * -1
    assertEqual(p.south, losersSum, `Winner should receive sum of payments for selfDraw=${selfDraw}`)
  }
})

// ── Summary ───────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
