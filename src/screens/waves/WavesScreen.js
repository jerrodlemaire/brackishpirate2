import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { fetchMarineData } from '../../utils/weather'
import { fetchNdbcObservations } from '../../utils/ndbc'
import { useDataLocation } from '../../hooks/useDataLocation'
import LocationChip from '../../components/LocationChip'
import BuoyPickerModal from '../../components/BuoyPickerModal'

const { width } = Dimensions.get('window')
const CHART_W = width - 32
const CHART_H = 140
const PAD_L   = 36
const PAD_R   = 12
const PAD_T   = 14
const PAD_B   = 24
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
function waveDir(deg) {
  if (deg == null) return '—'
  return COMPASS[Math.round(deg / 22.5) % 16]
}

const HOURS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

function smoothBezierPath(pts) {
  if (pts.length < 2) return ''
  const t = 0.35
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i]
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const cp1x = p1.x + (p2.x - p0.x) * t, cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t, cp2y = p2.y - (p3.y - p1.y) * t
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

function smoothAreaPath(pts, bottomY) {
  if (!pts.length) return ''
  const line = smoothBezierPath(pts)
  const last = pts[pts.length - 1], first = pts[0]
  return `${line} L ${last.x.toFixed(1)},${bottomY.toFixed(1)} L ${first.x.toFixed(1)},${bottomY.toFixed(1)} Z`
}

// ── Wave chart ────────────────────────────────────────────────────────────────
function WaveChart({ waves }) {
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic = useRef(-1)

  if (!waves || waves.length === 0) {
    return <View style={[wc.wrap, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={Colors.brackishWater}/></View>
  }

  const minVal = Math.min(...waves)
  const maxVal = Math.max(...waves)
  const range  = maxVal - minVal || 0.5
  const stepX  = PLOT_W / (waves.length - 1)

  const getIdx = (x) => Math.max(0, Math.min(waves.length - 1, Math.round((x - PAD_L) / stepX)))

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      const i = getIdx(e.nativeEvent.locationX); setScrubIdx(i)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i
    },
    onPanResponderMove: (e) => {
      const i = getIdx(e.nativeEvent.locationX); setScrubIdx(i)
      if (i !== lastHaptic.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i }
    },
    onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
  })

  const pts = waves.map((v, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H,
    v,
  }))

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)
  const nowX     = PAD_L + Math.min(new Date().getHours(), waves.length - 1) * stepX
  const scrub    = scrubIdx !== null ? pts[scrubIdx] : null
  const gridVals = [minVal, minVal + range * 0.5, maxVal]

  return (
    <View style={wc.wrap} {...pan.panHandlers}>
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.brackishWater} stopOpacity="0.4"/>
            <Stop offset="1" stopColor={Colors.brackishWater} stopOpacity="0.02"/>
          </LinearGradient>
        </Defs>
        {gridVals.map((v, i) => {
          const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
          return <Path key={i} d={`M ${PAD_L},${y.toFixed(1)} L ${CHART_W - PAD_R},${y.toFixed(1)}`} stroke="rgba(74,143,168,0.12)" strokeWidth="0.5"/>
        })}
        <Path d={areaPath} fill="url(#waveGrad)"/>
        <Path d={linePath} fill="none" stroke={Colors.brackishWater} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>

      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return <Text key={i} style={[wc.gridLbl, { top: y - 6 }]}>{v.toFixed(1)}</Text>
      })}

      <View style={[wc.nowLine, { left: nowX }]}>
        <Text style={wc.nowLbl}>NOW</Text>
      </View>

      {scrub && (
        <>
          <View style={[wc.scrubLine, { left: scrub.x }]}/>
          <View style={[wc.bubble, {
            left: Math.min(Math.max(scrub.x - 30, PAD_L), CHART_W - PAD_R - 70),
            top: scrub.y - 38,
          }]}>
            <Text style={wc.bubbleVal}>{scrub.v.toFixed(1)} ft</Text>
          </View>
        </>
      )}

      {HOURS.map((l, i) => (
        <Text key={i} style={[wc.xLbl, {
          left: PAD_L + (PLOT_W / (HOURS.length - 1)) * i - 8,
          top:  CHART_H - PAD_B + 4,
        }]}>{l}</Text>
      ))}

      {scrubIdx === null && <Text style={wc.hint}>← slide to explore →</Text>}
    </View>
  )
}

const wc = StyleSheet.create({
  wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 9, color: Colors.textMuted },
  nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
  nowLbl:    { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.doubloonGold, fontWeight: '700' },
  scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater, opacity: 0.8 },
  bubble:    { position: 'absolute', backgroundColor: Colors.brackishWater, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 56, alignItems: 'center' },
  bubbleVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  xLbl:      { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:      { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WavesScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { buoy, setBuoy } = useDataLocation()
  const [marine,     setMarine]     = useState(null)
  const [ndbcObs,    setNdbcObs]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const lat = buoy.lat ?? 29.212
      const lng = buoy.lng ?? -88.208
      const [marineData, obs] = await Promise.all([
        fetchMarineData(lat, lng),
        fetchNdbcObservations(buoy.id),
      ])
      setMarine(marineData)
      setNdbcObs(obs)
    } catch (e) {
      console.log('Waves fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [buoy.id, buoy.lat, buoy.lng])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  const onRefresh = () => { setRefreshing(true); loadData() }

  const hourlyWaves  = marine?.hourlyWaves  || []
  const dailyMax     = marine?.dailyMaxWaves || []
  const currentWave  = marine?.current

  return (
    <View style={s.container}>

      {/* ── CUSTOM TOPBAR ───────────────────────────── */}
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation?.navigate('Dashboard')} style={s.topbarBack}>
          <Text style={s.topbarBackTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Waves</Text>
        <LocationChip
          label={buoy.name}
          onPress={() => setShowPicker(true)}
          color={Colors.doubloonGold}
          boneColor={Colors.deepSea}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={Colors.brackishWater}/>
            <Text style={s.loadingTxt}>Fetching wave data…</Text>
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={s.heroCard}>
              <View style={s.heroLeft}>
                <Text style={s.heroLabel}>Current waves</Text>
                <Text style={s.heroWave}>
                  {ndbcObs?.waveHeight != null
                    ? `${ndbcObs.waveHeight} ft`
                    : currentWave?.wave_height != null
                    ? `${currentWave.wave_height.toFixed(1)} ft`
                    : '—'}
                </Text>
                <Text style={s.heroSub}>
                  {ndbcObs?.period != null ? `${ndbcObs.period}s period · ` : ''}
                  {ndbcObs?.waveDir != null ? waveDir(ndbcObs.waveDir) : currentWave?.wave_direction != null ? waveDir(currentWave.wave_direction) : ''}
                </Text>
              </View>
              <View style={s.heroRight}>
                <View style={s.heroBox}>
                  <Text style={s.heroBoxLabel}>Wind</Text>
                  <Text style={s.heroBoxVal}>{ndbcObs?.windSpeed != null ? `${ndbcObs.windSpeed} kt` : '—'}</Text>
                  <Text style={s.heroBoxSub}>{ndbcObs?.windDir != null ? waveDir(ndbcObs.windDir) : ''}</Text>
                </View>
                <View style={s.heroBox}>
                  <Text style={s.heroBoxLabel}>Water °F</Text>
                  <Text style={s.heroBoxVal}>{ndbcObs?.waterTemp != null ? `${ndbcObs.waterTemp}°` : '—'}</Text>
                  <Text style={s.heroBoxSub}>NDBC obs</Text>
                </View>
              </View>
            </View>

            {/* Wave height chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>24-hour wave height</Text>
              <Text style={s.cardSub}>Open-Meteo marine forecast · feet · {buoy.name}</Text>
              <WaveChart waves={hourlyWaves}/>
            </View>

            {/* 7-day max waves */}
            {dailyMax.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>7-day wave forecast</Text>
                <View style={s.dailyGrid}>
                  {dailyMax.map((h, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() + i)
                    const day = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
                    const barH = Math.max(6, (h / Math.max(...dailyMax)) * 60)
                    return (
                      <View key={i} style={s.dayCol}>
                        <Text style={s.dayWave}>{h != null ? h.toFixed(1) : '—'}</Text>
                        <Text style={s.dayWaveUnit}>ft</Text>
                        <View style={[s.dayBar, { height: barH, backgroundColor: Colors.brackishWater }]}/>
                        <Text style={[s.dayName, i === 0 && s.dayToday]}>{day}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {/* NDBC buoy observations */}
            {ndbcObs && (
              <View style={s.card}>
                <Text style={s.cardTitle}>NDBC buoy {buoy.id}</Text>
                <Text style={s.cardSub}>Latest observed conditions</Text>
                <View style={s.obsGrid}>
                  {[
                    { label: 'Wave height', val: ndbcObs.waveHeight != null ? `${ndbcObs.waveHeight} ft` : '—', icon: '🌊' },
                    { label: 'Dom. period',  val: ndbcObs.period     != null ? `${ndbcObs.period} sec`   : '—', icon: '⏱' },
                    { label: 'Wave dir',     val: ndbcObs.waveDir    != null ? waveDir(ndbcObs.waveDir)  : '—', icon: '🧭' },
                    { label: 'Wind speed',   val: ndbcObs.windSpeed  != null ? `${ndbcObs.windSpeed} kt` : '—', icon: '💨' },
                    { label: 'Air temp',     val: ndbcObs.airTemp    != null ? `${ndbcObs.airTemp}°F`    : '—', icon: '🌡' },
                    { label: 'Water temp',   val: ndbcObs.waterTemp  != null ? `${ndbcObs.waterTemp}°F`  : '—', icon: '🌊' },
                  ].map((c, i) => (
                    <View key={i} style={s.obsCard}>
                      <Text style={s.obsIcon}>{c.icon}</Text>
                      <Text style={s.obsLabel}>{c.label}</Text>
                      <Text style={s.obsVal}>{c.val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Fishing tips */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Wave fishing tips</Text>
              {[
                { cond: '0–1 ft',  tip: 'Calm conditions. Perfect for sight fishing flats and shallow reefs.' },
                { cond: '1–2 ft',  tip: 'Mild chop. Excellent offshore and nearshore boat fishing.' },
                { cond: '2–4 ft',  tip: 'Moderate seas. Stick to protected bays or well-powered vessels.' },
                { cond: '4+ ft',   tip: 'Rough water. Inshore and protected areas only. Safety first.' },
              ].map((t, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={s.tipBadge}><Text style={s.tipBadgeTxt}>{t.cond}</Text></View>
                  <Text style={s.tipTxt}>{t.tip}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <BuoyPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(id, name, lat, lng) => setBuoy(id, name, lat, lng)}
        currentBuoyId={buoy.id}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },

  topbar:       { backgroundColor: Colors.deepSea, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 8 },
  topbarBack:   { padding: 4 },
  topbarBackTxt:{ fontSize: 26, color: '#fff', lineHeight: 30 },
  topbarTitle:  { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  loadingBox: { alignItems: 'center', paddingTop: 80, gap: 16 },
  loadingTxt: { fontSize: Typography.base, color: Colors.textMuted },

  heroCard:    { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center' },
  heroLeft:    { flex: 1 },
  heroLabel:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  heroWave:    { fontSize: 38, fontWeight: '700', color: Colors.brackishWater, fontFamily: 'Georgia', lineHeight: 42 },
  heroSub:     { fontSize: Typography.sm, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  heroRight:   { gap: 8, alignItems: 'flex-end', marginLeft: 12 },
  heroBox:     { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center', minWidth: 72 },
  heroBoxLabel:{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2, letterSpacing: 0.3 },
  heroBoxVal:  { fontSize: Typography.base, fontWeight: '700', color: '#fff' },
  heroBoxSub:  { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  card:     { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:{ fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:  { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

  dailyGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: Spacing.md, height: 110 },
  dayCol:    { alignItems: 'center', gap: 3, justifyContent: 'flex-end', flex: 1 },
  dayWave:   { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  dayWaveUnit:{ fontSize: 8, color: Colors.textMuted },
  dayBar:    { width: 18, borderRadius: 4, opacity: 0.8 },
  dayName:   { fontSize: 9, color: Colors.textSecondary },
  dayToday:  { color: Colors.brackishWater, fontWeight: '700' },

  obsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  obsCard: { width: '30%', flexGrow: 1, backgroundColor: Colors.saltWhite, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 10, alignItems: 'center', gap: 3 },
  obsIcon: { fontSize: 18 },
  obsLabel:{ fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  obsVal:  { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },

  tipRow:      { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  tipBadge:    { backgroundColor: 'rgba(74,143,168,0.1)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: Colors.brackishWater, minWidth: 56, alignItems: 'center' },
  tipBadgeTxt: { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '600' },
  tipTxt:      { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
})
