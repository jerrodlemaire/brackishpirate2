import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder, Modal, Animated,
} from 'react-native'
import MapView, { UrlTile, PROVIDER_GOOGLE } from 'react-native-maps'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import WindCompass from '../../components/WindCompass'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchWeatherAndForecast, weatherEmoji, windDir, getWindColor } from '../../utils/weather'
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

function radarFrameTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Mini sparkline ─────────────────────────────────────────────────────────
function MiniSparkline({ values, color, h = 22, w = 80 }) {
  const filtered = (values || []).filter(v => v != null && !isNaN(v))
  if (filtered.length < 2) return null
  const min = Math.min(...filtered), max = Math.max(...filtered)
  const rng = max - min || 1
  const pts = filtered.map((v, i) => {
    const x = (i / (filtered.length - 1)) * w
    const y = h - ((v - min) / rng) * h * 0.8 - h * 0.1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <Svg width={w} height={h}>
      <Path d={`M ${pts.split(' ').join(' L ')}`} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}

// ── Compact wind particle overlay (for radar card) ──────────────────────────
const PARTICLE_N = 20
function RadarWindOverlay({ windSpeed, windDeg }) {
  const { width: W } = Dimensions.get('window')
  const H = 200
  const particles = useRef(
    Array.from({ length: PARTICLE_N }, () => ({
      startX: Math.random() * W,
      startY: Math.random() * H,
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      opacity: new Animated.Value(0),
      size: 2 + Math.random() * 2,
    }))
  ).current

  useEffect(() => {
    const rad = (windDeg * Math.PI) / 180
    const dx  = -Math.sin(rad)
    const dy  = Math.cos(rad)
    const spd = Math.max(3, windSpeed)
    const dist = Math.min(W, H) * 0.7
    const dur  = Math.round((dist / spd) * 350)
    const loops = particles.map((p, i) => {
      let loop
      const start = () => {
        p.tx.setValue(0); p.ty.setValue(0); p.opacity.setValue(0)
        p.startX = Math.random() * W; p.startY = Math.random() * H
        loop = Animated.parallel([
          Animated.timing(p.tx, { toValue: dx * dist, duration: dur, useNativeDriver: true }),
          Animated.timing(p.ty, { toValue: dy * dist, duration: dur, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 0.75, duration: Math.round(dur * 0.15), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0.75, duration: Math.round(dur * 0.65), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0,    duration: Math.round(dur * 0.2),  useNativeDriver: true }),
          ]),
        ])
        loop.start(({ finished }) => { if (finished) start() })
      }
      const timer = setTimeout(start, (dur / PARTICLE_N) * i)
      return () => { clearTimeout(timer); loop?.stop() }
    })
    return () => { loops.forEach(c => c()) }
  }, [windDeg, windSpeed])

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.startX, top: p.startY,
          width: p.size, height: p.size, borderRadius: p.size / 2,
          backgroundColor: '#4A8FA8',
          transform: [{ translateX: p.tx }, { translateY: p.ty }],
          opacity: p.opacity,
        }}/>
      ))}
    </View>
  )
}

// ── Radar card ─────────────────────────────────────────────────────────────
function RadarCard({ lat, lng, windData }) {
  const { Colors }    = useTheme()
  const insets        = useSafeAreaInsets()
  const [frames,      setFrames]      = useState([])
  const [frameIdx,    setFrameIdx]    = useState(0)
  const [playing,     setPlaying]     = useState(true)
  const [fullscreen,  setFullscreen]  = useState(false)
  const [radarLayers, setRadarLayers] = useState(['rain'])
  const playingRef    = useRef(true)
  const framesRef     = useRef([])
  const region        = { latitude: lat, longitude: lng, latitudeDelta: 2.5, longitudeDelta: 2.5 }

  const toggleRadarLayer = (id) => {
    setRadarLayers(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id])
  }

  const RADAR_LAYER_OPTS = [
    { id: 'rain', label: 'Rain' },
    { id: 'wind', label: 'Wind' },
    { id: 'temp', label: 'Temp' },
  ]

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
    layerRow:     { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: 8 },
    layerPill:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.inputBg },
    layerPillOn:  { backgroundColor: `${Colors.marshGreen}33`, borderColor: Colors.marshGreen },
    layerPillTxt: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
    layerPillTxtOn:{ color: Colors.marshGreen, fontWeight: '700' },
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

  const Timeline = () => (
    <View style={rc.controls}>
      <TouchableOpacity onPress={() => setPlaying(p => !p)} style={rc.playBtn}>
        <Text style={rc.playIcon}>{playing ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <View style={rc.timeline}>
        {frames.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => { setFrameIdx(i); setPlaying(false) }}
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
        {/* Layer pills */}
        <View style={rc.layerRow}>
          {RADAR_LAYER_OPTS.map(opt => {
            const on = radarLayers.includes(opt.id)
            return (
              <TouchableOpacity key={opt.id}
                style={[rc.layerPill, on && rc.layerPillOn]}
                onPress={() => toggleRadarLayer(opt.id)}>
                <Text style={[rc.layerPillTxt, on && rc.layerPillTxtOn]}>{opt.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreen(true)} style={rc.mapWrap}>
          <MapView style={rc.map} provider={PROVIDER_GOOGLE} mapType="satellite"
            initialRegion={region} scrollEnabled={false} zoomEnabled={false}
            rotateEnabled={false} pitchEnabled={false} showsUserLocation={false}
            showsMyLocationButton={false} showsCompass={false} toolbarEnabled={false}
            minZoomLevel={3} maxZoomLevel={18} pointerEvents="none">
            {radarLayers.includes('rain') && frames.map((frame, i) => (
              <UrlTile key={i} urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
                zIndex={2} opacity={i === frameIdx ? 0.7 : 0} tileSize={256}
                minimumZ={1} maximumZ={12} maximumNativeZ={8}/>
            ))}
          </MapView>
          {radarLayers.includes('wind') && windData && (
            <RadarWindOverlay
              windSpeed={windData.windspeed_10m ?? 10}
              windDeg={windData.winddirection_10m ?? 180}
            />
          )}
          <View style={rc.expandHint}><Text style={rc.expandTxt}>⤢ Full screen</Text></View>
        </TouchableOpacity>
        {frames.length > 0 && <Timeline/>}
      </View>

      <Modal visible={fullscreen} animationType="slide" statusBarTranslucent>
        <View style={rc.fsContainer}>
          <MapView style={StyleSheet.absoluteFillObject} provider={PROVIDER_GOOGLE}
            mapType="satellite" initialRegion={region} showsUserLocation
            showsMyLocationButton={false} showsCompass={false} minZoomLevel={3} maxZoomLevel={18}>
            {frames.map((frame, i) => (
              <UrlTile key={i} urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
                zIndex={2} opacity={i === frameIdx ? 0.7 : 0} tileSize={256}
                minimumZ={1} maximumZ={12} maximumNativeZ={8}/>
            ))}
          </MapView>
          <TouchableOpacity style={[rc.fsClose, { top: insets.top + 12 }]} onPress={() => setFullscreen(false)}>
            <Text style={rc.fsCloseTxt}>✕</Text>
          </TouchableOpacity>
          {frames.length > 0 && (
            <View style={[rc.fsBar, { paddingBottom: insets.bottom + 12 }]}><Timeline/></View>
          )}
        </View>
      </Modal>
    </>
  )
}

// ── Temp chart ─────────────────────────────────────────────────────────────
function TempChart({ temps }) {
  const { Colors } = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const panRef     = useRef(null)
  const getIdxFn   = useRef(null)
  const tempsRef   = useRef([])
  const stepXRef   = useRef(1)
  const lastHaptic = useRef(-1)

  const ch = useMemo(() => StyleSheet.create({
    wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4, overflow: 'hidden' },
    gridLbl:   { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
    scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.marshGreen, opacity: 0.8 },
    bubble:    { position: 'absolute', backgroundColor: Colors.marshGreen, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 52, alignItems: 'center' },
    bubbleVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
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
        if (i != null) { setScrubIdx(i); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i }
      },
      onPanResponderMove: (e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) { setScrubIdx(i); if (i !== lastHaptic.current) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); lastHaptic.current = i } }
      },
      onPanResponderRelease: () => { setTimeout(() => setScrubIdx(null), 2500) },
    })
  }

  if (!temps || temps.length === 0) return (
    <View style={[ch.wrap, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={Colors.marshGreen}/></View>
  )

  const minVal = Math.min(...temps), maxVal = Math.max(...temps)
  const range = maxVal - minVal || 1
  const stepX = PLOT_W / (temps.length - 1)
  tempsRef.current = temps; stepXRef.current = stepX
  getIdxFn.current = (x) => Math.max(0, Math.min(tempsRef.current.length - 1, Math.round((x - PAD_L) / stepXRef.current)))
  const pan  = panRef.current
  const pts  = temps.map((v, i) => ({ x: PAD_L + i * stepX, y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H, v }))
  const nowX = PAD_L + Math.min(new Date().getHours(), temps.length - 1) * stepX
  const scrub = scrubIdx !== null ? pts[scrubIdx] : null
  const gridVals = [minVal, minVal + range * 0.5, maxVal]

  return (
    <View
      style={ch.wrap}
      onTouchStart={(e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      }}
      {...pan.panHandlers}
    >
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
        <Path d={smoothAreaPath(pts, CHART_H - PAD_B)} fill="url(#tempGrad)"/>
        <Path d={smoothBezierPath(pts)} fill="none" stroke={Colors.marshGreen} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H
        return <Text key={i} style={[ch.gridLbl, { top: y - 6 }]}>{Math.round(v)}°</Text>
      })}
      <View style={[ch.nowLine, { left: nowX }]}/>
      {scrub && (
        <>
          <View style={[ch.scrubLine, { left: scrub.x }]}/>
          <View style={[ch.bubble, { left: Math.min(Math.max(scrub.x - 30, PAD_L), CHART_W - PAD_R - 70), top: scrub.y - 38 }]}>
            <Text style={ch.bubbleVal}>{Math.round(scrub.v)}°F</Text>
          </View>
        </>
      )}
      {HOURS.map((l, i) => (
        <Text key={i} style={[ch.xLbl, { left: PAD_L + (PLOT_W / (HOURS.length - 1)) * i - 8, top: CHART_H - PAD_B + 4 }]}>{l}</Text>
      ))}
    </View>
  )
}

// ── 10-day weather strip ──────────────────────────────────────────────────
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={wds.scroll} contentContainerStyle={wds.content}>
      {Array.from({ length: count }, (_, i) => {
        const date     = new Date(daily.time[i] + 'T12:00:00')
        const selected = selectedIdx === i
        const dayLabel = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })
        return (
          <TouchableOpacity key={i} style={[wds.pill, selected && wds.pillSel]} onPress={() => onSelect(i)}>
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

// ── Screen ────────────────────────────────────────────────────────────────
export default function WeatherScreen() {
  const { Colors }  = useTheme()
  const insets      = useSafeAreaInsets()
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

  useEffect(() => { setLoading(true); loadData() }, [loadData])
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

    // Rich hero card
    heroCard:     { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: Spacing.md },
    heroTop:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    heroTempCol:  { flex: 1 },
    heroLabel:    { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
    heroTemp:     { fontSize: 52, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia', lineHeight: 56 },
    heroCondition:{ fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
    heroEmoji:    { fontSize: 52, lineHeight: 58 },
    heroStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10 },
    heroStat:     { backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', minWidth: '22%', flex: 1 },
    heroStatLbl:  { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.3, marginBottom: 2 },
    heroStatVal:  { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
    heroSparkRow: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border, paddingTop: 10 },
    heroSparkLbl: { fontSize: 9, color: Colors.textSecondary, letterSpacing: 0.3, marginBottom: 6 },

    card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
    cardSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },
  }), [Colors])

  const precipPct  = daily?.precipitation_probability_max?.[selIdx]
  const hiTemp     = daily?.temperature_2m_max?.[selIdx]
  const loTemp     = daily?.temperature_2m_min?.[selIdx]
  const maxWind    = daily?.windspeed_10m_max?.[selIdx]
  const windDirDom = daily?.winddirection_10m_dominant?.[selIdx]

  return (
    <View style={s.container}>
      <View style={[s.topbar, { paddingTop: 10 }]}>
        <Text style={s.topbarTitle}>Weather</Text>
        <LocationChip label={weatherLocation.name} onPress={() => setShowPicker(true)} color="#fff" boneColor={Colors.topbarBg}/>
      </View>

      {!loading && <WeatherDayStrip daily={daily} selectedIdx={selIdx} onSelect={setSelectedDayIdx}/>}

      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.marshGreen}/>}>
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={Colors.marshGreen}/>
            <Text style={s.loadingTxt}>Fetching weather…</Text>
          </View>
        ) : (
          <>
            {/* Rich hero card */}
            <View style={s.heroCard}>
              <View style={s.heroTop}>
                <View style={s.heroTempCol}>
                  <Text style={s.heroLabel}>
                    {isToday ? 'Current conditions' : daily?.time[selIdx]
                      ? new Date(daily.time[selIdx] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                      : ''}
                  </Text>
                  <Text style={s.heroTemp}>
                    {isToday && cur ? `${Math.round(cur.temperature_2m)}°` : hiTemp != null ? `${Math.round(hiTemp)}°` : '—'}
                  </Text>
                  <Text style={s.heroCondition} numberOfLines={1}>{weatherLocation.name}</Text>
                </View>
                <Text style={s.heroEmoji}>{daily ? weatherEmoji(daily.weathercode[selIdx]) : '🌤️'}</Text>
              </View>

              <View style={s.heroStatGrid}>
                {hiTemp != null && loTemp != null && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatLbl}>HIGH / LOW</Text>
                    <Text style={s.heroStatVal}>{Math.round(hiTemp)}° / {Math.round(loTemp)}°</Text>
                  </View>
                )}
                {precipPct != null && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatLbl}>PRECIP %</Text>
                    <Text style={s.heroStatVal}>{precipPct}%</Text>
                  </View>
                )}
                {maxWind != null && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatLbl}>WIND</Text>
                    <Text style={s.heroStatVal}>
                      {Math.round(maxWind)} mph{windDirDom != null ? ` ${windDir(windDirDom)}` : ''}
                    </Text>
                  </View>
                )}
                {isToday && cur && (
                  <View style={s.heroStat}>
                    <Text style={s.heroStatLbl}>FEELS LIKE</Text>
                    <Text style={s.heroStatVal}>{Math.round(cur.temperature_2m)}°F</Text>
                  </View>
                )}
              </View>

            </View>

            {/* Live radar */}
            <RadarCard lat={weatherLocation.lat} lng={weatherLocation.lng} windData={cur}/>

            {/* Hourly temp chart — today only */}
            {isToday && (
              <View style={[s.card, { paddingHorizontal: 0, overflow: 'hidden' }]}>
                <Text style={[s.cardTitle, { paddingHorizontal: Spacing.lg }]}>24-hour temperature</Text>
                <Text style={[s.cardSub, { paddingHorizontal: Spacing.lg }]}>Today's hourly forecast · °F</Text>
                <TempChart temps={hourly}/>
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
    </View>
  )
}
