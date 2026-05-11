import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder, Modal,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { fetchTideHourly, fetchTideHiLo } from '../../utils/tides'
import { getSolunarForDate, scoreColor } from '../../utils/solunar'
import { useDataLocation } from '../../hooks/useDataLocation'
import LocationChip from '../../components/LocationChip'
import TideStationPickerModal from '../../components/TideStationPickerModal'
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

// ── Bezier helpers ────────────────────────────────────────────────────────────
function smoothBezierPath(pts) {
  if (pts.length < 2) return ''
  const t = 0.35
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) * t
    const cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t
    const cp2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function smoothAreaPath(pts, bottomY) {
  if (pts.length === 0) return ''
  const line  = smoothBezierPath(pts)
  const last  = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L ${last.x.toFixed(1)},${bottomY.toFixed(1)} L ${first.x.toFixed(1)},${bottomY.toFixed(1)} Z`
}

// ── Tide chart ────────────────────────────────────────────────────────────────
function TideChart({ hourlyData }) {
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic               = useRef(-1)

  if (!hourlyData || hourlyData.length === 0) {
    return (
      <View style={[tc.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.brackishWater}/>
      </View>
    )
  }

  const values = hourlyData.map(p => parseFloat(p.v))
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range  = maxVal - minVal || 1
  const stepX  = PLOT_W / (values.length - 1)

  const getIdx = (x) => {
    const rel = x - PAD_L
    return Math.max(0, Math.min(values.length - 1, Math.round(rel / stepX)))
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

  const pts = values.map((v, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H,
    v,
    t: hourlyData[i]?.t?.split(' ')[1] || '',
  }))

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)

  const nowX  = PAD_L + Math.min(new Date().getHours(), values.length - 1) * stepX
  const scrub = scrubIdx !== null ? pts[scrubIdx] : null

  const direction = scrub && scrubIdx > 0
    ? pts[scrubIdx].v > pts[scrubIdx - 1].v ? '↑ Rising' : '↓ Falling'
    : ''

  const gridVals = [minVal, minVal + range * 0.25, minVal + range * 0.5, minVal + range * 0.75, maxVal]

  return (
    <View style={tc.wrap} {...pan.panHandlers}>
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.brackishWater} stopOpacity="0.45"/>
            <Stop offset="1" stopColor={Colors.brackishWater} stopOpacity="0.03"/>
          </LinearGradient>
        </Defs>
        {gridVals.map((v, i) => {
          const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
          return (
            <Path key={i} d={`M ${PAD_L},${y.toFixed(1)} L ${CHART_W - PAD_R},${y.toFixed(1)}`}
              stroke="rgba(74,143,168,0.15)" strokeWidth="0.5"/>
          )
        })}
        <Path d={areaPath} fill="url(#tideGrad)"/>
        <Path d={linePath} fill="none" stroke={Colors.brackishWater} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>

      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return (
          <Text key={i} style={[tc.gridLbl, { top: y - 6 }]}>
            {v.toFixed(1)}
          </Text>
        )
      })}

      <View style={[tc.nowLine, { left: nowX }]}>
        <Text style={tc.nowLbl}>NOW</Text>
      </View>

      {scrub && (
        <>
          <View style={[tc.scrubLine, { left: scrub.x }]}/>
          <View style={[tc.bubble, {
            left: Math.min(Math.max(scrub.x - 50, PAD_L), CHART_W - PAD_R - 110),
            top: scrub.y - 48,
          }]}>
            <Text style={tc.bubbleVal}>{scrub.v.toFixed(2)} ft</Text>
            <Text style={tc.bubbleTime}>{scrub.t} {direction}</Text>
          </View>
        </>
      )}

      {['12a', '6a', '12p', '6p', '11p'].map((l, i) => (
        <Text key={i} style={[tc.xLbl, {
          left: PAD_L + (PLOT_W / 4) * i - 8,
          top:  CHART_H - PAD_B + 5,
        }]}>{l}</Text>
      ))}

      {scrubIdx === null && (
        <Text style={tc.hint}>← slide to explore →</Text>
      )}
    </View>
  )
}

const tc = StyleSheet.create({
  wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 9, color: Colors.textMuted },
  nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
  nowLbl:    { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.doubloonGold, fontWeight: '700' },
  scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater, opacity: 0.8 },
  bubble:    { position: 'absolute', backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 100, alignItems: 'center' },
  bubbleVal: { fontSize: 14, fontWeight: '700', color: '#fff' },
  bubbleTime:{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  xLbl:      { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:      { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

// ── 10-day strip ──────────────────────────────────────────────────────────────
function DayStrip({ selectedDate, onSelect }) {
  const today = new Date()
  const days  = Array.from({ length: 10 }, (_, i) => addDays(today, i))
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ds.scroll}
      contentContainerStyle={ds.content}>
      {days.map((day, i) => {
        const sol      = getSolunarForDate(day)
        const selected = isSameDay(day, selectedDate)
        const todayDay = isSameDay(day, today)
        return (
          <TouchableOpacity key={i}
            style={[ds.pill, selected && ds.pillSelected, todayDay && !selected && ds.pillToday]}
            onPress={() => onSelect(day)}
          >
            <Text style={[ds.dayName, selected && ds.textSel]}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[ds.dayNum, selected && ds.textSel]}>{day.getDate()}</Text>
            <Text style={ds.moon}>{sol.moonPhase.emoji}</Text>
            <Text style={[ds.tideVal, selected && ds.textSel]}>—</Text>
            <View style={[ds.dot, { backgroundColor: scoreColor(sol.activityScore) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const ds = StyleSheet.create({
  scroll:       { backgroundColor: Colors.brackishWater },
  content:      { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  pill:         { width: 58, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', gap: 2 },
  pillSelected: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: '#fff' },
  pillToday:    { borderColor: Colors.doubloonGold },
  dayName:      { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.3 },
  dayNum:       { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
  moon:         { fontSize: 12 },
  tideVal:      { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  textSel:      { color: '#fff' },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TidesScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { tideStation, setTideStation } = useDataLocation()
  const [selectedDate,     setSelectedDate]     = useState(new Date())
  const [hourly,           setHourly]           = useState([])
  const [hiLo,             setHiLo]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [refreshing,       setRefreshing]       = useState(false)
  const [showCalendar,     setShowCalendar]     = useState(false)
  const [showStationPicker, setShowStationPicker] = useState(false)

  const loadData = useCallback(async (date) => {
    try {
      const [h, hl] = await Promise.all([
        fetchTideHourly(date, tideStation.id),
        fetchTideHiLo(date, tideStation.id),
      ])
      setHourly(h)
      setHiLo(hl)
    } catch (e) {
      console.log('Tide fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tideStation.id])

  useEffect(() => {
    setLoading(true)
    loadData(selectedDate)
  }, [selectedDate, loadData])

  const onRefresh = () => { setRefreshing(true); loadData(selectedDate) }

  const nowHour    = new Date().getHours()
  const currentVal = hourly[nowHour]     ? parseFloat(hourly[nowHour].v)     : null
  const prevVal    = hourly[nowHour - 1] ? parseFloat(hourly[nowHour - 1].v) : null
  const tideDir    = currentVal !== null && prevVal !== null
    ? currentVal > prevVal ? 'Incoming ↑' : 'Outgoing ↓'
    : '—'

  const nextHighs = hiLo.filter(t => t.type === 'H')
  const nextLows  = hiLo.filter(t => t.type === 'L')

  return (
    <View style={s.container}>

      {/* ── CUSTOM TOPBAR ───────────────────────────── */}
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={s.topbarBack}>
          <Text style={s.topbarBackTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Tides</Text>
        <View style={s.topbarRight}>
          <LocationChip
            label={tideStation.name}
            onPress={() => setShowStationPicker(true)}
            color="#fff"
            boneColor={Colors.brackishWater}
          />
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={s.calBtn}>
            <Text style={s.calBtnTxt}>📅</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── DAY STRIP ───────────────────────────────── */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate}/>

      {/* ── SCROLLABLE CONTENT ──────────────────────── */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>}
      >
        {/* Compact hero */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>Current tide</Text>
            <Text style={s.heroVal}>{currentVal !== null ? `${currentVal.toFixed(2)} ft` : '—'}</Text>
            <Text style={s.heroDir}>{tideDir}</Text>
          </View>
          <View style={s.heroRight}>
            <View style={s.heroBox}>
              <Text style={s.heroBoxLabel}>Next high</Text>
              <Text style={s.heroBoxVal}>{nextHighs[0] ? `${parseFloat(nextHighs[0].v).toFixed(1)} ft` : '—'}</Text>
              <Text style={s.heroBoxTime}>{nextHighs[0]?.t?.split(' ')[1] || ''}</Text>
            </View>
            <View style={s.heroBox}>
              <Text style={s.heroBoxLabel}>Next low</Text>
              <Text style={[s.heroBoxVal, { color: Colors.doubloonGold }]}>{nextLows[0] ? `${parseFloat(nextLows[0].v).toFixed(1)} ft` : '—'}</Text>
              <Text style={s.heroBoxTime}>{nextLows[0]?.t?.split(' ')[1] || ''}</Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Today's tide chart</Text>
          <Text style={s.cardSub}>Slide your finger to explore · {tideStation.name}</Text>
          {loading
            ? <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={Colors.brackishWater}/>
              </View>
            : <TideChart hourlyData={hourly}/>
          }
        </View>

        {/* Hi/Lo grid */}
        <View style={s.card}>
          <Text style={s.cardTitle}>High & low tides</Text>
          <View style={s.hiLoGrid}>
            {hiLo.map((t, i) => {
              const high = t.type === 'H'
              return (
                <View key={i} style={[s.hiLoCard, high ? s.hiLoHigh : s.hiLoLow]}>
                  <Text style={s.hiLoIcon}>{high ? '▲' : '▼'}</Text>
                  <Text style={s.hiLoType}>{high ? 'High tide' : 'Low tide'}</Text>
                  <Text style={s.hiLoVal}>{parseFloat(t.v).toFixed(2)} ft</Text>
                  <Text style={s.hiLoTime}>{t.t.split(' ')[1]}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* Info row */}
        <View style={s.infoRow}>
          {[
            { icon: '🌊', label: 'Tidal range', val: hiLo.length >= 2 ? `${Math.abs(parseFloat(hiLo[0].v) - parseFloat(hiLo[1].v)).toFixed(2)} ft` : '—' },
            { icon: '📍', label: 'Station', val: tideStation.name },
            { icon: '📐', label: 'Datum', val: 'MLLW' },
          ].map((c, i) => (
            <View key={i} style={s.infoCard}>
              <Text style={s.infoIcon}>{c.icon}</Text>
              <Text style={s.infoLabel}>{c.label}</Text>
              <Text style={s.infoVal} numberOfLines={2}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* Fishing tips */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Tide fishing tips</Text>
          {[
            { tide: 'Incoming', tip: 'Baitfish push onto flats. Prime time for speckled trout and redfish on popping cork.' },
            { tide: 'High slack', tip: 'Brief lull before outgoing. Work jigs slowly around structure and oyster reefs.' },
            { tide: 'Outgoing', tip: 'Bait flushes through passes. Ambush points near drain outlets are key.' },
            { tide: 'Low slack', tip: 'Slowest bite. Fish deep holes and channel edges. Live bait on bottom works best.' },
          ].map((t, i) => (
            <View key={i} style={s.tipRow}>
              <View style={s.tipBadge}><Text style={s.tipBadgeTxt}>{t.tide}</Text></View>
              <Text style={s.tipTxt}>{t.tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Calendar modal */}
      {showCalendar && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <TidesCalendar onClose={() => setShowCalendar(false)}/>
        </Modal>
      )}

      {/* Tide station picker */}
      <TideStationPickerModal
        visible={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        onSelect={(id, name) => setTideStation(id, name)}
        currentStationId={tideStation.id}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },

  topbar:       { backgroundColor: Colors.brackishWater, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12 },
  topbarBack:   { padding: 4, marginRight: 4 },
  topbarBackTxt:{ fontSize: 26, color: '#fff', lineHeight: 30 },
  topbarTitle:  { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  topbarRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calBtn:       { padding: 4 },
  calBtnTxt:    { fontSize: 18 },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  heroCard:     { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center' },
  heroLeft:     { flex: 1 },
  heroLabel:    { fontSize: Typography.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  heroVal:      { fontSize: 28, fontWeight: '700', color: Colors.saltWhite, fontFamily: 'Georgia' },
  heroDir:      { fontSize: Typography.sm, color: Colors.brackishWater, marginTop: 2 },
  heroRight:    { gap: 8, alignItems: 'flex-end' },
  heroBox:      { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 68 },
  heroBoxLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2, letterSpacing: 0.3 },
  heroBoxVal:   { fontSize: Typography.base, fontWeight: '700', color: '#fff' },
  heroBoxTime:  { fontSize: Typography.xs, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:  { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:    { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

  hiLoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  hiLoCard:  { flex: 1, minWidth: '45%', borderRadius: Radius.md, padding: 12, alignItems: 'center', gap: 4 },
  hiLoHigh:  { backgroundColor: 'rgba(74,143,168,0.1)', borderWidth: 0.5, borderColor: Colors.brackishWater },
  hiLoLow:   { backgroundColor: 'rgba(196,154,42,0.08)', borderWidth: 0.5, borderColor: Colors.doubloonGold },
  hiLoIcon:  { fontSize: 18 },
  hiLoType:  { fontSize: Typography.xs, color: Colors.textSecondary },
  hiLoVal:   { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
  hiLoTime:  { fontSize: Typography.sm, color: Colors.textSecondary },

  infoRow:   { flexDirection: 'row', gap: 8 },
  infoCard:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  infoIcon:  { fontSize: 18 },
  infoLabel: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  infoVal:   { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },

  tipRow:      { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  tipBadge:    { backgroundColor: 'rgba(74,143,168,0.12)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: Colors.brackishWater, minWidth: 72, alignItems: 'center' },
  tipBadgeTxt: { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '600' },
  tipTxt:      { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
})
