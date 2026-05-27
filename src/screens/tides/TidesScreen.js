import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchTideHourly, fetchTideHiLo } from '../../utils/tides'
import { getSolunarForDate, scoreColor } from '../../utils/solunar'
import { useDataLocation } from '../../hooks/useDataLocation'
import { smoothBezierPath, smoothAreaPath } from '../../utils/chart'
import LocationChip from '../../components/LocationChip'
import TideStationPickerModal from '../../components/TideStationPickerModal'

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

// ── Tide chart ────────────────────────────────────────────────────────────────
function TideChart({ hourlyData }) {
  const { Colors }  = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic = useRef(-1)
  const panRef     = useRef(null)
  const getIdxFn   = useRef(null)
  const valuesRef  = useRef([])
  const stepXRef   = useRef(1)

  const tc = useMemo(() => StyleSheet.create({
    wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4, overflow: 'hidden' },
    gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
    scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater, opacity: 0.8 },
    bubble:    { position: 'absolute', backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 100, alignItems: 'center' },
    bubbleVal: { fontSize: 16, fontWeight: '700', color: '#fff' },
    bubbleTime:{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
    xLbl:      { position: 'absolute', fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary },
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

  valuesRef.current = values
  stepXRef.current  = stepX
  getIdxFn.current  = (x) =>
    Math.max(0, Math.min(valuesRef.current.length - 1, Math.round((x - PAD_L) / stepXRef.current)))

  const pan = panRef.current

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
    <View
      style={tc.wrap}
      onTouchStart={(e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      }}
      {...pan.panHandlers}
    >
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
        {scrub && (
          <>
            <Path
              d={`M ${PAD_L},${scrub.y.toFixed(1)} L ${scrub.x.toFixed(1)},${scrub.y.toFixed(1)}`}
              stroke={Colors.brackishWater} strokeWidth="1" strokeDasharray="4,3" opacity="0.65"
            />
            <Circle cx={scrub.x.toFixed(1)} cy={scrub.y.toFixed(1)} r="4.5"
              fill={Colors.brackishWater} stroke="#fff" strokeWidth="1.5"/>
          </>
        )}
      </Svg>

      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return <Text key={i} style={[tc.gridLbl, { top: y - 6 }]}>{v.toFixed(1)}</Text>
      })}

      <View style={[tc.nowLine, { left: nowX }]}/>

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
    pill:         { width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 2 },
    pillSelected: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: '#fff' },
    pillToday:    { borderColor: Colors.doubloonGold },
    dayName:      { fontSize: 9, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.3 },
    dayNum:       { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
    moon:         { fontSize: 12 },
    tideVal:      { fontSize: 9, color: 'rgba(255,255,255,0.7)' },
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
        const day = item.date
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
            <Text style={[ds.tideVal, selected && ds.textSel]}>—</Text>
            <View style={[ds.dot, { backgroundColor: scoreColor(sol.activityScore) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TidesScreen() {
  const { Colors }  = useTheme()
  const { tideStation, setTideStation } = useDataLocation()
  const [selectedDate,      setSelectedDate]      = useState(new Date())
  const [hourly,            setHourly]            = useState([])
  const [hiLo,              setHiLo]              = useState([])
  const [loading,           setLoading]           = useState(true)
  const [refreshing,        setRefreshing]        = useState(false)
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

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },

    topbar:        { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12 },
    topbarBack:    { padding: 4, marginRight: 4 },
    topbarBackTxt: { fontSize: 26, color: '#fff', lineHeight: 30 },
    topbarTitle:   { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },

    heroCard:     { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center' },
    heroLeft:     { flex: 1 },
    heroLabel:    { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
    heroVal:      { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    heroDir:      { fontSize: Typography.sm, color: Colors.brackishWater, marginTop: 2 },
    heroRight:    { gap: 8, alignItems: 'flex-end' },
    heroBox:      { backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 68 },
    heroBoxLabel: { fontSize: 9, color: Colors.textSecondary, marginBottom: 2, letterSpacing: 0.3 },
    heroBoxVal:   { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
    heroBoxTime:  { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },

    card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle:  { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    cardSub:    { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

    hiLoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
    hiLoCard:  { flex: 1, minWidth: '45%', borderRadius: Radius.md, padding: 12, alignItems: 'center', gap: 4 },
    hiLoHigh:  { backgroundColor: `${Colors.brackishWater}1A`, borderWidth: 0.5, borderColor: Colors.brackishWater },
    hiLoLow:   { backgroundColor: `${Colors.doubloonGold}14`, borderWidth: 0.5, borderColor: Colors.doubloonGold },
    hiLoIcon:  { fontSize: 18 },
    hiLoType:  { fontSize: Typography.xs, color: Colors.textSecondary },
    hiLoVal:   { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
    hiLoTime:  { fontSize: Typography.sm, color: Colors.textSecondary },

    infoRow:   { flexDirection: 'row', gap: 12, justifyContent: 'center' },
    infoCard:  { width: '45%', backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
    infoIcon:  { fontSize: 18 },
    infoLabel: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
    infoVal:   { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },

    tipRow:      { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
    tipBadge:    { backgroundColor: `${Colors.brackishWater}1F`, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: Colors.brackishWater, minWidth: 72, alignItems: 'center' },
    tipBadgeTxt: { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '600' },
    tipTxt:      { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  }), [Colors])

  return (
    <View style={s.container}>

      {/* TOPBAR */}
      <View style={[s.topbar, { paddingTop: 10 }]}>
        <Text style={s.topbarTitle}>Tides</Text>
        <LocationChip
          label={tideStation.name}
          onPress={() => setShowStationPicker(true)}
          color="#fff"
          boneColor={Colors.topbarBg}
        />
      </View>

      {/* DAY STRIP */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate}/>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>}
      >
        {/* Hero */}
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
        <View style={[s.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
          <Text style={[s.cardTitle, { paddingHorizontal: Spacing.lg }]}>Today's tide chart</Text>
          <Text style={[s.cardSub, { paddingHorizontal: Spacing.lg }]}>24-hour tide chart · {tideStation.name}</Text>
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

      <TideStationPickerModal
        visible={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        onSelect={(id, name) => setTideStation(id, name)}
        currentStationId={tideStation.id}
      />

    </View>
  )
}
