// ── RulesPanel ────────────────────────────────────────────────
// Slide-up rules reference drawer. Rendered in App.jsx so it
// overlays every page. Open via the floating ? button.

import { useState } from 'react'

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 480

const C = {
  bg:      '#16213e',
  bgDeep:  '#0d1526',
  surface: '#1e2a45',
  border:  '#2a3a5e',
  text:    '#f5f2e8',
  muted:   '#8899aa',
  gold:    '#e8c870',
  green:   '#2ecc71',
  limit:   '#e87070',
}

// ── Faan table data ───────────────────────────────────────────

const STANDARD_HANDS = [
  { zh: '平糊',   en: 'Ping Wu',                    faan: '1' },
  { zh: '對對胡', en: 'All Triplets',                faan: '3' },
  { zh: '混一色', en: 'Half Flush',                  faan: '3' },
  { zh: '缺一門', en: 'Voided Suit',                 faan: '2' },
  { zh: '清一色', en: 'Full Flush',                  faan: '7' },
  { zh: '小三元', en: 'Small Three Dragons',         faan: '5' },
  { zh: '大三元', en: 'Great Three Dragons',         faan: '8' },
  { zh: '小四喜', en: 'Small Four Winds',            faan: '8' },
  { zh: '大四喜', en: 'Great Four Winds',            faan: '10' },
  { zh: '字一色', en: 'All Honours',                 faan: '10' },
  { zh: '七對子', en: 'Seven Pairs',                 faan: '4' },
  { zh: '混么九', en: 'Mixed Terminals & Honours',   faan: '1' },
]

const BONUS_FAAN = [
  { zh: '自摸',   en: 'Self Draw',                  faan: '+1' },
  { zh: '門前清', en: 'Concealed Hand',              faan: '+1' },
  { zh: '箭刻',   en: 'Dragon Pung',                faan: '+1 ea.' },
  { zh: '門風',   en: 'Seat Wind Pung',             faan: '+1' },
  { zh: '圈風',   en: 'Prevailing Wind Pung',       faan: '+1' },
  { zh: '無花',   en: 'No Bonus Tiles',             faan: '+1' },
  { zh: '正花/正季', en: 'Own Flower/Season',       faan: '+1 ea.' },
  { zh: '齊花',   en: 'All Flowers',                faan: '+1' },
  { zh: '齊季',   en: 'All Seasons',                faan: '+1' },
  { zh: '海底撈月', en: 'Last Wall Tile',            faan: '+1' },
  { zh: '河底撈魚', en: 'Last Discard Tile',         faan: '+1' },
  { zh: '槓上開花', en: 'Kong Replacement Win',      faan: '+1' },
  { zh: '搶槓胡', en: 'Robbing the Kong',           faan: '+1' },
  { zh: '槓上槓', en: 'Double Kong',                faan: '+2' },
]

const LIMIT_HANDS = [
  { zh: '十三么',   en: 'Thirteen Orphans' },
  { zh: '十八羅漢', en: 'All Kongs' },
  { zh: '天胡',     en: 'Heavenly Hand' },
  { zh: '地胡',     en: 'Earthly Hand' },
]

// ── Sub-components ────────────────────────────────────────────

function TableSubhead({ children }) {
  return (
    <tr>
      <td colSpan={2} style={{
        padding:     IS_MOBILE ? '10px 10px 3px' : '7px 8px 2px',
        fontSize:    IS_MOBILE ? 12 : 10,
        fontWeight:  700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color:       C.muted,
        background:  C.bgDeep,
      }}>
        {children}
      </td>
    </tr>
  )
}

function FaanRow({ row, isLimit }) {
  const fs = IS_MOBILE ? 15 : 12
  const pad = IS_MOBILE ? '6px 10px' : '4px 8px'
  const border = `1px solid ${C.border}33`
  return (
    <tr>
      <td style={{ padding: pad, borderBottom: border, fontSize: fs, color: C.text, lineHeight: 1.3 }}>
        <span style={{ display: 'block', fontWeight: 600 }}>{row.zh}</span>
        <span style={{ fontSize: IS_MOBILE ? 11 : 9, color: C.muted }}>{row.en}</span>
      </td>
      <td style={{
        padding:    pad,
        borderBottom: border,
        fontSize:   IS_MOBILE ? 14 : 12,
        fontWeight: 700,
        textAlign:  'right',
        color:      isLimit ? C.limit : C.gold,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}>
        {isLimit ? '滿貫' : row.faan}
      </td>
    </tr>
  )
}

function FaanTable() {
  const thStyle = {
    padding:    IS_MOBILE ? '8px 10px' : '5px 8px',
    fontSize:   IS_MOBILE ? 13 : 10,
    fontWeight: 700,
    color:      C.gold,
    background: C.surface,
    borderBottom: `1px solid ${C.border}`,
    textAlign:  'left',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thStyle}>牌型 / Hand</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>番</th>
        </tr>
      </thead>
      <tbody>
        <TableSubhead>基本牌型 / Standard Hands</TableSubhead>
        {STANDARD_HANDS.map(r => <FaanRow key={r.zh} row={r} />)}
        <TableSubhead>額外番數 / Bonus Faan</TableSubhead>
        {BONUS_FAAN.map(r => <FaanRow key={r.zh} row={r} />)}
        <TableSubhead>滿貫 / Limit Hands</TableSubhead>
        {LIMIT_HANDS.map(r => <FaanRow key={r.zh} row={r} isLimit />)}
      </tbody>
    </table>
  )
}

// ── Section content ───────────────────────────────────────────

const FS  = IS_MOBILE ? 16 : 12
const FSs = IS_MOBILE ? 13 : 10  // small

function Para({ children }) {
  return <p style={{ margin: '0 0 10px', fontSize: FS, color: C.text, lineHeight: 1.65 }}>{children}</p>
}

function Li({ children }) {
  return <li style={{ marginBottom: IS_MOBILE ? 10 : 6, fontSize: FS, lineHeight: 1.6 }}>{children}</li>
}

function Term({ children }) {
  return <strong style={{ color: C.gold }}>{children}</strong>
}

function SectionContent({ sectionKey, lang }) {
  const zh = lang === 'zh'

  if (sectionKey === 'basic') {
    return zh ? (
      <Para>目標係砌成一副糊牌：四組面子加一對將眼（<Term>四搭一對</Term>）。每個回合：摸一張牌，然後打出一張牌。莊家（東）起手14張，先出牌。出牌順序係逆時針：東→南→西→北。</Para>
    ) : (
      <Para>The goal is to form a winning hand of 14 tiles: <Term>4 melds + 1 pair</Term> (四搭一對). Each turn: draw one tile from the wall, then discard one tile. The dealer (East) starts with 14 tiles and discards first. Play goes counterclockwise: East → South → West → North.</Para>
    )
  }

  if (sectionKey === 'tiles') {
    return zh ? (
      <Para>
        三種數牌（<Term>萬/筒/索</Term>，各1-9，每隻4張），<Term>風牌</Term>（東南西北，各4張），<Term>箭牌</Term>（中發白，各4張），<Term>花牌</Term>（花/季，各1張——摸到後自動補一張正牌）。
      </Para>
    ) : (
      <Para>
        Three suits (<Term>萬 / 筒 / 索</Term>, numbers 1–9, 4 copies each). <Term>Winds</Term> (東南西北, 4 copies each). <Term>Dragons</Term> (中發白, 4 copies each). <Term>Bonus tiles</Term> (Flowers 花 / Seasons 季, 1 copy each — drawn and replaced automatically from the dead wall).
      </Para>
    )
  }

  if (sectionKey === 'claims') {
    return zh ? (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>食：</Term>認領別人打出的牌，砌成順子（例如3-4-5同花色）。只有<Term>上家</Term>打出的牌才可以食。字牌不可以食。</Li>
        <Li><Term>碰：</Term>認領別人打出的牌，砌成刻子（三張相同）。任何玩家都可以碰。</Li>
        <Li><Term>槓：</Term>四張相同的牌。宣告槓後從死牌堆補摸一張牌。</Li>
        <Li><Term>優先次序：</Term>胡 › 槓 › 碰 › 食。同優先級則以座位距離決定（距離出牌者最近者優先）。</Li>
        <Li>所有其他玩家必須表明意向（認領或「過」）後，遊戲才繼續。</Li>
      </ul>
    ) : (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>Chow 食:</Term> Claim a discard to form a sequence (e.g. 3-4-5 same suit). Only the <Term>next player</Term> (上家) can chow. Honour tiles cannot be chowed.</Li>
        <Li><Term>Pong 碰:</Term> Claim a discard to form a triplet. Any player can pong.</Li>
        <Li><Term>Kong 槓:</Term> Four identical tiles. Draw a replacement from the dead wall after declaring.</Li>
        <Li><Term>Priority:</Term> Win › Kong › Pong › Chow. Equal priority: closest seat to discarder wins.</Li>
        <Li>All other players must submit their intention (claim or Pass) before the game advances.</Li>
      </ul>
    )
  }

  if (sectionKey === 'winning') {
    return zh ? (
      <Para>
        糊牌需要四組面子（順子或刻子/槓子）加一對<Term>將眼</Term>，而且番數必須達到最低要求（預設：<Term>3番</Term>）。可以<Term>食糊</Term>（認領別人打出的牌）或<Term>自摸</Term>（自己摸到）。特殊牌型：七對子、十三么。
      </Para>
    ) : (
      <Para>
        A winning hand needs 4 melds (sequences or triplets/kongs) + 1 pair, and must score at least the minimum faan (default: <Term>3 faan</Term>). You can win by claiming a discard (<Term>食糊</Term>) or by self-draw (<Term>自摸</Term>). Special hands: Seven Pairs (七對子), Thirteen Orphans (十三么).
      </Para>
    )
  }

  if (sectionKey === 'faan') {
    return <FaanTable />
  }

  if (sectionKey === 'payment') {
    return zh ? (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>食糊：</Term>出銃者付<Term>2倍</Term>底分，其餘兩位各付<Term>1倍</Term>底分。</Li>
        <Li><Term>自摸：</Term>三位對家各付<Term>2倍</Term>底分。</Li>
        <Li><Term>莊家（東）</Term>永遠付雙倍/收雙倍。</Li>
        <Li>底分 = 2^番數（<Term>全辣</Term>）或按半辣計分表，視房間設定。</Li>
        <Li>滿貫 = 房間上限（預設<Term>64分</Term>）。</Li>
      </ul>
    ) : (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>Win by discard 食糊:</Term> Discarder pays winner <Term>2×</Term> base. Other 2 players each pay <Term>1×</Term> base.</Li>
        <Li><Term>Self-draw 自摸:</Term> All 3 opponents each pay <Term>2×</Term> base.</Li>
        <Li><Term>Dealer (East)</Term> always pays / receives double.</Li>
        <Li>Base points = 2^faan (<Term>full spicy 全辣</Term>) or scaled table (half spicy 半辣), per room settings.</Li>
        <Li>Limit hand = room maximum (default <Term>64 points</Term>).</Li>
      </ul>
    )
  }

  if (sectionKey === 'special') {
    return zh ? (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>七對子：</Term>七對不同的對子。4番。須為門前清。</Li>
        <Li><Term>十三么：</Term>一萬九萬一筒九筒一索九索東南西北中發白各一張，加其中任何一張。滿貫。須為門前清。</Li>
        <Li><Term>九蓮寶燈：</Term>同一花色1112345678999加任意一張同花色牌。滿貫。須為門前清。</Li>
        <Li><Term>十八羅漢：</Term>四槓加一對將眼。滿貫。</Li>
        <Li><Term>天胡：</Term>莊家以起手14張直接糊牌（未有人出牌前）。滿貫。</Li>
        <Li><Term>地胡：</Term>非莊家第一次摸牌即糊。滿貫。</Li>
      </ul>
    ) : (
      <ul style={{ margin: 0, padding: '0 0 0 18px', color: C.text }}>
        <Li><Term>Seven Pairs 七對子:</Term> Seven distinct pairs. 4 faan. Fully concealed only.</Li>
        <Li><Term>Thirteen Orphans 十三么:</Term> One each of 1m 9m 1t 9t 1s 9s E S W N 中 發 白 + any duplicate. Limit hand. Concealed only.</Li>
        <Li><Term>Nine Gates 九蓮寶燈:</Term> 1112345678999 of one suit + any tile of same suit. Limit hand. Concealed only.</Li>
        <Li><Term>All Kongs 十八羅漢:</Term> 4 kongs + 1 pair. Limit hand.</Li>
        <Li><Term>Heavenly Hand 天胡:</Term> Dealer wins with starting 14 tiles before anyone discards. Limit hand.</Li>
        <Li><Term>Earthly Hand 地胡:</Term> Non-dealer wins on their very first draw. Limit hand.</Li>
      </ul>
    )
  }

  return null
}

// ── Section list definition ───────────────────────────────────

const SECTIONS = [
  { key: 'basic',   zh: '基本規則', en: 'Basic Rules' },
  { key: 'tiles',   zh: '牌種',     en: 'Tile Types' },
  { key: 'claims',  zh: '食碰槓',   en: 'Chow · Pong · Kong' },
  { key: 'winning', zh: '胡牌',     en: 'Winning' },
  { key: 'faan',    zh: '番數表',   en: 'Faan Table' },
  { key: 'payment', zh: '計分',     en: 'Payment' },
  { key: 'special', zh: '特殊牌型', en: 'Special Hands' },
]

// ── CollapsibleSection ────────────────────────────────────────

function CollapsibleSection({ section, lang, isOpen, onToggle }) {
  const zh = lang === 'zh'
  return (
    <div style={{
      marginBottom:   IS_MOBILE ? 8 : 6,
      border:         `1px solid ${C.border}`,
      borderRadius:   10,
      overflow:       'hidden',
    }}>
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        IS_MOBILE ? '14px 16px' : '10px 14px',
          background:     C.surface,
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
          userSelect:     'none',
        }}
      >
        <span style={{ fontSize: IS_MOBILE ? 18 : 13, fontWeight: 700, color: C.gold, fontFamily: '-apple-system, sans-serif' }}>
          {zh ? section.zh : `${section.zh} / ${section.en}`}
        </span>
        <span style={{ fontSize: IS_MOBILE ? 14 : 11, color: C.muted, marginLeft: 8, flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {/* Body */}
      {isOpen && (
        <div style={{
          background: C.bgDeep,
          padding:    IS_MOBILE ? '14px 16px' : '10px 14px',
        }}>
          <SectionContent sectionKey={section.key} lang={lang} />
        </div>
      )}
    </div>
  )
}

// ── RulesPanel ────────────────────────────────────────────────

export default function RulesPanel({ lang, onClose }) {
  const [openKeys, setOpenKeys] = useState(new Set())

  function toggle(key) {
    setOpenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1500 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div style={{
        position:      'fixed',
        bottom:        0,
        left:          0,
        right:         0,
        height:        '82vh',
        background:    C.bg,
        borderRadius:  IS_MOBILE ? '18px 18px 0 0' : '14px 14px 0 0',
        display:       'flex',
        flexDirection: 'column',
        zIndex:        1501,
        boxShadow:     '0 -6px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          padding:      IS_MOBILE ? '16px 18px' : '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink:   0,
        }}>
          <span style={{
            flex:       1,
            fontSize:   IS_MOBILE ? 22 : 16,
            fontWeight: 700,
            color:      C.text,
            fontFamily: '-apple-system, sans-serif',
          }}>
            {lang === 'zh' ? '規則' : '規則 / Rules'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border:     'none',
              color:      C.muted,
              fontSize:   IS_MOBILE ? 28 : 20,
              cursor:     'pointer',
              padding:    '4px 8px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          flex:      1,
          overflowY: 'auto',
          padding:   IS_MOBILE ? '12px 14px 24px' : '10px 12px 16px',
        }}>
          {SECTIONS.map(s => (
            <CollapsibleSection
              key={s.key}
              section={s}
              lang={lang}
              isOpen={openKeys.has(s.key)}
              onToggle={() => toggle(s.key)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
