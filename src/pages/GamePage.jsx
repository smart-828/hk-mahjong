// ── GamePage.jsx ──────────────────────────────────────────────
// Main in-game UI: 4 rows top-to-bottom
// 1. Opponent rows  2. Discard pool  3. My hand  4. Action bar

import { useState, useMemo, useEffect, useRef } from 'react'
import MahjongTile from '../components/tiles/MahjongTile.jsx'
import { t } from '../i18n/translations.js'
import { tileBase, SEAT_ORDER } from '../engine/tiles.js'

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
        background: isCurrentTurn ? '#2ecc71' : isLastActor ? 'rgba(212,160,23,0.35)' : C.darker,
        transition: 'background 0.2s',
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
            <MahjongTile key={base} tileId={tileId} size="lg" count={count} />
          ))}
          {lastIsInPool && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <MahjongTile tileId={lastTileId} size="xl" highlighted />
              <span style={{ fontSize: FS.xxs, color: C.red, fontWeight: 700 }}>最新</span>
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

// ── WinOverlay ────────────────────────────────────────────────
function WinOverlay({ winResult, winner, seats, scores, myWind, onBack }) {
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
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
              Payments (base {basePoints} pts)
            </div>
            {SEAT_ORDER.map(w => {
              const amt    = payments[w] ?? 0
              const isWin  = amt > 0
              const label  = seats?.[w]?.name ?? WIND_LABEL[w] ?? w
              const runScore = scores?.[w] ?? 0
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
                  <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ color: isWin ? '#2ecc71' : C.red, minWidth: 40, textAlign: 'right' }}>
                      {isWin ? `+${amt}` : amt}
                    </span>
                    <span style={{ color: C.muted, fontSize: 12, minWidth: 40, textAlign: 'right' }}>
                      {runScore}
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

// ── GamePage ──────────────────────────────────────────────────

export default function GamePage({ room, myWind, game, lang, onBack }) {
  const [selected, setSelected] = useState(null)
  const landscape = useOrientation()

  const {
    myHand, myExposedMelds, myFlowers, actions,
    discard, claim, pass, draw, drawDead,
    concealedKong, addedKong, selfDrawWin,
    claimResult,
  } = game

  const handState  = room.hand
  const opponents  = SEAT_ORDER.filter(w => w !== myWind)

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
        padding:      '10px 12px',
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
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{ color: C.muted, fontSize: 22, fontWeight: 700 }}>摸牌 Draw Game</div>
          <div style={{ color: C.muted, fontSize: 14 }}>Wall exhausted — no winner</div>
          <button
            onClick={onBack}
            style={{
              marginTop: 12, padding: '10px 28px',
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.text, fontSize: 15, cursor: 'pointer',
            }}
          >Back to Lobby</button>
        </div>
      )}

      {/* ── Claim result overlay (auto-dismisses after 3 s) ── */}
      {claimResult && (
        <ClaimResultOverlay
          claimResult={claimResult}
          room={room}
          lang={lang}
        />
      )}
    </div>
  )
}
