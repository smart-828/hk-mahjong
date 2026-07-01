// ── useGame hook ──────────────────────────────────────────────
// Combines real-time room state with private hand subscription.
// Handles auto-resolution of the claim window.

import { useState, useEffect, useRef } from 'react'
import {
  subscribeToHand,
  getAvailableActions,
  resolveClaims,
  discardTile,
  submitClaim,
  drawTile,
  drawDeadWallTile,
  declareConcealedKong,
  declareAddedKong,
  triggerAITurn,
  declareSelfDrawWin,
  recordWinScores,
} from '../firebase/game.js'
import { SEAT_ORDER } from '../engine/tiles.js'

export function useGame(roomId, myWind, room) {
  const [myHandData, setMyHandData]   = useState(null)   // { hand, exposedMelds }
  const [claimResult, setClaimResult] = useState(null)   // summary shown after each resolution
  const [visKey, setVisKey]           = useState(0)       // increments on page-visible to force re-subscribe
  const resolvingRef       = useRef(false)
  const drawingRef         = useRef(false)
  const claimResultTimer   = useRef(null)

  // Clear the auto-dismiss timer if the hook unmounts mid-game
  useEffect(() => {
    return () => { if (claimResultTimer.current) clearTimeout(claimResultTimer.current) }
  }, [])

  // Re-subscribe to Firestore when the tab/screen becomes visible again after being hidden.
  // Prevents game lockup when the phone screen locks and unlocks mid-game.
  useEffect(() => {
    function onVisChange() {
      if (document.visibilityState === 'visible') setVisKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [])

  // Subscribe to own private hand
  useEffect(() => {
    if (!roomId || !myWind) return
    setMyHandData(null)
    return subscribeToHand(roomId, myWind, setMyHandData)
  }, [roomId, myWind, visKey])

  // Auto-resolve claim window when all non-discarders have submitted or deadline passed.
  // When the deadline is still in the future we schedule a timer so it fires automatically
  // (just returning early would leave the window stuck if no further dependency changes).
  useEffect(() => {
    if (!room?.hand || room.hand.phase !== 'claim') return
    if (resolvingRef.current) return

    const { claims, lastDiscard, claimDeadline } = room.hand
    if (!lastDiscard) return

    const others       = SEAT_ORDER.filter(s => s !== lastDiscard.discardedBy)
    const allSubmitted = others.every(s => claims?.[s])
    const msLeft       = claimDeadline ? new Date(claimDeadline) - Date.now() : -1
    const deadlinePast = msLeft <= 0

    console.log(
      '[claim-effect] discardedBy=%s others=%o submitted=%o allSubmitted=%s deadlinePast=%s',
      lastDiscard.discardedBy, others,
      Object.fromEntries(others.map(s => [s, !!claims?.[s]])),
      allSubmitted, deadlinePast
    )

    // Snapshot claim data NOW — the Firestore transaction will clear hand.claims
    // before the next snapshot arrives, so we must capture it before resolving.
    const capturedClaims    = { ...(room.hand.claims ?? {}) }
    const capturedDiscardBy = room.hand.lastDiscard?.discardedBy ?? null

    const doResolve = () => {
      if (resolvingRef.current) return
      resolvingRef.current = true
      resolveClaims(roomId)
        .then(result => {
          // 'already_resolved' and 'none' produce no meaningful summary
          if (!result || result.outcome === 'already_resolved' || result.outcome === 'none') return
          if (claimResultTimer.current) clearTimeout(claimResultTimer.current)
          setClaimResult({
            claims:      capturedClaims,
            discardedBy: capturedDiscardBy,
            outcome:     result.outcome,   // 'win'|'pong'|'kong'|'chow'|'draw_tile'
            winnerSeat:  result.seat ?? null,
          })
          claimResultTimer.current = setTimeout(() => {
            setClaimResult(null)
            claimResultTimer.current = null
          }, 5000)
        })
        .catch(err => {
          if (!err.message?.includes('already_resolved') &&
              !err.message?.includes('Not in claim phase')) {
            console.error('resolveClaims error:', err)
          }
        })
        .finally(() => { resolvingRef.current = false })
    }

    if (allSubmitted || deadlinePast) {
      doResolve()
      return
    }

    // Deadline is in the future — arm a timer so we fire when it expires.
    // The cleanup cancels the timer if claims arrive before it fires.
    const timer = setTimeout(doResolve, msLeft + 200)
    return () => clearTimeout(timer)
  }, [roomId, room?.hand?.claims, room?.hand?.phase, room?.hand?.claimDeadline])

  // Auto-draw: when it becomes the human player's turn in the draw phase,
  // immediately draw without requiring a button click.
  // Gated on claimResult: hold off until the claim overlay has dismissed.
  useEffect(() => {
    if (claimResult) return
    if (!room?.hand || !myWind || !roomId) return
    const { phase, currentTurn } = room.hand
    console.log('[draw-effect] phase=%s currentTurn=%s myWind=%s drawingRef=%s',
      phase, currentTurn, myWind, drawingRef.current)
    if (phase !== 'draw' || currentTurn !== myWind) return
    if (drawingRef.current) return

    console.log('[draw] auto-drawing for', myWind)
    drawingRef.current = true
    drawTile(roomId, myWind)
      .then(() => console.log('[draw] complete for', myWind))
      .catch(err => {
        if (!err.message?.includes('Not in draw phase') &&
            !err.message?.includes('Not your turn')) {
          console.error('Auto-draw error:', err)
        }
      })
      .finally(() => { drawingRef.current = false })
  }, [roomId, myWind, room?.hand?.phase, room?.hand?.currentTurn, claimResult])

  // Auto dead-wall draw: fires automatically after any kong (from discard claim,
  // concealed kong, or added kong) so the player does not need to click a second button.
  // NOT gated on claimResult — fires promptly regardless of overlay state.
  useEffect(() => {
    if (!room?.hand || !myWind || !roomId) return
    const { phase, currentTurn } = room.hand
    if (phase !== 'draw_dead' || currentTurn !== myWind) return
    if (drawingRef.current) return

    console.log('[draw_dead] auto-drawing from dead wall for', myWind)
    drawingRef.current = true
    // Short delay lets the UI render the exposed kong meld before the phase transitions
    const t = setTimeout(() => {
      drawDeadWallTile(roomId, myWind)
        .then(() => console.log('[draw_dead] complete for', myWind))
        .catch(err => {
          if (!err.message?.includes('Not in draw_dead phase') &&
              !err.message?.includes('Not your turn')) {
            console.error('Auto dead-wall draw error:', err)
          }
        })
        .finally(() => { drawingRef.current = false })
    }, 500)
    return () => { clearTimeout(t); drawingRef.current = false }
  }, [roomId, myWind, room?.hand?.phase, room?.hand?.currentTurn])

  // Record win scores to user profiles exactly once when a hand finishes.
  // All clients race to call this; the scoresRecorded flag makes it idempotent.
  useEffect(() => {
    if (!roomId) return
    if (room?.hand?.phase !== 'finished') return
    if (!room?.hand?.winResult) return
    if (room?.hand?.scoresRecorded) return
    recordWinScores(roomId).catch(console.error)
  }, [roomId, room?.hand?.phase, room?.hand?.winResult, room?.hand?.scoresRecorded])

  // Reactively trigger AI actions whenever it becomes an AI seat's turn.
  // Gated on myHandData: the hand subscription must have fired at least once
  // before AI starts, so when the first claim window opens myHand is non-null
  // and getAvailableActions can return the correct claim options for the human.
  // Also gated on claimResult: hold off until the claim overlay has dismissed.
  useEffect(() => {
    if (claimResult) return
    if (!myHandData) return
    if (!room?.hand || !room?.seats || !roomId) return
    const { phase, currentTurn } = room.hand
    console.log('[ai-trigger] phase=%s currentTurn=%s type=%s',
      phase, currentTurn, room.seats[currentTurn]?.type ?? '?')
    if (!currentTurn) return
    if (room.seats[currentTurn]?.type !== 'ai') return
    if (!['draw', 'draw_dead', 'discard'].includes(phase)) return

    console.log('[ai-trigger] FIRING triggerAITurn for', currentTurn)
    triggerAITurn(roomId).catch(console.error)
  }, [roomId, myHandData, room?.hand?.phase, room?.hand?.currentTurn, claimResult])

  const myHand         = myHandData?.hand         ?? null
  const myExposedMelds = myHandData?.exposedMelds ?? []
  const actions        = getAvailableActions(room, myHand, myExposedMelds, myWind)
  const claimTimeout   = room?.settings?.claimTimeoutHours ?? 24

  // Log what the local player's UI is showing at every state change.
  // This pairs with the [SEQ] lines in game.js to confirm the UI reacts correctly.
  const hand = room?.hand
  if (hand && myWind) {
    const actionKeys = Object.keys(actions).join(',') || '—'
    const ph   = String(hand.phase).padEnd(12)
    const turn = String(hand.currentTurn).padEnd(6)
    const pool = hand.discardPool?.length ?? 0
    console.log(`[UI]  phase=${ph} turn=${turn} pool=${pool}  │ myWind=${myWind} actions={${actionKeys}}`)
  }

  return {
    myHand,
    myExposedMelds,
    myFlowers:   room?.hand?.flowers?.[myWind] ?? [],
    actions,
    claimResult,

    discard:           (tileId)        => discardTile(roomId, myWind, tileId, claimTimeout),
    claim:             (type, tiles)   => submitClaim(roomId, myWind, type, tiles ?? null),
    pass:              ()              => submitClaim(roomId, myWind, 'pass'),
    draw:              ()              => drawTile(roomId, myWind),
    drawDead:          ()              => drawDeadWallTile(roomId, myWind),
    concealedKong:     (base)          => declareConcealedKong(roomId, myWind, base),
    addedKong:         (base)          => declareAddedKong(roomId, myWind, base, claimTimeout),
    selfDrawWin:       ()              => declareSelfDrawWin(roomId, myWind),
  }
}
