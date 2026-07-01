// ── MahjongTile.jsx ───────────────────────────────────────────
// Custom-designed mahjong tiles.
// Each tile: cream background (#f5f2e8) + 8px left colour strip.
//
// Sizes
//   lg  40 × 54   (featured / selected display)
//   sm  38 × 50   (my hand — main tap targets)
//   md  28 × 38   (opponent rows, discard pool, melds)
//
// tileId='back' renders a face-down tile.

import { tileBase } from '../../engine/tiles.js'

// ── Tile dimensions ───────────────────────────────────────────
const SIZES = {
  lg: { w: 44, h: 59, fs1: 24, fs2: 21, fsX: 10 },  // fs1=honour, fs2=wan chars, fsX=bonus label
  sm: { w: 42, h: 55, fs1: 22, fs2: 19, fsX: 9  },
  md: { w: 31, h: 42, fs1: 15, fs2: 13, fsX: 7  },
}

// ── Left strip colours ─────────────────────────────────────────
const STRIP = {
  wan:   '#c0392b',  // red
  tong:  '#2471a3',  // blue
  suo:   '#1e8449',  // green
  wind:  '#7b5835',  // brown
  zhong: '#c0392b',  // red
  fa:    '#1e8449',  // green
  bai:   '#7f8c8d',  // grey
  bonus: '#e67e22',  // orange
}

// ── 萬 tile character set ─────────────────────────────────────
const WAN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

// ── Wind characters ───────────────────────────────────────────
const WIND_CHAR = { east: '東', south: '南', west: '西', north: '北' }

// ── 筒 circle layouts (positions in 0-100 viewBox space) ──────
// Each entry: positions [[cx,cy]…] and radius r
const TONG_LAYOUT = {
  1: { pos: [[50, 50]],                                                              r: 28 },
  2: { pos: [[50, 27], [50, 73]],                                                   r: 20 },
  3: { pos: [[50, 18], [50, 50], [50, 82]],                                         r: 16 },
  4: { pos: [[28, 27], [72, 27], [28, 73], [72, 73]],                               r: 16 },
  5: { pos: [[28, 19], [72, 19], [50, 50], [28, 81], [72, 81]],                     r: 14 },
  6: { pos: [[28, 17], [72, 17], [28, 50], [72, 50], [28, 83], [72, 83]],           r: 13 },
  7: { pos: [[27, 13], [73, 13], [27, 39], [73, 39], [50, 64], [27, 88], [73, 88]], r: 11 },
  8: { pos: [[27, 12], [73, 12], [27, 37], [73, 37], [27, 63], [73, 63], [27, 88], [73, 88]], r: 11 },
  9: { pos: [[20, 15], [50, 15], [80, 15], [20, 50], [50, 50], [80, 50], [20, 85], [50, 85], [80, 85]], r: 12 },
}

// Outer ring, inner ring, centre dot colour per tile number.
// null = alternating (used for 5筒).
const TONG_COLOUR = [
  null,
  ['#c0392b', '#f1948a', '#c0392b'],  // 1 — red
  ['#1a5276', '#5dade2', '#1a5276'],  // 2 — blue
  ['#1e8449', '#52be80', '#1e8449'],  // 3 — green
  ['#7d6608', '#f4d03f', '#7d6608'],  // 4 — gold
  null,                                // 5 — alternating red/blue
  ['#0e6655', '#1abc9c', '#0e6655'],  // 6 — teal
  ['#6c3483', '#a569bd', '#6c3483'],  // 7 — purple
  ['#a04000', '#f0a040', '#a04000'],  // 8 — amber/orange
  ['#1a5276', '#5dade2', '#1a5276'],  // 9 — blue
]
const TONG5_ALT = [
  ['#c0392b', '#f1948a', '#c0392b'],  // even indices → red
  ['#1a5276', '#5dade2', '#1a5276'],  // odd indices  → blue
]

// ── 索 stick layouts ───────────────────────────────────────────
// pos: [cx,cy] in 0-100 SVG space; sw/sh: stick width/height in SVG units.
// The SVG uses preserveAspectRatio="none" so sticks stretch to fill the tile
// height, producing tall elongated bamboo rods rather than stubby bars.
const SUO_LAYOUT = {
  2: { pos: [[33, 50], [67, 50]],                                                             sw: 22, sh: 36 },  // short stubby sticks — clearly "2"
  3: { pos: [[50, 27], [33, 73], [67, 73]],                                                   sw: 20, sh: 40 },  // 1 top, 2 bottom
  4: { pos: [[30, 27], [70, 27], [30, 73], [70, 73]],                                         sw: 22, sh: 50 },
  5: { pos: [[28, 18], [72, 18], [50, 50], [28, 82], [72, 82]],                               sw: 20, sh: 33 },
  6: { pos: [[25, 18], [50, 18], [75, 18], [25, 82], [50, 82], [75, 82]],                     sw: 18, sh: 33 },
  7: { pos: [[22, 13], [50, 13], [78, 13], [22, 50], [78, 50], [22, 87], [78, 87]],           sw: 18, sh: 27 },
  8: { pos: [[27, 12], [73, 12], [27, 37], [73, 37], [27, 63], [73, 63], [27, 88], [73, 88]], sw: 20, sh: 22 },
  9: { pos: [[20, 12], [50, 12], [80, 12], [20, 50], [50, 50], [80, 50], [20, 88], [50, 88], [80, 88]], sw: 17, sh: 27 },
}

// ── Bonus tile config ─────────────────────────────────────────
const BONUS_CFG = {
  spring:        { emoji: '🌸', label: '春' },
  summer:        { emoji: '🌿', label: '夏' },
  autumn:        { emoji: '🍂', label: '秋' },
  winter:        { emoji: '❄️', label: '冬' },
  plum:          { emoji: '🌸', label: '梅' },
  orchid:        { emoji: '🌺', label: '蘭' },
  chrysanthemum: { emoji: '🌼', label: '菊' },
  bamboo_b:      { emoji: '🎋', label: '竹' },
}

// ── Content components ─────────────────────────────────────────

function WanContent({ number, fs2 }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0, padding: '2px 0',
    }}>
      <span style={{ color: '#c0392b', fontSize: fs2, fontWeight: 900, lineHeight: 1.15 }}>
        {WAN_NUM[number]}
      </span>
      <span style={{ color: '#1a5276', fontSize: fs2, fontWeight: 900, lineHeight: 1.15 }}>
        萬
      </span>
    </div>
  )
}

function TongContent({ number }) {
  const { pos, r } = TONG_LAYOUT[number]
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', display: 'block' }}>
      {pos.map(([cx, cy], i) => {
        const [c1, c2, c3] = number === 5 ? TONG5_ALT[i % 2] : TONG_COLOUR[number]
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r}        fill={c1} />
            <circle cx={cx} cy={cy} r={r * 0.62} fill={c2} />
            <circle cx={cx} cy={cy} r={r * 0.28} fill={c3} />
          </g>
        )
      })}
    </svg>
  )
}

function SuoContent({ number, fs1 }) {
  if (number === 1) {
    return (
      <div style={{
        height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: fs1 * 1.5, lineHeight: 1,
      }}>
        🐦
      </div>
    )
  }
  const { pos, sw, sh } = SUO_LAYOUT[number]
  const rx = sw / 2
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      {pos.map(([cx, cy], i) => (
        <g key={i}>
          {/* Body */}
          <rect x={cx - sw / 2} y={cy - sh / 2} width={sw} height={sh} rx={rx}
            fill="#27ae60" />
          {/* Joint band */}
          <rect x={cx - sw / 2} y={cy - 3} width={sw} height={6}
            fill="#922b21" />
          {/* Highlight */}
          <rect x={cx - sw / 2 + 2} y={cy - sh / 2 + 4} width={sw * 0.38} height={sh * 0.32} rx={sw * 0.19}
            fill="#82e0aa" opacity={0.65} />
        </g>
      ))}
    </svg>
  )
}

function WindContent({ base, fs1 }) {
  return (
    <div style={{
      height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: '#1a5276', fontSize: fs1, fontWeight: 900, lineHeight: 1 }}>
        {WIND_CHAR[base]}
      </span>
    </div>
  )
}

function DragonContent({ base, fs1 }) {
  if (base === 'zhong') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#c0392b', fontSize: fs1, fontWeight: 900, lineHeight: 1 }}>中</span>
      </div>
    )
  }
  if (base === 'fa') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e8449', fontSize: fs1, fontWeight: 900, lineHeight: 1 }}>發</span>
      </div>
    )
  }
  // bai — blank with blue rectangle border outline
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
      <div style={{
        width: '100%', height: '100%',
        border: `${Math.max(2, Math.round(fs1 * 0.14))}px solid #1a5276`,
        borderRadius: 2,
      }} />
    </div>
  )
}

function BonusContent({ base, fs1, fsX }) {
  const cfg = BONUS_CFG[base]
  if (!cfg) return null
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 2,
    }}>
      <span style={{ fontSize: fs1 * 0.95, lineHeight: 1 }}>{cfg.emoji}</span>
      <span style={{ color: '#7d6608', fontSize: fsX, fontWeight: 700, lineHeight: 1 }}>{cfg.label}</span>
    </div>
  )
}

function CountBadge({ count }) {
  return (
    <div style={{
      position: 'absolute', top: -5, right: -5,
      width: 16, height: 16, borderRadius: '50%',
      background: '#c0392b', color: '#fff',
      fontSize: 9, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    }}>
      {count}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
export default function MahjongTile({
  tileId,
  size        = 'md',
  selected    = false,
  highlighted = false,
  onClick     = null,
  count       = null,
}) {
  const { w, h, fs1, fs2, fsX } = SIZES[size] ?? SIZES.md
  const base = tileId === 'back' ? 'back' : tileBase(tileId)

  // ── Back (face-down) ─────────────────────────────────────────
  if (base === 'back') {
    return (
      <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
        <div
          onClick={onClick ?? undefined}
          style={{
            width: w, height: h, borderRadius: 4,
            background: 'repeating-linear-gradient(135deg,#1e4d7a,#1e4d7a 4px,#163a5e 4px,#163a5e 8px)',
            border: '2px solid #0d2a44',
            cursor: onClick ? 'pointer' : 'default',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
            userSelect: 'none', WebkitTapHighlightColor: 'transparent',
          }}
        />
        {count != null && count > 1 && <CountBadge count={count} />}
      </div>
    )
  }

  // ── Resolve strip colour and content ─────────────────────────
  let strip = '#aaa'
  let content = null

  const wanM  = base.match(/^wan(\d)$/)
  const tongM = base.match(/^tong(\d)$/)
  const suoM  = base.match(/^suo(\d)$/)

  if (wanM) {
    strip   = STRIP.wan
    content = <WanContent number={+wanM[1]} fs2={fs2} />
  } else if (tongM) {
    strip   = STRIP.tong
    content = <TongContent number={+tongM[1]} />
  } else if (suoM) {
    strip   = STRIP.suo
    content = <SuoContent number={+suoM[1]} fs1={fs1} />
  } else if (WIND_CHAR[base]) {
    strip   = STRIP.wind
    content = <WindContent base={base} fs1={fs1} />
  } else if (base === 'zhong' || base === 'fa' || base === 'bai') {
    strip   = STRIP[base]
    content = <DragonContent base={base} fs1={fs1} />
  } else if (BONUS_CFG[base]) {
    strip   = STRIP.bonus
    content = <BonusContent base={base} fs1={fs1} fsX={fsX} />
  }

  const borderColor = highlighted ? '#c0392b'
    : selected      ? '#e67e22'
    :                 'rgba(0,0,0,0.18)'

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <div
        onClick={onClick ?? undefined}
        style={{
          width: w, height: h,
          background:   '#f5f2e8',
          borderRadius: 4,
          border:       `2px solid ${borderColor}`,
          display:      'flex',
          overflow:     'hidden',
          cursor:       onClick ? 'pointer' : 'default',
          boxShadow:    selected
            ? '0 5px 12px rgba(0,0,0,0.45)'
            : '0 1px 4px rgba(0,0,0,0.3)',
          transform:    selected ? 'translateY(-7px)' : 'none',
          transition:   'transform 0.12s, box-shadow 0.12s, border-color 0.1s',
          userSelect:   'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* 8px left colour strip */}
        <div style={{ width: 8, flexShrink: 0, background: strip }} />
        {/* Tile face */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {content}
        </div>
      </div>

      {count != null && count > 1 && <CountBadge count={count} />}
    </div>
  )
}
