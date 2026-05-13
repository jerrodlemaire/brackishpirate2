import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder, Modal,
} from 'react-native'
import MapView, { UrlTile, PROVIDER_GOOGLE } from 'react-native-maps'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchWeatherAndForecast, weatherEmoji, windDir } from '../../utils/weather'
import { useDataLocation } from '../../hooks/useDataLocation'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'
import ForecastBubble from '../../components/ForecastBubble'

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
  return `${line} L ${pts[pts.length-1].x.toFixed(1)},${bottomY.toFixed(1)} L ${pts[0].x.toFixed(1)},${bottomY.toFixed(1)} Z`
}

function radarFrameTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Radar card ────────────────────────────────────────────────────────────────
function RadarCard({ lat, lng }) {
  const { Colors }    = useTheme()
  const insets        = useSafeAreaInsets()
  const [frames,      setFrames]      = useState([])
  const [frameIdx,    setFrameIdx]    = useState(0)
  const [playing,     setPlaying]     = useState(true)
  const [fullscreen,  setFullscreen]  = useState(false)
  const playingRef    = useRef(true)
  const framesRef     = useRef([])
  const region        = { latitude: lat, longitude: lng, latitudeDelta: 2.5, longitudeDelta: 2.5 }

  playingRef.current = playing
  framesRef.current  = frames

  const rc = useMemo(() => StyleSheet.create({
    card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 10 },
    title:      { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
    frameTime:  { fontSize: Typography.xs, color: Colors.textMuted },
    mapWrap:    { height: 200 },
    map:        { flex: 1 },
    expandHint: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(13,33,55,0.75)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
    expandTxt:  { fontSize: Typography.xs, color: '#fff', fontWeight: '500' },
    controls:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    playBtn:    { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.marshGreen, alignItems: 'center', justifyContent: 'center' },
    playIcon:   { fontSize: 12, color: '#fff' },
    timeline:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
    tick:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
    tickActive: { backgroundColor: Colors.marshGreen, height: 7, borderRadius: 3.5 },
    timeLabel:  { fontSize: Typography.xs, color: Colors.textMuted, width: 58, textAlign: 'right' },
    fsContainer:{ flex: 1, backgroundColor: '#000' },
    fsClose:    { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(13,33,55,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: Colors.border },
    fsCloseTxt: { fontSize: 14, color: '#fff', fontWeight: '600' },
    fsBar:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(13,33,55,0.92)', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 4 },
  }), [Colors])

  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        const past = data.radar?.past ?? []
        const host = data.host ?? 'https://tilecache.rainviewer.com'
        const f = past.map(fr => ({ url: `${host}${fr.path}`, time: fr.time }))
        if (f.length) { setFrames(f); setFrameIdx(f.length - 1) }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (playingRef.current && framesRef.current.length > 1) {
        setFrameIdx(i => (i + 1) % framesRef.current.length)
      }
    }, 600)
    return () => clearInterval(id)
  }, [])

  const togglePlay = () => setPlaying(p => !p)
  const seekTo    = (i) => { setFrameIdx(i); setPlaying(false) }

  const Timeline = () => (
    <View style={rc.controls}>
      <TouchableOpacity onPress={togglePlay} style={rc.playBtn}>
        <Text style={rc.playIcon}>{playing ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={rc.timeline}>
        {frames.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => seekTo(i)}
            style={[rc.tick, i === frameIdx && rc.tickActive]}/>
        ))}
      </View>
      <Text style={rc.timeLabel}>{frames.length > 0 ? radarFrameTime(frames[frameIdx].time) : ''}</Text>
    </View>
  )

  return (
    <>
      <View style={rc.card}>
        <View style={rc.header}>
          <Text style={rc.title}>Live Radar</Text>
          {frames.length === 0
            ? <ActivityIndicator size="small" color={Colors.marshGreen}/>
            : <Text style={rc.frameTime}>{radarFrameTime(frames[frameIdx].time)}</Text>
          }
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreen(true)} style={rc.mapWrap}>
          <MapView
            style={rc.map}
            provider={PROVIDER_GOOGLE}
            mapType="satellite"
            initialRegion={region}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            minZoomLevel={3}
            maxZoomLevel={18}
            pointerEvents="none"
          >
            {frames.map((frame, i) => (
              <UrlTile key={i}
                urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
                zIndex={2}
                opacity={i === frameIdx ? 0.7 : 0}
                tileSize={256}
                minimumZ={1}
                maximumZ={12}
                maximumNativeZ={8}
              />
            ))}
          </MapView>
          <View style={rc.expandHint}>
            <Text style={rc.expandTxt}>⤢ Full screen</Text>
          </View>
        </TouchableOpacity>

        {frames.length > 0 && <Timeline/>}
      </View>

      <Modal visible={fullscreen} animationType="slide" statusBarTranslucent>
        <View style={rc.fsContainer}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            mapType="satellite"
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            minZoomLevel={3}
            maxZoomLevel={18}
          >
            {frames.map((frame, i) => (
              <UrlTile key={i}
                urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
                zIndex={2}
                opacity={i === frameIdx ? 0.7 : 0}
                tileSize={256}
                minimumZ={1}
                maximumZ={12}
                maximumNativeZ={8}
              />
            ))}
          </MapView>
          <TouchableOpacity
            style={[rc.fsClose, { top: insets.top + 12 }]}
            onPress={() => setFullscreen(false)}
          >
            <Text style={rc.fsCloseTxt}>✕</Text>
          </TouchableOpacity>
          {frames.length > 0 && (
            <View style={[rc.fsBar, { paddingBottom: insets.bottom + 12 }]}>
              <Timeline/>
            </View>
          )}
        </View>
      </Modal>
    </>
  )
}

// ── Temp chart ────────────────────────────────────────────────────────────────
function TempChart({ temps }) {
  const { Colors } = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const panRef    = useRef(null)
  const getIdxFn  = useRef(null)
  const tempsRef  = useRef([])
  const stepXRef  = useRef(1)

  const ch = useMemo(() => StyleSheet.create({
    wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
    gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
    scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.marshGreen, opacity: 0.8 },
    bubble:    { position: 'absolute', backgroundColor: Colors.marshGreen, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 52, alignItems: 'center' },
    bubbleVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
    xLbl:      { position: 'absolute', fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary },
  }), [Colors])

  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      },
      onPanResponderMove: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      },
      onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
    })
  }

  if (!temps || temps.length === 0) {
    return <View style={[ch.wrap, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={Colors.marshGreen}/></View>
  }

  const minVal = Math.min(...temps)
  const maxVal = Math.max(...temps)
  const range  = maxVal - minVal || 1
  const stepX  = PLOT_W / (temps.length - 1)

  tempsRef.current = temps
  stepXRef.current = stepX
  getIdxFn.current = (x) => Math.max(0, Math.min(tempsRef.current.length - 1, Math.round((x - PAD_L) / stepXRef.current)))

  const pan = panRef.current

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

      <View style={[ch.nowLine, { left: nowX }]}/>

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
    </View>
  )
}

// ── 10-day weather strip ──────────────────────────────────────────────────────
function WeatherDayStrip({ daily, selectedIdx, onSelect }) {
  const { Colors } = useTheme()

  const wds = useMemo(() => StyleSheet.create({
    scroll:  { backgroundColor: Colors.topbarBg },
    content: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
    pill:    { width: 58, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 2 },
    pillSel: { backgroundColor: `${Colors.brackishWater}59`, borderColor: Colors.brackishWater },
    label:   { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.3 },
    num:     { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
    emoji:   { fontSize: 14 },
    hi:      { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    textSel: { color: '#fff' },
  }), [Colors])

  if (!daily) return null
  const count = Math.min(daily.time.length, 10)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={wds.scroll} contentContainerStyle={wds.content}>
      {Array.from({ length: count }, (_, i) => {
        const date     = new Date(daily.time[i] + 'T12:00:00')
        const selected = selectedIdx === i
        const dayLabel = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
        return (
          <TouchableOpacity key={i}
            style={[wds.pill, selected && wds.pillSel]}
            onPress={() => onSelect(i)}
          >
            <Text style={[wds.label, selected && wds.textSel]}>{dayLabel}</Text>
            <Text style={[wds.num,   selected && wds.textSel]}>{date.getDate()}</Text>
            <Text style={wds.emoji}>{weatherEmoji(daily.weathercode[i])}</Text>
            <Text style={[wds.hi,   selected && wds.textSel]}>{Math.round(daily.temperature_2m_max[i])}°</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// ── Day forecast row ──────────────────────────────────────────────────────────
function DayRow({ time, code, high, low, wind }) {
  const { Colors } = useTheme()
  const dr = useMemo(() => StyleSheet.create({
    row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    day:      { width: 48, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    dayToday: { color: Colors.brackishWater, fontWeight: '700' },
    icon:     { fontSize: 20, width: 32 },
    temps:    { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' },
    high:     { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, minWidth: 36 },
    low:      { fontSize: Typography.base, color: Colors.textMuted, minWidth: 36 },
    wind:     { fontSize: Typography.xs, color: Colors.textSecondary },
  }), [Colors])

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

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WeatherScreen({ navigation }) {
  const { Colors }  = useTheme()
  const insets = useSafeAreaInsets()
  const { weatherLocation, setWeatherLocation } = useDataLocation()
  const [weather,        setWeather]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)
  const [showPicker,     setShowPicker]     = useState(false)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)

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

  const cur    = weather?.current
  const daily  = weather?.daily
  const hourly = weather?.hourlyTemps || []

  const selIdx  = Math.min(selectedDayIdx, (daily?.time?.length ?? 1) - 1)
  const isToday = selIdx === 0

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },

    topbar:        { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 8 },
    topbarBack:    { padding: 4 },
    topbarBackTxt: { fontSize: 26, color: '#fff', lineHeight: 30 },
    topbarTitle:   { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },

    loadingBox: { alignItems: 'center', paddingTop: 80, gap: 16 },
    loadingTxt: { fontSize: Typography.base, color: Colors.textMuted },

    heroCard:    { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center' },
    heroLeft:    { flex: 1 },
    heroLabel:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
    heroTemp:    { fontSize: 40, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia', lineHeight: 44 },
    heroLoc:     { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 },
    heroRight:   { alignItems: 'center', gap: 10, marginLeft: 12 },
    heroEmoji:   { fontSize: 44, lineHeight: 50 },
    heroChips:   { gap: 6, alignItems: 'center' },
    heroChip:    { backgroundColor: Colors.inputBg, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
    heroChipLbl: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.3 },
    heroChipVal: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },

    card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    cardSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },

    detailRow:   { flexDirection: 'row', gap: 8 },
    detailCard:  { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
    detailIcon:  { fontSize: 20 },
    detailLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
    detailVal:   { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  }), [Colors])

  return (
    <View style={s.container}>

      {/* TOPBAR */}
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation?.navigate('Dashboard')} style={s.topbarBack}>
          <Text style={s.topbarBackTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Weather</Text>
        <LocationChip
          label={weatherLocation.name}
          onPress={() => setShowPicker(true)}
          color="#fff"
          boneColor={Colors.topbarBg}
        />
      </View>

      {/* DAY STRIP */}
      {!loading && <WeatherDayStrip daily={daily} selectedIdx={selIdx} onSelect={setSelectedDayIdx}/>}

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
                <Text style={s.heroLabel}>
                  {isToday ? 'Current conditions' : daily?.time[selIdx]
                    ? new Date(daily.time[selIdx] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                    : ''}
                </Text>
                <Text style={s.heroTemp}>
                  {isToday && cur
                    ? `${Math.round(cur.temperature_2m)}°`
                    : daily ? `${Math.round(daily.temperature_2m_max[selIdx])}°` : '—'}
                </Text>
                <Text style={s.heroLoc} numberOfLines={1}>{weatherLocation.name}</Text>
              </View>
              <View style={s.heroRight}>
                <Text style={s.heroEmoji}>{daily ? weatherEmoji(daily.weathercode[selIdx]) : '🌤️'}</Text>
                <View style={s.heroChips}>
                  {daily && (
                    <View style={s.heroChip}>
                      <Text style={s.heroChipLbl}>High / Low</Text>
                      <Text style={s.heroChipVal}>{Math.round(daily.temperature_2m_max[selIdx])}° / {Math.round(daily.temperature_2m_min[selIdx])}°</Text>
                    </View>
                  )}
                  {daily && (
                    <View style={s.heroChip}>
                      <Text style={s.heroChipLbl}>Wind</Text>
                      <Text style={s.heroChipVal}>{Math.round(daily.windspeed_10m_max[selIdx])} mph</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Live radar */}
            <RadarCard lat={weatherLocation.lat} lng={weatherLocation.lng}/>

            {/* Hourly temp chart — today only */}
            {isToday && (
              <View style={s.card}>
                <Text style={s.cardTitle}>24-hour temperature</Text>
                <Text style={s.cardSub}>Today's hourly forecast · °F</Text>
                <TempChart temps={hourly}/>
              </View>
            )}

            {/* Wind & details — today only */}
            {isToday && cur && (
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

      <ForecastBubble navigation={navigation} activeRoute="Weather"/>
    </View>
  )
}
