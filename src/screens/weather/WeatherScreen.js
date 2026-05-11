import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { fetchWeatherAndForecast, weatherEmoji, windDir } from '../../utils/weather'
import { useDataLocation } from '../../hooks/useDataLocation'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'

const { width } = Dimensions.get('window')
const CHART_W = width - 32
const CHART_H = 140
const PAD_L   = 36
const PAD_R   = 12
const PAD_T   = 14
const PAD_B   = 24
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

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

// ── Temp chart ────────────────────────────────────────────────────────────────
function TempChart({ temps }) {
  const [scrubIdx, setScrubIdx] = useState(null)
  const lastHaptic = useRef(-1)

  if (!temps || temps.length === 0) {
    return <View style={[ch.wrap, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={Colors.brackishWater}/></View>
  }

  const minVal = Math.min(...temps)
  const maxVal = Math.max(...temps)
  const range  = maxVal - minVal || 1
  const stepX  = PLOT_W / (temps.length - 1)

  const getIdx = (x) => Math.max(0, Math.min(temps.length - 1, Math.round((x - PAD_L) / stepX)))

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

  const pts = temps.map((v, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H,
    v,
  }))

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)
  const nowX     = PAD_L + Math.min(new Date().getHours(), temps.length - 1) * stepX
  const scrub    = scrubIdx !== null ? pts[scrubIdx] : null
  const gridVals = [minVal, minVal + range * 0.5, maxVal]

  return (
    <View style={ch.wrap} {...pan.panHandlers}>
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.marshGreen} stopOpacity="0.4"/>
            <Stop offset="1" stopColor={Colors.marshGreen} stopOpacity="0.03"/>
          </LinearGradient>
        </Defs>
        {gridVals.map((v, i) => {
          const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
          return <Path key={i} d={`M ${PAD_L},${y.toFixed(1)} L ${CHART_W - PAD_R},${y.toFixed(1)}`} stroke="rgba(46,139,90,0.12)" strokeWidth="0.5"/>
        })}
        <Path d={areaPath} fill="url(#tempGrad)"/>
        <Path d={linePath} fill="none" stroke={Colors.marshGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>

      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return <Text key={i} style={[ch.gridLbl, { top: y - 6 }]}>{Math.round(v)}°</Text>
      })}

      <View style={[ch.nowLine, { left: nowX }]}>
        <Text style={ch.nowLbl}>NOW</Text>
      </View>

      {scrub && (
        <>
          <View style={[ch.scrubLine, { left: scrub.x }]}/>
          <View style={[ch.bubble, {
            left: Math.min(Math.max(scrub.x - 30, PAD_L), CHART_W - PAD_R - 70),
            top: scrub.y - 38,
          }]}>
            <Text style={ch.bubbleVal}>{Math.round(scrub.v)}°F</Text>
          </View>
        </>
      )}

      {HOURS.map((l, i) => (
        <Text key={i} style={[ch.xLbl, {
          left: PAD_L + (PLOT_W / (HOURS.length - 1)) * i - 8,
          top:  CHART_H - PAD_B + 4,
        }]}>{l}</Text>
      ))}

      {scrubIdx === null && <Text style={ch.hint}>← slide to explore →</Text>}
    </View>
  )
}

const ch = StyleSheet.create({
  wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 9, color: Colors.textMuted },
  nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
  nowLbl:    { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.doubloonGold, fontWeight: '700' },
  scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.marshGreen, opacity: 0.8 },
  bubble:    { position: 'absolute', backgroundColor: Colors.marshGreen, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 52, alignItems: 'center' },
  bubbleVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  xLbl:      { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:      { position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

// ── Day forecast item ─────────────────────────────────────────────────────────
function DayRow({ time, code, high, low, wind }) {
  const date    = new Date(time + 'T12:00:00')
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
  const isToday = new Date().toDateString() === date.toDateString()
  return (
    <View style={dr.row}>
      <Text style={[dr.day, isToday && dr.dayToday]}>{isToday ? 'Today' : dayName}</Text>
      <Text style={dr.icon}>{weatherEmoji(code)}</Text>
      <View style={dr.temps}>
        <Text style={dr.high}>{Math.round(high)}°</Text>
        <Text style={dr.low}>{Math.round(low)}°</Text>
      </View>
      <Text style={dr.wind}>💨 {Math.round(wind)} mph</Text>
    </View>
  )
}

const dr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  day:     { width: 48, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  dayToday:{ color: Colors.brackishWater, fontWeight: '700' },
  icon:    { fontSize: 20, width: 32 },
  temps:   { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
  high:    { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, minWidth: 36 },
  low:     { fontSize: Typography.base, color: Colors.textMuted, minWidth: 36 },
  wind:    { fontSize: Typography.xs, color: Colors.textSecondary },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WeatherScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { weatherLocation, setWeatherLocation } = useDataLocation()
  const [weather,     setWeather]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [showPicker,  setShowPicker]  = useState(false)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchWeatherAndForecast(weatherLocation.lat, weatherLocation.lng)
      setWeather(data)
    } catch (e) {
      console.log('Weather fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [weatherLocation.lat, weatherLocation.lng])

  useEffect(() => {
    setLoading(true)
    loadData()
  }, [loadData])

  const onRefresh = () => { setRefreshing(true); loadData() }

  const cur     = weather?.current
  const daily   = weather?.daily
  const hourly  = weather?.hourlyTemps || []
  const dayCount = daily?.time?.length || 0

  return (
    <View style={s.container}>

      {/* ── CUSTOM TOPBAR ───────────────────────────── */}
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation?.navigate('Dashboard')} style={s.topbarBack}>
          <Text style={s.topbarBackTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Weather</Text>
        <LocationChip
          label={weatherLocation.name}
          onPress={() => setShowPicker(true)}
          color="#fff"
          boneColor={Colors.marshGreen}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.marshGreen}/>}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={Colors.marshGreen}/>
            <Text style={s.loadingTxt}>Fetching weather…</Text>
          </View>
        ) : (
          <>
            {/* Hero */}
            <View style={s.heroCard}>
              <View style={s.heroLeft}>
                <Text style={s.heroLabel}>Current conditions</Text>
                <Text style={s.heroTemp}>{cur ? `${Math.round(cur.temperature_2m)}°` : '—'}</Text>
                <Text style={s.heroLoc} numberOfLines={1}>{weatherLocation.name}</Text>
              </View>
              <View style={s.heroRight}>
                <Text style={s.heroEmoji}>{cur ? weatherEmoji(cur.weathercode) : '🌤️'}</Text>
                <View style={s.heroChips}>
                  {cur && <>
                    <View style={s.heroChip}>
                      <Text style={s.heroChipLbl}>Wind</Text>
                      <Text style={s.heroChipVal}>{Math.round(cur.windspeed_10m)} mph {windDir(cur.winddirection_10m)}</Text>
                    </View>
                  </>}
                  {daily && (
                    <View style={s.heroChip}>
                      <Text style={s.heroChipLbl}>Today</Text>
                      <Text style={s.heroChipVal}>{Math.round(daily.temperature_2m_max[0])}° / {Math.round(daily.temperature_2m_min[0])}°</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Hourly temp chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>24-hour temperature</Text>
              <Text style={s.cardSub}>Today's hourly forecast · °F</Text>
              <TempChart temps={hourly}/>
            </View>

            {/* 7-day forecast */}
            <View style={s.card}>
              <Text style={s.cardTitle}>7-day forecast</Text>
              {daily && Array.from({ length: dayCount }).map((_, i) => (
                <DayRow
                  key={i}
                  time={daily.time[i]}
                  code={daily.weathercode[i]}
                  high={daily.temperature_2m_max[i]}
                  low={daily.temperature_2m_min[i]}
                  wind={daily.windspeed_10m_max[i]}
                />
              ))}
            </View>

            {/* Wind & details */}
            {cur && (
              <View style={s.detailRow}>
                {[
                  { icon: '💨', label: 'Wind', val: `${Math.round(cur.windspeed_10m)} mph` },
                  { icon: '🧭', label: 'Direction', val: windDir(cur.winddirection_10m) },
                  { icon: '📍', label: 'Location', val: `${weatherLocation.lat.toFixed(2)}°N` },
                ].map((c, i) => (
                  <View key={i} style={s.detailCard}>
                    <Text style={s.detailIcon}>{c.icon}</Text>
                    <Text style={s.detailLabel}>{c.label}</Text>
                    <Text style={s.detailVal}>{c.val}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Fishing weather tips */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Weather fishing tips</Text>
              {[
                { cond: 'Clear sky', tip: 'High pressure = active fish. Morning bite before midday heat.' },
                { cond: 'Overcast', tip: 'Clouds keep fish feeding longer. All-day bite possible.' },
                { cond: 'Light rain', tip: 'Pre-frontal activity is peak bite time. Fish shallow flats.' },
                { cond: 'Post-front', tip: 'Cold front slows bite. Go deep with slow presentations.' },
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

      <LocationPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(lat, lng, name) => setWeatherLocation(lat, lng, name)}
        title="Set Weather Location"
        initialLat={weatherLocation.lat}
        initialLng={weatherLocation.lng}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },

  topbar:       { backgroundColor: Colors.marshGreen, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 8 },
  topbarBack:   { padding: 4 },
  topbarBackTxt:{ fontSize: 26, color: '#fff', lineHeight: 30 },
  topbarTitle:  { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

  loadingBox: { alignItems: 'center', paddingTop: 80, gap: 16 },
  loadingTxt: { fontSize: Typography.base, color: Colors.textMuted },

  heroCard:     { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center' },
  heroLeft:     { flex: 1 },
  heroLabel:    { fontSize: Typography.xs, color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  heroTemp:     { fontSize: 40, fontWeight: '700', color: '#fff', fontFamily: 'Georgia', lineHeight: 44 },
  heroLoc:      { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  heroRight:    { alignItems: 'center', gap: 10, marginLeft: 12 },
  heroEmoji:    { fontSize: 44, lineHeight: 50 },
  heroChips:    { gap: 6, alignItems: 'center' },
  heroChip:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  heroChipLbl:  { fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 },
  heroChipVal:  { fontSize: Typography.sm, fontWeight: '600', color: '#fff', marginTop: 1 },

  card:     { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:{ fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  cardSub:  { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

  detailRow:  { flexDirection: 'row', gap: 8 },
  detailCard: { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  detailIcon: { fontSize: 20 },
  detailLabel:{ fontSize: Typography.xs, color: Colors.textSecondary },
  detailVal:  { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },

  tipRow:      { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  tipBadge:    { backgroundColor: 'rgba(46,139,90,0.1)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: Colors.marshGreen, minWidth: 72, alignItems: 'center' },
  tipBadgeTxt: { fontSize: Typography.xs, color: Colors.marshGreen, fontWeight: '600' },
  tipTxt:      { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
})
