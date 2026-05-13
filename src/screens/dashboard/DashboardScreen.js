import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, PanResponder, Image, Modal, FlatList,
} from 'react-native'
import Svg, { Polyline, Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { getSolunarForDate, buildActivityCurve, scoreColor, scoreLabel } from '../../utils/solunar'
import { fetchTideHourly } from '../../utils/tides'
import { fetchWeatherAndForecast, fetchMarineData, fetchWaterTemp, windDir } from '../../utils/weather'
import JollyRoger from '../../components/JollyRoger'
import HomePortPicker from '../../components/HomePortPicker'
import { useApp } from '../../context/AppContext'
import { useDataLocation } from '../../hooks/useDataLocation'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')

const CHART_W = width - 32
const CHART_H = 220
const PAD_L   = 40
const PAD_R   = 12
const PAD_T   = 16
const PAD_B   = 28
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

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
  const line = smoothBezierPath(pts)
  return `${line} L ${pts[pts.length-1].x.toFixed(1)},${bottomY.toFixed(1)} L ${pts[0].x.toFixed(1)},${bottomY.toFixed(1)} Z`
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniSparkline({ values, color, h = 28, w = 88 }) {
  const filtered = (values || []).filter(v => v != null && !isNaN(v))
  if (filtered.length < 2) return null
  const min   = Math.min(...filtered)
  const max   = Math.max(...filtered)
  const rng   = max - min || 1
  const stepX = w / (filtered.length - 1)
  const pts   = filtered.map((v, i) => {
    const x = i * stepX
    const y = h - ((v - min) / rng) * h * 0.8 - h * 0.1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}

// ── Activity wave ─────────────────────────────────────────────────────────────
function ActivityWave({ sol, scrubIdx, Colors }) {
  const curve = buildActivityCurve(sol)
  const stepX = PLOT_W / (curve.length - 1)
  const toY   = (v) => PAD_T + PLOT_H - (v / 100) * PLOT_H
  const pts   = curve.map((v, i) => ({ x: PAD_L + i * stepX, y: toY(v), v }))
  const nowX  = PAD_L + Math.min(new Date().getHours(), curve.length - 1) * stepX

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)

  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, major: false },
  ]

  const aw = useMemo(() => StyleSheet.create({
    gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: `${Colors.doubloonGold}8C` },
    nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater },
    scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1, backgroundColor: Colors.doubloonGold, opacity: 0.8 },
    xLbl:      { position: 'absolute', fontSize: 10, fontWeight: 'bold', color: `${Colors.doubloonGold}99` },
  }), [Colors])

  return (
    <View style={{ height: CHART_H, width: CHART_W }}>
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.doubloonGold} stopOpacity="0.45"/>
            <Stop offset="1" stopColor={Colors.doubloonGold} stopOpacity="0.02"/>
          </LinearGradient>
        </Defs>
        {windows.map((w, i) => {
          const x1 = PAD_L + (w.startH / 24) * PLOT_W
          const x2 = PAD_L + (Math.min(w.endH, 24) / 24) * PLOT_W
          return (
            <Path key={i}
              d={`M ${x1},${PAD_T} L ${x2},${PAD_T} L ${x2},${CHART_H-PAD_B} L ${x1},${CHART_H-PAD_B} Z`}
              fill={w.major ? 'rgba(196,154,42,0.14)' : 'rgba(196,154,42,0.07)'}
            />
          )
        })}
        <Path d={areaPath} fill="url(#actGrad)"/>
        <Path d={linePath} fill="none" stroke={Colors.doubloonGold} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>

      {[0, 50, 100].map((v, i) => (
        <Text key={i} style={[aw.gridLbl, { top: toY(v) - 6 }]}>{v}</Text>
      ))}
      <View style={[aw.nowLine, { left: nowX }]}/>
      {scrubIdx !== null && (
        <View style={[aw.scrubLine, { left: pts[scrubIdx].x }]}/>
      )}
      {['12a', '6a', '12p', '6p', '12a'].map((l, i) => (
        <Text key={i} style={[aw.xLbl, {
          left: PAD_L + (PLOT_W / 4) * i - 6,
          top:  CHART_H - PAD_B + 4,
        }]}>{l}</Text>
      ))}
    </View>
  )
}

// ── Catch report helpers ──────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  return `${days}d ago`
}

function CatchCard({ report }) {
  const { Colors } = useTheme()
  const cs = useMemo(() => StyleSheet.create({
    card:        { width: '47.5%', backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
    photo:       { width: '100%', height: 80 },
    placeholder: { width: '100%', height: 80, backgroundColor: Colors.screenBg, alignItems: 'center', justifyContent: 'center' },
    info:        { padding: 8, gap: 2 },
    species:     { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
    loc:         { fontSize: 10, color: Colors.textSecondary },
    time:        { fontSize: 9, color: Colors.textMuted },
  }), [Colors])

  const speciesStr = (report.species || []).slice(0, 2).join(', ') || 'Unknown'
  return (
    <View style={cs.card}>
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={cs.photo} resizeMode="cover"/>
      ) : (
        <View style={cs.placeholder}>
          <Text style={{ fontSize: 28 }}>🎣</Text>
        </View>
      )}
      <View style={cs.info}>
        <Text style={cs.species} numberOfLines={1}>{speciesStr}</Text>
        <Text style={cs.loc} numberOfLines={1}>{report.location_name || 'Unknown'}</Text>
        <Text style={cs.time}>{timeAgo(report.created_at)}</Text>
      </View>
    </View>
  )
}

function CatchReportRow({ report }) {
  const { Colors } = useTheme()
  const speciesStr = (report.species || []).slice(0, 2).join(', ') || 'Unknown'
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 0.5, borderColor: Colors.border,
    }}>
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }}
          style={{ width: 52, height: 52, borderRadius: Radius.sm }} resizeMode="cover"/>
      ) : (
        <View style={{
          width: 52, height: 52, borderRadius: Radius.sm,
          backgroundColor: Colors.screenBg, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>🎣</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary }}>{speciesStr}</Text>
        <Text style={{ fontSize: Typography.xs, color: Colors.textSecondary }} numberOfLines={1}>{report.location_name || 'Unknown'}</Text>
        <Text style={{ fontSize: 9, color: Colors.textMuted }}>{report.user_name || 'Anonymous'} · {timeAgo(report.created_at)}</Text>
      </View>
    </View>
  )
}

function CatchReportsModal({ visible, onClose, Colors }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    supabase.from('catch_reports')
      .select('id, user_name, species, count, location_name, photo_url, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setReports(data) })
      .finally(() => setLoading(false))
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.screenBg }}>
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          padding: Spacing.md, borderBottomWidth: 0.5, borderColor: Colors.border,
          backgroundColor: Colors.deepSea,
        }}>
          <Text style={{ fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' }}>
            Recent Catch Reports
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Text style={{ fontSize: Typography.md, color: Colors.doubloonGold, fontWeight: '600' }}>Done</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: Colors.textSecondary }}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={r => r.id}
            renderItem={({ item }) => <CatchReportRow report={item}/>}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 32 }}
            ListEmptyComponent={
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <Text style={{ color: Colors.textSecondary }}>No reports yet</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { Colors }          = useTheme()
  const { homePort, activeStation } = useApp()
  const { buoy }            = useDataLocation()
  const [showPicker,   setShowPicker]   = useState(false)
  const [showAllCatches, setShowAllCatches] = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [scrubIdx,     setScrubIdx]     = useState(null)
  const lastHaptic = useRef(-1)

  const [weather,      setWeather]      = useState(null)
  const [marine,       setMarine]       = useState(null)
  const [waterTemp,    setWaterTemp]    = useState(null)
  const [hourlyTide,   setHourlyTide]   = useState([])
  const [catchReports, setCatchReports] = useState([])

  const sol      = getSolunarForDate(new Date())
  const curve    = buildActivityCurve(sol)
  const stepX    = PLOT_W / (curve.length - 1)
  const actScore = sol.activityScore

  const loadData = useCallback(async () => {
    try {
      const [w, m, wt, tide] = await Promise.all([
        fetchWeatherAndForecast(homePort.lat, homePort.lng),
        fetchMarineData(buoy.lat ?? 29.212, buoy.lng ?? -88.208),
        fetchWaterTemp(),
        fetchTideHourly(new Date(), activeStation.id),
      ])
      setWeather(w)
      setMarine(m)
      setWaterTemp(wt)
      setHourlyTide(tide)
    } catch (e) {
      console.log('Dashboard load error:', e)
    } finally {
      setRefreshing(false)
    }
  }, [homePort.lat, homePort.lng, activeStation.id, buoy.lat, buoy.lng])

  const loadCatches = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('catch_reports')
        .select('id, user_name, species, count, location_name, photo_url, created_at')
        .order('created_at', { ascending: false })
        .limit(4)
      if (data) setCatchReports(data)
    } catch (e) {
      console.log('Catch reports load error:', e)
    }
  }, [])

  useEffect(() => { loadData(); loadCatches() }, [loadData, loadCatches])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
    loadCatches()
  }, [loadData, loadCatches])

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
    onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2000) },
  })

  // ── Derived values ──────────────────────────────────────────────────────────
  const nowHour    = new Date().getHours()
  const curTide    = hourlyTide[nowHour]     ? parseFloat(hourlyTide[nowHour].v)     : null
  const prevTide   = hourlyTide[nowHour - 1] ? parseFloat(hourlyTide[nowHour - 1].v) : null
  const tideRising = curTide !== null && prevTide !== null && curTide > prevTide

  const airTemp    = weather ? Math.round(weather.current.temperature_2m)  : null
  const windSpd    = weather ? Math.round(weather.current.windspeed_10m)   : null
  const windDirStr = weather ? windDir(weather.current.winddirection_10m)  : ''
  const waveHt     = marine?.current?.wave_height != null ? marine.current.wave_height.toFixed(1) : null
  const waveDirStr = marine?.current?.wave_direction != null ? windDir(marine.current.wave_direction) : ''
  const todayLow   = weather?.daily?.temperature_2m_min?.[0]

  const chips = [
    { label: 'Air',   val: airTemp    !== null ? `${airTemp}°F`  : '—', dot: airTemp != null && airTemp > 95 ? Colors.doubloonGold : Colors.marshGreen },
    { label: 'Water', val: waterTemp  !== null ? `${Math.round(waterTemp)}°F` : '—', dot: waterTemp != null && waterTemp >= 68 && waterTemp <= 82 ? Colors.marshGreen : Colors.doubloonGold },
    { label: 'Wind',  val: windSpd    !== null ? `${windDirStr} ${windSpd}` : '—', dot: windSpd != null && windSpd > 20 ? Colors.textSecondary : windSpd > 12 ? Colors.doubloonGold : Colors.marshGreen },
    { label: 'Tide',  val: curTide    !== null ? `${tideRising ? '↑' : '↓'}${curTide.toFixed(1)}` : '—', dot: tideRising ? Colors.marshGreen : Colors.doubloonGold },
  ]

  const tideSpark  = hourlyTide.length > 0 ? hourlyTide.slice(0, 24).map(p => parseFloat(p.v)) : null
  const tempSpark  = weather?.hourlyTemps?.length > 0 ? weather.hourlyTemps : null
  const waveSpark  = marine?.hourlyWaves?.filter(v => v != null).length > 0 ? marine.hourlyWaves : null

  const displayScore = scrubIdx !== null ? curve[scrubIdx] : actScore
  const displayLabel = scrubIdx !== null ? scoreLabel(curve[scrubIdx]) : scoreLabel(actScore)
  const displayName  = homePort.name.length > 28 ? homePort.name.slice(0, 26) + '…' : homePort.name

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    content:   { paddingBottom: 32 },

    // Home port card
    heroCard:       { backgroundColor: Colors.deepSea, margin: 12, borderRadius: Radius.lg, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
    heroRow1:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    heroLeft:       { flex: 1 },
    homePortRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    homePortLabel:  { fontSize: 9, color: Colors.doubloonGold, fontWeight: '700', letterSpacing: 1.4 },
    homePortName:   { fontSize: Typography.base, fontFamily: 'Georgia', fontWeight: '700', color: Colors.saltWhite },
    changeBtn:      { backgroundColor: 'rgba(196,154,42,0.15)', borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.4)' },
    changeBtnTxt:   { fontSize: Typography.xs, color: Colors.doubloonGold, fontWeight: '600' },
    heroRow2:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
    homePortCoords: { fontSize: Typography.xs, color: Colors.textSecondary, letterSpacing: 0.4 },
    heroStatInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroStatVal:    { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: '600' },
    heroStatSep:    { fontSize: Typography.xs, color: Colors.textMuted },

    // Data cards 2×2
    cardGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: Spacing.sm, marginBottom: Spacing.md },
    dataCard:      { width: '47.5%', backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, borderTopWidth: 3, padding: Spacing.md, gap: 1 },
    dataCardTeal:  { borderTopColor: Colors.brackishWater },
    dataCardGold:  { borderTopColor: Colors.doubloonGold },
    dataCardGreen: { borderTopColor: Colors.marshGreen },
    dataCardLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 2 },
    dataCardVal:   { fontSize: Typography.lg, fontWeight: '700', fontFamily: 'Georgia' },
    dataCardSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6 },

    // Condition chips
    chipRow:   { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: Spacing.md },
    condChip:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 10, alignItems: 'center', gap: 3 },
    condDot:   { width: 6, height: 6, borderRadius: 3 },
    condVal:   { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
    condLabel: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.3 },

    // Activity wave chart
    chartCard:  { backgroundColor: Colors.deepSea, marginHorizontal: 12, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
    chartHd:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    chartTitle: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500', letterSpacing: 0.5 },
    chartScore: { fontSize: Typography.sm, fontWeight: '700' },

    // Catch reports
    catchSection: { paddingHorizontal: 12, marginBottom: Spacing.lg },
    catchHd:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    catchTitle:   { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
    seeAllBtn:    { paddingVertical: 2, paddingHorizontal: 8 },
    seeAllTxt:    { fontSize: Typography.xs, color: Colors.doubloonGold, fontWeight: '600' },
    catchGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  }), [Colors])

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.doubloonGold}/>}
    >

      {/* HOME PORT */}
      <View style={s.heroCard}>
        <View style={s.heroRow1}>
          <View style={s.heroLeft}>
            <View style={s.homePortRow}>
              <JollyRoger size={13} flagColor={Colors.doubloonGold} boneColor={Colors.deepSea}/>
              <Text style={s.homePortLabel}>HOME PORT</Text>
            </View>
            <Text style={s.homePortName} numberOfLines={1}>{displayName}</Text>
          </View>
          <TouchableOpacity style={s.changeBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.changeBtnTxt}>Change</Text>
          </TouchableOpacity>
        </View>
        <View style={s.heroRow2}>
          <Text style={s.homePortCoords}>
            {homePort.lat.toFixed(4)}° N · {Math.abs(homePort.lng).toFixed(4)}° W
          </Text>
          <View style={s.heroStatInline}>
            <Text style={[s.heroStatVal, { color: scoreColor(actScore) }]}>{actScore}/100</Text>
            <Text style={s.heroStatSep}>·</Text>
            <Text style={s.heroStatVal}>{sol.moonPhase.emoji}</Text>
            <Text style={s.heroStatSep}>·</Text>
            <Text style={[s.heroStatVal, { opacity: 0.65 }]} numberOfLines={1}>{activeStation.name}</Text>
          </View>
        </View>
      </View>

      {/* DATA CARDS 2×2 */}
      <View style={s.cardGrid}>
        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => navigation.navigate('Tides')} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>TIDES</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>{curTide !== null ? `${curTide.toFixed(2)} ft` : '—'}</Text>
          <Text style={s.dataCardSub}>{curTide !== null ? (tideRising ? 'Incoming ↑' : 'Outgoing ↓') : 'Loading…'}</Text>
          <MiniSparkline values={tideSpark} color={Colors.brackishWater}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardGold]} onPress={() => navigation.navigate('Solunar')} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>SOLUNAR</Text>
          <Text style={[s.dataCardVal, { color: scoreColor(actScore) }]}>{actScore}/100</Text>
          <Text style={[s.dataCardSub, { color: scoreColor(actScore) }]}>{scoreLabel(actScore)}</Text>
          <MiniSparkline values={curve.slice(0, 24)} color={Colors.doubloonGold}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardGreen]} onPress={() => navigation.navigate('Weather')} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WEATHER</Text>
          <Text style={[s.dataCardVal, { color: Colors.marshGreen }]}>{airTemp !== null ? `${airTemp}°F` : '—'}</Text>
          <Text style={s.dataCardSub}>{todayLow != null ? `Low ${Math.round(todayLow)}°` : 'Loading…'}</Text>
          <MiniSparkline values={tempSpark} color={Colors.marshGreen}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => navigation.navigate('Waves')} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WAVES</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>{waveHt !== null ? `${waveHt} ft` : '—'}</Text>
          <Text style={s.dataCardSub}>{waveHt !== null ? `${waveDirStr} swell` : 'Loading…'}</Text>
          <MiniSparkline values={waveSpark} color={Colors.brackishWater}/>
        </TouchableOpacity>
      </View>

      {/* CONDITION STRIP */}
      <View style={s.chipRow}>
        {chips.map((c, i) => (
          <TouchableOpacity key={i} style={s.condChip} activeOpacity={0.75}>
            <View style={[s.condDot, { backgroundColor: c.dot }]}/>
            <Text style={s.condVal}>{c.val}</Text>
            <Text style={s.condLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FISH ACTIVITY WAVE */}
      <View style={s.chartCard}>
        <View style={s.chartHd}>
          <Text style={s.chartTitle}>Fish activity today</Text>
          <Text style={[s.chartScore, { color: scoreColor(displayScore) }]}>
            {displayScore} · {displayLabel}
          </Text>
        </View>
        <View {...pan.panHandlers}>
          <ActivityWave sol={sol} scrubIdx={scrubIdx} Colors={Colors}/>
        </View>
      </View>

      {/* NEARBY CATCH REPORTS */}
      {catchReports.length > 0 && (
        <View style={s.catchSection}>
          <View style={s.catchHd}>
            <Text style={s.catchTitle}>Recent catch reports</Text>
            <TouchableOpacity style={s.seeAllBtn} onPress={() => setShowAllCatches(true)}>
              <Text style={s.seeAllTxt}>See all →</Text>
            </TouchableOpacity>
          </View>
          <View style={s.catchGrid}>
            {catchReports.map(r => <CatchCard key={r.id} report={r}/>)}
          </View>
        </View>
      )}

      <HomePortPicker visible={showPicker} onClose={() => setShowPicker(false)}/>
      <CatchReportsModal
        visible={showAllCatches}
        onClose={() => setShowAllCatches(false)}
        Colors={Colors}
      />
    </ScrollView>
  )
}
