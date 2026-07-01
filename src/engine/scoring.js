// ════════════════════════════════════════════════════════════════
// scoring.js  —  Phase 5: Faan calculation and payment engine
//
// Entry points:
//   calcFaan(hand, exposedMelds, flowers, winContext, settings)
//   calcPoints(faan, isLimit, settings)
//   calcPayments(basePoints, winContext, settings)
//
// winContext: {
//   seat, prevailingWind, selfDraw, discarderSeat,
//   isLastTile, winAfterKong, robbingKong,
//   isHeavenly, isEarthly, doubleKong,
// }
// ════════════════════════════════════════════════════════════════

import {
  tileBase, isHonour,
  WINDS, DRAGONS, SEASONS, FLOWERS, BONUS_SEAT_NUMBER, SEAT_ORDER,
} from './tiles.js'

// ── Internal tile-category helpers ────────────────────────────
function isDragon(base)   { return DRAGONS.includes(base) }
function isWindBase(base) { return WINDS.includes(base) }

function suitOf(base) {
  const m = base.match(/^(wan|tong|suo)\d$/)
  return m ? m[1] : null
}

function baseIsTerminal(base) {
  const m = base.match(/^(wan|tong|suo)(\d)$/)
  return !!m && (m[2] === '1' || m[2] === '9')
}

// isHonour(base) works on bare bases (tileBase strips nothing when there's no suffix)
function baseIsTerminalOrHonour(base) {
  return baseIsTerminal(base) || isHonour(base)
}

// ── Special hand detectors ─────────────────────────────────────

const ORPHAN_BASES = [
  'wan1','wan9','tong1','tong9','suo1','suo9',
  'east','south','west','north','zhong','fa','bai',
]

function checkThirteenOrphans(hand, exposedMelds) {
  if (exposedMelds.length > 0 || hand.length !== 14) return false
  const bases  = hand.map(tileBase)
  const unique = new Set(bases)
  if (!ORPHAN_BASES.every(b => unique.has(b))) return false
  const counts = {}
  bases.forEach(b => { counts[b] = (counts[b] || 0) + 1 })
  return Object.values(counts).filter(c => c === 2).length === 1
}

function checkSevenPairs(hand, exposedMelds) {
  if (exposedMelds.length > 0 || hand.length !== 14) return false
  const counts = {}
  hand.forEach(t => { const b = tileBase(t); counts[b] = (counts[b] || 0) + 1 })
  const vals = Object.values(counts)
  return vals.length === 7 && vals.every(c => c === 2)
}

function checkAllKongs(hand, exposedMelds) {
  const kongs = exposedMelds.filter(m => m.type.startsWith('kong'))
  return kongs.length === 4 && hand.length === 2 && tileBase(hand[0]) === tileBase(hand[1])
}

function checkNineGates(hand, exposedMelds) {
  if (exposedMelds.length > 0 || hand.length !== 14) return false
  const bases = hand.map(tileBase)
  for (const suit of ['wan', 'tong', 'suo']) {
    if (!bases.every(b => b.startsWith(suit))) continue
    const nums  = bases.map(b => +b.slice(suit.length)).sort((a, b) => a - b)
    const base  = [1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9]
    const extra = [...nums]
    for (const n of base) {
      const idx = extra.indexOf(n)
      if (idx === -1) break
      extra.splice(idx, 1)
    }
    if (extra.length === 1) return true
  }
  return false
}

// ── Hand decomposition ─────────────────────────────────────────
// Returns all ways to partition `tiles` into `count` melds.
// Each meld: { type: 'seq'|'trip', bases: string[] }
function formMelds(tiles, count) {
  if (count === 0) return tiles.length === 0 ? [[]] : []

  const sorted = [...tiles].sort()
  const first  = sorted[0]
  const base   = tileBase(first)
  const out    = []

  // Try triplet
  if (sorted.filter(t => tileBase(t) === base).length >= 3) {
    const rest = removeN(sorted, base, 3)
    for (const sub of formMelds(rest, count - 1)) {
      out.push([{ type: 'trip', bases: [base, base, base] }, ...sub])
    }
  }

  // Try sequence (suited only)
  const sm = base.match(/^(wan|tong|suo)(\d)$/)
  if (sm) {
    const suit = sm[1], n = +sm[2]
    if (n <= 7) {
      const b2 = `${suit}${n + 1}`, b3 = `${suit}${n + 2}`
      if (sorted.some(t => tileBase(t) === b2) && sorted.some(t => tileBase(t) === b3)) {
        const rest = removeOnce(removeOnce(removeOnce(sorted, base), b2), b3)
        for (const sub of formMelds(rest, count - 1)) {
          out.push([{ type: 'seq', bases: [base, b2, b3] }, ...sub])
        }
      }
    }
  }

  return out
}

// Returns all { pair: base, concealedMelds: Meld[] } for the concealed hand.
function decomposeHand(hand, meldsNeeded) {
  const tried   = new Set()
  const results = []
  for (const tile of hand) {
    const pb = tileBase(tile)
    if (tried.has(pb)) continue
    if (hand.filter(t => tileBase(t) === pb).length < 2) continue
    tried.add(pb)
    const rest = removeN(hand, pb, 2)
    for (const melds of formMelds(rest, meldsNeeded)) {
      results.push({ pair: pb, concealedMelds: melds })
    }
  }
  return results
}

// ── Normalise Firestore exposed melds ─────────────────────────
function normaliseExposed(exposedMelds) {
  return exposedMelds.map(m => ({
    type:      m.type === 'chow' ? 'seq'
             : m.type === 'pong' ? 'trip'
             : 'kong',
    bases:     m.tiles.map(tileBase),
    concealed: m.type === 'kong_concealed',
  }))
}

// ── Bonus faan (same for any hand structure) ──────────────────
function addBonusFaan(fanList, exposedMelds, flowers, winContext, seat) {
  const { prevailingWind, selfDraw, isLastTile,
          winAfterKong, robbingKong, doubleKong } = winContext

  // Concealed win by discard (門前清)
  const fullyConcealed = exposedMelds.every(m => m.type === 'kong_concealed')
  if (!selfDraw && fullyConcealed) fanList.push({ name: '門前清', faan: 1 })

  if (selfDraw) fanList.push({ name: '自摸', faan: 1 })

  if (doubleKong)        fanList.push({ name: '槓上槓',  faan: 2 })
  else if (winAfterKong) fanList.push({ name: '槓上開花', faan: 1 })
  if (robbingKong)       fanList.push({ name: '搶槓胡',  faan: 1 })

  if (isLastTile &&  selfDraw) fanList.push({ name: '海底撈月', faan: 1 })
  if (isLastTile && !selfDraw) fanList.push({ name: '河底撈魚', faan: 1 })

  // Flower / season bonuses
  const seatNum    = SEAT_ORDER.indexOf(seat) + 1   // 1–4
  const bonusBases = (flowers ?? []).map(tileBase)

  if (bonusBases.length === 0) {
    fanList.push({ name: '無花', faan: 1 })
  } else {
    bonusBases.filter(b => FLOWERS.includes(b) && BONUS_SEAT_NUMBER[b] === seatNum)
              .forEach(() => fanList.push({ name: '正花', faan: 1 }))
    bonusBases.filter(b => SEASONS.includes(b) && BONUS_SEAT_NUMBER[b] === seatNum)
              .forEach(() => fanList.push({ name: '正季', faan: 1 }))
    if (FLOWERS.every(f => bonusBases.includes(f))) fanList.push({ name: '齊花', faan: 1 })
    if (SEASONS.every(s => bonusBases.includes(s))) fanList.push({ name: '齊季', faan: 1 })
  }
}

// ── Score one decomposition of a standard hand ────────────────
function scoreStandardDecomp(pair, concealedMelds, exposedMelds, flowers, winContext, settings) {
  const { seat, prevailingWind } = winContext

  const expNorm  = normaliseExposed(exposedMelds)
  const allMelds = [
    ...concealedMelds.map(m => ({ ...m, concealed: true })),
    ...expNorm,
  ]

  // All tile bases in the hand (pair appears twice, each meld contributes its bases)
  const allBases = [pair, pair, ...allMelds.flatMap(m => m.bases)]

  const fanList = []

  // ── Meld-structure faan ──────────────────────────────────────
  const allTrip = allMelds.every(m => m.type === 'trip' || m.type === 'kong')
  const allSeq  = allMelds.every(m => m.type === 'seq')
  if (allSeq)  fanList.push({ name: '平糊',  faan: 1 })
  if (allTrip) fanList.push({ name: '對對胡', faan: 3 })

  // ── Suit / flush faan (mutually exclusive groups) ────────────
  const usedSuits = [...new Set(allBases.map(suitOf).filter(Boolean))]
  const hasHon    = allBases.some(b => isHonour(b))

  if      (usedSuits.length === 0 && hasHon)  fanList.push({ name: '字一色', faan: 10 })
  else if (usedSuits.length === 1 && !hasHon) fanList.push({ name: '清一色', faan: 7  })
  else if (usedSuits.length === 1 && hasHon)  fanList.push({ name: '混一色', faan: 3  })
  else if (usedSuits.length === 2)            fanList.push({ name: '缺一門', faan: 2  })

  // ── Dragon triplets (箭刻 + 大三元 / 小三元) ──────────────────
  const dragonTrips = allMelds.filter(m =>
    (m.type === 'trip' || m.type === 'kong') && isDragon(m.bases[0])
  )
  if      (dragonTrips.length === 3)                    fanList.push({ name: '大三元', faan: 8 })
  else if (dragonTrips.length === 2 && isDragon(pair))  fanList.push({ name: '小三元', faan: 5 })
  dragonTrips.forEach(() => fanList.push({ name: '箭刻', faan: 1 }))

  // ── Wind triplets (大四喜 / 小四喜 + 門風 / 圈風) ─────────────
  const windTrips = allMelds.filter(m =>
    (m.type === 'trip' || m.type === 'kong') && isWindBase(m.bases[0])
  )
  if      (windTrips.length === 4)                      fanList.push({ name: '大四喜', faan: 10 })
  else if (windTrips.length === 3 && isWindBase(pair))  fanList.push({ name: '小四喜', faan: 8  })

  if (windTrips.some(m => m.bases[0] === seat))          fanList.push({ name: '門風', faan: 1 })
  if (windTrips.some(m => m.bases[0] === prevailingWind)) fanList.push({ name: '圈風', faan: 1 })

  // ── Mixed Terminals & Honours (混么九) ────────────────────────
  // Every meld contains ≥1 terminal or honour; pair is terminal or honour.
  const meldHasTOH = m => m.bases.some(baseIsTerminalOrHonour)
  if (baseIsTerminalOrHonour(pair) && allMelds.every(meldHasTOH)) {
    fanList.push({ name: '混么九', faan: 1 })
  }

  // ── Bonus faan ───────────────────────────────────────────────
  addBonusFaan(fanList, exposedMelds, flowers, winContext, seat)

  return { faan: fanList.reduce((s, f) => s + f.faan, 0), fanList }
}

// ── Score a Seven Pairs hand ──────────────────────────────────
function scoreSevenPairs(hand, flowers, winContext) {
  const allBases  = hand.map(tileBase)
  const usedSuits = [...new Set(allBases.map(suitOf).filter(Boolean))]
  const hasHon    = allBases.some(b => isHonour(b))
  const fanList   = [{ name: '七對子', faan: 4 }]

  if      (usedSuits.length === 0 && hasHon)  fanList.push({ name: '字一色', faan: 10 })
  else if (usedSuits.length === 1 && !hasHon) fanList.push({ name: '清一色', faan: 7  })
  else if (usedSuits.length === 1 && hasHon)  fanList.push({ name: '混一色', faan: 3  })
  else if (usedSuits.length === 2)            fanList.push({ name: '缺一門', faan: 2  })

  if (allBases.every(baseIsTerminalOrHonour)) fanList.push({ name: '混么九', faan: 1 })

  addBonusFaan(fanList, [], flowers, winContext, winContext.seat)

  return { faan: fanList.reduce((s, f) => s + f.faan, 0), fanList }
}

// ── Main faan calculator ──────────────────────────────────────
// hand:         concealed tiles including the winning tile
// exposedMelds: Firestore meld objects ({ type, tiles, claimedFrom })
// flowers:      array of bonus tile IDs for the winner
// winContext:   see top of file
// settings:     room settings object
export function calcFaan(hand, exposedMelds, flowers, winContext, settings) {
  const minFaan = settings?.minFaan ?? 3

  // ── Limit hands ───────────────────────────────────────────────
  if (winContext.isHeavenly && settings?.allowHeavenly !== false) {
    return limitResult('天胡')
  }
  if (winContext.isEarthly && settings?.allowHeavenly !== false) {
    return limitResult('地胡')
  }
  if (checkThirteenOrphans(hand, exposedMelds) && settings?.allow13orphans !== false) {
    return limitResult('十三么')
  }
  if (checkAllKongs(hand, exposedMelds)) {
    return limitResult('十八羅漢')
  }
  if (checkNineGates(hand, exposedMelds) && settings?.allowNineGates) {
    return limitResult('九蓮寶燈')
  }

  // ── Seven Pairs ───────────────────────────────────────────────
  if (checkSevenPairs(hand, exposedMelds)) {
    const { faan, fanList } = scoreSevenPairs(hand, flowers, winContext)
    return { isLimit: false, faan, fanList, meetsMinimum: faan >= minFaan }
  }

  // ── Standard hand: try all decompositions, pick best ─────────
  const meldsNeeded = 4 - exposedMelds.length
  const decomps     = decomposeHand(hand, meldsNeeded)

  let bestFaan    = 0
  let bestFanList = []

  for (const { pair, concealedMelds } of decomps) {
    const { faan, fanList } = scoreStandardDecomp(
      pair, concealedMelds, exposedMelds, flowers, winContext, settings
    )
    if (faan > bestFaan) {
      bestFaan    = faan
      bestFanList = fanList
    }
  }

  return {
    isLimit:      false,
    faan:         bestFaan,
    fanList:      bestFanList,
    meetsMinimum: bestFaan >= minFaan,
  }
}

function limitResult(name) {
  return { isLimit: true, faan: Infinity, fanList: [{ name, faan: '滿貫' }], meetsMinimum: true }
}

// ── Faan → base points ────────────────────────────────────────
export function calcPoints(faan, isLimit, settings) {
  const limit = settings?.limitValue ?? 64
  if (isLimit || !isFinite(faan)) return limit

  let pts
  if ((settings?.scoringTable ?? 'half') === 'full') {
    pts = Math.pow(2, faan)
  } else {
    // Half Spicy: 2^faan up to 4; above 4 doubles every 2 faan, odd = 1.5× previous
    if (faan <= 4) {
      pts = Math.pow(2, faan)
    } else {
      const evenFaan = faan % 2 === 0 ? faan : faan - 1
      const evenPts  = 16 * Math.pow(2, (evenFaan - 4) / 2)
      pts = faan % 2 === 0 ? evenPts : evenPts * 1.5
    }
  }

  return Math.min(pts, limit)
}

// ── Payment calculation ───────────────────────────────────────
// Returns { east, south, west, north }
//   positive → seat RECEIVES (the winner)
//   negative → seat PAYS
export function calcPayments(basePoints, winContext) {
  const { seat: winnerSeat, selfDraw, discarderSeat } = winContext
  const losers      = SEAT_ORDER.filter(s => s !== winnerSeat)
  const winnerMult  = winnerSeat === 'east' ? 2 : 1
  const payments    = {}
  let   winnerTotal = 0

  for (const loser of losers) {
    const eastMult = (loser === 'east' && winnerSeat !== 'east') ? 2 : 1
    const baseAmt  = selfDraw
      ? 2 * basePoints
      : (loser === discarderSeat ? 2 * basePoints : 1 * basePoints)

    const amount    = baseAmt * winnerMult * eastMult
    payments[loser] = -amount
    winnerTotal    += amount
  }

  payments[winnerSeat] = winnerTotal
  return payments
}

// ── Array helpers ─────────────────────────────────────────────
function removeN(arr, base, n) {
  const copy = [...arr]
  let   left = n
  for (let i = copy.length - 1; i >= 0 && left > 0; i--) {
    if (tileBase(copy[i]) === base) { copy.splice(i, 1); left-- }
  }
  return copy
}

function removeOnce(arr, base) {
  const copy = [...arr]
  const idx  = copy.findIndex(t => tileBase(t) === base)
  if (idx !== -1) copy.splice(idx, 1)
  return copy
}
