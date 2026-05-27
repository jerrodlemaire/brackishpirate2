import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import {
  getSolunarForDate, buildActivityCurve,
  scoreColor, scoreLabel, getSunTimes, getMoonEmoji,
} from '../../utils/solunar'
import { useDataLocation } from '../../hooks/useDataLocation'
import { smoothBezierPath, smoothAreaPath } from '../../utils/chart'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'

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
  const { Colors } = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic = useRef(-1)
  const panRef     = useRef(null)
  const getIdxFn   = useRef(null)
  const curveRef   = useRef([])
  const stepXRef   = useRef(1)

  const gc = useMemo(() => StyleSheet.create({
    wrap:        { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
    gridLbl:     { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    nowLine:     { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater },
    scrubLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold, opacity: 0.9 },
    bubble:      { position: 'absolute', backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 90, alignItems: 'center' },
    bubbleVal:   { fontSize: 16, fontWeight: '700', color: Colors.deepSea },
    bubbleLabel: { fontSize: 12, color: Colors.deepSea, marginTop: 1, fontWeight: '600' },
    xLbl:        { position: 'absolute', fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary },
  }), [Colors])

  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i == null) return
        setScrubIdx(i); Haptics.selectionAsync(); lastHaptic.current = i
      },
      onPanResponderMove: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i == null) return
        setScrubIdx(i)
        if (i !== lastHaptic.current) { Haptics.selectionAsync(); lastHaptic.current = i }
      },
      onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
    })
  }

  const curve = buildActivityCurve(sol)
  const stepX = PLOT_W / (curve.length - 1)
  const toY   = (v) => PAD_T + PLOT_H - (v / 100) * PLOT_H

  curveRef.current = curve
  stepXRef.current = stepX
  getIdxFn.current = (x) =>
    Math.max(0, Math.min(curveRef.current.length - 1, Math.round((x - PAD_L) / stepXRef.current)))

  const pan = panRef.current

  const pts = curve.map((v, i) => ({ x: PAD_L + i * stepX, y: toY(v), v }))

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)

  const nowX  = PAD_L + Math.min(new Date().getHours(), curve.length - 1) * stepX
  const scrub = scrubIdx !== null ? pts[scrubIdx] : null

  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, major: false },
  ]

  return (
    <View
      style={gc.wrap}
      onTouchStart={(e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      }}
      {...pan.panHandlers}
    >
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="solGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.doubloonGold} stopOpacity="0.45"/>
            <Stop offset="1" stopColor={Colors.doubloonGold} stopOpacity="0.02"/>
          </LinearGradient>
        </Defs>
        {windows.map((w, i) => {
          const x1 = PAD_L + (w.startH / 24) * PLOT_W
          const x2 = PAD_L + (Math.min(w.endH, 24) / 24) * PLOT_W
          return (
            <Path key={i}
              d={`M ${x1.toFixed(1)},${PAD_T} L ${x2.toFixed(1)},${PAD_T} L ${x2.toFixed(1)},${CHART_H-PAD_B} L ${x1.toFixed(1)},${CHART_H-PAD_B} Z`}
              fill={w.major ? 'rgba(196,154,42,0.14)' : 'rgba(196,154,42,0.07)'}
            />
          )
        })}
        {[0, 25, 50, 75, 100].map((v, i) => (
          <Path key={i}
            d={`M ${PAD_L},${toY(v).toFixed(1)} L ${CHART_W - PAD_R},${toY(v).toFixed(1)}`}
            stroke="rgba(196,154,42,0.15)" strokeWidth="0.5"/>
        ))}
        <Path d={areaPath} fill="url(#solGrad)"/>
        <Path d={linePath} fill="none" stroke={Colors.doubloonGold} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>
        {scrub && (
          <>
            <Path
              d={`M ${PAD_L},${scrub.y.toFixed(1)} L ${scrub.x.toFixed(1)},${scrub.y.toFixed(1)}`}
              stroke={Colors.doubloonGold} strokeWidth="1" strokeDasharray="4,3" opacity="0.65"
            />
            <Circle cx={scrub.x.toFixed(1)} cy={scrub.y.toFixed(1)} r="4.5"
              fill={Colors.doubloonGold} stroke="#fff" strokeWidth="1.5"/>
          </>
        )}
      </Svg>

      {[0, 50, 100].map((v, i) => (
        <Text key={i} style={[gc.gridLbl, { top: toY(v) - 6 }]}>{v}</Text>
      ))}
      <View style={[gc.nowLine, { left: nowX }]}/>
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
      {['12a', '6a', '12p', '6p', '12a'].map((l, i) => (
        <Text key={i} style={[gc.xLbl, {
          left: PAD_L + (PLOT_W / 4) * i - 8,
          top:  CHART_H - PAD_B + 5,
        }]}>{l}</Text>
      ))}
    </View>
  )
}

// ── Day strip ─────────────────────────────────────────────────────────────────
function DayStrip({ selectedDate, onSelect }) {
  const { Colors } = useTheme()

  const ds = useMemo(() => StyleSheet.create({
    scroll:       { backgroundColor: Colors.topbarBg },
    content:      { paddingHorizontal: 8, paddingVertical: 10, gap: 4, alignItems: 'center' },
    monthSep:     { justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 4, marginRight: 2 },
    monthTxt:     { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5, textTransform: 'uppercase' },
    pill:         { width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.3)', gap: 2 },
    pillSelected: { backgroundColor: 'rgba(196,154,42,0.45)', borderColor: Colors.doubloonGold },
    pillToday:    { borderColor: Colors.doubloonGold },
    dayName:      { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.3 },
    dayNum:       { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
    moon:         { fontSize: 12 },
    score:        { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    dot:          { width: 6, height: 6, borderRadius: 3 },
    textSel:      { color: '#fff' },
  }), [Colors])

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const items = useMemo(() => {
    const result = []
    let lastMonth = -1
    for (let i = 0; i < 120; i++) {
      const d = addDays(today, i)
      const m = d.getMonth()
      if (m !== lastMonth) {
        result.push({ type: 'month', label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), key: `m-${i}` })
        lastMonth = m
      }
      result.push({ type: 'day', date: d, key: `d-${i}` })
    }
    return result
  }, [today])

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={ds.scroll} contentContainerStyle={ds.content}>
      {items.map(item => {
        if (item.type === 'month') {
          return (
            <View key={item.key} style={ds.monthSep}>
              <Text style={ds.monthTxt}>{item.label}</Text>
            </View>
          )
        }
        const day      = item.date
        const sol      = getSolunarForDate(day)
        const selected = isSameDay(day, selectedDate)
        const todayDay = isSameDay(day, today)
        return (
          <TouchableOpacity key={item.key}
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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function SolunarScreen() {
  const { Colors } = useTheme()
  const { solunarLocation, setSolunarLocation } = useDataLocation()
  const [selectedDate,       setSelectedDate]       = useState(new Date())
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const sol   = getSolunarForDate(selectedDate)
  const sun   = getSunTimes()
  const score = sol.activityScore
  const color = scoreColor(score)
  const label = scoreLabel(score)

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },

    topbar:        { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12 },
    topbarBack:    { padding: 4, marginRight: 4 },
    topbarBackTxt: { fontSize: 26, color: '#fff', lineHeight: 30 },
    topbarTitle:   { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },

    heroCard:       { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'flex-start' },
    heroLeft:       { flex: 1 },
    heroLabel:      { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
    heroScoreRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    heroScore:      { fontSize: 32, fontWeight: '700', fontFamily: 'Georgia', lineHeight: 36 },
    heroScoreDenom: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: 4 },
    heroScoreLabel: { fontSize: Typography.sm, color: Colors.textPrimary, marginTop: 3, marginBottom: 8 },
    heroMoonPhase:  { fontSize: Typography.sm, color: Colors.doubloonGold, fontWeight: '500', marginTop: 1 },
    scoreBar:       { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
    scoreBarFill:   { height: '100%', borderRadius: 2 },
    heroRight:      { gap: 8, alignItems: 'flex-end', marginLeft: 12 },
    heroBox:        { backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 60 },
    heroBoxLabel:   { fontSize: 9, color: Colors.textSecondary, marginBottom: 2, letterSpacing: 0.3 },
    heroBoxEmoji:   { fontSize: 20, lineHeight: 24 },
    heroBoxVal:     { fontSize: Typography.lg, fontWeight: '700', color: Colors.doubloonGold },
    heroBoxSub:     { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },

    card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    cardSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

    moonCard:  { backgroundColor: `${Colors.doubloonGold}0F`, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: `${Colors.doubloonGold}40`, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14 },
    moonEmoji: { fontSize: 50 },
    moonInfo:  { flex: 1 },
    moonName:  { fontSize: Typography.md, fontWeight: '500', color: Colors.textPrimary },
    moonSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
    moonDays:  { fontSize: Typography.sm, color: Colors.doubloonGold, marginTop: 6, fontWeight: '500' },

    solGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
    solCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12 },
    solCardMajor: { borderColor: Colors.doubloonGold, backgroundColor: `${Colors.doubloonGold}0D` },
    solEmoji:     { fontSize: 16, marginBottom: 4 },
    solLabel:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
    solTime:      { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
    solDur:       { fontSize: Typography.xs, color: Colors.doubloonGold, marginTop: 3 },

    sunRow:   { flexDirection: 'row', gap: 8 },
    sunCard:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
    sunIcon:  { fontSize: 22 },
    sunLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
    sunVal:   { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },

    bestRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    bestLabel:  { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
    bestDetail: { fontSize: Typography.sm, color: Colors.textSecondary },

    scienceTxt: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 22 },
  }), [Colors])

  return (
    <View style={s.container}>

      {/* TOPBAR */}
      <View style={[s.topbar, { paddingTop: 10 }]}>
        <Text style={s.topbarTitle}>Solunar</Text>
        <LocationChip
          label={solunarLocation.name}
          onPress={() => setShowLocationPicker(true)}
          color={Colors.doubloonGold}
          boneColor={Colors.topbarBg}
        />
      </View>

      {/* DAY STRIP */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate}/>

      {/* SCROLLABLE CONTENT */}
      <ScrollView contentContainerStyle={s.content}>

        {/* Hero */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>Activity score</Text>
            <View style={s.heroScoreRow}>
              <Text style={[s.heroScore, { color }]}>{score}</Text>
              <Text style={s.heroScoreDenom}>/100</Text>
            </View>
            <Text style={s.heroMoonPhase}>{sol.moonPhase.name}</Text>
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
          <Text style={s.cardSub}>Gold bands = feeding windows · {solunarLocation.name}</Text>
          <SolunarChart sol={sol}/>
        </View>

        {/* Best times — moved directly below chart */}
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
            { icon: getMoonEmoji(sol.phase), label: 'Illumination', val: `${sol.illumination}%` },
          ].map((c, i) => (
            <View key={i} style={s.sunCard}>
              <Text style={s.sunIcon}>{c.icon}</Text>
              <Text style={s.sunLabel}>{c.label}</Text>
              <Text style={s.sunVal}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Science blurb */}
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

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(lat, lng, name) => setSolunarLocation(lat, lng, name)}
        title="Set Solunar Location"
        initialLat={solunarLocation.lat}
        initialLng={solunarLocation.lng}
      />

    </View>
  )
}
