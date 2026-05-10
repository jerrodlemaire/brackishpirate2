import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, PanResponder, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import {
  getSolunarForDate, buildActivityCurve,
  scoreColor, scoreLabel, getSunTimes,
} from '../../utils/solunar'
import JollyRoger from '../../components/JollyRoger'
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

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function isSameDay(a, b) { return a.toDateString() === b.toDateString() }

// ── Solunar chart ─────────────────────────────────────────────────────────────
function SolunarChart({ sol }) {
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic              = useRef(-1)

  const curve = buildActivityCurve(sol)
  const stepX = PLOT_W / (curve.length - 1)

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
    onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
  })

  const toY = (v) => PAD_T + PLOT_H - (v / 100) * PLOT_H

  const pts = curve.map((v, i) => ({ x: PAD_L + i * stepX, y: toY(v), v }))

  const nowX  = PAD_L + Math.min(new Date().getHours(), curve.length - 1) * stepX
  const scrub = scrubIdx !== null ? pts[scrubIdx] : null

  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, major: false },
  ]

  return (
    <View style={gc.wrap} {...pan.panHandlers}>

      {/* Window bands */}
      {windows.map((w, i) => {
        const x1 = PAD_L + (w.startH / 24) * PLOT_W
        const x2 = PAD_L + (Math.min(w.endH, 24) / 24) * PLOT_W
        return (
          <View key={i} style={{
            position: 'absolute', left: x1, top: PAD_T,
            width: Math.max(0, x2 - x1), height: PLOT_H,
            backgroundColor: w.major ? 'rgba(196,154,42,0.14)' : 'rgba(196,154,42,0.07)',
            borderLeftWidth: 0.5, borderLeftColor: Colors.doubloonGold,
          }}/>
        )
      })}

      {/* Grid */}
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
            position: 'absolute', left: pt.x, top: avgY,
            width: stepX + 0.5,
            height: Math.max(0, CHART_H - PAD_B - avgY),
            backgroundColor: scrubIdx === i
              ? 'rgba(196,154,42,0.5)' : 'rgba(196,154,42,0.22)',
          }}/>
        )
      })}

      {/* Dots */}
      {pts.map((pt, i) => (
        <View key={i} style={[
          gc.dot,
          { left: pt.x - 2, top: pt.y - 2 },
          scrubIdx === i && gc.dotActive,
        ]}/>
      ))}

      {/* NOW line */}
      <View style={[gc.nowLine, { left: nowX }]}>
        <Text style={gc.nowLbl}>NOW</Text>
      </View>

      {/* Scrub */}
      {scrub && (
        <>
          <View style={[gc.scrubLine, { left: scrub.x }]}/>
          <View style={[gc.bubble, {
            left: Math.min(Math.max(scrub.x - 40, PAD_L), CHART_W - PAD_R - 90),
            top: scrub.y - 44,
          }]}>
            <Text style={gc.bubbleVal}>{scrub.v} / 100</Text>
            <Text style={gc.bubbleLabel}>{scoreLabel(scrub.v)}</Text>
          </View>
        </>
      )}

      {/* X labels */}
      {['12a', '6a', '12p', '6p', '12a'].map((l, i) => (
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
  wrap:       { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  grid:       { position: 'absolute', left: 0, right: PAD_R, height: 0.5, backgroundColor: 'rgba(196,154,42,0.2)', flexDirection: 'row', alignItems: 'center' },
  gridLbl:    { position: 'absolute', left: 0, fontSize: 9, color: Colors.textMuted, width: PAD_L - 4, textAlign: 'right' },
  dot:        { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.doubloonGold },
  dotActive:  { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff', marginLeft: -3, marginTop: -3 },
  nowLine:    { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater },
  nowLbl:     { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.brackishWater, fontWeight: '700' },
  scrubLine:  { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold, opacity: 0.9 },
  bubble:     { position: 'absolute', backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: 'center' },
  bubbleVal:  { fontSize: 14, fontWeight: '700', color: Colors.deepSea },
  bubbleLabel:{ fontSize: 10, color: Colors.deepSea, marginTop: 1, fontWeight: '500' },
  xLbl:       { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:       { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

// ── 10-day strip ──────────────────────────────────────────────────────────────
function DayStrip({ selectedDate, onSelect }) {
  const today = new Date()
  const days  = Array.from({ length: 10 }, (_, i) => addDays(today, i))

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={ds.scroll} contentContainerStyle={ds.content}>
      {days.map((day, i) => {
        const sol      = getSolunarForDate(day)
        const selected = isSameDay(day, selectedDate)
        const todayDay = isSameDay(day, today)
        return (
          <TouchableOpacity
            key={i}
            style={[ds.pill, selected && ds.pillSelected, todayDay && !selected && ds.pillToday]}
            onPress={() => onSelect(day)}
          >
            <Text style={[ds.dayName, selected && ds.textSel]}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[ds.dayNum, selected && ds.textSel]}>{day.getDate()}</Text>
            <Text style={ds.moon}>{sol.moonPhase.emoji}</Text>
            <Text style={[ds.score, selected && ds.textSel]}>{sol.activityScore}</Text>
            <View style={[ds.dot, { backgroundColor: scoreColor(sol.activityScore) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const ds = StyleSheet.create({
  scroll:       { backgroundColor: Colors.deepSea },
  content:      { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  pill:         { width: 58, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.3)', gap: 2 },
  pillSelected: { backgroundColor: '#C49A2A', borderColor: '#C49A2A' },
  pillToday:    { borderColor: Colors.doubloonGold },
  dayName:      { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.3 },
  dayNum:       { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
  moon:         { fontSize: 12 },
  score:        { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  textSel:      { color: Colors.deepSea },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SolunarScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [selectedDate,  setSelectedDate] = useState(new Date())
  const [showCalendar,  setShowCalendar] = useState(false)

  const sol   = getSolunarForDate(selectedDate)
  const sun   = getSunTimes()
  const score = sol.activityScore
  const color = scoreColor(score)
  const label = scoreLabel(score)

  return (
    <View style={s.container}>

      {/* ── CUSTOM TOPBAR ───────────────────────────── */}
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={s.topbarBack}>
          <Text style={s.topbarBackTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Solunar</Text>
        <View style={s.topbarRight}>
          <TouchableOpacity
            style={s.homePortChip}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <JollyRoger size={13} flagColor={Colors.doubloonGold} boneColor={Colors.deepSea}/>
            <Text style={s.homePortTxt}>Home Port</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={s.calBtn}>
            <Text style={s.calBtnTxt}>📅</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── DAY STRIP ───────────────────────────────── */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate}/>

      {/* ── SCROLLABLE CONTENT ──────────────────────── */}
      <ScrollView contentContainerStyle={s.content}>

        {/* Hero */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>Activity score</Text>
            <View style={s.heroScoreRow}>
              <Text style={[s.heroScore, { color }]}>{score}</Text>
              <Text style={s.heroScoreDenom}>/100</Text>
            </View>
            <Text style={s.heroScoreLabel}>{label} fishing conditions</Text>
            <View style={s.scoreBar}>
              <View style={[s.scoreBarFill, { width: `${score}%`, backgroundColor: color }]}/>
            </View>
          </View>
          <View style={s.heroRight}>
            <View style={s.heroBox}>
              <Text style={s.heroBoxLabel}>Moon</Text>
              <Text style={s.heroBoxEmoji}>{sol.moonPhase.emoji}</Text>
              <Text style={s.heroBoxSub}>{sol.illumination}%</Text>
            </View>
            <View style={s.heroBox}>
              <Text style={s.heroBoxLabel}>Full in</Text>
              <Text style={s.heroBoxVal}>{sol.daysToFull}</Text>
              <Text style={s.heroBoxSub}>days</Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Solunar activity</Text>
          <Text style={s.cardSub}>Slide to explore · Gold bands = feeding windows</Text>
          <SolunarChart sol={sol}/>
        </View>

        {/* Moon card */}
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

        {/* Feeding windows */}
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

        {/* Sun row */}
        <View style={s.sunRow}>
          {[
            { icon: '🌅', label: 'Sunrise',     val: sun.sunrise },
            { icon: '🌇', label: 'Sunset',       val: sun.sunset },
            { icon: '🌕', label: 'Illumination', val: `${sol.illumination}%` },
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
            { label: '🌅 Dawn bite',     detail: `First light to 2 hr after ${sun.sunrise}` },
            { label: '🌟 Major solunar', detail: `${sol.major1.start} – ${sol.major1.end}` },
            { label: '🌟 Evening major', detail: `${sol.major2.start} – ${sol.major2.end}` },
            { label: '🌇 Dusk bite',     detail: `2 hr before ${sun.sunset}` },
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

      </ScrollView>

      {/* Calendar modal */}
      {showCalendar && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <TidesCalendar onClose={() => setShowCalendar(false)}/>
        </Modal>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },

  // Topbar
  topbar:       { backgroundColor: Colors.deepSea, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12 },
  topbarBack:   { padding: 4, marginRight: 4 },
  topbarBackTxt:{ fontSize: 26, color: '#fff', lineHeight: 30 },
  topbarTitle:  { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  topbarRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  homePortChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(196,154,42,0.15)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.4)' },
  homePortTxt:  { fontSize: Typography.xs, color: Colors.doubloonGold, fontWeight: '600' },
  calBtn:       { padding: 4 },
  calBtnTxt:    { fontSize: 18 },

  // Content
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  // Hero
  heroCard:       { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start' },
  heroLeft:       { flex: 1 },
  heroLabel:      { fontSize: Typography.sm, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  heroScoreRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  heroScore:      { fontSize: 44, fontWeight: '700', fontFamily: 'Georgia', lineHeight: 48 },
  heroScoreDenom: { fontSize: Typography.md, color: 'rgba(255,255,255,0.5)', marginBottom: 8 },
  heroScoreLabel: { fontSize: Typography.base, color: Colors.saltWhite, marginTop: 4, marginBottom: 10 },
  scoreBar:       { height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:   { height: '100%', borderRadius: 3 },
  heroRight:      { gap: 10, alignItems: 'flex-end', marginLeft: 12 },
  heroBox:        { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.md, padding: 10, alignItems: 'center', minWidth: 60 },
  heroBoxLabel:   { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 3, letterSpacing: 0.3 },
  heroBoxEmoji:   { fontSize: 22, lineHeight: 28 },
  heroBoxVal:     { fontSize: Typography.xl, fontWeight: '700', color: Colors.doubloonGold },
  heroBoxSub:     { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Cards
  card:     { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:{ fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:  { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

  // Moon
  moonCard: { backgroundColor: 'rgba(196,154,42,0.06)', borderRadius: Radius.lg, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.25)', padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14 },
  moonEmoji:{ fontSize: 50 },
  moonInfo: { flex: 1 },
  moonName: { fontSize: Typography.md, fontWeight: '500', color: Colors.textPrimary },
  moonSub:  { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  moonDays: { fontSize: Typography.sm, color: Colors.doubloonGold, marginTop: 6, fontWeight: '500' },

  // Feeding windows
  solGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  solCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.saltWhite, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12 },
  solCardMajor: { borderColor: Colors.doubloonGold, backgroundColor: 'rgba(196,154,42,0.05)' },
  solEmoji:     { fontSize: 16, marginBottom: 4 },
  solLabel:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  solTime:      { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  solDur:       { fontSize: Typography.xs, color: Colors.doubloonGold, marginTop: 3 },

  // Sun row
  sunRow:   { flexDirection: 'row', gap: 8 },
  sunCard:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  sunIcon:  { fontSize: 22 },
  sunLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  sunVal:   { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },

  // Best times
  bestRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  bestLabel: { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
  bestDetail:{ fontSize: Typography.sm, color: Colors.textSecondary },

  scienceTxt:{ fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 22 },
})
