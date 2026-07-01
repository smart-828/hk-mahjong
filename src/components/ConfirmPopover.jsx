// ── ConfirmPopover ────────────────────────────────────────────
// Inline confirmation popover — replaces window.confirm().
// Position via clientX/clientY from the triggering click event.
//
// Usage:
//   const [confirm, setConfirm] = useState(null)
//   // in a button onClick:
//   setConfirm({ x: e.clientX, y: e.clientY, msg: '...', onOk: () => doThing() })
//   // in JSX:
//   {confirm && <ConfirmPopover {...confirm} onCancel={() => setConfirm(null)} />}

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 480
const POP_W     = IS_MOBILE ? 270 : 230
const POP_H     = IS_MOBILE ? 120 : 100  // rough height for upward-flip calc

export default function ConfirmPopover({ x, y, msg, onOk, onCancel }) {
  const left = Math.max(8, Math.min(x - 12, window.innerWidth  - POP_W - 8))
  const top  = y + POP_H + 16 > window.innerHeight
    ? Math.max(8, y - POP_H - 8)   // flip above
    : y + 8

  return (
    <>
      {/* Backdrop — click anywhere outside to cancel */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onCancel}
      />

      {/* Popover card */}
      <div style={{
        position:     'fixed',
        left,
        top,
        width:        POP_W,
        background:   '#16213e',
        border:       '1px solid #4a4a7e',
        borderRadius: IS_MOBILE ? 12 : 9,
        padding:      IS_MOBILE ? '16px 18px' : '11px 14px',
        zIndex:       1000,
        boxShadow:    '0 8px 28px rgba(0,0,0,0.65)',
        fontFamily:   '-apple-system, sans-serif',
      }}>
        <div style={{
          fontSize:     IS_MOBILE ? 18 : 13,
          color:        '#f5f2e8',
          lineHeight:   1.45,
          marginBottom: IS_MOBILE ? 14 : 10,
        }}>
          {msg}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); onCancel() }}
            style={{
              flex:         1,
              padding:      IS_MOBILE ? '10px 8px' : '7px 8px',
              background:   'transparent',
              border:       '1px solid #2a2a4e',
              borderRadius: 6,
              color:        '#888',
              fontSize:     IS_MOBILE ? 15 : 12,
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            取消 / Cancel
          </button>
          <button
            onClick={e => { e.stopPropagation(); onOk(); onCancel() }}
            style={{
              flex:         1,
              padding:      IS_MOBILE ? '10px 8px' : '7px 8px',
              background:   '#7a1515',
              border:       '1px solid #c0392b',
              borderRadius: 6,
              color:        '#fff',
              fontSize:     IS_MOBILE ? 15 : 12,
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            確定 / Confirm
          </button>
        </div>
      </div>
    </>
  )
}
