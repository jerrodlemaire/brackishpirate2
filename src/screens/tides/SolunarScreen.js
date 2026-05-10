import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, PanResponder, Modal,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import TidesCalendar from '../../components/TidesCalendar'

const { width } = Dimensions.get('window')
const CHART_W = width - 32
const CHART_H = 160
const PAD_L   = 40
const PAD_R   = 12
const PAD_T   = 16
const PAD_B   = 28
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

// ── SOLUNAR ENGINE ─────────────────────────────────────────────────────────────
function getSolunarForDate(date = new Date(), lat = 30.1766, lng = -90.1146) {
  const JD   = date / 86400000 + 2440587.5
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

  // Solunar windows as decimal hours
  const major1H = toDecimalHour(base)
  const major2H = toDecimalHour(base + 12)
  const minor1H = toDecimalHour(base + 6)
  const minor2H = toDecimalHour(base + 18)

  return {
    major1:        { start: toTime(major1H), end: toTime(major1H + 2), startH: major1H, endH: major1H + 2 },
    major2:        { start: toTime(major2H), end: toTime(major2H + 2), startH: major2H, endH: major2H + 2 },
    minor1:        { start: toTime(minor1H), end: toTime(minor1H + 1), startH: minor1H, endH: minor1H + 1 },
    minor2:        { start: toTime(minor2H), end: toTime(minor2H + 1), startH: minor2H, endH: minor2H + 1 },
    moonPhase,
    illumination,
    activityScore,
    daysToFull,
    phase,
  }
}

// ── BUILD HOURLY ACTIVITY CURVE ────────────────────────────────────────────────
function buildActivityCurve(sol) {
  const hours = Array.from({ length: 25 }, (_, i) => i) // 0–24
  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, peak: 100, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, peak: 100, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, peak: 65,  major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, peak: 65,  major: false },
  ]

  return hours.map(h => {
    let score = sol.activityScore * 0.3 // baseline
    windows.forEach(w => {
      const center = (w.startH + w.endH) / 2
      const radius = w.major ? 3 : 2
      const dist   = Math.min(
        Math.abs(h - center),
        Math.abs(h - center + 24),
        Math.abs(h - center - 24),
      )
      if (dist < radius) {
        const boost = w.peak * (1 - dist / radius)
        score = Math.max(score, boost)
      }
    })
    return Math.min(100, Math.round(score))
  })
}

// ── SOLUNAR CHART ──────────────────────────────────────────────────────────────
function SolunarChart({ sol }) {
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic              = useRef(-1)

  const curve  = buildActivityCurve(sol)
  const stepX  = PLOT_W / (curve.length - 1)

  const getIdx = (x) => {
    const rel = x - PAD_L
    return Math.max(0, Math.min(curve.length - 1, Math.round(rel / stepX)))
  }

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const i = getIdx(e.nativeEvent.locationX)
      setScrubIdx(i)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      lastHaptic.current = i
    },
    onPanResponderMove: (e) => {
      const i = getIdx(e.nativeEvent.locationX)
      setScrubIdx(i)
      if (i !== lastHaptic.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        lastHaptic.current = i
      }
    },
    onPanResponderRelease: () => {
      setTimeout(() => setScrubIdx(null), 2500)
    },
  })

  const toY = (v) => PAD_T + PLOT_H - (v / 100) * PLOT_H

  const pts = curve.map((v, i) => ({
    x: PAD_L + i * stepX,
    y: toY(v),
    v,
    label: i === 0 ? '12a' : i === 6 ? '6a' : i === 12 ? '12p' : i === 18 ? '6p' : i === 24 ? '12a' : '',
  }))

  const nowHour = new Date().getHours()
  const nowX    = PAD_L + Math.min(nowHour, curve.length - 1) * stepX
  const scrub   = scrubIdx !== null ? pts[scrubIdx] : null

  // Score label for scrub
  const scrubLabel = scrub
    ? scrub.v >= 80 ? 'Excellent'
    : scrub.v >= 65 ? 'Good'
    : scrub.v >= 50 ? 'Fair' : 'Slow'
    : ''

  // Window highlight bands
  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, major: false },
  ]

  return (
    <View style={gc.wrap} {...pan.panHandlers}>

      {/* Window bands behind chart */}
      {windows.map((w, i) => {
        const x1 = PAD_L + (w.startH / 24) * PLOT_W
        const x2 = PAD_L + (Math.min(w.endH, 24) / 24) * PLOT_W
        return (
          <View key={i} style={{
            position: 'absolute',
            left: x1, top: PAD_T,
            width: Math.max(0, x2 - x1),
            height: PLOT_H,
            backgroundColor: w.major
              ? 'rgba(196,154,42,0.12)'
              : 'rgba(196,154,42,0.06)',
            borderLeftWidth: 0.5,
            borderLeftColor: Colors.doubloonGold,
          }}/>
        )
      })}

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v, i) => (
        <View key={i} style={[gc.grid, { top: toY(v) }]}>
          <Text style={gc.gridLbl}>{v}</Text>
        </View>
      ))}

      {/* Area bars */}
      {pts.map((pt, i) => {
        if (i === pts.length - 1) return null
        const next = pts[i + 1]
        const avgY = (pt.y + next.y) / 2
        return (
          <View key={i} style={{
            position: 'absolute',
            left: pt.x, top: avgY,
            width: stepX + 0.5,
            height: Math.max(0, CHART_H - PAD_B - avgY),
            backgroundColor: scrubIdx === i
              ? 'rgba(196,154,42,0.5)'
              : 'rgba(196,154,42,0.22)',
          }}/>
        )
      })}

      {/* Line dots */}
      {pts.map((pt, i) => (
        <View key={i} style={[
          gc.dot,
          { left: pt.x - 2, top: pt.y - 2 },
          scrubIdx === i && gc.dotActive,
        ]}/>
      ))}

      {/* Now line */}
      <View style={[gc.nowLine, { left: nowX }]}>
        <Text style={gc.nowLbl}>NOW</Text>
      </View>

      {/* Scrub indicator */}
      {scrub && (
        <>
          <View style={[gc.scrubLine, { left: scrub.x }]}/>
          <View style={[gc.bubble, {
            left: Math.min(Math.max(scrub.x - 40, PAD_L), CHART_W - PAD_R - 90),
            top: scrub.y - 44,
          }]}>
            <Text style={gc.bubbleVal}>{scrub.v} / 100</Text>
            <Text style={gc.bubbleLabel}>{scrubLabel}</Text>
          </View>
        </>
      )}

      {/* X axis labels */}
      {['12a','6a','12p','6p','12a'].map((l, i) => (
        <Text key={i} style={[gc.xLbl, {
          left: PAD_L + (PLOT_W / 4) * i - 8,
          top:  CHART_H - PAD_B + 5,
        }]}>{l}</Text>
      ))}

      {scrubIdx === null && (
        <Text style={gc.hint}>← slide to explore activity →</Text>
      )}
    </View>
  )
}

const gc = StyleSheet.create({
  wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  grid:      { position: 'absolute', left: 0, right: PAD_R, height: 0.5, backgroundColor: 'rgba(196,154,42,0.2)', flexDirection: 'row', alignItems: 'center' },
  gridLbl:   { position: 'absolute', left: 0, fontSize: 9, color: Colors.textMuted, width: PAD_L - 4, textAlign: 'right' },
  dot:       { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.doubloonGold },
  dotActive: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff', marginLeft: -3, marginTop: -3 },
  nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater },
  nowLbl:    { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.brackishWater, fontWeight: '700' },
  scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold, opacity: 0.9 },
  bubble:    { position: 'absolute', backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: 'center' },
  bubbleVal: { fontSize: 14, fontWeight: '700', color: Colors.deepSea },
  bubbleLabel:{ fontSize: 10, color: Colors.deepSea, marginTop: 1, fontWeight: '500' },
  xLbl:      { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:      { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

// ── MAIN SOLUNAR SCREEN ────────────────────────────────────────────────────────
export default function SolunarScreen() {
  const [showCalendar, setShowCalendar] = useState(false)
  const sol = getSolunarForDate(new Date())

  const actScore = sol.activityScore
  const scoreColor = actScore >= 80 ? Colors.marshGreen
    : actScore >= 65 ? Colors.doubloonGold
    : actScore >= 50 ? Colors.brackishWater
    : Colors.textSecondary

  const scoreLabel = actScore >= 80 ? 'Excellent'
    : actScore >= 65 ? 'Good'
    : actScore >= 50 ? 'Fair' : 'Slow'

  // Sun times
  const getSunTimes = () => {
    const now = new Date()
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)
    const dec = 23.45 * Math.sin((360 / 365) * (day - 81) * Math.PI / 180)
    const lat = 30.18, lng = 90.11
    const ha  = Math.acos(-Math.tan(lat * Math.PI / 180) * Math.tan(dec * Math.PI / 180)) * 180 / Math.PI
    const sr  = 12 - ha / 15 + lng / 15
    const ss  = 12 + ha / 15 + lng / 15
    const fmt = (h) => {
      const n = ((h % 24) + 24) % 24
      const hh = Math.floor(n), mm = Math.floor((n - hh) * 60)
      const ap = hh >= 12 ? 'PM' : 'AM'
      return `${hh % 12 === 0 ? 12 : hh % 12}:${mm.toString().padStart(2,'0')} ${ap}`
    }
    return { sunrise: fmt(sr), sunset: fmt(ss) }
  }
  const sun = getSunTimes()

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroLeft}>
          <Text style={s.heroLabel}>Today's activity score</Text>
          <View style={s.heroScoreRow}>
            <Text style={s.heroScore}>{actScore}</Text>
            <Text style={s.heroScoreDenom}>/100</Text>
          </View>
          <Text style={s.heroScoreLabel}>{scoreLabel} fishing conditions</Text>
          <View style={s.scoreBar}>
            <View style={[s.scoreBarFill, { width: `${actScore}%`, backgroundColor: scoreColor }]}/>
          </View>
        </View>
        <TouchableOpacity style={s.calBtn} onPress={() => setShowCalendar(true)}>
          <Text style={s.calBtnTxt}>📅</Text>
          <Text style={s.calBtnLabel}>Calendar</Text>
        </TouchableOpacity>
      </View>

      {/* Chart */}
      <View style={s.chartCard}>
        <Text style={s.cardTitle}>Solunar activity — today</Text>
        <Text style={s.chartSub}>Slide to explore · Gold bands = feeding windows</Text>
        <SolunarChart sol={sol}/>
      </View>

      {/* Moon */}
      <View style={s.moonCard}>
        <Text style={s.moonEmoji}>{sol.moonPhase.emoji}</Text>
        <View style={s.moonInfo}>
          <Text style={s.moonName}>{sol.moonPhase.name}</Text>
          <Text style={s.moonSub}>{sol.illumination}% illuminated</Text>
          <Text style={s.moonDays}>
            {sol.daysToFull === 0
              ? '🔥 Full moon tonight — peak conditions'
              : `Full moon in ${sol.daysToFull} day${sol.daysToFull === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>

      {/* Solunar windows */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Feeding windows</Text>
        <View style={s.solGrid}>
          {[
            { label: 'Major AM', start: sol.major1.start, end: sol.major1.end, major: true,  emoji: '🌟' },
            { label: 'Minor AM', start: sol.minor1.start, end: sol.minor1.end, major: false, emoji: '⭐' },
            { label: 'Major PM', start: sol.major2.start, end: sol.major2.end, major: true,  emoji: '🌟' },
            { label: 'Minor PM', start: sol.minor2.start, end: sol.minor2.end, major: false, emoji: '⭐' },
          ].map((w, i) => (
            <View key={i} style={[s.solCard, w.major && s.solCardMajor]}>
              <Text style={s.solEmoji}>{w.emoji}</Text>
              <Text style={s.solLabel}>{w.label}</Text>
              <Text style={s.solTime}>{w.start}</Text>
              <Text style={s.solDur}>{w.major ? '2 hr window' : '1 hr window'}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Sun & best times */}
      <View style={s.sunRow}>
        {[
          { icon: '🌅', label: 'Sunrise', val: sun.sunrise },
          { icon: '🌇', label: 'Sunset',  val: sun.sunset },
          { icon: '🌕', label: 'Moon',    val: `${sol.illumination}%` },
        ].map((c, i) => (
          <View key={i} style={s.sunCard}>
            <Text style={s.sunIcon}>{c.icon}</Text>
            <Text style={s.sunLabel}>{c.label}</Text>
            <Text style={s.sunVal}>{c.val}</Text>
          </View>
        ))}
      </View>

      {/* Best times */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Best fishing windows today</Text>
        {[
          { label: '🌅 Dawn bite',      detail: `First light to 2hr after ${sun.sunrise}` },
          { label: '🌟 Major solunar',  detail: `${sol.major1.start} – ${sol.major1.end}` },
          { label: '🌟 Evening major',  detail: `${sol.major2.start} – ${sol.major2.end}` },
          { label: '🌇 Dusk bite',      detail: `2hr before ${sun.sunset}` },
        ].map((b, i) => (
          <View key={i} style={s.bestRow}>
            <Text style={s.bestLabel}>{b.label}</Text>
            <Text style={s.bestDetail}>{b.detail}</Text>
          </View>
        ))}
      </View>

      {/* Solunar science */}
      <View style={s.card}>
        <Text style={s.cardTitle}>About solunar theory</Text>
        <Text style={s.scienceTxt}>
          Solunar theory, developed by John Alden Knight in 1926, predicts fish feeding
          activity based on the moon's position and gravitational pull. Major periods occur
          when the moon is directly overhead or underfoot. Minor periods occur when the
          moon rises or sets. Peak activity typically aligns with a rising or full moon.
        </Text>
      </View>

      {/* Calendar modal */}
      {showCalendar && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <TidesCalendar onClose={() => setShowCalendar(false)}/>
        </Modal>
      )}

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.saltWhite },
  content:    { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  hero:       { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start' },
  heroLeft:   { flex: 1 },
  heroLabel:  { fontSize: Typography.sm, color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  heroScoreRow:{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  heroScore:  { fontSize: 44, fontWeight: '700', color: Colors.doubloonGold, fontFamily: 'Georgia', lineHeight: 48 },
  heroScoreDenom:{ fontSize: Typography.md, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  heroScoreLabel:{ fontSize: Typography.base, color: Colors.saltWhite, marginTop: 4, marginBottom: 10 },
  scoreBar:   { height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:{ height: '100%', borderRadius: 3 },
  calBtn:     { alignItems: 'center', backgroundColor: 'rgba(196,154,42,0.15)', borderRadius: Radius.md, padding: 10, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.4)', marginLeft: 12 },
  calBtnTxt:  { fontSize: 22 },
  calBtnLabel:{ fontSize: Typography.xs, color: Colors.doubloonGold, marginTop: 2 },

  chartCard:  { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:  { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
  chartSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },
  card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },

  moonCard:   { backgroundColor: 'rgba(196,154,42,0.06)', borderRadius: Radius.lg, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.25)', padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14 },
  moonEmoji:  { fontSize: 50 },
  moonInfo:   { flex: 1 },
  moonName:   { fontSize: Typography.md, fontWeight: '500', color: Colors.textPrimary },
  moonSub:    { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  moonDays:   { fontSize: Typography.sm, color: Colors.doubloonGold, marginTop: 6, fontWeight: '500' },

  solGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  solCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.saltWhite, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12 },
  solCardMajor: { borderColor: Colors.doubloonGold, backgroundColor: 'rgba(196,154,42,0.05)' },
  solEmoji:     { fontSize: 16, marginBottom: 4 },
  solLabel:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  solTime:      { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  solDur:       { fontSize: Typography.xs, color: Colors.doubloonGold, marginTop: 3 },

  sunRow:     { flexDirection: 'row', gap: 8 },
  sunCard:    { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  sunIcon:    { fontSize: 22 },
  sunLabel:   { fontSize: Typography.xs, color: Colors.textSecondary },
  sunVal:     { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },

  bestRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  bestLabel:  { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
  bestDetail: { fontSize: Typography.sm, color: Colors.textSecondary },

  scienceTxt: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 22 },
})
