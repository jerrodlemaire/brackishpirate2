import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { getSolunarForDate, buildActivityCurve, scoreColor, scoreLabel } from '../../utils/solunar'
import { fetchTideHourly } from '../../utils/tides'
import { fetchWeatherAndForecast, fetchMarineData, fetchWaterTemp, weatherEmoji, windDir } from '../../utils/weather'
import JollyRoger from '../../components/JollyRoger'

const { width } = Dimensions.get('window')

const CHART_W = width - 32
const CHART_H = 110
const PAD_L   = 8
const PAD_R   = 8
const PAD_T   = 10
const PAD_B   = 22
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniSparkline({ values, color, h = 28, w = 88 }) {
  if (!values || values.length < 2) return null
  const filtered = values.filter(v => v != null && !isNaN(v))
  if (filtered.length < 2) return null
  const min  = Math.min(...filtered)
  const max  = Math.max(...filtered)
  const rng  = max - min || 1
  const stepX = w / (filtered.length - 1)
  const pts  = filtered.map((v, i) => {
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

// ── Activity wave chart ───────────────────────────────────────────────────────
function ActivityWave({ sol, scrubIdx }) {
  const curve  = buildActivityCurve(sol)
  const stepX  = PLOT_W / (curve.length - 1)
  const toY    = (v) => PAD_T + PLOT_H - (v / 100) * PLOT_H
  const pts    = curve.map((v, i) => ({ x: PAD_L + i * stepX, y: toY(v), v }))
  const nowX   = PAD_L + Math.min(new Date().getHours(), curve.length - 1) * stepX

  const windows = [
    { startH: sol.major1.startH, endH: sol.major1.endH, major: true },
    { startH: sol.major2.startH, endH: sol.major2.endH, major: true },
    { startH: sol.minor1.startH, endH: sol.minor1.endH, major: false },
    { startH: sol.minor2.startH, endH: sol.minor2.endH, major: false },
  ]

  return (
    <View style={{ height: CHART_H, width: CHART_W }}>
      {windows.map((w, i) => {
        const x1 = PAD_L + (w.startH / 24) * PLOT_W
        const x2 = PAD_L + (Math.min(w.endH, 24) / 24) * PLOT_W
        return (
          <View key={i} style={{
            position: 'absolute', left: x1, top: PAD_T,
            width: Math.max(0, x2 - x1), height: PLOT_H,
            backgroundColor: w.major ? 'rgba(196,154,42,0.18)' : 'rgba(196,154,42,0.08)',
          }}/>
        )
      })}

      {pts.map((pt, i) => {
        if (i === pts.length - 1) return null
        const next = pts[i + 1]
        const avgY = (pt.y + next.y) / 2
        return (
          <View key={i} style={{
            position: 'absolute', left: pt.x, top: avgY,
            width: stepX + 0.5,
            height: Math.max(0, CHART_H - PAD_B - avgY),
            backgroundColor: scrubIdx === i ? 'rgba(196,154,42,0.55)' : 'rgba(196,154,42,0.28)',
          }}/>
        )
      })}

      {pts.map((pt, i) => (
        <View key={i} style={[
          aw.dot,
          { left: pt.x - 2, top: pt.y - 2 },
          scrubIdx === i && aw.dotActive,
        ]}/>
      ))}

      <View style={[aw.nowLine, { left: nowX }]}>
        <Text style={aw.nowLbl}>NOW</Text>
      </View>

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

const aw = StyleSheet.create({
  dot:      { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.doubloonGold },
  dotActive:{ width: 8, height: 8, borderRadius: 4, marginLeft: -2, marginTop: -2, borderWidth: 1.5, borderColor: '#fff' },
  nowLine:  { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater },
  nowLbl:   { position: 'absolute', top: -13, left: -10, fontSize: 8, color: Colors.brackishWater, fontWeight: '700' },
  scrubLine:{ position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1, backgroundColor: Colors.doubloonGold, opacity: 0.7 },
  xLbl:     { position: 'absolute', fontSize: 8, color: 'rgba(196,154,42,0.5)' },
})

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false)
  const [scrubIdx,   setScrubIdx]   = useState(null)
  const lastHaptic                  = useRef(-1)

  const [weather,    setWeather]    = useState(null)
  const [marine,     setMarine]     = useState(null)
  const [waterTemp,  setWaterTemp]  = useState(null)
  const [hourlyTide, setHourlyTide] = useState([])

  const sol      = getSolunarForDate(new Date())
  const curve    = buildActivityCurve(sol)
  const stepX    = PLOT_W / (curve.length - 1)
  const actScore = sol.activityScore

  const loadData = useCallback(async () => {
    try {
      const [w, m, wt, tide] = await Promise.all([
        fetchWeatherAndForecast(),
        fetchMarineData(),
        fetchWaterTemp(),
        fetchTideHourly(new Date()),
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
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

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

  // ── Derived display values ─────────────────────────────────────────────────

  const nowHour      = new Date().getHours()
  const curTide      = hourlyTide[nowHour]      ? parseFloat(hourlyTide[nowHour].v)      : null
  const prevTide     = hourlyTide[nowHour - 1]  ? parseFloat(hourlyTide[nowHour - 1].v)  : null
  const tideRising   = curTide !== null && prevTide !== null && curTide > prevTide

  const airTemp      = weather ? Math.round(weather.current.temperature_2m)  : null
  const windSpd      = weather ? Math.round(weather.current.windspeed_10m)   : null
  const windDirStr   = weather ? windDir(weather.current.winddirection_10m)  : ''
  const waveHt       = marine?.current?.wave_height != null
    ? marine.current.wave_height.toFixed(1) : null
  const waveDirStr   = marine?.current?.wave_direction != null
    ? windDir(marine.current.wave_direction) : ''

  const todayLow     = weather?.daily?.temperature_2m_min?.[0]

  const chips = [
    {
      label: 'Air',
      val:   airTemp !== null ? `${airTemp}°F` : '—',
      dot:   airTemp != null && airTemp > 95 ? Colors.doubloonGold : Colors.marshGreen,
    },
    {
      label: 'Water',
      val:   waterTemp !== null ? `${Math.round(waterTemp)}°F` : '—',
      dot:   waterTemp != null && waterTemp >= 68 && waterTemp <= 82 ? Colors.marshGreen : Colors.doubloonGold,
    },
    {
      label: 'Wind',
      val:   windSpd !== null ? `${windDirStr} ${windSpd}` : '—',
      dot:   windSpd != null && windSpd > 20 ? Colors.textSecondary : windSpd > 12 ? Colors.doubloonGold : Colors.marshGreen,
    },
    {
      label: 'Tide',
      val:   curTide !== null ? `${tideRising ? '↑' : '↓'}${curTide.toFixed(1)}` : '—',
      dot:   tideRising ? Colors.marshGreen : Colors.doubloonGold,
    },
  ]

  const tideSpark    = hourlyTide.length > 0
    ? hourlyTide.slice(0, 24).map(p => parseFloat(p.v))
    : [0.9, 1.2, 1.5, 1.8, 1.9, 1.8, 1.5, 1.1, 0.8, 0.6, 0.5, 0.6]
  const solMini      = curve.slice(0, 24)
  const tempSpark    = weather?.hourlyTemps?.length > 0
    ? weather.hourlyTemps : [74, 76, 79, 81, 82, 83, 84, 84, 83, 81, 79, 77]
  const waveSpark    = marine?.hourlyWaves?.filter(v => v != null).length > 0
    ? marine.hourlyWaves : [1.4, 1.5, 1.6, 1.8, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3]

  const forecast = weather?.daily
    ? weather.daily.time.slice(0, 7).map((date, i) => ({
        day:   i === 0 ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
        ico:   weatherEmoji(weather.daily.weathercode[i]),
        high:  `${Math.round(weather.daily.temperature_2m_max[i])}°`,
        low:   `${Math.round(weather.daily.temperature_2m_min[i])}°`,
        wind:  `${Math.round(weather.daily.windspeed_10m_max[i])} mph`,
        today: i === 0,
      }))
    : [
        { day: 'Today', ico: '⛅', high: '—', low: '—', wind: '—', today: true },
        ...Array.from({ length: 6 }, (_, i) => ({
          day:  ['Mon','Tue','Wed','Thu','Fri','Sat'][i],
          ico:  '⛅', high: '—', low: '—', wind: '—', today: false,
        })),
      ]

  const displayScore = scrubIdx !== null ? curve[scrubIdx] : actScore
  const displayLabel = scrubIdx !== null ? scoreLabel(curve[scrubIdx]) : scoreLabel(actScore)

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.doubloonGold}
        />
      }
    >

      {/* ── HOME PORT HERO ─────────────────────────────────── */}
      <View style={s.heroCard}>
        <View style={s.heroTop}>
          <View style={s.heroLeft}>
            <View style={s.homePortRow}>
              <JollyRoger size={16} flagColor={Colors.doubloonGold} boneColor={Colors.deepSea}/>
              <Text style={s.homePortLabel}>Home Port</Text>
            </View>
            <Text style={s.homePortName}>Shell Beach Marina</Text>
            <Text style={s.homePortCoords}>29.8650° N · 89.6740° W</Text>
          </View>
          <TouchableOpacity style={s.changeBtn}>
            <Text style={s.changeBtnTxt}>Change</Text>
          </TouchableOpacity>
        </View>

        <View style={s.heroDivider}/>

        <View style={s.heroStats}>
          {[
            { label: 'Solunar', val: `${actScore}/100`, color: scoreColor(actScore) },
            { label: 'Moon',    val: sol.moonPhase.emoji, color: null },
            { label: 'Phase',   val: sol.moonPhase.name.split(' ').slice(-1)[0], color: null },
          ].map((c, i) => (
            <View key={i} style={s.heroStat}>
              <Text style={[s.heroStatVal, c.color && { color: c.color }]}>{c.val}</Text>
              <Text style={s.heroStatLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── ACTIVITY WAVE ──────────────────────────────────── */}
      <View style={s.chartCard}>
        <View style={s.chartHd}>
          <Text style={s.chartTitle}>Fish activity today</Text>
          <Text style={[s.chartScore, { color: scoreColor(displayScore) }]}>
            {displayScore} · {displayLabel}
          </Text>
        </View>
        <View {...pan.panHandlers}>
          <ActivityWave sol={sol} scrubIdx={scrubIdx}/>
        </View>
        {scrubIdx === null && (
          <Text style={s.chartHint}>← slide to explore →</Text>
        )}
      </View>

      {/* ── CONDITION CHIPS ────────────────────────────────── */}
      <View style={s.chipRow}>
        {chips.map((c, i) => (
          <TouchableOpacity key={i} style={s.condChip} activeOpacity={0.75}>
            <View style={[s.condDot, { backgroundColor: c.dot }]}/>
            <Text style={s.condVal}>{c.val}</Text>
            <Text style={s.condLabel}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── DATA CARDS 2×2 ─────────────────────────────────── */}
      <View style={s.cardGrid}>
        <TouchableOpacity
          style={[s.dataCard, s.dataCardTeal]}
          onPress={() => navigation.navigate('Tides')}
          activeOpacity={0.8}
        >
          <Text style={s.dataCardLabel}>TIDES</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>
            {curTide !== null ? `${curTide.toFixed(2)} ft` : '—'}
          </Text>
          <Text style={s.dataCardSub}>
            {curTide !== null ? (tideRising ? 'Incoming ↑' : 'Outgoing ↓') : 'Loading…'}
          </Text>
          <MiniSparkline values={tideSpark} color={Colors.brackishWater}/>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.dataCard, s.dataCardGold]}
          onPress={() => navigation.navigate('Solunar')}
          activeOpacity={0.8}
        >
          <Text style={s.dataCardLabel}>SOLUNAR</Text>
          <Text style={[s.dataCardVal, { color: scoreColor(actScore) }]}>{actScore}/100</Text>
          <Text style={[s.dataCardSub, { color: scoreColor(actScore) }]}>{scoreLabel(actScore)}</Text>
          <MiniSparkline values={solMini} color={Colors.doubloonGold}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardGreen]} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WEATHER</Text>
          <Text style={[s.dataCardVal, { color: Colors.marshGreen }]}>
            {airTemp !== null ? `${airTemp}°F` : '—'}
          </Text>
          <Text style={s.dataCardSub}>
            {todayLow != null ? `Low ${Math.round(todayLow)}°` : 'Loading…'}
          </Text>
          <MiniSparkline values={tempSpark} color={Colors.marshGreen}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardNavy]} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WAVES</Text>
          <Text style={[s.dataCardVal, { color: Colors.midnightTide }]}>
            {waveHt !== null ? `${waveHt} ft` : '—'}
          </Text>
          <Text style={s.dataCardSub}>
            {waveHt !== null ? `${waveDirStr} swell` : 'Loading…'}
          </Text>
          <MiniSparkline values={waveSpark} color={Colors.midnightTide}/>
        </TouchableOpacity>
      </View>

      {/* ── 7-DAY FORECAST ─────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHd}>
          <Text style={s.sectionTitle}>7-day forecast</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {forecast.map((f, i) => (
            <View key={i} style={[s.fcCard, f.today && s.fcCardToday]}>
              <Text style={[s.fcDay, f.today && s.fcDayToday]}>{f.day}</Text>
              <Text style={s.fcIco}>{f.ico}</Text>
              <Text style={s.fcHigh}>{f.high}</Text>
              <Text style={s.fcLow}>{f.low}</Text>
              <Text style={s.fcWind}>{f.wind}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },
  content:   { paddingBottom: 32 },

  // Hero
  heroCard:       {
    backgroundColor: Colors.deepSea,
    margin: Spacing.lg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.deepSea,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft:       { flex: 1 },
  homePortRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  homePortLabel:  { fontSize: Typography.xs, color: Colors.doubloonGold, fontWeight: '700', letterSpacing: 1.5 },
  homePortName:   { fontSize: Typography.lg, fontFamily: 'Georgia', fontWeight: '700', color: Colors.saltWhite, marginBottom: 2 },
  homePortCoords: { fontSize: Typography.xs, color: 'rgba(245,240,232,0.45)', letterSpacing: 0.5 },
  changeBtn:      { backgroundColor: 'rgba(196,154,42,0.15)', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(196,154,42,0.4)' },
  changeBtnTxt:   { fontSize: Typography.xs, color: Colors.doubloonGold, fontWeight: '600' },
  heroDivider:    { height: 0.5, backgroundColor: 'rgba(245,240,232,0.1)', marginVertical: Spacing.md },
  heroStats:      { flexDirection: 'row', gap: Spacing.xl },
  heroStat:       { alignItems: 'flex-start', gap: 2 },
  heroStatVal:    { fontSize: Typography.md, fontWeight: '700', color: Colors.saltWhite },
  heroStatLabel:  { fontSize: Typography.xs, color: 'rgba(245,240,232,0.45)' },

  // Wave chart
  chartCard:  { backgroundColor: Colors.deepSea, marginHorizontal: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  chartHd:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chartTitle: { fontSize: Typography.xs, color: 'rgba(245,240,232,0.5)', fontWeight: '500', letterSpacing: 0.5 },
  chartScore: { fontSize: Typography.sm, fontWeight: '700' },
  chartHint:  { fontSize: 9, color: 'rgba(196,154,42,0.35)', textAlign: 'center', marginTop: 2 },

  // Condition chips
  chipRow:   { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.md },
  condChip:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 10, alignItems: 'center', gap: 3 },
  condDot:   { width: 6, height: 6, borderRadius: 3 },
  condVal:   { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  condLabel: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.3 },

  // Data cards 2×2
  cardGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  dataCard:      { width: '47.5%', backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, borderTopWidth: 3, padding: Spacing.md, gap: 1 },
  dataCardTeal:  { borderTopColor: Colors.brackishWater },
  dataCardGold:  { borderTopColor: Colors.doubloonGold },
  dataCardGreen: { borderTopColor: Colors.marshGreen },
  dataCardNavy:  { borderTopColor: Colors.midnightTide },
  dataCardLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 2 },
  dataCardVal:   { fontSize: Typography.lg, fontWeight: '700', fontFamily: 'Georgia' },
  dataCardSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6 },

  // Forecast
  section:     { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHd:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle:{ fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
  fcCard:      { width: 72, marginRight: 8, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 8, alignItems: 'center', gap: 2 },
  fcCardToday: { borderColor: Colors.doubloonGold, backgroundColor: 'rgba(196,154,42,0.06)' },
  fcDay:       { fontSize: Typography.xs, color: Colors.textSecondary },
  fcDayToday:  { color: Colors.doubloonGold, fontWeight: '600' },
  fcIco:       { fontSize: 18 },
  fcHigh:      { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  fcLow:       { fontSize: Typography.xs, color: Colors.textSecondary },
  fcWind:      { fontSize: 9, color: Colors.textSecondary },
})
