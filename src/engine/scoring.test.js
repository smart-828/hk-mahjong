// ============================================================
// scoring.test.js
// Tests for faan calculation and payment engine
// Run with: node src/engine/scoring.test.js
// ============================================================

import { calcFaan, calcPoints, calcPayments } from './scoring.js'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`)
    failed++
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed') }
function eq(a, b, msg)     { if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`) }

// ── Tile ID helpers ───────────────────────────────────────────
// Build hand from base names (adds _0 suffix)
function tiles(...bases) { return bases.map(b => `${b}_0`) }

// Default win context (non-dealer, win by discard, no special conditions)
const ctx = (overrides = {}) => ({
  seat: 'south', prevailingWind: 'east',
  selfDraw: false, discarderSeat: 'west',
  isLastTile: false, winAfterKong: false,
  robbingKong: false, isHeavenly: false,
  isEarthly: false, doubleKong: false,
  ...overrides,
})

const settings = { minFaan: 3, scoringTable: 'half', limitValue: 64,
                   allow13orphans: true, allowHeavenly: true }

// ── calcPoints ────────────────────────────────────────────────
console.log('\n── calcPoints (半辣 Half Spicy) ──')

test('1 faan = 2', () => eq(calcPoints(1, false, settings), 2))
test('2 faan = 4', () => eq(calcPoints(2, false, settings), 4))
test('3 faan = 8', () => eq(calcPoints(3, false, settings), 8))
test('4 faan = 16', () => eq(calcPoints(4, false, settings), 16))
test('5 faan = 24', () => eq(calcPoints(5, false, settings), 24))
test('6 faan = 32', () => eq(calcPoints(6, false, settings), 32))
test('7 faan = 48', () => eq(calcPoints(7, false, settings), 48))
test('8 faan = 64 (hits limit)', () => eq(calcPoints(8, false, settings), 64))
test('9 faan = 64 (capped)', () => eq(calcPoints(9, false, settings), 64))
test('limit hand = limitValue', () => eq(calcPoints(Infinity, true, settings), 64))

console.log('\n── calcPoints (全辣 Full Spicy) ──')
const full = { ...settings, scoringTable: 'full' }
test('1 faan = 2',   () => eq(calcPoints(1, false, full), 2))
test('3 faan = 8',   () => eq(calcPoints(3, false, full), 8))
test('6 faan = 64',  () => eq(calcPoints(6, false, full), 64))
test('7 faan = 64 (capped)', () => eq(calcPoints(7, false, full), 64))

// ── calcPayments ──────────────────────────────────────────────
console.log('\n── calcPayments ──')

test('win by discard, non-dealer wins from non-East: 2:1 ratio + East-loser-doubles', () => {
  // Winner=south, discarder=west, base=8
  // Spec 2:1:1 base ratio: west pays 16, north pays 8
  // East is a loser → pays double non-discarder rate: 2×8=16 (not 8)
  // Total received: 16(west) + 16(east) + 8(north) = 40
  const p = calcPayments(8, ctx({ seat: 'south', selfDraw: false, discarderSeat: 'west' }))
  eq(p.west,  -16, `discarder pays 2×base=16`)
  eq(p.east,  -16, `east (loser) pays double non-discarder rate: 2×8=16`)
  eq(p.north, -8,  `north pays 1×base=8`)
  eq(p.south,  40, `south receives 16+16+8=40`)
})

test('self-draw: all 3 opponents pay 2× base', () => {
  const p = calcPayments(8, ctx({ seat: 'south', selfDraw: true }))
  assert(p.south > 0, 'winner receives positive')
  // Non-East losers (west, north) pay 2×8=16 each
  // East loser pays 2×8×2 = 32 (East loser doubles)
  eq(p.east,  -32, `east pays 32, got ${p.east}`)
  eq(p.west,  -16, `west pays 16, got ${p.west}`)
  eq(p.north, -16, `north pays 16, got ${p.north}`)
  eq(p.south, 64,  `south receives 64, got ${p.south}`)
})

test('east wins by self-draw: all pay 4× base', () => {
  const p = calcPayments(8, ctx({ seat: 'east', selfDraw: true }))
  // Winner is East → winnerMult=2. Each pays 2×8×2 = 32.
  eq(p.south, -32)
  eq(p.west,  -32)
  eq(p.north, -32)
  eq(p.east,   96)
})

test('east wins by discard: discarder pays 4× base, others pay 2× base', () => {
  const p = calcPayments(8, ctx({ seat: 'east', selfDraw: false, discarderSeat: 'south' }))
  eq(p.south, -32, `discarder south pays 2×8×2=32`)
  eq(p.west,  -16, `west pays 1×8×2=16`)
  eq(p.north, -16, `north pays 1×8×2=16`)
  eq(p.east,   64, `east receives 64`)
})

// ── calcFaan: limit hands ─────────────────────────────────────
console.log('\n── Limit Hands ──')

test('十三么 (Thirteen Orphans)', () => {
  const hand = tiles(
    'wan1','wan9','tong1','tong9','suo1','suo9',
    'east','south','west','north','zhong','fa','bai','wan1'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  assert(r.isLimit, 'should be limit')
  eq(r.fanList[0].name, '十三么')
})

test('天胡 (Heavenly Hand) — dealer', () => {
  const hand = tiles('wan1','wan2','wan3','wan4','wan5','wan6','wan7','wan8','wan9','tong1','tong1','tong1','fa','fa')
  const r = calcFaan(hand, [], [], ctx({ isHeavenly: true, seat: 'east' }), settings)
  assert(r.isLimit)
  eq(r.fanList[0].name, '天胡')
})

test('十八羅漢 (All Kongs)', () => {
  const pair  = tiles('wan1','wan1')
  const kongs = [
    { type: 'kong_exposed',   tiles: tiles('east','east','east','east'),   claimedFrom: 'north' },
    { type: 'kong_concealed', tiles: tiles('zhong','zhong','zhong','zhong'), claimedFrom: null },
    { type: 'kong_exposed',   tiles: tiles('wan9','wan9','wan9','wan9'),   claimedFrom: 'south' },
    { type: 'kong_added',     tiles: tiles('fa','fa','fa','fa'),           claimedFrom: 'west'  },
  ]
  const r = calcFaan(pair, kongs, [], ctx(), settings)
  assert(r.isLimit)
  eq(r.fanList[0].name, '十八羅漢')
})

// ── calcFaan: Seven Pairs ─────────────────────────────────────
console.log('\n── 七對子 (Seven Pairs) ──')

test('七對子 fan item = 4 faan (total includes bonus)', () => {
  const hand = tiles('wan1','wan1','wan3','wan3','wan5','wan5','wan7','wan7','tong2','tong2','tong4','tong4','suo6','suo6')
  const r = calcFaan(hand, [], [], ctx(), settings)
  assert(!r.isLimit)
  const qpItem = r.fanList.find(f => f.name === '七對子')
  assert(qpItem, 'should have 七對子 in fanList')
  eq(qpItem.faan, 4, '七對子 item should be 4 faan')
  // Total includes 門前清(1) + 無花(1) = 6 total
  eq(r.faan, 6, 'total = 4 + 門前清(1) + 無花(1)')
})

test('七對子 + 門前清 + no flowers = 4+1+1 = 6 faan', () => {
  const hand = tiles('wan1','wan1','wan3','wan3','wan5','wan5','wan7','wan7','tong2','tong2','tong4','tong4','suo6','suo6')
  const r = calcFaan(hand, [], [], ctx({ selfDraw: false }), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('無花'), 'should have 無花')
  assert(names.includes('門前清'), 'should have 門前清')
  eq(r.faan, 6)
})

test('七對子 清一色 = 4+7 = 11 faan', () => {
  const hand = tiles('wan1','wan1','wan3','wan3','wan5','wan5','wan7','wan7','wan2','wan2','wan4','wan4','wan6','wan6')
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('七對子'))
  assert(names.includes('清一色'))
  eq(r.faan, 7 + 4 + 1 /*無花*/ + 1 /*門前清*/)
})

// ── calcFaan: Standard hands ──────────────────────────────────
console.log('\n── Standard Hands ──')

test('平糊 (All Chows, 1 faan)', () => {
  // 1-2-3, 4-5-6, 7-8-9 wan + 1-2-3 tong + pair 5-5 tong
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'tong1','tong2','tong3',
    'tong5','tong5'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('平糊'), 'should have 平糊')
  assert(!names.includes('對對胡'), 'should NOT have 對對胡')
})

test('對對胡 (All Triplets, 3 faan)', () => {
  // 3× wan1 pong, 3× wan9 pong, 3× east pong, 3× zhong pong + pair south
  // wan1 and wan9 are suited → 混一色 (wan + honours); NOT 字一色
  const hand = tiles(
    'wan1','wan1','wan1',
    'wan9','wan9','wan9',
    'east','east','east',
    'zhong','zhong','zhong',
    'south','south'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('對對胡'), 'should have 對對胡')
  assert(names.includes('箭刻'), '中 pong → 箭刻')
  assert(names.includes('混一色'), 'wan + honours → 混一色 (not 字一色)')
  assert(!names.includes('字一色'), 'wan1/wan9 are suited tiles → NOT 字一色')
  assert(names.includes('混么九'), 'all melds contain terminal or honour → 混么九')
})

test('清一色 (Full Flush, 7 faan)', () => {
  // All wan tiles
  const hand = tiles(
    'wan1','wan1','wan1',
    'wan2','wan3','wan4',
    'wan5','wan6','wan7',
    'wan8','wan8','wan8',
    'wan9','wan9'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('清一色'), 'should have 清一色')
  assert(!names.includes('混一色'), 'should NOT have 混一色')
})

test('混一色 (Half Flush, 3 faan)', () => {
  // Mix wan + east wind
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'east','east','east',
    'wan1','wan1'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('混一色'), 'should have 混一色')
  assert(!names.includes('清一色'), 'should NOT have 清一色')
})

test('缺一門 (Voided Suit, 2 faan)', () => {
  // wan + tong, no suo
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong2','tong3',
    'tong4','tong5','tong6',
    'wan7','wan7'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('缺一門'), 'should have 缺一門')
  assert(!names.includes('混一色'), 'should NOT have 混一色')
  assert(!names.includes('清一色'), 'should NOT have 清一色')
})

test('大三元 (Great Three Dragons, 8 + 3×箭刻)', () => {
  // 3 dragon pongs + 1 sequence + pair
  const hand = tiles(
    'zhong','zhong','zhong',
    'fa','fa','fa',
    'bai','bai','bai',
    'wan1','wan2','wan3',
    'east','east'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('大三元'), 'should have 大三元')
  eq(names.filter(n => n === '箭刻').length, 3, 'should have 3× 箭刻')
})

test('小三元 (Small Three Dragons, 5 + 2×箭刻)', () => {
  // 2 dragon pongs + dragon pair + 1 sequence + 1 pong
  const hand = tiles(
    'zhong','zhong','zhong',
    'fa','fa','fa',
    'wan1','wan2','wan3',
    'tong1','tong1','tong1',
    'bai','bai'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('小三元'), 'should have 小三元')
  eq(names.filter(n => n === '箭刻').length, 2, 'should have 2× 箭刻')
  assert(!names.includes('大三元'), 'should NOT have 大三元')
})

test('門風 (Seat Wind Pong, 1 faan) — south seat', () => {
  const hand = tiles(
    'south','south','south',
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'wan7','wan7'
  )
  const r = calcFaan(hand, [], [], ctx({ seat: 'south', prevailingWind: 'east' }), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('門風'), 'should have 門風')
  assert(!names.includes('圈風'), 'east wind not in hand — no 圈風')
})

test('圈風 (Prevailing Wind Pong, 1 faan)', () => {
  // East is prevailing wind, hand has east pong but winner is south
  const hand = tiles(
    'east','east','east',
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'wan7','wan7'
  )
  const r = calcFaan(hand, [], [], ctx({ seat: 'south', prevailingWind: 'east' }), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('圈風'), 'should have 圈風 (east is prevailing, east pong in hand)')
  assert(!names.includes('門風'), 'south wind not in hand — no 門風')
})

test('雙風 (Seat = Prevailing Wind, 2 faan)', () => {
  // East is both seat and prevailing wind, hand has east pong
  const hand = tiles(
    'east','east','east',
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'wan7','wan7'
  )
  const r = calcFaan(hand, [], [], ctx({ seat: 'east', prevailingWind: 'east' }), settings)
  const names = r.fanList.map(f => f.name)
  assert(names.includes('門風'), 'should have 門風')
  assert(names.includes('圈風'), 'should have 圈風')
  eq(names.filter(n => n === '門風' || n === '圈風').length, 2, '2 wind bonuses')
})

test('自摸 (Self-draw, 1 faan)', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'tong1','tong1','tong1',
    'suo1','suo1'
  )
  const r = calcFaan(hand, [], [], ctx({ selfDraw: true }), settings)
  assert(r.fanList.some(f => f.name === '自摸'), 'should have 自摸')
  assert(!r.fanList.some(f => f.name === '門前清'), 'self-draw should NOT have 門前清')
})

test('門前清 (Concealed win by discard, 1 faan)', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'tong1','tong1','tong1',
    'suo1','suo1'
  )
  const r = calcFaan(hand, [], [], ctx({ selfDraw: false }), settings)
  assert(r.fanList.some(f => f.name === '門前清'), 'should have 門前清')
  assert(!r.fanList.some(f => f.name === '自摸'), 'discard win should NOT have 自摸')
})

test('門前清 does NOT apply when exposed (non-kong) melds present', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'suo1','suo1'
  )
  const pong = [{ type: 'pong', tiles: tiles('tong1','tong1','tong1'), claimedFrom: 'west' }]
  const r = calcFaan(hand, pong, [], ctx({ selfDraw: false }), settings)
  assert(!r.fanList.some(f => f.name === '門前清'), 'exposed pong → no 門前清')
})

test('無花 (No flowers, 1 faan)', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'suo1','suo1','suo1',
    'east','east'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  assert(r.fanList.some(f => f.name === '無花'), 'should have 無花 (no flowers)')
})

test('正花 (Own flower — south seat has 蘭 = flower 2)', () => {
  // South = seat 2; 蘭 (orchid) maps to seat 2
  const flowers = ['orchid_0']   // orchid = 蘭, BONUS_SEAT_NUMBER.orchid = 2
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'suo1','suo1','suo1',
    'east','east'
  )
  const r = calcFaan(hand, [], flowers, ctx({ seat: 'south' }), settings)
  assert(r.fanList.some(f => f.name === '正花'), 'should have 正花 for matching flower')
  assert(!r.fanList.some(f => f.name === '無花'), 'has flower → no 無花')
})

test('槓上開花 (Win after Kong, 1 faan)', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'suo1','suo1','suo1',
    'east','east'
  )
  const r = calcFaan(hand, [], [], ctx({ selfDraw: true, winAfterKong: true }), settings)
  assert(r.fanList.some(f => f.name === '槓上開花'), 'should have 槓上開花')
  assert(!r.fanList.some(f => f.name === '槓上槓'), 'single kong → no 槓上槓')
})

test('槓上槓 (Double Kong, 2 faan) takes priority over 槓上開花', () => {
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'tong1','tong1','tong1',
    'suo1','suo1','suo1',
    'east','east'
  )
  const r = calcFaan(hand, [], [], ctx({ selfDraw: true, winAfterKong: true, doubleKong: true }), settings)
  assert(r.fanList.some(f => f.name === '槓上槓'), 'should have 槓上槓')
  assert(!r.fanList.some(f => f.name === '槓上開花'), '槓上槓 replaces 槓上開花')
})

test('混么九 (Mixed Terminals & Honours, 1 faan)', () => {
  // All melds are triplets of terminals/honours; pair is terminal
  const hand = tiles(
    'wan1','wan1','wan1',
    'wan9','wan9','wan9',
    'tong1','tong1','tong1',
    'east','east','east',
    'suo9','suo9'
  )
  const r = calcFaan(hand, [], [], ctx(), settings)
  assert(r.fanList.some(f => f.name === '混么九'), 'should have 混么九')
})

test('meetsMinimum false when below minFaan', () => {
  // 平糊 alone = 1 faan; with 無花 = 2; still below default minFaan=3
  const hand = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'tong1','tong2','tong3',
    'suo1','suo1'
  )
  // selfDraw=false (門前清 +1), 無花 (+1) → 1+1+1 = 3 faan (borderline)
  // Let's test with no 門前清 and 自摸 where we'd only get 1+1=2
  // Actually add exposed pong to remove 門前清
  const pong = [{ type: 'pong', tiles: tiles('tong4','tong4','tong4'), claimedFrom: 'north' }]
  const hand2 = tiles(
    'wan1','wan2','wan3',
    'wan4','wan5','wan6',
    'wan7','wan8','wan9',
    'suo1','suo1'
  )
  const r = calcFaan(hand2, pong, [], ctx({ selfDraw: false }), settings)
  // 平糊 (1) + 無花 (1) = 2 faan < minFaan 3
  eq(r.meetsMinimum, false, `expected false, got ${r.meetsMinimum} (faan=${r.faan})`)
})

// ── Summary ───────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
