import { Colors as DefaultColors } from '../constants/theme'

export function getSolunarForDate(date = new Date(), lat = 30.1766, lng = -90.1146) {
  const JD          = date / 86400000 + 2440587.5
  const moonLng     = (218.3165 + 13.176396 * (JD - 2451545)) % 360
  const moonTransit = ((moonLng - lng) / 360) * 24
  const base        = ((moonTransit % 24) + 24) % 24

  const toTime = (h) => {
    const n    = ((h % 24) + 24) % 24
    const hrs  = Math.floor(n)
    const mins = Math.floor((n - hrs) * 60)
    const ampm = hrs >= 12 ? 'PM' : 'AM'
    const h12  = hrs % 12 === 0 ? 12 : hrs % 12
    return `${h12}:${mins.toString().padStart(2, '0')} ${ampm}`
  }

  const toDecimalHour = (h) => ((h % 24) + 24) % 24

  const phase        = ((JD - 2451549.5) / 29.53058867) % 1
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100)

  const phaseNames = [
    { name: 'New Moon',        emoji: '🌑', range: [0,    0.06] },
    { name: 'Waxing Crescent', emoji: '🌒', range: [0.06, 0.25] },
    { name: 'First Quarter',   emoji: '🌓', range: [0.25, 0.31] },
    { name: 'Waxing Gibbous',  emoji: '🌔', range: [0.31, 0.50] },
    { name: 'Full Moon',       emoji: '🌕', range: [0.50, 0.56] },
    { name: 'Waning Gibbous',  emoji: '🌖', range: [0.56, 0.75] },
    { name: 'Last Quarter',    emoji: '🌗', range: [0.75, 0.81] },
    { name: 'Waning Crescent', emoji: '🌘', range: [0.81, 1.00] },
  ]
  const moonPhase    = phaseNames.find(p => phase >= p.range[0] && phase < p.range[1]) || phaseNames[0]
  const moonScore    = illumination > 80 || illumination < 20 ? 92 : 55 + illumination * 0.35
  const activityScore= Math.min(100, Math.round(moonScore))
  const daysToFull   = phase <= 0.5
    ? Math.round((0.5 - phase) * 29.53)
    : Math.round((1.5 - phase) * 29.53)

  const major1H = toDecimalHour(base)
  const major2H = toDecimalHour(base + 12)
  const minor1H = toDecimalHour(base + 6)
  const minor2H = toDecimalHour(base + 18)

  return {
    major1:       { start: toTime(major1H), end: toTime(major1H + 2), startH: major1H, endH: major1H + 2 },
    major2:       { start: toTime(major2H), end: toTime(major2H + 2), startH: major2H, endH: major2H + 2 },
    minor1:       { start: toTime(minor1H), end: toTime(minor1H + 1), startH: minor1H, endH: minor1H + 1 },
    minor2:       { start: toTime(minor2H), end: toTime(minor2H + 1), startH: minor2H, endH: minor2H + 1 },
    moonPhase,
    illumination,
    activityScore,
    daysToFull,
    phase,
  }
}

export function buildActivityCurve(sol) {
  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, peak: 100, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, peak: 100, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, peak: 65,  major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, peak: 65,  major: false },
  ]
  return Array.from({ length: 25 }, (_, h) => {
    let score = sol.activityScore * 0.3
    windows.forEach(w => {
      const center = (w.startH + w.endH) / 2
      const radius = w.major ? 3 : 2
      const dist   = Math.min(
        Math.abs(h - center),
        Math.abs(h - center + 24),
        Math.abs(h - center - 24),
      )
      if (dist < radius) score = Math.max(score, w.peak * (1 - dist / radius))
    })
    return Math.min(100, Math.round(score))
  })
}

export function scoreColor(score, Colors = DefaultColors) {
  if (score >= 80) return Colors.marshGreen
  if (score >= 65) return Colors.doubloonGold
  if (score >= 50) return Colors.brackishWater
  return Colors.textSecondary
}

export function scoreLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Slow'
}

export function getSunTimes(lat = 30.18, lngDeg = 90.11) {
  const now = new Date()
  const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
  const dec = 23.45 * Math.sin((360 / 365) * (day - 81) * Math.PI / 180)
  const ha  = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(dec * Math.PI / 180)) * 180 / Math.PI
  const sr  = 12 - ha / 15 + lngDeg / 15
  const ss  = 12 + ha / 15 + lngDeg / 15
  const fmt = (h) => {
    const n  = ((h % 24) + 24) % 24
    const hh = Math.floor(n)
    const mm = Math.floor((n - hh) * 60)
    const ap = hh >= 12 ? 'PM' : 'AM'
    return `${hh % 12 === 0 ? 12 : hh % 12}:${mm.toString().padStart(2, '0')} ${ap}`
  }
  return { sunrise: fmt(sr), sunset: fmt(ss) }
}
