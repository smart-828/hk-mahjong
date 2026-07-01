// ── Time utilities ─────────────────────────────────────────────
// Timezone formatting for scheduled game times

export function formatInTimezone(date, tz) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(',', '')
}

export function formatBothTimezones(date) {
  if (!date) return { uk: '—', hk: '—' }
  return {
    uk: formatInTimezone(date, 'Europe/London'),
    hk: formatInTimezone(date, 'Asia/Hong_Kong'),
  }
}

// Convert a Date to the "YYYY-MM-DDTHH:mm" string that datetime-local inputs expect
export function toDatetimeLocal(date) {
  if (!date) return ''
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}
