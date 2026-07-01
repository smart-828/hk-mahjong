// ── GamePage.jsx ──────────────────────────────────────────────
// Main in-game UI: 4 rows top-to-bottom
// 1. Opponent rows  2. Discard pool  3. My hand  4. Action bar

import { useState, useMemo, useEffect, useRef } from 'react'
import MahjongTile from '../components/tiles/MahjongTile.jsx'
import { t } from '../i18n/translations.js'
import { tileBase, SEAT_ORDER } from '../engine/tiles.js'
import { subscribeToChat, sendMessage } from '../firebase/chat.js'
import {
  initPlayAgain, submitPlayAgainVote, startNewHand, setRoomClosing,
} from '../firebase/game.js'
import { deleteRoom } from '../firebase/rooms.js'

// ── Constants ─────────────────────────────────────────────────
const WIND_CHAR  = { east: '東', south: '南', west: '西', north: '北' }
const WIND_LABEL = { east: 'East', south: 'South', west: 'West', north: 'North' }

// Mobile detection — computed once at load time from viewport width
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 480
// Font sizes — ~35% larger on mobile, ~30% up from original desktop values
const FS = {
  xxs:  IS_MOBILE ? 14 : 12,
  xs:   IS_MOBILE ? 15 : 13,
  sm:   IS_MOBILE ? 17 : 14,
  base: IS_MOBILE ? 20 : 16,
  lg:   IS_MOBILE ? 22 : 18,
}

// Reactive orientation detection — responds to device rotation
function useOrientation() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = e => setLandscape(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return landscape
}

// ── Colour palette (consistent with rest of app) ──────────────
const C = {
  bg:       '#1a1a2e',
  card:     '#16213e',
  darker:   '#0d1b2a',
  border:   '#2a2a4e',
  red:      '#c0392b',
  blue:     '#0f3460',
  green:    '#1e8c4e',
  gold:     '#d4a017',
  text:     '#f5f2e8',
  muted:    '#888',
  dim:      '#555',
}

// ── Helpers ───────────────────────────────────────────────────
function timeLeft(deadline) {
  if (!deadline) return null
  const ms = new Date(deadline) - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function groupDiscards(discardPool) {
  const map = new Map()
  for (const { tileId } of discardPool) {
    const base = tileBase(tileId)
    const entry = map.get(base)
    if (!entry) map.set(base, { tileId, base, count: 1 })
    else         entry.count++
  }
  return Array.from(map.values())
}

// ── Sub-components ─────────────────────────────────────────────

function MeldGroup({ meld, size = 'md', concealed = false }) {
  return (
    <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      {meld.tiles.map((tile, i) => {
        const isHidden = concealed && meld.type === 'kong_concealed' && (i === 1 || i === 2)
        return (
          <MahjongTile key={i} tileId={isHidden ? 'back' : tile} size={size} />
        )
      })}
    </div>
  )
}

function FlowerGroup({ flowers, size = 'md' }) {
  if (!flowers?.length) return null
  return (
    <div style={{ display: 'flex', gap: 1, opacity: 0.9 }}>
      {flowers.map((tile, i) => (
        <MahjongTile key={i} tileId={tile} size={size} />
      ))}
    </div>
  )
}

// ── Row 1: Opponent ───────────────────────────────────────────

function OpponentRow({ wind, seat, handSize, exposedMelds, flowers, isLastActor, isCurrentTurn }) {
  const name = seat?.name ?? WIND_LABEL[wind]
  return (
    <div style={{
      display:      'flex',
      alignItems:   'stretch',
      background:   isLastActor ? 'rgba(212,160,23,0.07)' : C.card,
      borderBottom: `1px solid ${C.border}`,
      minHeight:    IS_MOBILE ? 60 : 52,
    }}>
      {/* Turn indicator — solid when active, dark otherwise */}
      <div style={{
        width:      IS_MOBILE ? 7 : 5,
        flexShrink: 0,
        background: isCurrentTurn ? '#2ecc71' : 'transparent',
      }} />

      {/* Row content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 12px 6px 10px', flex: 1 }}>
        {/* Wind badge */}
        <div style={{
          width: IS_MOBILE ? 34 : 30, height: IS_MOBILE ? 34 : 30,
          borderRadius: 4, marginTop: 2, flexShrink: 0,
          background: isLastActor ? 'rgba(212,160,23,0.18)' : C.darker,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: FS.base, fontWeight: 700,
          color: isLastActor ? C.gold : C.text,
        }}>
          {WIND_CHAR[wind]}
        </div>

        {/* Name + hidden count */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          <div style={{ fontSize: FS.sm, color: C.text, fontWeight: 600, maxWidth: 100, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <div style={{ fontSize: FS.xs, color: C.muted, marginTop: 1 }}>
            🀫 × {handSize ?? 13}
          </div>
        </div>

        {/* Exposed melds — wraps to multiple lines when long */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap', flex: 1, paddingTop: 2 }}>
          {(exposedMelds ?? []).map((meld, i) => (
            <MeldGroup key={i} meld={meld} size="opp" concealed />
          ))}
          <FlowerGroup flowers={flowers} size="opp" />
        </div>
      </div>
    </div>
  )
}

// ── Row 2: Discard pool ───────────────────────────────────────

function DiscardPool({ discardPool, lastDiscard, landscape }) {
  const pool       = discardPool ?? []
  const lastTileId = lastDiscard?.tileId
  // Show the last tile separately (larger) only while it remains the pool's
  // tail — once claimed by pong/chow it's removed from the pool array.
  const lastIsInPool = pool.length > 0 && pool[pool.length - 1].tileId === lastTileId
  const grouped = useMemo(
    () => groupDiscards(lastIsInPool ? pool.slice(0, -1) : pool),
    [pool, lastIsInPool],
  )

  return (
    <div style={{
      flex:       '1 1 0',
      background: C.bg,
      padding:    '8px 10px',
      overflowY:  'auto',
      borderBottom: `1px solid ${C.border}`,
      minHeight:  landscape ? 110 : 150,  // ~2 rows of lg tiles (59px each) + label + padding
    }}>
      <div style={{ fontSize: FS.xxs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Discard pool
      </div>
      {pool.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', padding: '12px 0' }}>
          —
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end' }}>
          {grouped.map(({ tileId, base, count }) => (
            <div key={base} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MahjongTile tileId={tileId} size="lg" />
              <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {count >= 2 && (
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#e8c870', lineHeight: 1 }}>
                    {count}
                  </span>
                )}
              </div>
            </div>
          ))}
          {lastIsInPool && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MahjongTile tileId={lastTileId} size="xl" highlighted />
              <div style={{ height: 20 }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Row 3: My hand ────────────────────────────────────────────

// sm tile width (42) + gap (4) = 46 px per slot — for drag shift animation
const TILE_SLOT = 46

function MyHand({ hand, exposedMelds, flowers, selected, onTilePointerDown, dragUi }) {
  return (
    <div style={{
      background:   C.card,
      padding:      '8px 10px 6px',
      borderTop:    `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: FS.xxs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        Your hand
      </div>

      {/* Exposed melds + concealed hand — wraps to second row on small screens */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', flexWrap: 'wrap', paddingBottom: 4 }}>
        {(exposedMelds ?? []).map((meld, i) => (
          <MeldGroup key={i} meld={meld} size="sm" />
        ))}

        {/* Divider between exposed and concealed */}
        {exposedMelds?.length > 0 && hand?.length > 0 && (
          <div style={{ width: 1, background: C.border, alignSelf: 'stretch', flexShrink: 0, margin: '0 2px' }} />
        )}

        {(hand ?? []).map((tileId, idx) => {
          const fromIdx   = dragUi?.fromIdx
          const overIdx   = dragUi?.overIdx
          const isDragged = dragUi !== null && idx === fromIdx

          // Shift surrounding tiles to open a gap at the insertion point
          let shiftX = 0
          if (dragUi && !isDragged) {
            if (fromIdx < overIdx && idx > fromIdx && idx <= overIdx) shiftX = -TILE_SLOT
            else if (fromIdx > overIdx && idx >= overIdx && idx < fromIdx) shiftX = TILE_SLOT
          }

          return (
            <div
              key={tileId}
              data-tile-idx={String(idx)}
              onPointerDown={(e) => onTilePointerDown(e, idx)}
              style={{
                flexShrink:       0,
                transform:        shiftX ? `translateX(${shiftX}px)` : 'none',
                transition:       dragUi ? 'transform 0.12s ease' : 'none',
                opacity:          isDragged ? 0 : 1,
                pointerEvents:    isDragged ? 'none' : undefined,
                touchAction:      'none',
                userSelect:       'none',
                WebkitUserSelect: 'none',
              }}
            >
              <MahjongTile
                tileId={tileId}
                size="sm"
                selected={!dragUi && selected === tileId}
                onClick={null}
              />
            </div>
          )
        })}
      </div>

      <FlowerGroup flowers={flowers} size="md" />
    </div>
  )
}

// ── Row 4: Action bar ─────────────────────────────────────────

const btnBase = {
  padding:      IS_MOBILE ? '18px 28px' : '10px 16px',
  borderRadius: IS_MOBILE ? 14 : 8,
  fontSize:     IS_MOBILE ? 22 : FS.base,
  fontWeight:   700,
  cursor:       'pointer',
  flexShrink:   0,
  minHeight:    IS_MOBILE ? 62 : undefined,
  transition:   'opacity 0.15s',
}

// Button color presets — fill / border / text
const B_WIN     = { color: '#b8860b', borderColor: '#ffd700', textColor: '#fff' }
const B_ACTION  = { color: '#1a3a2a', borderColor: '#2ecc71', textColor: '#fff' }
const B_PASS    = { color: '#1a1a3a', borderColor: '#6666aa', textColor: '#aaa' }
const B_DISCARD = { color: '#0f3460', borderColor: '#1a6ab5', textColor: '#fff' }

function Btn({ label, color = '#0f3460', borderColor, textColor = C.text, disabled = false, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        ...btnBase,
        background: disabled ? C.border : color,
        border:     `2px solid ${disabled ? C.dim : (borderColor ?? color)}`,
        color:      disabled ? C.dim : textColor,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  )
}

const SUIT_SUFFIX = { wan: '萬', tong: '筒', suo: '索' }
const NUM_ZH = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
function tileBaseName(base) {
  const m = base.match(/^(wan|tong|suo)(\d)$/)
  if (m) return `${NUM_ZH[+m[2]]}${SUIT_SUFFIX[m[1]]}`
  return base.toUpperCase()
}

function ActionBar({
  actions, handState, myWind, minFaan, lang,
  selected, onDiscard,
  onDraw, onDrawDead,
  onClaim, onPass,
  onConcealedKong, onAddedKong,
  onSelfDrawWin,
}) {
  const [chowOpen, setChowOpen] = useState(false)

  const phase         = handState?.phase
  const mySubmitted   = handState?.claims?.[myWind]
  const hasActions    = actions && Object.keys(actions).length > 0

  // ── Terminal states ──────────────────────────────────────────
  if (phase === 'finished') {
    const winner = handState?.winner
    return (
      <div style={barStyle}>
        <div style={{ color: C.gold, fontWeight: 700, fontSize: 16 }}>
          {winner === myWind ? '🏆 You win!' : `${WIND_CHAR[winner] ?? '?'} wins this hand`}
        </div>
      </div>
    )
  }
  if (phase === 'exhausted') {
    return (
      <div style={barStyle}>
        <div style={{ color: C.muted, fontSize: FS.base }}>Wall exhausted — draw game</div>
      </div>
    )
  }

  // ── Already submitted claim — waiting ────────────────────────
  if (phase === 'claim' && mySubmitted) {
    const label = mySubmitted.type === 'pass'
      ? t(lang, 'pass')
      : `${t(lang, 'claimResult')}: ${CLAIM_CHAR[mySubmitted.type] ?? mySubmitted.type}`
    const discardedBy2 = handState?.lastDiscard?.discardedBy
    const responded2   = SEAT_ORDER.filter(s => s !== discardedBy2 && handState?.claims?.[s]).length
    return (
      <div style={barStyle}>
        <div style={{ color: C.muted, fontSize: FS.base }}>
          {label}
        </div>
        <div style={{ color: C.dim, fontSize: FS.sm, marginLeft: 'auto' }}>
          {responded2} / 3 responded
        </div>
      </div>
    )
  }

  // ── No actions (waiting for another player) ──────────────────
  if (!hasActions) {
    const turn = handState?.currentTurn
    return (
      <div style={barStyle}>
        <div style={{ color: C.muted, fontSize: FS.base }}>
          {turn && turn !== myWind
            ? `Waiting for ${WIND_CHAR[turn]}…`
            : 'Waiting…'}
        </div>
      </div>
    )
  }

  // ── Draw from wall / dead wall ───────────────────────────────
  if (actions.mustDraw || actions.mustDrawDead) {
    return (
      <div style={barStyle}>
        <Btn
          label={actions.mustDrawDead
            ? (lang === 'zh' ? '摸嶺牌' : 'Draw (Kong)')
            : t(lang, 'draw')}
          {...B_ACTION}
          onClick={actions.mustDrawDead ? onDrawDead : onDraw}
        />
      </div>
    )
  }

  // ── Discard phase ────────────────────────────────────────────
  if (actions.mustDiscard) {
    return (
      <div style={{ ...barStyle, flexDirection: 'column', gap: 8 }}>
        {/* Self-draw win / special actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.canSelfDrawWin && (
            <Btn label={lang === 'zh' ? '胡 🏆' : 'Win 🏆'} {...B_WIN} onClick={onSelfDrawWin} />
          )}
          {(actions.concealedKongs ?? []).map(base => (
            <Btn key={base}
              label={lang === 'zh' ? `暗槓 ${tileBaseName(base)}` : 'Hidden Kong'}
              {...B_ACTION} onClick={() => onConcealedKong(base)} />
          ))}
          {(actions.addedKongs ?? []).map(base => (
            <Btn key={base}
              label={lang === 'zh' ? `加槓 ${tileBaseName(base)}` : `+Kong ${tileBaseName(base)}`}
              {...B_ACTION} onClick={() => onAddedKong(base)} />
          ))}
        </div>

        {/* Discard button — subtle outline when no tile selected, filled when ready */}
        <button
          onClick={selected ? onDiscard : undefined}
          style={{
            ...btnBase,
            background: selected ? B_DISCARD.color : 'transparent',
            color:      selected ? B_DISCARD.textColor : C.muted,
            border:     `2px solid ${selected ? B_DISCARD.borderColor : 'rgba(245,242,232,0.2)'}`,
            cursor:     selected ? 'pointer' : 'default',
          }}
        >
          {selected
            ? t(lang, 'discard')
            : (lang === 'zh' ? '點選一張牌出牌' : 'Tap a tile to discard')}
        </button>
      </div>
    )
  }

  // ── Claim phase ───────────────────────────────────────────────
  if (actions.canPass !== undefined) {
    const chowOptions  = actions.chowOptions ?? []
    const discardedBy  = handState?.lastDiscard?.discardedBy
    const responded    = SEAT_ORDER.filter(s => s !== discardedBy && handState?.claims?.[s]).length
    const msLeft       = handState?.claimDeadline ? new Date(handState.claimDeadline) - Date.now() : Infinity
    const showCountdown = msLeft > 0 && msLeft < 300_000  // only show when < 5 min left

    console.log(
      '[claim-ui] myWind=%s canWin=%s canKong=%s canPong=%s chowOptions=%d canPass=%s',
      myWind,
      actions.canWin, actions.canKong, actions.canPong,
      chowOptions.length, actions.canPass,
    )

    return (
      <div style={{ ...barStyle, flexDirection: 'column', gap: 8 }}>
        {/* Response progress + optional time warning */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ fontSize: FS.sm, color: C.muted }}>
            {responded} / 3 responded
          </div>
          {showCountdown && (
            <div style={{ fontSize: FS.xs, color: C.red }}>
              {timeLeft(handState.claimDeadline)} left
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.canWin && (
            <Btn label={lang === 'zh' ? '胡 🏆' : 'Win 🏆'} {...B_WIN} onClick={() => onClaim('win')} />
          )}
          {!actions.canWin && actions.winFaan !== null && (
            <Btn
              disabled
              label={`${lang === 'zh' ? '胡' : 'Win'} — ${actions.winFaan}${lang === 'zh' ? '番' : ' faan'} (${lang === 'zh' ? `需${minFaan}番` : `need ${minFaan}`})`}
              {...B_WIN}
              onClick={undefined}
            />
          )}
          {actions.canKong && (
            <Btn label={t(lang, 'kong')} {...B_ACTION} onClick={() => onClaim('kong')} />
          )}
          {actions.canPong && (
            <Btn label={t(lang, 'pong')} {...B_ACTION} onClick={() => onClaim('pong')} />
          )}
          {chowOptions.length > 0 && !chowOpen && (
            <Btn
              label={chowOptions.length === 1 ? t(lang, 'chow') : `${t(lang, 'chow')} ▾`}
              {...B_ACTION}
              onClick={() => {
                if (chowOptions.length === 1) {
                  console.log('[chow-tap] single option — tiles=%o', chowOptions[0].tiles)
                  onClaim('chow', chowOptions[0].tiles)
                } else {
                  console.log('[chow-tap] opening picker — %d options', chowOptions.length)
                  setChowOpen(true)
                }
              }}
            />
          )}
          <Btn label={t(lang, 'pass')} {...B_PASS} onClick={onPass} />
        </div>

        {/* Chow option picker */}
        {chowOpen && chowOptions.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: FS.sm, color: C.muted }}>{lang === 'zh' ? '選擇序列：' : 'Choose sequence:'}</div>
            {chowOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  console.log('[chow-tap] picker option=%d tiles=%o', i, opt.tiles)
                  setChowOpen(false)
                  onClaim('chow', opt.tiles)
                }}
                style={{
                  ...btnBase,
                  background:  B_ACTION.color,
                  border:      `2px solid ${B_ACTION.borderColor}`,
                  color:       B_ACTION.textColor,
                  display:     'flex',
                  alignItems:  'center',
                  gap:         6,
                }}
              >
                {opt.tiles.map((tile, j) => (
                  <MahjongTile key={j} tileId={tile} size="sm" />
                ))}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

const barStyle = {
  background:   C.card,
  padding:      '12px 12px',
  display:      'flex',
  alignItems:   'center',
  gap:          8,
  borderTop:    `1px solid ${C.border}`,
  flexShrink:   0,
  minHeight:    IS_MOBILE ? 100 : 64,
}

// ── PlayAgainBox ──────────────────────────────────────────────
function PlayAgainBox({ room, myWind, lang, secsLeft, onVote }) {
  const zh         = lang === 'zh'
  const votes      = room.playAgainVotes ?? {}
  const myVote     = myWind ? votes[myWind] : null
  const humanSeats = Object.entries(room.seats ?? {}).filter(([, s]) => s.type === 'human')

  return (
    <div style={{
      position:       'fixed', inset: 0, zIndex: 200,
      background:     'rgba(0,0,0,0.92)',
      display:        'flex', alignItems: 'center', justifyContent: 'center',
      padding:        '24px 16px',
    }}>
      <div style={{
        background:    C.card,
        border:        `1px solid ${C.border}`,
        borderRadius:  16,
        padding:       IS_MOBILE ? '28px 22px' : '22px 20px',
        maxWidth:      360,
        width:         '100%',
        display:       'flex',
        flexDirection: 'column',
        gap:           IS_MOBILE ? 16 : 12,
        textAlign:     'center',
      }}>
        {/* Title */}
        <div style={{ fontSize: IS_MOBILE ? 24 : 18, fontWeight: 800, color: C.gold }}>
          再玩一局？{!zh && ' / Play Again?'}
        </div>

        {/* Countdown */}
        <div style={{
          fontSize:   IS_MOBILE ? 72 : 56,
          fontWeight: 900,
          lineHeight: 1,
          color:      secsLeft <= 3 ? C.red : C.text,
        }}>
          {secsLeft}
        </div>
        <div style={{ fontSize: IS_MOBILE ? 14 : 12, color: C.muted }}>
          {zh
            ? `你有 ${secsLeft} 秒時間決定。`
            : `You have ${secsLeft} seconds to decide.`}
        </div>

        {/* Per-player vote status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: IS_MOBILE ? 7 : 5 }}>
          {humanSeats.map(([w, s]) => {
            const v = votes[w]
            return (
              <div key={w} style={{
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
                padding:        IS_MOBILE ? '8px 14px' : '5px 10px',
                background:     C.darker,
                borderRadius:   8,
                fontSize:       IS_MOBILE ? FS.base : FS.sm,
              }}>
                <span style={{ color: C.text }}>
                  {WIND_CHAR[w]} {s.name}{w === myWind ? (zh ? '（你）' : ' (you)') : ''}
                </span>
                <span style={{
                  fontWeight: 700,
                  fontSize:   IS_MOBILE ? 22 : 16,
                  color: v === 'yes' ? '#2ecc71' : v === 'no' ? C.red : C.muted,
                }}>
                  {v === 'yes' ? '✓' : v === 'no' ? '✗' : '…'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Buttons or "voted" message */}
        {!myVote && myWind ? (
          <div style={{ display: 'flex', gap: IS_MOBILE ? 12 : 8 }}>
            <button
              onClick={() => onVote('no')}
              style={{
                flex:         1,
                padding:      IS_MOBILE ? '14px 0' : '10px 0',
                background:   'transparent',
                border:       `2px solid ${C.red}`,
                borderRadius: 10,
                color:        C.red,
                fontSize:     IS_MOBILE ? 16 : 13,
                fontWeight:   700,
                cursor:       'pointer',
              }}
            >
              ✗ {zh ? '停止' : '停止 / Stop'}
            </button>
            <button
              onClick={() => onVote('yes')}
              style={{
                flex:         1,
                padding:      IS_MOBILE ? '14px 0' : '10px 0',
                background:   '#1a4a2a',
                border:       '2px solid #2ecc71',
                borderRadius: 10,
                color:        '#2ecc71',
                fontSize:     IS_MOBILE ? 16 : 13,
                fontWeight:   700,
                cursor:       'pointer',
              }}
            >
              ✓ {zh ? '繼續' : '繼續 / Continue'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: IS_MOBILE ? 13 : 11, color: C.muted }}>
            {zh ? '已投票，等待其他玩家…' : 'Vote submitted. Waiting for others…'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── RoomClosingOverlay ────────────────────────────────────────
function RoomClosingOverlay({ room, lang, secsLeft }) {
  const zh       = lang === 'zh'
  const votes    = room.playAgainVotes ?? {}
  const seats    = room.seats ?? {}
  const stopWind = Object.entries(votes).find(([, v]) => v === 'no')?.[0]
  const stopName = stopWind ? (seats[stopWind]?.name ?? WIND_LABEL[stopWind]) : null

  return (
    <div style={{
      position:       'fixed', inset: 0, zIndex: 200,
      background:     'rgba(0,0,0,0.93)',
      display:        'flex', alignItems: 'center', justifyContent: 'center',
      padding:        '24px 16px',
    }}>
      <div style={{
        background:    C.card,
        border:        `1px solid ${C.border}`,
        borderRadius:  16,
        padding:       IS_MOBILE ? '32px 22px' : '24px 20px',
        maxWidth:      340,
        width:         '100%',
        textAlign:     'center',
        display:       'flex', flexDirection: 'column',
        gap:           IS_MOBILE ? 12 : 10,
      }}>
        <div style={{ fontSize: IS_MOBILE ? 18 : 14, color: C.muted, lineHeight: 1.5 }}>
          {stopName
            ? (zh ? `${stopName} 選擇停止。` : `${stopName} has chosen to stop.`)
            : (zh ? '時間到。' : "Time's up.")}
        </div>
        <div style={{
          fontSize:   IS_MOBILE ? 68 : 52,
          fontWeight: 900,
          lineHeight: 1,
          color:      secsLeft <= 3 ? C.red : C.text,
        }}>
          {secsLeft}
        </div>
        <div style={{ fontSize: IS_MOBILE ? 14 : 12, color: C.muted }}>
          {zh
            ? `此房間將於 ${secsLeft} 秒後關閉。`
            : `This room will close in ${secsLeft} second${secsLeft === 1 ? '' : 's'}.`}
        </div>
      </div>
    </div>
  )
}

// ── WinOverlay ────────────────────────────────────────────────
function WinOverlay({ winResult, winner, seats, scores, roomScores, myWind, onBack }) {
  const { faan, isLimit, fanList, basePoints, payments, selfDraw, discarderSeat, winningTile } = winResult
  const winnerName = seats?.[winner]?.name ?? WIND_LABEL[winner] ?? winner
  const isMe       = winner === myWind

  const faamLabel = isLimit
    ? '滿貫 Limit'
    : `${isFinite(faan) ? faan : '∞'} 番`

  const modeLabel = selfDraw
    ? '自摸 Self-Draw'
    : `Discard win — ${WIND_LABEL[discarderSeat] ?? discarderSeat} (${WIND_CHAR[discarderSeat] ?? '?'})`

  return (
    <div style={{
      position:       'fixed', inset: 0, zIndex: 100,
      background:     'rgba(0,0,0,0.88)',
      display:        'flex', flexDirection: 'column',
      alignItems:     'center', justifyContent: 'center',
      padding:        '24px 16px',
      overflowY:      'auto',
    }}>
      <div style={{
        background:   C.card,
        border:       `1px solid ${C.border}`,
        borderRadius: 16,
        padding:      '28px 24px',
        maxWidth:     380,
        width:        '100%',
        display:      'flex',
        flexDirection:'column',
        gap:          18,
      }}>
        {/* Winner banner */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.gold }}>
            {isMe ? '🏆 You Win!' : `${WIND_CHAR[winner] ?? '?'} ${winnerName} Wins`}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{modeLabel}</div>
        </div>

        {/* Faan total */}
        <div style={{
          textAlign: 'center', fontSize: 22, fontWeight: 700,
          color: isLimit ? C.gold : C.text,
        }}>
          {faamLabel}
        </div>

        {/* Fan list */}
        {fanList?.length > 0 && (
          <div style={{
            background:   C.darker,
            borderRadius: 8,
            padding:      '10px 14px',
            display:      'flex',
            flexDirection:'column',
            gap:          6,
          }}>
            {fanList.map((f, i) => (
              <div key={i} style={{
                display:        'flex',
                justifyContent: 'space-between',
                fontSize:       13,
                color:          C.text,
              }}>
                <span>{f.name}</span>
                <span style={{ color: C.gold, fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
                  {f.faan === '滿貫' ? f.faan : `${f.faan}番`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Payments */}
        {payments && (
          <div>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              fontSize:       11,
              color:          C.muted,
              marginBottom:   5,
              padding:        '0 0 4px',
              borderBottom:   `1px solid ${C.border}`,
            }}>
              <span>Payments (base {basePoints} pts)</span>
              <span style={{ display: 'flex', gap: 28 }}>
                <span>This hand</span>
                <span>Total</span>
              </span>
            </div>
            {SEAT_ORDER.map(w => {
              const amt   = payments[w] ?? 0
              const isWin = amt > 0
              const label = seats?.[w]?.name ?? WIND_LABEL[w] ?? w
              const total = (roomScores?.[w] ?? 0) + (scores?.[w] ?? 0)
              return (
                <div key={w} style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '4px 0',
                  borderBottom:   `1px solid ${C.border}`,
                  fontSize:       14,
                  color:          w === myWind ? C.text : C.muted,
                  fontWeight:     w === winner ? 700 : 400,
                }}>
                  <span>{WIND_CHAR[w]} {label}{w === myWind ? ' (you)' : ''}</span>
                  <span style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ color: isWin ? '#2ecc71' : C.red, minWidth: 36, textAlign: 'right' }}>
                      {isWin ? `+${amt}` : amt}
                    </span>
                    <span style={{ color: C.muted, fontSize: 12, minWidth: 36, textAlign: 'right' }}>
                      {total >= 0 ? `+${total}` : total}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onBack}
          style={{
            padding:      '12px 0',
            background:   C.blue,
            border:       'none',
            borderRadius: 8,
            color:        C.text,
            fontSize:     15,
            fontWeight:   600,
            cursor:       'pointer',
          }}
        >Back to Lobby</button>
      </div>
    </div>
  )
}

// ── Claim resolution overlay ──────────────────────────────────

const CLAIM_CHAR = { win: '胡', kong: '槓', pong: '碰', chow: '吃', pass: '過' }
const CLAIM_KEY  = { win: 'win', kong: 'kong', pong: 'pong', chow: 'chow', pass: 'pass' }

function ClaimResultOverlay({ claimResult, room, lang }) {
  const { claims, discardedBy, outcome, winnerSeat } = claimResult
  // draw_tile = regular all-pass; draw_dead = rob-the-kong all-pass (declarer keeps turn)
  const isAllPass = outcome === 'draw_tile' || outcome === 'draw_dead'

  function claimLabel(type) {
    if (!type) return '—'
    const char = CLAIM_CHAR[type]
    const word = t(lang, CLAIM_KEY[type])
    return char ? `${char} ${word}` : type
  }

  const Y      = '#ffd700'           // yellow for all text
  const Y_DIM  = 'rgba(255,215,0,0.45)'  // dimmed yellow for pass / discarder
  const Y_MID  = 'rgba(255,215,0,0.7)'   // mid yellow for non-winner names

  return (
    <div style={{
      position:      'fixed',
      top:           '50%',
      left:          '50%',
      transform:     'translate(-50%, -50%)',
      zIndex:        60,
      pointerEvents: 'none',
    }}>
      <div style={{
        background:    '#1a2a4a',
        border:        `2px solid ${Y}`,
        borderRadius:  14,
        padding:       '16px 18px',
        minWidth:      IS_MOBILE ? 270 : 240,
        maxWidth:      330,
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        boxShadow:     '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        {isAllPass ? (
          <div style={{ textAlign: 'center', color: Y, fontSize: FS.base, fontWeight: 600 }}>
            {t(lang, 'allPassed')} — {WIND_CHAR[winnerSeat]} {t(lang, 'draw')}
          </div>
        ) : (
          <>
            <div style={{
              fontSize:      FS.xxs,
              color:         Y,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight:    700,
            }}>
              {t(lang, 'claimResult')}
            </div>

            {SEAT_ORDER.map(wind => {
              const isDiscarder = wind === discardedBy
              const claim       = isDiscarder ? null : (claims[wind] ?? null)
              const isWinner    = wind === winnerSeat
              const isClaim     = !isDiscarder && claim?.type && claim.type !== 'pass'

              return (
                <div key={wind} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                  padding:      '6px 10px',
                  borderRadius: 8,
                  background:   isWinner ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)',
                  border:       `1px solid ${isWinner ? Y : 'rgba(255,215,0,0.2)'}`,
                }}>
                  {/* Wind badge */}
                  <div style={{
                    width:          28,
                    height:         28,
                    borderRadius:   4,
                    background:     isWinner ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.06)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       FS.sm,
                    fontWeight:     700,
                    color:          isWinner ? Y : Y_MID,
                    flexShrink:     0,
                  }}>
                    {WIND_CHAR[wind]}
                  </div>

                  {/* Name */}
                  <div style={{
                    flex:         1,
                    fontSize:     FS.sm,
                    fontWeight:   isWinner ? 700 : 400,
                    color:        isWinner ? Y : Y_MID,
                    overflow:     'hidden',
                    whiteSpace:   'nowrap',
                    textOverflow: 'ellipsis',
                  }}>
                    {room.seats?.[wind]?.name ?? WIND_LABEL[wind]}
                  </div>

                  {/* Claim label */}
                  <div style={{
                    fontSize:   FS.sm,
                    fontWeight: isWinner || isClaim ? 700 : 400,
                    color:      isWinner || isClaim ? Y : Y_DIM,
                    flexShrink: 0,
                  }}>
                    {isDiscarder
                      ? t(lang, 'discarded')
                      : claimLabel(claim?.type ?? 'pass')}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ── ChatDrawer ────────────────────────────────────────────────

const CHAT_BADGE = { east: '#c0392b', south: '#27ae60', west: '#2980b9', north: '#8e44ad' }

function ChatDrawer({ messages, myWind, myName, lang, onClose, onSend }) {
  const [input, setInput] = useState('')
  const listRef           = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    onSend(text)
  }

  return (
    <div style={{
      position:      'fixed',
      bottom:        0,
      left:          0,
      right:         0,
      height:        '45vh',
      background:    C.card,
      borderTop:     `2px solid ${C.border}`,
      display:       'flex',
      flexDirection: 'column',
      zIndex:        55,
      boxShadow:     '0 -4px 24px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        padding:      IS_MOBILE ? '10px 16px' : '7px 14px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
      }}>
        <span style={{ flex: 1, fontWeight: 700, fontSize: IS_MOBILE ? FS.lg : FS.base, color: C.text }}>
          {lang === 'zh' ? '聊天' : 'Chat'}
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none',
          color: C.muted, fontSize: IS_MOBILE ? 28 : 20, cursor: 'pointer', padding: 4,
        }}>✕</button>
      </div>

      {/* Message list */}
      <div ref={listRef} style={{
        flex:          1,
        overflowY:     'auto',
        padding:       IS_MOBILE ? '10px 12px' : '8px 10px',
        display:       'flex',
        flexDirection: 'column',
        gap:           IS_MOBILE ? 10 : 7,
      }}>
        {messages.length === 0 && (
          <div style={{ color: C.dim, fontSize: FS.xs, textAlign: 'center', paddingTop: 20 }}>
            {lang === 'zh' ? '尚無訊息' : 'No messages yet'}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width:          IS_MOBILE ? 28 : 22,
              height:         IS_MOBILE ? 28 : 22,
              borderRadius:   4,
              background:     CHAT_BADGE[msg.wind] ?? C.darker,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       IS_MOBILE ? FS.xs : 10,
              fontWeight:     700,
              color:          '#fff',
              flexShrink:     0,
            }}>
              {WIND_CHAR[msg.wind] ?? '?'}
            </div>
            <div style={{ flex: 1, wordBreak: 'break-word' }}>
              <span style={{ fontSize: IS_MOBILE ? FS.xs : 11, color: C.muted, fontWeight: 600 }}>
                {msg.name}:{' '}
              </span>
              <span style={{ fontSize: IS_MOBILE ? FS.sm : FS.xs, color: C.text }}>{msg.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input row */}
      <div style={{
        display:    'flex',
        gap:        8,
        padding:    IS_MOBILE ? '10px 12px' : '8px 10px',
        borderTop:  `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder={lang === 'zh' ? '輸入訊息…' : 'Type a message…'}
          maxLength={200}
          style={{
            flex:         1,
            background:   C.darker,
            border:       `1px solid ${C.border}`,
            borderRadius: 8,
            padding:      IS_MOBILE ? '12px 14px' : '8px 10px',
            fontSize:     IS_MOBILE ? FS.base : FS.sm,
            color:        C.text,
            outline:      'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          style={{
            background:   input.trim() ? '#0f3460' : C.border,
            border:       `1px solid ${input.trim() ? '#1a6ab5' : C.dim}`,
            borderRadius: 8,
            color:        input.trim() ? C.text : C.dim,
            padding:      IS_MOBILE ? '12px 18px' : '8px 12px',
            fontSize:     IS_MOBILE ? FS.base : FS.sm,
            fontWeight:   700,
            cursor:       input.trim() ? 'pointer' : 'default',
          }}
        >
          {lang === 'zh' ? '送出' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── GamePage ──────────────────────────────────────────────────

export default function GamePage({ room, myWind, game, lang, onBack }) {
  const [selected, setSelected]       = useState(null)
  const [chatOpen, setChatOpen]       = useState(false)
  const [chatMsgs, setChatMsgs]       = useState([])
  const [unread, setUnread]           = useState(0)
  const [showVoteBox, setShowVoteBox]     = useState(false)
  const [voteSecsLeft, setVoteSecsLeft]   = useState(null)
  const [closeSecsLeft, setCloseSecsLeft] = useState(null)
  const chatOpenRef  = useRef(false)
  const prevCountRef = useRef(0)
  const landscape = useOrientation()

  // Chat subscription — tracks unread count when drawer is closed
  useEffect(() => {
    if (!room?.id) return
    return subscribeToChat(room.id, msgs => {
      setChatMsgs(msgs)
      if (!chatOpenRef.current) {
        const newCount = msgs.length - prevCountRef.current
        if (newCount > 0) setUnread(u => u + newCount)
      }
      prevCountRef.current = msgs.length
    })
  }, [room?.id])

  function openChat() {
    chatOpenRef.current = true
    setChatOpen(true)
    setUnread(0)
    prevCountRef.current = chatMsgs.length
  }
  function closeChat() {
    chatOpenRef.current = false
    setChatOpen(false)
  }
  function handleChatSend(text) {
    const myName = room.seats?.[myWind]?.name ?? myWind
    sendMessage(room.id, myWind, myName, text).catch(console.error)
  }

  const {
    myHand, myExposedMelds, myFlowers, actions,
    discard, claim, pass, draw, drawDead,
    concealedKong, addedKong, selfDrawWin,
    claimResult,
  } = game

  const handState  = room.hand
  const opponents  = SEAT_ORDER.filter(w => w !== myWind)

  // ── Play-again effects ────────────────────────────────────────

  // 1. Initialise play-again vote window when phase becomes finished/exhausted
  useEffect(() => {
    const phase = handState?.phase
    if (phase !== 'finished' && phase !== 'exhausted') return
    if (room?.playAgainDeadline || room?.closingAt) return
    initPlayAgain(room.id).catch(console.error)
  }, [handState?.phase, room?.playAgainDeadline, room?.closingAt])

  // 2. Show vote box 3 s after deadline is set (synchronised via deadline timestamp)
  useEffect(() => {
    const dl = room?.playAgainDeadline?.toDate?.()
    if (!dl) { setShowVoteBox(false); return }
    const showAt  = dl.getTime() - 10_000   // vote box shows for last 10s of deadline
    const delayMs = Math.max(0, showAt - Date.now())
    const t = setTimeout(() => setShowVoteBox(true), delayMs)
    return () => clearTimeout(t)
  }, [room?.playAgainDeadline])

  // 3. Vote countdown timer (drives the number displayed in PlayAgainBox)
  useEffect(() => {
    const dl = room?.playAgainDeadline?.toDate?.()
    if (!dl) { setVoteSecsLeft(null); return }
    const tick = () => setVoteSecsLeft(Math.max(0, Math.ceil((dl - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [room?.playAgainDeadline])

  // 4. Close countdown timer
  useEffect(() => {
    const ca = room?.closingAt?.toDate?.()
    if (!ca) { setCloseSecsLeft(null); return }
    const tick = () => setCloseSecsLeft(Math.max(0, Math.ceil((ca - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [room?.closingAt])

  // 5. Resolve vote: all-yes → new hand; any-no → start closing
  useEffect(() => {
    const votes = room?.playAgainVotes
    if (!votes || !room?.playAgainDeadline) return
    const hw     = Object.entries(room.seats ?? {}).filter(([, s]) => s.type === 'human').map(([w]) => w)
    const allYes = hw.length > 0 && hw.every(w => votes[w] === 'yes')
    const anyNo  = hw.some(w => votes[w] === 'no')
    if (allYes)      startNewHand(room.id).catch(console.error)
    else if (anyNo)  setRoomClosing(room.id).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.playAgainVotes?.east, room?.playAgainVotes?.south,
      room?.playAgainVotes?.west, room?.playAgainVotes?.north])

  // 6. Timeout: vote countdown hit 0 → start closing
  useEffect(() => {
    if (voteSecsLeft !== 0 || !room?.playAgainDeadline) return
    setRoomClosing(room.id).catch(console.error)
  }, [voteSecsLeft])

  // 7. Close countdown hit 0 → delete room (subscription null triggers lobby nav in App.jsx)
  useEffect(() => {
    if (closeSecsLeft !== 0 || closeSecsLeft === null || !room?.closingAt) return
    deleteRoom(room.id).catch(console.error)
  }, [closeSecsLeft])

  // ── Tile order (persisted to localStorage) ────────────────────
  const lsKey = `hkm_order_${room.id}_${myWind}`

  const [handOrder, setHandOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) ?? 'null') ?? [] }
    catch { return [] }
  })

  // Server hand is authoritative for which tiles exist; saved order controls display.
  // New tiles (draws, post-claim) are appended at the right end automatically.
  const orderedHand = useMemo(() => {
    if (!myHand) return myHand
    const available = [...myHand]
    const result    = []
    for (const tid of handOrder) {
      const idx = available.indexOf(tid)
      if (idx !== -1) result.push(available.splice(idx, 1)[0])
    }
    result.push(...available)
    return result
  }, [myHand, handOrder])

  // Ref so pointer-event closures always see the latest hand without re-registering
  const orderedHandRef = useRef(orderedHand)
  useEffect(() => { orderedHandRef.current = orderedHand }, [orderedHand])

  function saveOrder(newOrder) {
    setHandOrder(newOrder)
    try { localStorage.setItem(lsKey, JSON.stringify(newOrder)) } catch {}
  }

  // ── Drag-and-drop reordering ──────────────────────────────────
  const [dragUi, setDragUi] = useState(null)
  // { fromIdx, overIdx, ghostX, ghostY } — null when idle
  const dragUiRef      = useRef(null)   // mirror of dragUi for closure access
  const cleanupDragRef = useRef(null)   // current drag's cleanup fn (for unmount)

  useEffect(() => () => { cleanupDragRef.current?.() }, [])

  // Resolve the data-tile-idx of the tile under the pointer
  function computeOverIdx(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY)
    let node = el
    while (node && node !== document.body) {
      if (node.dataset?.tileIdx !== undefined) return parseInt(node.dataset.tileIdx, 10)
      node = node.parentElement
    }
    return null
  }

  // Called by onPointerDown on each tile wrapper.
  // A 150 ms stationary press initiates drag; shorter press = selection tap.
  function startDrag(e, idx) {
    e.stopPropagation()

    const pointerId = e.pointerId
    const startX    = e.clientX
    const startY    = e.clientY
    const fromIdx   = idx
    const hand      = orderedHandRef.current // snapshot; hand won't change during drag

    let dragActive = false

    const timer = setTimeout(() => {
      dragActive = true
      const ui = { fromIdx, overIdx: fromIdx, ghostX: startX, ghostY: startY }
      dragUiRef.current = ui
      setDragUi(ui)
    }, 150)

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      if (!dragActive) {
        // Cancel long-press if finger moves too far before it fires (probably a scroll)
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
          clearTimeout(timer)
          cleanup()
        }
        return
      }
      ev.preventDefault()
      const newIdx = computeOverIdx(ev.clientX, ev.clientY)
      const ui = {
        fromIdx,
        overIdx: newIdx ?? (dragUiRef.current?.overIdx ?? fromIdx),
        ghostX:  ev.clientX,
        ghostY:  ev.clientY,
      }
      dragUiRef.current = ui
      setDragUi(ui)
    }

    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      clearTimeout(timer)
      cleanup()

      if (dragActive) {
        const ui = dragUiRef.current
        if (ui && ui.fromIdx !== ui.overIdx && hand) {
          // INSERT model: remove from source, insert at destination
          const newOrder = [...hand]
          const [tile]   = newOrder.splice(ui.fromIdx, 1)
          newOrder.splice(ui.overIdx, 0, tile)
          saveOrder(newOrder)
        } else {
          // Long-press released without moving — treat as selection tap
          const tileId = hand?.[fromIdx]
          if (tileId) setSelected(prev => prev === tileId ? null : tileId)
        }
        dragUiRef.current = null
        setDragUi(null)
      } else {
        // Short press — toggle tile selection for discard
        const tileId = hand?.[fromIdx]
        if (tileId) setSelected(prev => prev === tileId ? null : tileId)
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove',   onMove)
      window.removeEventListener('pointerup',     onUp)
      window.removeEventListener('pointercancel', onUp)
      cleanupDragRef.current = null
    }
    cleanupDragRef.current = () => { clearTimeout(timer); cleanup() }

    window.addEventListener('pointermove',   onMove)
    window.addEventListener('pointerup',     onUp)
    window.addEventListener('pointercancel', onUp)
  }

  async function handleDiscard() {
    if (!selected) return
    const tile = selected
    setSelected(null)
    try { await discard(tile) }
    catch (err) { console.error('Discard error:', err) }
  }

  async function handleClaim(type, tiles = null) {
    console.log('[gamepage] handleClaim type=%s tiles=%o myWind=%s', type, tiles, myWind)
    try {
      await claim(type, tiles)
      console.log('[gamepage] handleClaim DONE type=%s', type)
    } catch (err) {
      console.error('[gamepage] handleClaim ERROR type=%s —', type, err)
    }
  }

  async function handlePass() {
    try { await pass() }
    catch (err) { console.error('Pass error:', err) }
  }

  async function handleDraw() {
    try { await draw() }
    catch (err) { console.error('Draw error:', err) }
  }

  async function handleDrawDead() {
    try { await drawDead() }
    catch (err) { console.error('DrawDead error:', err) }
  }

  async function handleConcealedKong(base) {
    try { await concealedKong(base) }
    catch (err) { console.error('ConcealedKong error:', err) }
  }

  async function handleAddedKong(base) {
    try { await addedKong(base) }
    catch (err) { console.error('AddedKong error:', err) }
  }

  async function handleSelfDrawWin() {
    try { await selfDrawWin() }
    catch (err) { console.error('SelfDrawWin error:', err) }
  }

  // Log canWin transitions during claim phase to diagnose why the button may flicker
  useEffect(() => {
    if (handState?.phase !== 'claim') return
    console.log('[canWin-effect] claim phase: canWin=%s canPass=%s mySubmitted=%s',
      actions.canWin, actions.canPass, !!handState?.claims?.[myWind])
  }, [actions.canWin, actions.canPass, handState?.phase, handState?.claims?.[myWind]])

  const isMyTurn      = handState?.currentTurn === myWind
  const phase         = handState?.phase
  const tilesLeft     = handState?.tilesLeft ?? '—'
  const lastActorWind = handState?.lastDiscard?.discardedBy ?? null

  // True during the brief gap where room snapshot says phase='discard' (our turn)
  // but the hand subcollection snapshot hasn't yet delivered the drawn tile.
  // Prevents showing the discard UI with 13 tiles before the 14th appears.
  const handNeedsSync = phase === 'discard' && isMyTurn
    && myHand !== null
    && handState?.handSizes?.[myWind] !== undefined
    && myHand.length < handState.handSizes[myWind]

  // Phase label for header
  const phaseLabel = (() => {
    if (phase === 'claim')     return 'Claim window'
    if (phase === 'draw')      return `${WIND_CHAR[handState?.currentTurn] ?? '?'} drawing…`
    if (phase === 'draw_dead') return `${WIND_CHAR[handState?.currentTurn] ?? '?'} drawing (kong)…`
    if (phase === 'discard')   return isMyTurn ? 'Your turn' : `${WIND_CHAR[handState?.currentTurn] ?? '?'} discarding…`
    if (phase === 'finished')  return 'Hand finished'
    if (phase === 'exhausted') return 'Draw game'
    return '—'
  })()

  return (
    <div style={{
      height:         '100dvh',
      display:        'flex',
      flexDirection:  'column',
      background:     C.bg,
      color:          C.text,
      fontFamily:     '-apple-system, sans-serif',
      overflow:       landscape ? 'auto' : 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        padding:      '10px 52px 10px 12px',
        background:   C.card,
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, padding: 0, cursor: 'pointer' }}
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: FS.lg }}>{room.roomCode}</span>
        <div style={{
          marginLeft:   'auto',
          display:      'flex',
          alignItems:   'center',
          gap:          12,
        }}>
          <span style={{ fontSize: FS.sm, color: isMyTurn ? '#2ecc71' : C.muted, fontWeight: 600 }}>
            {phaseLabel}
          </span>
          <div style={{
            fontSize: FS.xs, color: C.muted,
            background: C.darker, borderRadius: 4, padding: '2px 8px',
          }}>
            {tilesLeft} tiles
          </div>
          {myWind && (
            <div style={{
              fontSize:    FS.sm, fontWeight: 700,
              background:  myWind === lastActorWind ? 'rgba(212,160,23,0.18)' : C.red,
              borderRadius: 4, padding: '2px 8px',
              color:       myWind === lastActorWind ? C.gold : '#fff',
              outline:     myWind === lastActorWind ? `2px solid ${C.gold}` : 'none',
              outlineOffset: 1,
            }}>
              {WIND_CHAR[myWind]}
            </div>
          )}
        </div>
      </div>

      {/* ── Opponent rows ───────────────────────────────────── */}
      {opponents.map(wind => (
        <OpponentRow
          key={wind}
          wind={wind}
          seat={room.seats?.[wind]}
          handSize={handState?.handSizes?.[wind]}
          exposedMelds={handState?.exposedMelds?.[wind]}
          flowers={handState?.flowers?.[wind]}
          isLastActor={wind === lastActorWind}
          isCurrentTurn={wind === handState?.currentTurn}
        />
      ))}

      {/* ── Discard pool ────────────────────────────────────── */}
      <DiscardPool
        discardPool={handState?.discardPool}
        lastDiscard={handState?.lastDiscard}
        landscape={landscape}
      />

      {/* ── My hand ─────────────────────────────────────────── */}
      <MyHand
        hand={orderedHand}
        exposedMelds={myExposedMelds}
        flowers={myFlowers}
        selected={selected}
        onTilePointerDown={startDrag}
        dragUi={dragUi}
      />

      {/* ── Action bar ──────────────────────────────────────── */}
      {handNeedsSync ? (
        <div style={barStyle}>
          <div style={{ color: C.muted, fontSize: FS.base }}>Drawing tile…</div>
        </div>
      ) : (
        <ActionBar
          actions={actions}
          handState={handState}
          myWind={myWind}
          minFaan={room.settings?.minFaan ?? 3}
          lang={lang}
          selected={selected}
          onDiscard={handleDiscard}
          onDraw={handleDraw}
          onDrawDead={handleDrawDead}
          onClaim={handleClaim}
          onPass={handlePass}
          onConcealedKong={handleConcealedKong}
          onAddedKong={handleAddedKong}
          onSelfDrawWin={handleSelfDrawWin}
        />
      )}

      {/* ── Drag ghost — follows pointer, position:fixed escapes overflow:hidden */}
      {dragUi && orderedHand && (
        <div style={{
          position:      'fixed',
          left:          dragUi.ghostX,
          top:           dragUi.ghostY,
          transform:     'translate(-50%, -70%) scale(1.15)',
          pointerEvents: 'none',
          zIndex:        9999,
          opacity:       0.88,
          filter:        'drop-shadow(0 4px 10px rgba(0,0,0,0.55))',
        }}>
          <MahjongTile tileId={orderedHand[dragUi.fromIdx]} size="sm" selected />
        </div>
      )}

      {/* ── Win overlay ─────────────────────────────────────── */}
      {phase === 'finished' && handState?.winResult && (
        <WinOverlay
          winResult={handState.winResult}
          winner={handState.winner}
          seats={room.seats}
          scores={room.game?.scores}
          roomScores={room.roomScores}
          myWind={myWind}
          onBack={onBack}
        />
      )}

      {/* ── Exhausted overlay ────────────────────────────────── */}
      {phase === 'exhausted' && (
        <div style={{
          position:   'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.82)',
          display:    'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ color: C.muted, fontSize: IS_MOBILE ? 26 : 20, fontWeight: 700 }}>摸牌 Draw Game</div>
          <div style={{ color: C.muted, fontSize: IS_MOBILE ? 16 : 13 }}>
            {lang === 'zh' ? '牌牆耗盡，無人糊牌。' : 'Wall exhausted — no winner.'}
          </div>
        </div>
      )}

      {/* ── Play Again vote box ──────────────────────────────── */}
      {showVoteBox && room?.playAgainDeadline && !room?.closingAt && (
        <PlayAgainBox
          room={room}
          myWind={myWind}
          lang={lang}
          secsLeft={voteSecsLeft ?? 0}
          onVote={vote => submitPlayAgainVote(room.id, myWind, vote).catch(console.error)}
        />
      )}

      {/* ── Room closing countdown ───────────────────────────── */}
      {room?.closingAt && (
        <RoomClosingOverlay
          room={room}
          lang={lang}
          secsLeft={closeSecsLeft ?? 10}
        />
      )}

      {/* ── Claim result overlay (auto-dismisses after 3 s) ── */}
      {claimResult && (
        <ClaimResultOverlay
          claimResult={claimResult}
          room={room}
          lang={lang}
        />
      )}

      {/* ── Chat drawer ──────────────────────────────────────── */}
      {chatOpen && (
        <ChatDrawer
          messages={chatMsgs}
          myWind={myWind}
          myName={room.seats?.[myWind]?.name ?? myWind}
          lang={lang}
          onClose={closeChat}
          onSend={handleChatSend}
        />
      )}

      {/* ── Floating chat button ─────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={openChat}
          style={{
            position:       'fixed',
            bottom:         IS_MOBILE ? 112 : 76,
            right:          16,
            width:          IS_MOBILE ? 54 : 44,
            height:         IS_MOBILE ? 54 : 44,
            borderRadius:   '50%',
            background:     C.card,
            border:         `2px solid ${C.border}`,
            color:          C.text,
            fontSize:       IS_MOBILE ? 26 : 20,
            cursor:         'pointer',
            zIndex:         50,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            boxShadow:      '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          💬
          {unread > 0 && (
            <div style={{
              position:       'absolute',
              top:            -4,
              right:          -4,
              background:     '#e74c3c',
              color:          '#fff',
              borderRadius:   '50%',
              width:          IS_MOBILE ? 22 : 18,
              height:         IS_MOBILE ? 22 : 18,
              fontSize:       IS_MOBILE ? 12 : 10,
              fontWeight:     700,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              {unread > 9 ? '9+' : unread}
            </div>
          )}
        </button>
      )}

    </div>
  )
}
