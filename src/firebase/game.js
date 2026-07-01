// ── game.js ───────────────────────────────────────────────────
// Phase 4: real-time game state, turn management, claim window

import {
  doc, getDoc, getDocFromServer, setDoc, updateDoc,
  runTransaction, onSnapshot,
  serverTimestamp, increment, Timestamp, deleteField,
} from 'firebase/firestore'
import { db } from './config'
import {
  dealHand, drawFromWall, drawFromDeadWall,
  discardTile as engineDiscard,
} from '../engine/dealing.js'
import {
  canPong, canChow, canKongFromDiscard,
  canKongConcealed, canKongAdded,
  canWinFromDiscard, canWinSelfDraw,
  resolveClaims as engineResolveClaims,
  applyPong, applyChow,
  applyKongFromDiscard, applyKongConcealed, applyKongAdded,
} from '../engine/claims.js'
import { tileBase, nextSeat, SEAT_ORDER } from '../engine/tiles.js'
import { isWinningHand } from '../engine/winning.js'
import { calcFaan, calcPoints, calcPayments } from '../engine/scoring.js'

// rooms/{roomId}/hands/{wind} — private hand per player
function handRef(roomId, wind) {
  return doc(db, 'rooms', roomId, 'hands', wind)
}

// ── Sequence tracer ───────────────────────────────────────────
// Logs every Firestore write that mutates turn/phase/pool so the
// full game sequence is visible in one column of the console.
// Format: [SEQ] ACTION | actor=SEAT | →phase=PHASE turn=SEAT pool=N | notes
function _seq(action, actor, nextPhase, nextTurn, poolLen, notes = '') {
  const p = String(nextPhase).padEnd(12)
  const t = String(nextTurn).padEnd(6)
  console.log(`[SEQ] ${String(action).padEnd(20)} actor=${String(actor).padEnd(6)} │ →phase=${p} turn=${t} pool=${poolLen}${notes ? '  // ' + notes : ''}`)
}

// ── Start game ────────────────────────────────────────────────
export async function startGame(roomId) {
  const dealer = 'east'
  const state  = dealHand(dealer)

  await Promise.all(
    SEAT_ORDER.map(wind =>
      setDoc(handRef(roomId, wind), {
        hand:         state.hands[wind],
        exposedMelds: [],
      })
    )
  )

  await updateDoc(doc(db, 'rooms', roomId), {
    status:     'playing',
    handNumber: 1,
    roomScores: { east: 0, south: 0, west: 0, north: 0 },
    game: {
      dealer,
      prevailingWind: 'east',
      handsPlayed:    0,
      scores:         { east: 0, south: 0, west: 0, north: 0 },
    },
    hand: {
      dealer,
      wall:          state.wall,
      deadWall:      state.deadWall,
      discardPool:   [],
      lastDiscard:   null,
      currentTurn:   dealer,
      phase:         'discard',   // dealer has 14 tiles, discards first
      claimDeadline: null,
      claims:        {},
      flowers:       state.flowers,
      exposedMelds:  { east: [], south: [], west: [], north: [] },
      handSizes: {
        east:  state.hands.east.length,
        south: state.hands.south.length,
        west:  state.hands.west.length,
        north: state.hands.north.length,
      },
      tilesLeft: state.wall.length,
    },
    updatedAt: serverTimestamp(),
  })
  _seq('startGame', dealer, 'discard', dealer, 0, 'dealer has 14 tiles')
}

// ── Subscribe to own hand (private subcollection) ─────────────
export function subscribeToHand(roomId, wind, cb) {
  return onSnapshot(handRef(roomId, wind), snap => {
    if (snap.exists()) cb(snap.data())
  })
}

// ── Discard a tile ────────────────────────────────────────────
export async function discardTile(roomId, wind, tileId, claimTimeoutHours = 24) {
  let postCommitRoom = null

  await runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const hRef  = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    const room = rSnap.data()
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')
    if (room.hand.phase !== 'discard')  throw new Error('Not in discard phase')

    const { hand } = hSnap.data()
    const result   = engineDiscard(hand, tileId, room.hand.discardPool, wind)
    const deadline = new Date(Date.now() + claimTimeoutHours * 3_600_000).toISOString()

    tx.update(hRef, { hand: result.hand })
    tx.update(rRef, {
      'hand.discardPool':         result.discardPool,
      'hand.lastDiscard':         result.lastDiscard,
      'hand.phase':               'claim',
      'hand.claims':              {},
      'hand.claimDeadline':       deadline,
      [`hand.handSizes.${wind}`]: result.hand.length,
      updatedAt: serverTimestamp(),
    })
    _seq('discard', wind, 'claim', wind, result.discardPool.length,
      `tile=${tileId}  hand ${hand.length}→${result.hand.length}`)

    // Build the exact post-commit room state here so triggerAIClaims never
    // needs to re-read Firestore (which would hit the stale client cache).
    postCommitRoom = {
      ...room,
      hand: {
        ...room.hand,
        discardPool:   result.discardPool,
        lastDiscard:   result.lastDiscard,
        phase:         'claim',
        claims:        {},
        claimDeadline: deadline,
        handSizes:     { ...room.hand.handSizes, [wind]: result.hand.length },
      },
    }
  })

  triggerAIClaims(roomId, postCommitRoom)
    .catch(err => console.error('AI claims error:', err))
}

// ── Submit a claim (or pass) ──────────────────────────────────
// type: 'win' | 'pong' | 'kong' | 'chow' | 'pass'
// tiles: required for 'chow' — the 3-tile sequence [tileId, tileId, tileId]
export async function submitClaim(roomId, wind, type, tiles = null) {
  console.log('[submitClaim] START wind=%s type=%s tiles=%o', wind, type, tiles)
  await runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const rSnap = await tx.get(rRef)
    const phase = rSnap.data()?.hand?.phase
    if (phase !== 'claim') {
      console.warn('[submitClaim] REJECTED wind=%s type=%s — phase is "%s" not "claim"', wind, type, phase)
      throw new Error('Not in claim phase')
    }

    const claim = tiles ? { type, tiles } : { type }
    console.log('[submitClaim] writing claim=%o for wind=%s', claim, wind)
    tx.update(rRef, {
      [`hand.claims.${wind}`]: claim,
      updatedAt: serverTimestamp(),
    })
  })
  console.log('[submitClaim] COMMITTED wind=%s type=%s', wind, type)
}

// ── Resolve pending claims ────────────────────────────────────
// Call when all non-discarders submitted OR deadline passed.
// Idempotent: safe to call from multiple clients simultaneously.
export async function resolveClaims(roomId) {
  return runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const rSnap = await tx.get(rRef)
    if (!rSnap.exists()) throw new Error('Room not found')

    const room = rSnap.data()
    if (room.hand.phase !== 'claim') return { outcome: 'already_resolved' }

    const { lastDiscard, claims } = room.hand
    const activeClaims = Object.fromEntries(
      Object.entries(claims).filter(([, c]) => c.type !== 'pass')
    )

    console.log('[resolveClaims] allClaims=%o activeClaims=%o discardedBy=%s',
      claims, activeClaims, lastDiscard.discardedBy)

    // Pre-validate win claims: read hands, compute faan, drop wins below minFaan.
    // Caches scoring+context so the win block can reuse them without a second read.
    const winCandidates = Object.entries(activeClaims).filter(([, c]) => c.type === 'win')
    const winCache      = new Map()   // seat → { scoring, winContext }
    const validActive   = { ...activeClaims }

    for (const [claimSeat] of winCandidates) {
      const wSnap = await tx.get(handRef(roomId, claimSeat))
      if (!wSnap.exists()) { delete validActive[claimSeat]; continue }
      const { hand: wHand, exposedMelds: wMelds } = wSnap.data()
      const wFlowers  = room.hand.flowers?.[claimSeat] ?? []
      const wFullHand = [...wHand, lastDiscard.tileId]
      const wCtx      = {
        seat:           claimSeat,
        prevailingWind: room.game?.prevailingWind ?? 'east',
        selfDraw:       false,
        discarderSeat:  lastDiscard.discardedBy,
        isLastTile:     (room.hand.tilesLeft ?? 1) === 0,
        winAfterKong:   false,
        robbingKong:    lastDiscard.source === 'kong_added',
        isHeavenly:     false,
        isEarthly:      false,
        doubleKong:     false,
      }
      const wScore = calcFaan(wFullHand, wMelds, wFlowers, wCtx, room.settings)
      if (!wScore.meetsMinimum) {
        console.warn('[resolveClaims] win REJECTED %s: faan=%d < minFaan', claimSeat, wScore.faan)
        delete validActive[claimSeat]
      } else {
        winCache.set(claimSeat, { scoring: wScore, winContext: wCtx })
      }
    }

    const winner = engineResolveClaims(validActive, lastDiscard.discardedBy)

    console.log('[resolveClaims] winner=%o', winner)

    if (!winner) {
      const { discardedBy, source } = lastDiscard
      const poolLen = room.hand.discardPool?.length ?? 0

      if (source === 'kong_added') {
        // Rob-the-kong window: all passed — declarer keeps the turn and draws replacement
        tx.update(rRef, {
          'hand.phase':       'draw_dead',
          'hand.currentTurn': discardedBy,
          'hand.claims':      {},
          updatedAt: serverTimestamp(),
        })
        _seq('resolve:all-pass(kong)', discardedBy, 'draw_dead', discardedBy, poolLen,
          `kong declarer=${discardedBy} draws dead-wall replacement`)
        return { outcome: 'draw_dead', seat: discardedBy }
      }

      const next = nextSeat(discardedBy)
      tx.update(rRef, {
        'hand.phase':       'draw',
        'hand.currentTurn': next,
        'hand.claims':      {},
        updatedAt: serverTimestamp(),
      })
      _seq('resolve:all-pass', '*', 'draw', next, poolLen,
        `discardedBy=${discardedBy}  nextSeat(${discardedBy})=${next}`)
      return { outcome: 'draw_tile', seat: next }
    }

    const { seat, claim } = winner

    if (claim.type === 'win') {
      // Re-use the scoring and context computed during pre-validation (no second tx.get needed)
      const { scoring, winContext } = winCache.get(seat)
      const poolLen    = room.hand.discardPool?.length ?? 0
      const basePoints = calcPoints(scoring.faan, scoring.isLimit, room.settings)
      const payments   = calcPayments(basePoints, winContext)

      const newScores = {}
      for (const w of SEAT_ORDER) {
        newScores[w] = (room.game?.scores?.[w] ?? 0) + (payments[w] ?? 0)
      }

      tx.update(rRef, {
        'hand.phase':     'finished',
        'hand.winner':    seat,
        'hand.winResult': {
          faan:         scoring.faan,
          isLimit:      scoring.isLimit,
          fanList:      scoring.fanList,
          meetsMinimum: scoring.meetsMinimum,
          basePoints,
          payments,
          winningTile:  lastDiscard.tileId,
          discarderSeat: lastDiscard.discardedBy,
          selfDraw:     false,
        },
        'game.scores':    newScores,
        updatedAt: serverTimestamp(),
      })
      _seq('resolve:win', seat, 'finished', seat, poolLen,
        `faan=${scoring.faan} basePoints=${basePoints}`)
      return { outcome: 'win', seat }
    }

    // All non-win claims need the claimant's hand
    const hRef  = handRef(roomId, seat)
    const hSnap = await tx.get(hRef)
    const { hand: playerHand, exposedMelds } = hSnap.data()

    const poolWithoutClaimed = (room.hand.discardPool ?? []).slice(0, -1)

    if (claim.type === 'pong') {
      const r = applyPong(playerHand, lastDiscard.tileId, exposedMelds)
      r.exposedMelds.at(-1).claimedFrom = lastDiscard.discardedBy
      tx.update(hRef, { hand: r.hand, exposedMelds: r.exposedMelds })
      tx.update(rRef, {
        'hand.phase':                  'discard',
        'hand.currentTurn':            seat,
        'hand.claims':                 {},
        'hand.discardPool':            poolWithoutClaimed,
        [`hand.exposedMelds.${seat}`]: r.exposedMelds,
        [`hand.handSizes.${seat}`]:    r.hand.length,
        updatedAt: serverTimestamp(),
      })
      _seq('resolve:pong', seat, 'discard', seat, poolWithoutClaimed.length,
        `tile=${lastDiscard.tileId} from=${lastDiscard.discardedBy}  claimer must discard next`)
      return { outcome: 'pong', seat }
    }

    if (claim.type === 'kong') {
      const r = applyKongFromDiscard(playerHand, lastDiscard.tileId, exposedMelds, lastDiscard.discardedBy)
      tx.update(hRef, { hand: r.hand, exposedMelds: r.exposedMelds })
      tx.update(rRef, {
        'hand.phase':                  'draw_dead',
        'hand.currentTurn':            seat,
        'hand.claims':                 {},
        'hand.discardPool':            poolWithoutClaimed,
        [`hand.exposedMelds.${seat}`]: r.exposedMelds,
        [`hand.handSizes.${seat}`]:    r.hand.length,
        updatedAt: serverTimestamp(),
      })
      _seq('resolve:kong', seat, 'draw_dead', seat, poolWithoutClaimed.length,
        `tile=${lastDiscard.tileId} from=${lastDiscard.discardedBy}  claimer draws dead wall`)
      return { outcome: 'kong', seat }
    }

    if (claim.type === 'chow') {
      console.log('[resolveClaims] chow: seat=%s claimTiles=%o discardTile=%s handSize=%d',
        seat, claim.tiles, lastDiscard.tileId, playerHand.length)
      const r = applyChow(playerHand, claim.tiles, lastDiscard.tileId, exposedMelds, lastDiscard.discardedBy)
      console.log('[resolveClaims] chow applied: hand %d→%d exposedMelds count=%d',
        playerHand.length, r.hand.length, r.exposedMelds.length)
      tx.update(hRef, { hand: r.hand, exposedMelds: r.exposedMelds })
      tx.update(rRef, {
        'hand.phase':                  'discard',
        'hand.currentTurn':            seat,
        'hand.claims':                 {},
        'hand.discardPool':            poolWithoutClaimed,
        [`hand.exposedMelds.${seat}`]: r.exposedMelds,
        [`hand.handSizes.${seat}`]:    r.hand.length,
        updatedAt: serverTimestamp(),
      })
      _seq('resolve:chow', seat, 'discard', seat, poolWithoutClaimed.length,
        `tile=${lastDiscard.tileId} from=${lastDiscard.discardedBy}  claimer must discard next`)
      console.log('[resolveClaims] chow COMMITTED: phase→discard currentTurn→%s', seat)
      return { outcome: 'chow', seat }
    }

    return { outcome: 'none' }
  })
}

// ── Draw from live wall ───────────────────────────────────────
export async function drawTile(roomId, wind) {
  return runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const hRef  = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    const room = rSnap.data()
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')
    if (room.hand.phase !== 'draw')     throw new Error('Not in draw phase')

    const { hand } = hSnap.data()
    const result   = drawFromWall(
      room.hand.wall, room.hand.deadWall,
      hand, room.hand.flowers[wind] || [], wind
    )

    if (result.exhausted) {
      tx.update(rRef, { 'hand.phase': 'exhausted', updatedAt: serverTimestamp() })
      _seq('draw:exhausted', wind, 'exhausted', wind, room.hand.discardPool?.length ?? 0)
      return { exhausted: true }
    }

    const flowerPatch = result.isBonus
      ? { [`hand.flowers.${wind}`]: [...(room.hand.flowers[wind] || []), result.drawnTile] }
      : {}

    tx.update(hRef, { hand: result.hand })
    tx.update(rRef, {
      'hand.wall':                result.wall,
      'hand.deadWall':            result.deadWall,
      'hand.tilesLeft':           result.wall.length,
      'hand.phase':               'discard',
      [`hand.handSizes.${wind}`]: result.hand.length,
      ...flowerPatch,
      updatedAt: serverTimestamp(),
    })
    const poolLen = room.hand.discardPool?.length ?? 0
    _seq('draw', wind, 'discard', wind, poolLen,
      `hand ${result.hand.length} tiles  tilesLeft=${result.wall.length}${result.isBonus ? '  BONUS-tile→redraw' : ''}`)
    return { exhausted: false, isBonus: result.isBonus }
  })
}

// ── Draw from dead wall (after kong) ─────────────────────────
export async function drawDeadWallTile(roomId, wind) {
  return runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const hRef  = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    const room = rSnap.data()
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')
    if (room.hand.phase !== 'draw_dead') throw new Error('Not in draw_dead phase')

    const { hand } = hSnap.data()
    const result   = drawFromDeadWall(
      room.hand.wall, room.hand.deadWall,
      hand, room.hand.flowers[wind] || []
    )

    if (result.exhausted) {
      tx.update(rRef, { 'hand.phase': 'exhausted', updatedAt: serverTimestamp() })
      _seq('draw_dead:exhausted', wind, 'exhausted', wind, room.hand.discardPool?.length ?? 0)
      return { exhausted: true }
    }

    tx.update(hRef, { hand: result.hand })
    tx.update(rRef, {
      'hand.deadWall':            result.deadWall,
      'hand.phase':               'discard',
      [`hand.handSizes.${wind}`]: result.hand.length,
      updatedAt: serverTimestamp(),
    })
    _seq('draw_dead', wind, 'discard', wind, room.hand.discardPool?.length ?? 0,
      `hand ${result.hand.length} tiles`)
    return { exhausted: false }
  })
}

// ── Declare concealed kong (暗槓) ────────────────────────────
// base: e.g. 'wan5' — the tile base of the four matching tiles
export async function declareConcealedKong(roomId, wind, base) {
  return runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const hRef  = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    const room = rSnap.data()
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')
    if (room.hand.phase !== 'discard')  throw new Error('Not in discard phase')

    const { hand, exposedMelds } = hSnap.data()
    const r = applyKongConcealed(hand, base, exposedMelds)

    tx.update(hRef, { hand: r.hand, exposedMelds: r.exposedMelds })
    tx.update(rRef, {
      'hand.phase':                   'draw_dead',
      [`hand.exposedMelds.${wind}`]:  r.exposedMelds,
      [`hand.handSizes.${wind}`]:     r.hand.length,
      updatedAt: serverTimestamp(),
    })
    _seq('kong_concealed', wind, 'draw_dead', wind, room.hand.discardPool?.length ?? 0,
      `base=${base}  draws from dead wall next`)
  })
}

// ── Declare added kong (加槓) ─────────────────────────────────
// Opens a short rob-the-kong claim window for other players
export async function declareAddedKong(roomId, wind, base, claimTimeoutHours = 24) {
  let postCommitRoom = null

  await runTransaction(db, async tx => {
    const rRef  = doc(db, 'rooms', roomId)
    const hRef  = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    const room = rSnap.data()
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')
    if (room.hand.phase !== 'discard')  throw new Error('Not in discard phase')

    const { hand, exposedMelds } = hSnap.data()
    const kongTile = hand.find(t => tileBase(t) === base)
    const r        = applyKongAdded(hand, base, exposedMelds)

    const deadline = new Date(Date.now() + claimTimeoutHours * 3_600_000).toISOString()

    // source:'kong_added' lets resolveClaims know that if everyone passes,
    // the declarer must draw from the dead wall (not the next player from the live wall).
    const lastDiscard = { tileId: kongTile, discardedBy: wind, source: 'kong_added' }

    tx.update(hRef, { hand: r.hand, exposedMelds: r.exposedMelds })
    tx.update(rRef, {
      'hand.phase':                   'claim',
      'hand.lastDiscard':             lastDiscard,
      'hand.claims':                  {},
      'hand.claimDeadline':           deadline,
      [`hand.exposedMelds.${wind}`]:  r.exposedMelds,
      [`hand.handSizes.${wind}`]:     r.hand.length,
      updatedAt: serverTimestamp(),
    })
    _seq('kong_added', wind, 'claim', wind, room.hand.discardPool?.length ?? 0,
      `tile=${kongTile}  rob-the-kong window open`)

    postCommitRoom = {
      ...room,
      hand: {
        ...room.hand,
        phase:        'claim',
        lastDiscard,
        claims:       {},
        claimDeadline: deadline,
        exposedMelds: { ...room.hand.exposedMelds, [wind]: r.exposedMelds },
        handSizes:    { ...room.hand.handSizes, [wind]: r.hand.length },
      },
    }
  })

  triggerAIClaims(roomId, postCommitRoom)
    .catch(err => console.error('AI claims error:', err))
}

// ── Derive available actions from current game state ──────────
// Pure function — no Firestore. Call after each room/hand update.
// Returns an object describing what the local player can do right now.
export function getAvailableActions(room, myHand, myExposedMelds, myWind) {
  if (!room?.hand || !myHand) return {}

  const { phase, currentTurn, lastDiscard, claims } = room.hand
  const myFlowers      = room.hand.flowers?.[myWind] || []
  const settings       = room.settings || {}
  const prevailingWind = room.game?.prevailingWind || 'east'

  if (phase === 'discard' && currentTurn === myWind) {
    return {
      mustDiscard:     true,
      concealedKongs:  canKongConcealed(myHand),
      addedKongs:      canKongAdded(myHand, myExposedMelds),
      canSelfDrawWin:  canWinSelfDraw(myHand, myWind, myExposedMelds, myFlowers, settings, prevailingWind),
    }
  }

  if (phase === 'claim' && lastDiscard?.discardedBy !== myWind && !claims?.[myWind]) {
    const { tileId, discardedBy } = lastDiscard
    // ── Kong eligibility debug log ────────────────────────────
    const _base        = tileBase(tileId)
    const _matchCount  = (myHand ?? []).filter(t => tileBase(t) === _base).length
    const _canKong     = _matchCount >= 3
    console.log(
      '[getAvailableActions] claim wind=%s discard=%s base=%s handLen=%d matches=%d canKong=%s | hand=%o',
      myWind, tileId, _base, (myHand ?? []).length, _matchCount, _canKong, myHand,
    )
    let canWin  = false
    let winFaan = null   // null = no structural win; number = faan count (may be below minimum)

    if (canWinFromDiscard(myHand, tileId, myWind, myExposedMelds, myFlowers, settings, prevailingWind)) {
      const winCtx = {
        seat:           myWind,
        prevailingWind,
        selfDraw:       false,
        discarderSeat:  discardedBy,
        isLastTile:     (room.hand.tilesLeft ?? 1) === 0,
        winAfterKong:   false,
        robbingKong:    lastDiscard.source === 'kong_added',
        isHeavenly:     false,
        isEarthly:      false,
        doubleKong:     false,
      }
      const sc = calcFaan([...myHand, tileId], myExposedMelds, myFlowers, winCtx, settings)
      winFaan = sc.faan
      canWin  = sc.meetsMinimum
    }

    return {
      canWin,
      winFaan,
      canPong:     canPong(myHand, tileId),
      canKong:     canKongFromDiscard(myHand, tileId),
      chowOptions: canChow(myHand, tileId, discardedBy, myWind),
      canPass:     true,
    }
  }

  if (phase === 'draw'      && currentTurn === myWind) return { mustDraw:     true }
  if (phase === 'draw_dead' && currentTurn === myWind) return { mustDrawDead: true }

  return {}
}

// ── AI engine ─────────────────────────────────────────────────
// All functions below are pure helpers or fire-and-forget async.
// They are triggered automatically after discards / claim resolution.

const delay = ms => new Promise(r => setTimeout(r, ms))

// Score a tile's value in the context of a hand (higher = keep it).
function _scoreTile(tileId, hand) {
  const base   = tileBase(tileId)
  const others = hand.filter(t => t !== tileId)
  const oBase  = others.map(tileBase)
  const same   = oBase.filter(b => b === base).length

  const m = base.match(/^(wan|tong|suo)(\d)$/)
  if (!m) {
    // Honour tile — only valuable in multiples
    return same >= 2 ? 8 : same >= 1 ? 5 : 1
  }

  const [, suit, ns] = m
  const n = +ns

  if (same >= 2) return 10  // complete triplet
  if (same >= 1) return 8   // pair

  // Sequence connectivity: +2 per direct neighbour, +1 per skip-one
  let conn = 0
  if (n > 1 && oBase.includes(`${suit}${n - 1}`)) conn += 2
  if (n < 9 && oBase.includes(`${suit}${n + 1}`)) conn += 2
  if (n > 2 && oBase.includes(`${suit}${n - 2}`)) conn += 1
  if (n < 8 && oBase.includes(`${suit}${n + 2}`)) conn += 1

  const flexible = (n >= 3 && n <= 7) ? 1 : 0  // middle tiles are more flexible
  return 2 + conn + flexible
}

// ── Safety scoring ─────────────────────────────────────────────

// Build {tileBase → count} from all publicly visible tiles:
// discard pool + every seat's exposed melds.
function _buildSafetyMap(discardPool = [], allExposedMelds = {}) {
  const counts = {}
  for (const { tileId } of discardPool) {
    const b = tileBase(tileId)
    counts[b] = (counts[b] || 0) + 1
  }
  for (const seatMelds of Object.values(allExposedMelds)) {
    if (!Array.isArray(seatMelds)) continue
    for (const meld of seatMelds) {
      if (!Array.isArray(meld?.tiles)) continue
      for (const tid of meld.tiles) {
        const b = tileBase(tid)
        counts[b] = (counts[b] || 0) + 1
      }
    }
  }
  return counts
}

// How safe is it to discard this tile (higher = safer).
function _safetyScore(tileId, visibleCounts, tilesLeft) {
  const base = tileBase(tileId)
  const seen = visibleCounts[base] || 0
  if (seen >= 3) return 10   // ≥3 copies publicly visible → very safe
  if (seen === 2) return 5
  if (seen === 1) return 2
  const isHon = !base.match(/^(wan|tong|suo)\d$/)
  return (isHon && tilesLeft < 30) ? -2 : 0  // unseen honour in late game → dangerous
}

// ── 聽牌 (ready hand) detection ────────────────────────────────

const _READY_BASES = [
  'wan1','wan2','wan3','wan4','wan5','wan6','wan7','wan8','wan9',
  'tong1','tong2','tong3','tong4','tong5','tong6','tong7','tong8','tong9',
  'suo1','suo2','suo3','suo4','suo5','suo6','suo7','suo8','suo9',
  'east','south','west','north',
  'zhong','fa','bai',
]

// Check if a 13-tile-equivalent hand (private tiles + exposed counts to 13)
// is one tile away from winning.  The '_x' suffix on test tiles is a
// throwaway id that won't collide with any real tile id in the deck.
function _isReadyHand(hand13, exposedMelds = []) {
  const waitingFor = []
  for (const base of _READY_BASES) {
    if (isWinningHand([...hand13, `${base}_x`], exposedMelds, {})) {
      waitingFor.push(base)
    }
  }
  return waitingFor.length > 0 ? { isReady: true, waitingFor } : { isReady: false }
}

// Return the tile ID to discard.
// 1. Try every candidate; if discarding it leaves the hand 聽牌, pick the
//    safest such tile.
// 2. Otherwise pick lowest (connectivity - safetyScore).
// 3. On any error fall back to plain _scoreTile (existing behaviour).
function _aiChooseDiscard(hand, myExposedMelds = [], room = null) {
  try {
    const discardPool     = room?.hand?.discardPool    ?? []
    const allExposedMelds = room?.hand?.exposedMelds   ?? {}
    const tilesLeft       = room?.hand?.tilesLeft      ?? 999
    const safetyMap       = _buildSafetyMap(discardPool, allExposedMelds)

    // ── 聽牌 detection ──────────────────────────────────────────
    let readyCandidates = null
    try {
      readyCandidates = []
      for (const cid of hand) {
        const hand13 = hand.filter(t => t !== cid)
        const ready  = _isReadyHand(hand13, myExposedMelds)
        if (ready.isReady) readyCandidates.push({ cid, waitingFor: ready.waitingFor })
      }
    } catch (e) {
      console.warn('[AI] 聽牌 detection error:', e.message)
      readyCandidates = null
    }

    if (readyCandidates?.length > 0) {
      // Multiple tiles might enable 聽牌; pick the one that's safest to lose.
      let best       = readyCandidates[0]
      let bestSafety = _safetyScore(best.cid, safetyMap, tilesLeft)
      for (const rc of readyCandidates.slice(1)) {
        const s = _safetyScore(rc.cid, safetyMap, tilesLeft)
        if (s > bestSafety) { bestSafety = s; best = rc }
      }
      console.log('[AI] 聽牌! discard=%s safety=%d waiting=%s',
        best.cid, bestSafety, best.waitingFor.join(','))
      return best.cid
    }

    // ── Safe discard: lowest (connectivity - safety) ───────────
    let worst    = hand[0]
    let lowScore = _scoreTile(hand[0], hand) - _safetyScore(hand[0], safetyMap, tilesLeft)
    for (const t of hand.slice(1)) {
      const score = _scoreTile(t, hand) - _safetyScore(t, safetyMap, tilesLeft)
      if (score < lowScore) { lowScore = score; worst = t }
    }
    console.log('[AI] safe discard=%s conn=%d safety=%d',
      worst, _scoreTile(worst, hand), _safetyScore(worst, safetyMap, tilesLeft))
    return worst

  } catch (e) {
    // Fallback: original simple logic
    console.warn('[AI] _aiChooseDiscard error, falling back:', e.message)
    let worst = hand[0]
    let low   = _scoreTile(hand[0], hand)
    for (const t of hand.slice(1)) {
      const s = _scoreTile(t, hand)
      if (s < low) { low = s; worst = t }
    }
    return worst
  }
}

// Return the best claim { type, tiles? } an AI can make, or null (pass).
function _aiChooseClaim(hand, exposedMelds, tileId, discardedBy, mySeat, room) {
  const settings = room.settings || {}
  const prevWind = room.game?.prevailingWind || 'east'
  const flowers  = room.hand?.flowers?.[mySeat] || []

  if (canWinFromDiscard(hand, tileId, mySeat, exposedMelds, flowers, settings, prevWind)) {
    const wCtx = {
      seat: mySeat, prevailingWind: prevWind,
      selfDraw: false, discarderSeat: discardedBy,
      isLastTile: (room.hand?.tilesLeft ?? 1) === 0,
      winAfterKong: false, robbingKong: false,
      isHeavenly: false, isEarthly: false, doubleKong: false,
    }
    const sc = calcFaan([...hand, tileId], exposedMelds, flowers, wCtx, settings)
    if (sc.meetsMinimum) return { type: 'win' }
    console.log('[AI] %s: hand wins but faan=%d < min=%d, skipping win claim', mySeat, sc.faan, settings?.minFaan ?? 3)
  }

  // If 聽牌, skip pong/chow/kong — claiming would restructure the hand
  // and break the ready state.  Win was already handled above.
  try {
    const ready = _isReadyHand(hand, exposedMelds)
    if (ready.isReady) {
      console.log('[AI] %s is 聽牌 (waiting: %s) — passing %s',
        mySeat, ready.waitingFor.join(','), tileBase(tileId))
      return null
    }
  } catch { /* on error, fall through to normal claim logic */ }

  if (canKongFromDiscard(hand, tileId))
    return { type: 'kong' }
  if (canPong(hand, tileId))
    return { type: 'pong' }

  const chowOpts = canChow(hand, tileId, discardedBy, mySeat)
  if (chowOpts.length > 0)
    return { type: 'chow', tiles: chowOpts[0].tiles }

  return null  // pass
}

// Read an AI's private hand then discard the chosen tile.
async function _aiDiscard(roomId, wind, claimTimeoutHours, room = null) {
  // Server read: hand was just updated by drawTile/resolveClaims — bypass stale cache
  const hSnap = await getDocFromServer(handRef(roomId, wind))
  if (!hSnap.exists()) { console.warn('[AI] _aiDiscard %s: hand doc missing', wind); return }
  const { hand, exposedMelds: myExposedMelds } = hSnap.data()
  console.log('[AI] _aiDiscard %s: hand has %d tiles', wind, hand?.length ?? 0)
  if (!hand?.length) { console.warn('[AI] _aiDiscard %s: empty hand, skipping', wind); return }
  const tileId = _aiChooseDiscard(hand, myExposedMelds ?? [], room)
  if (!tileId) { console.warn('[AI] _aiDiscard %s: _aiChooseDiscard returned null', wind); return }
  // Verify the chosen tile is actually in hand (safety net)
  if (!hand.includes(tileId)) {
    console.warn('[AI] _aiDiscard %s: chosen tile %s not in hand — falling back', wind, tileId)
    const fallback = hand[0]
    await discardTile(roomId, wind, fallback, claimTimeoutHours)
    return
  }
  console.log('[AI] _aiDiscard %s: calling discardTile(%s)', wind, tileId)
  try {
    await discardTile(roomId, wind, tileId, claimTimeoutHours)
    console.log('[AI] _aiDiscard %s: discardTile OK', wind)
  } catch (e) {
    console.error('[AI] _aiDiscard %s: discardTile FAILED — %s', wind, e.message)
    throw e
  }
}

// Handle whatever action an AI seat needs to take right now.
// Guards on phase, so concurrent calls are safe (one wins, rest are no-ops).
export async function triggerAITurn(roomId) {
  // Server read: called after resolveClaims / draw — local cache may lag
  const rSnap = await getDocFromServer(doc(db, 'rooms', roomId))
  if (!rSnap.exists()) return
  const room = rSnap.data()
  if (!room?.hand) return

  const { phase, currentTurn } = room.hand
  console.log('[AI] triggerAITurn: phase=%s currentTurn=%s type=%s',
    phase, currentTurn, room.seats?.[currentTurn]?.type ?? '?')
  if (!currentTurn) return
  if (room.seats?.[currentTurn]?.type !== 'ai') return
  if (!['draw', 'draw_dead', 'discard'].includes(phase)) return

  const timeout = room.settings?.claimTimeoutHours ?? 24

  try {
    if (phase === 'draw') {
      console.log('[AI] %s drawing from wall', currentTurn)
      const res = await drawTile(roomId, currentTurn)
      console.log('[AI] %s draw complete — exhausted=%s', currentTurn, res?.exhausted)
      if (!res?.exhausted) await triggerAITurn(roomId)  // recurse into discard phase

    } else if (phase === 'draw_dead') {
      console.log('[AI] %s drawing from dead wall (post-kong)', currentTurn)
      const res = await drawDeadWallTile(roomId, currentTurn)
      if (!res?.exhausted) await triggerAITurn(roomId)

    } else if (phase === 'discard') {
      console.log('[AI] %s entering discard (post-claim or dealer start)', currentTurn)
      await _aiDiscard(roomId, currentTurn, timeout, room)
      console.log('[AI] %s discard step done', currentTurn)
      // _aiDiscard → discardTile → triggerAIClaims (handles the next claim window)
    }
  } catch (e) {
    // Concurrent client already acted — silently ignore phase/turn mismatches
    const benign = ['Not your turn', 'Not in draw phase',
                    'Not in discard phase', 'Not in draw_dead phase']
    if (!benign.some(msg => e.message?.includes(msg))) {
      console.error('AI turn error:', e)
    }
  }
}

// Submit AI claims for every AI seat that hasn't responded yet,
// then either resolve immediately (all submitted) or shorten the
// deadline to 5 s so humans must act quickly.
//
// knownRoom: the post-commit room state built inside the discardTile /
// declareAddedKong transaction — avoids a stale-cache getDoc immediately
// after the transaction commits (the client cache lags the server write).
export async function triggerAIClaims(roomId, knownRoom = null) {
  console.log('[AI] triggerAIClaims called', roomId)

  // Use the caller-supplied state when available; fall back to a
  // server-authoritative read (bypasses cache) when called without context.
  let room = knownRoom
  if (!room) {
    const rSnap = await getDocFromServer(doc(db, 'rooms', roomId))
    if (!rSnap.exists()) { console.log('[AI] room not found'); return }
    room = rSnap.data()
  }

  console.log('[AI] phase=%s currentTurn=%s', room?.hand?.phase, room?.hand?.currentTurn)
  if (room?.hand?.phase !== 'claim') { console.log('[AI] not claim phase — exit'); return }

  const { lastDiscard, claims } = room.hand
  if (!lastDiscard) { console.log('[AI] no lastDiscard — exit'); return }

  const { tileId, discardedBy } = lastDiscard
  const seats = room.seats || {}
  const seatTypes = Object.fromEntries(SEAT_ORDER.map(w => [w, seats[w]?.type ?? 'empty']))
  console.log('[AI] discardedBy=%s tile=%s seats=%o existingClaims=%o',
    discardedBy, tileId, seatTypes, claims)

  // Seats that still need to submit
  const pendingAI = SEAT_ORDER.filter(w =>
    w !== discardedBy &&
    seats[w]?.type === 'ai' &&
    !claims?.[w]
  )
  console.log('[AI] pendingAI=%o', pendingAI)

  // Submit AI claims sequentially to avoid concurrent-transaction 400 errors.
  // useGame.js:doResolve owns resolution — we only submit here, never resolve.
  for (const wind of pendingAI) {
    const hSnap = await getDocFromServer(handRef(roomId, wind))
    if (!hSnap.exists()) { console.log('[AI] hand missing for', wind); continue }

    const { hand, exposedMelds } = hSnap.data()
    const choice = _aiChooseClaim(hand, exposedMelds, tileId, discardedBy, wind, room)
    console.log('[AI] %s choosing: %s', wind, choice?.type ?? 'pass')
    try {
      await submitClaim(roomId, wind, choice?.type ?? 'pass', choice?.tiles ?? null)
      console.log('[AI] %s claim submitted OK', wind)
    } catch (e) {
      console.log('[AI] %s claim submit failed: %s', wind, e.message)
    }
  }
  console.log('[AI] AI claims submitted')
}

// ── Declare self-draw win (自摸) ──────────────────────────────
export async function declareSelfDrawWin(roomId, wind) {
  return runTransaction(db, async tx => {
    const rRef = doc(db, 'rooms', roomId)
    const hRef = handRef(roomId, wind)
    const [rSnap, hSnap] = await Promise.all([tx.get(rRef), tx.get(hRef)])

    if (!rSnap.exists()) throw new Error('Room not found')
    const room = rSnap.data()
    if (room.hand.phase !== 'discard')  throw new Error('Not in discard phase')
    if (room.hand.currentTurn !== wind) throw new Error('Not your turn')

    const { hand, exposedMelds } = hSnap.data()
    const flowers    = room.hand.flowers?.[wind] ?? []
    const winContext = {
      seat:           wind,
      prevailingWind: room.game?.prevailingWind ?? 'east',
      selfDraw:       true,
      discarderSeat:  null,
      isLastTile:     (room.hand.tilesLeft ?? 1) === 0,
      winAfterKong:   false,
      robbingKong:    false,
      isHeavenly:     false,
      isEarthly:      false,
      doubleKong:     false,
    }
    const scoring = calcFaan(hand, exposedMelds, flowers, winContext, room.settings)
    if (!scoring.meetsMinimum) {
      throw new Error(`Insufficient faan: ${scoring.faan} (minimum ${room.settings?.minFaan ?? 3})`)
    }
    const basePoints = calcPoints(scoring.faan, scoring.isLimit, room.settings)
    const payments   = calcPayments(basePoints, winContext)

    const newScores = {}
    for (const w of SEAT_ORDER) {
      newScores[w] = (room.game?.scores?.[w] ?? 0) + (payments[w] ?? 0)
    }

    tx.update(rRef, {
      'hand.phase':     'finished',
      'hand.winner':    wind,
      'hand.winResult': {
        faan:         scoring.faan,
        isLimit:      scoring.isLimit,
        fanList:      scoring.fanList,
        meetsMinimum: scoring.meetsMinimum,
        basePoints,
        payments,
        winningTile:  null,
        discarderSeat: null,
        selfDraw:     true,
      },
      'game.scores':    newScores,
      updatedAt: serverTimestamp(),
    })
    _seq('selfDrawWin', wind, 'finished', wind, room.hand.discardPool?.length ?? 0,
      `faan=${scoring.faan} basePoints=${basePoints}`)
    return { outcome: 'win', seat: wind }
  })
}

// ── Record win scores to user profiles ───────────────────────
// Idempotent: scoresRecorded flag prevents double-counting.
// Only updates human seats. Safe to call from multiple clients.
export async function recordWinScores(roomId) {
  const roomRef = doc(db, 'rooms', roomId)

  await runTransaction(db, async tx => {
    const rSnap = await tx.get(roomRef)
    if (!rSnap.exists()) return
    const room = rSnap.data()

    if (!room.hand?.winResult || room.hand?.scoresRecorded) return

    const { payments } = room.hand.winResult
    const seats = room.seats ?? {}

    tx.update(roomRef, { 'hand.scoresRecorded': true, updatedAt: serverTimestamp() })

    for (const [wind, seat] of Object.entries(seats)) {
      if (seat.type !== 'human' || !seat.uid) continue
      const payment = payments?.[wind] ?? 0
      tx.set(doc(db, 'users', seat.uid), {
        totalScore:  increment(payment),
        gamesPlayed: increment(1),
      }, { merge: true })
    }
  })
}

// ── Play-again flow ───────────────────────────────────────────

// Call once when hand.phase becomes 'finished' or 'exhausted'.
// Sets up the 13-second vote window (3s win-screen + 10s vote).
// Idempotent via transaction guard.
export async function initPlayAgain(roomId) {
  return runTransaction(db, async tx => {
    const roomRef = doc(db, 'rooms', roomId)
    const snap    = await tx.get(roomRef)
    if (!snap.exists()) return
    const room = snap.data()
    if (room.playAgainDeadline || room.closingAt) return
    const phase = room.hand?.phase
    if (phase !== 'finished' && phase !== 'exhausted') return

    tx.update(roomRef, {
      playAgainVotes:    { east: null, south: null, west: null, north: null },
      playAgainDeadline: Timestamp.fromDate(new Date(Date.now() + 13_000)),
      updatedAt:         serverTimestamp(),
    })
  })
}

// Record a human player's yes/no vote.
export async function submitPlayAgainVote(roomId, wind, vote) {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`playAgainVotes.${wind}`]: vote,
    updatedAt:                  serverTimestamp(),
  })
}

// Start a new hand when all human players voted yes.
// Rotates dealer, accumulates roomScores, resets hand state.
// Idempotent: no-ops if playAgainDeadline already cleared.
export async function startNewHand(roomId) {
  return runTransaction(db, async tx => {
    const roomRef = doc(db, 'rooms', roomId)
    const snap    = await tx.get(roomRef)
    if (!snap.exists()) return
    const room = snap.data()
    if (!room.playAgainDeadline) return   // already resolved

    const DEALER_ROT = { east: 'south', south: 'west', west: 'north', north: 'east' }
    const dealer = DEALER_ROT[room.game?.dealer ?? 'east'] ?? 'east'
    const state  = dealHand(dealer)

    const handScores     = room.game?.scores ?? { east: 0, south: 0, west: 0, north: 0 }
    const prevRoomScores = room.roomScores    ?? { east: 0, south: 0, west: 0, north: 0 }
    const newRoomScores  = {}
    for (const w of SEAT_ORDER) newRoomScores[w] = (prevRoomScores[w] ?? 0) + (handScores[w] ?? 0)

    tx.update(roomRef, {
      status:            'playing',
      handNumber:        (room.handNumber ?? 1) + 1,
      roomScores:        newRoomScores,
      playAgainVotes:    deleteField(),
      playAgainDeadline: deleteField(),
      closingAt:         deleteField(),
      game: {
        dealer,
        prevailingWind: room.game?.prevailingWind ?? 'east',
        handsPlayed:    (room.game?.handsPlayed ?? 0) + 1,
        scores:         { east: 0, south: 0, west: 0, north: 0 },
      },
      hand: {
        dealer,
        wall:          state.wall,
        deadWall:      state.deadWall,
        discardPool:   [],
        lastDiscard:   null,
        currentTurn:   dealer,
        phase:         'discard',
        claimDeadline: null,
        claims:        {},
        flowers:       state.flowers,
        exposedMelds:  { east: [], south: [], west: [], north: [] },
        handSizes: {
          east:  state.hands.east.length,
          south: state.hands.south.length,
          west:  state.hands.west.length,
          north: state.hands.north.length,
        },
        tilesLeft: state.wall.length,
      },
      updatedAt: serverTimestamp(),
    })

    for (const wind of SEAT_ORDER) {
      tx.set(handRef(roomId, wind), { hand: state.hands[wind], exposedMelds: [] })
    }
  })
}

// Transition room to closing phase (triggered by 'no' vote or timeout).
// Keeps playAgainVotes intact so UI can show who stopped the game.
export async function setRoomClosing(roomId) {
  return runTransaction(db, async tx => {
    const roomRef = doc(db, 'rooms', roomId)
    const snap    = await tx.get(roomRef)
    if (!snap.exists()) return
    const room = snap.data()
    if (room.closingAt)         return   // already set
    if (!room.playAgainDeadline) return  // already resolved another way

    tx.update(roomRef, {
      playAgainDeadline: deleteField(),
      closingAt:         Timestamp.fromDate(new Date(Date.now() + 10_000)),
      updatedAt:         serverTimestamp(),
    })
  })
}

// ── Auto-start when all invited players are seated ────────────
// Returns true if the game was started, false otherwise.
export async function startGameWhenReady(roomId) {
  const snap = await getDocFromServer(doc(db, 'rooms', roomId))
  if (!snap.exists()) return false
  const room = snap.data()
  if (room.status !== 'waiting') return false
  const invitedUids = room.invitedUids ?? []
  if (invitedUids.length === 0) return false
  const seatedUids = Object.values(room.seats ?? {})
    .filter(s => s.type === 'human')
    .map(s => s.uid)
  const allSeated = invitedUids.every(uid => seatedUids.includes(uid))
  if (!allSeated) return false
  await startGame(roomId)
  return true
}
