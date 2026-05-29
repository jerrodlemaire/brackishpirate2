import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import WindCompass from '../../components/WindCompass'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchWeatherAndForecast, windDir, getWindColor } from '../../utils/weather'
import { useDataLocation } from '../../hooks/useDataLocation'
import { smoothBezierPath, smoothAreaPath } from '../../utils/chart'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'

const { width } = Dimensions.get('window')
const CHART_W = width - 32
const CHART_H = 140
const PAD_L   = 36
const PAD_R   = 12
const PAD_T   = 14
const PAD_B   = 32
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

const HOURS = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p']

function WindChart({ speeds, dirs }) {
  const { Colors } = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const panRef     = useRef(null)
  const getIdxFn   = useRef(null)
  const dataRef    = useRef([])
  const stepXRef   = useRef(1)
  const lastHaptic = useRef(-1)

  const wc = useMemo(() => StyleSheet.create({
    wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4, overflow: 'hidden' },
    gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
    scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater, opacity: 0.8 },
    bubble:    { position: 'absolute', backgroundColor: Colors.brackishWater, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 72, alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center' },
    bubbleVal: { fontSize: 14, fontWeight: '700', color: Colors.textOnDark },
    xLbl:      { position: 'absolute', fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary },
    arrowRow:  { position: 'absolute', flexDirection: 'row', left: PAD_L, right: PAD_R, bottom: 4, justifyContent: 'space-between' },
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
        if (i != null) { setScrubIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i }
      },
      onPanResponderMove: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) { setScrubIdx(i); if (i !== lastHaptic.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i } }
      },
      onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
    })
  }

  if (!speeds || speeds.length === 0) return (
    <View style={[wc.wrap, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={Colors.brackishWater}/></View>
  )

  const minVal = 0
  const maxVal = Math.max(...speeds, 5)
  const range  = maxVal - minVal || 1
  const stepX  = PLOT_W / (speeds.length - 1)
  dataRef.current  = speeds; stepXRef.current = stepX
  getIdxFn.current = (x) => Math.max(0, Math.min(dataRef.current.length - 1, Math.round((x - PAD_L) / stepXRef.current)))
  const pan  = panRef.current
  const pts  = speeds.map((v, i) => ({ x: PAD_L + i * stepX, y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H, v }))
  const nowX = PAD_L + Math.min(new Date().getHours(), speeds.length - 1) * stepX
  const scrub      = scrubIdx !== null ? pts[scrubIdx] : null
  const lineColor  = getWindColor(maxVal)
  const gridVals   = [0, Math.round(maxVal * 0.5), Math.round(maxVal)]
  const arrowHours = [0, 3, 6, 9, 12, 15, 18, 21]

  return (
    <View
      style={wc.wrap}
      onTouchStart={(e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      }}
      {...pan.panHandlers}
    >
      <Svg width={CHART_W} height={CHART_H - PAD_B + 4} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="windGradWS" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.35"/>
            <Stop offset="1" stopColor={lineColor} stopOpacity="0.03"/>
          </LinearGradient>
        </Defs>
        {gridVals.map((v, i) => {
          const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
          return <Path key={i} d={`M ${PAD_L},${y.toFixed(1)} L ${CHART_W - PAD_R},${y.toFixed(1)}`} stroke={`${lineColor}20`} strokeWidth="0.5"/>
        })}
        <Path d={smoothAreaPath(pts, CHART_H - PAD_B)} fill="url(#windGradWS)"/>
        <Path d={smoothBezierPath(pts)} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return <Text key={i} style={[wc.gridLbl, { top: y - 6 }]}>{v}</Text>
      })}
      <View style={[wc.nowLine, { left: nowX }]}/>
      {scrub && (
        <>
          <View style={[wc.scrubLine, { left: scrub.x, backgroundColor: getWindColor(scrub.v) }]}/>
          <View style={[wc.bubble, { left: Math.min(Math.max(scrub.x - 40, PAD_L), CHART_W - PAD_R - 90), top: scrub.y - 40, backgroundColor: getWindColor(scrub.v) }]}>
            {dirs && dirs[scrubIdx] != null && <WindCompass deg={dirs[scrubIdx]} size={14} color="#fff"/>}
            <Text style={wc.bubbleVal}>{Math.round(scrub.v)} mph</Text>
          </View>
        </>
      )}
      {HOURS.map((l, i) => (
        <Text key={i} style={[wc.xLbl, { left: PAD_L + (PLOT_W / (HOURS.length - 1)) * i - 8, top: CHART_H - PAD_B + 4 }]}>{l}</Text>
      ))}
      {dirs && dirs.length > 0 && (
        <View style={wc.arrowRow}>
          {arrowHours.map(h => {
            const idx = Math.min(h, dirs.length - 1)
            if (dirs[idx] == null) return <View key={h} style={{ width: 18 }}/>
            return (
              <View key={h} style={{ alignItems: 'center' }}>
                <WindCompass deg={dirs[idx]} size={18} color={`${Colors.brackishWater}CC`}/>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function TenDayWindStrip({ daily }) {
  const { Colors } = useTheme()
  const ws = useMemo(() => StyleSheet.create({
    wrap:    { gap: 6 },
    title:   { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
    row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border, gap: 8 },
    day:     { width: 52, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    dayToday:{ color: Colors.brackishWater, fontWeight: '700' },
    arrow:   { width: 22, alignItems: 'center' },
    barWrap: { flex: 1, height: 6, backgroundColor: Colors.inputBg, borderRadius: 3, overflow: 'hidden' },
    bar:     { height: '100%', borderRadius: 3 },
    speed:   { width: 52, fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  }), [Colors])

  if (!daily?.windspeed_10m_max?.length) return null
  const maxSpeed = Math.max(...daily.windspeed_10m_max.slice(0, 10), 1)
  const count    = Math.min(daily.time.length, 10)

  return (
    <View style={ws.wrap}>
      <Text style={ws.title}>10-day wind forecast</Text>
      {Array.from({ length: count }, (_, i) => {
        const date     = new Date(daily.time[i] + 'T12:00:00')
        const isToday  = new Date().toDateString() === date.toDateString()
        const dayName  = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
        const spd      = Math.round(daily.windspeed_10m_max[i])
        const dir      = daily.winddirection_10m_dominant?.[i]
        const barW     = (spd / maxSpeed) * 100
        const barColor = getWindColor(spd)
        return (
          <View key={i} style={ws.row}>
            <Text style={[ws.day, isToday && ws.dayToday]}>{dayName}</Text>
            <View style={ws.arrow}>
              {dir != null && <WindCompass deg={dir} size={20} color={barColor}/>}
            </View>
            <View style={ws.barWrap}>
              <View style={[ws.bar, { width: `${barW}%`, backgroundColor: barColor }]}/>
            </View>
            <Text style={ws.speed}>{spd} mph</Text>
          </View>
        )
      })}
    </View>
  )
}

export default function WindScreen() {
  const { Colors }  = useTheme()
  const { weatherLocation, setWeatherLocation } = useDataLocation()
  const [weather,    setWeather]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchWeatherAndForecast(weatherLocation.lat, weatherLocation.lng)
      setWeather(data)
    } catch (e) {
      console.log('Wind fetch error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [weatherLocation.lat, weatherLocation.lng])

  useEffect(() => { setLoading(true); loadData() }, [loadData])
  const onRefresh = () => { setRefreshing(true); loadData() }

  const cur     = weather?.current
  const daily   = weather?.daily
  const wSpeeds = weather?.hourlyWindSpeeds || []
  const wDirs   = weather?.hourlyWindDirs   || []

  const windSpd    = cur ? Math.round(cur.windspeed_10m) : null
  const gustSpd    = cur?.windgusts_10m != null ? Math.round(cur.windgusts_10m) : null
  const windDirStr = cur ? windDir(cur.winddirection_10m) : ''
  const windColor  = windSpd !== null ? getWindColor(windSpd) : Colors.brackishWater
  const gustColor  = gustSpd !== null ? getWindColor(gustSpd) : Colors.textPrimary

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    topbar:    { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, paddingTop: 10, gap: 8 },
    topbarTitle: { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5 },
    content:   { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },
    loadingBox:{ alignItems: 'center', paddingTop: 80, gap: 16 },
    loadingTxt:{ fontSize: Typography.base, color: Colors.textMuted },
    heroCard:  { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.md },
    heroTop:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    heroLeft:  { flex: 1 },
    heroLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
    heroWind:  { fontSize: 52, fontWeight: '700', fontFamily: 'Georgia', lineHeight: 56 },
    heroDir:   { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600', marginTop: 6, textAlign: 'center' },
    heroRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
    heroStatRow:   { marginTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroStatLabel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
    heroStatVal:   { fontSize: 24, fontWeight: '700', fontFamily: 'Georgia' },
    card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    cardSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },
  }), [Colors])

  return (
    <View style={s.container}>
      <View style={s.topbar}>
        <Text style={s.topbarTitle}>Wind</Text>
        <LocationChip label={weatherLocation.name} onPress={() => setShowPicker(true)} color={Colors.textPrimary} boneColor={Colors.topbarBg}/>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={Colors.brackishWater}/>
            <Text style={s.loadingTxt}>Fetching wind data…</Text>
          </View>
        ) : (
          <>
            <View style={s.heroCard}>
              <View style={s.heroTop}>
                <View style={s.heroLeft}>
                  <Text style={s.heroLabel}>Current wind</Text>
                  <Text style={[s.heroWind, { color: windColor }]}>
                    {windSpd !== null ? `${windSpd} mph` : '—'}
                  </Text>
                </View>
                <View style={s.heroRight}>
                  {cur?.winddirection_10m != null && (
                    <WindCompass deg={cur.winddirection_10m} size={56} color={windColor} strokeWidth={4.5}/>
                  )}
                  {windDirStr ? <Text style={s.heroDir}>{windDirStr}</Text> : null}
                </View>
              </View>
              <View style={s.heroStatRow}>
                <Text style={s.heroStatLabel}>GUSTS</Text>
                <Text style={[s.heroStatVal, { color: gustColor }]}>
                  {gustSpd !== null ? `${gustSpd} mph` : '—'}
                </Text>
              </View>
            </View>

            <View style={[s.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
              <Text style={[s.cardTitle, { paddingHorizontal: Spacing.lg }]}>Hourly wind</Text>
              <Text style={[s.cardSub, { paddingHorizontal: Spacing.lg }]}>Speed (mph) · arrows show direction</Text>
              <WindChart speeds={wSpeeds} dirs={wDirs}/>
            </View>

            <View style={s.card}>
              <TenDayWindStrip daily={daily}/>
            </View>
          </>
        )}
      </ScrollView>

      <LocationPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(lat, lng, name) => setWeatherLocation(lat, lng, name)}
        title="Set Wind Location"
        initialLat={weatherLocation.lat}
        initialLng={weatherLocation.lng}
      />
    </View>
  )
}
