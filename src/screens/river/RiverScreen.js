import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchNearbyRiverStations, fetchRiverTimeSeries, formatStage, formatFlow } from '../../utils/river'
import { smoothBezierPath, smoothAreaPath } from '../../utils/chart'
import { useApp } from '../../context/AppContext'

const { width } = Dimensions.get('window')
const CHART_W = width - 32
const CHART_H = 160
const PAD_L   = 44
const PAD_R   = 12
const PAD_T   = 14
const PAD_B   = 28
const PLOT_W  = CHART_W - PAD_L - PAD_R
const PLOT_H  = CHART_H - PAD_T - PAD_B

const RANGES = [
  { key: 'P1D',  label: '24 hr'   },
  { key: 'P7D',  label: '7 day'   },
  { key: 'P30D', label: '1 month' },
]

function getXLabels(series, range) {
  if (!series.length) return []
  const first = series[0].time
  const last  = series[series.length - 1].time
  const span  = last - first || 1
  const labels = []

  if (range === 'P1D') {
    for (let t = first; t <= last + 3600000; t += 6 * 3600000) {
      const h = new Date(t).getHours()
      const label = h === 0 ? '12a' : h === 6 ? '6a' : h === 12 ? '12p' : h === 18 ? '6p' : null
      if (label) labels.push({ label, pct: Math.min(1, (t - first) / span) })
    }
  } else if (range === 'P7D') {
    const d = new Date(first); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1)
    while (d.getTime() <= last) {
      labels.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), pct: (d.getTime() - first) / span })
      d.setDate(d.getDate() + 1)
    }
  } else {
    const d = new Date(first); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 7)
    while (d.getTime() <= last) {
      labels.push({ label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), pct: (d.getTime() - first) / span })
      d.setDate(d.getDate() + 7)
    }
  }
  return labels
}

function formatScrubTime(ts, range) {
  const d = new Date(ts)
  if (range === 'P1D') return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', hour12: true })
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function RiverChart({ series, metric, range }) {
  const { Colors } = useTheme()
  const [scrubIdx, setScrubIdx] = useState(null)
  const panRef    = useRef(null)
  const getIdxFn  = useRef(null)
  const seriesRef = useRef([])
  const stepXRef  = useRef(1)

  const ch = useMemo(() => StyleSheet.create({
    wrap:       { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
    gridLbl:    { position: 'absolute', left: 0, width: PAD_L - 4, textAlign: 'right', fontSize: 11, fontWeight: 'bold', color: Colors.textMuted },
    xLbl:       { position: 'absolute', fontSize: 11, fontWeight: 'bold', color: Colors.textSecondary, width: 26, textAlign: 'center' },
    scrubLine:  { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, opacity: 0.8 },
    bubble:     { position: 'absolute', backgroundColor: Colors.cardBg, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', minWidth: 72 },
    bubbleVal:  { fontSize: 14, fontWeight: '700' },
    bubbleTime: { fontSize: 11, fontWeight: 'bold', color: Colors.textMuted, marginTop: 1 },
  }), [Colors])

  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_e, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: e => { const i = getIdxFn.current?.(e.nativeEvent.locationX); if (i != null) setScrubIdx(i) },
      onPanResponderMove:  e => { const i = getIdxFn.current?.(e.nativeEvent.locationX); if (i != null) setScrubIdx(i) },
      onPanResponderRelease: () => setTimeout(() => setScrubIdx(null), 2500),
    })
  }

  if (!series || series.length < 2) {
    return (
      <View style={[ch.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.brackishWater}/>
      </View>
    )
  }

  const values = series.map(s => s.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range_ = maxVal - minVal || 1
  const stepX  = PLOT_W / (series.length - 1)

  seriesRef.current = series
  stepXRef.current  = stepX
  getIdxFn.current  = x => Math.max(0, Math.min(series.length - 1, Math.round((x - PAD_L) / stepXRef.current)))

  const pts = series.map((s, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((s.value - minVal) / range_) * PLOT_H,
    v: s.value,
    t: s.time,
  }))

  const linePath  = smoothBezierPath(pts)
  const areaPath  = smoothAreaPath(pts, CHART_H - PAD_B)
  const xLabels   = getXLabels(series, range)
  const gridVals  = [minVal, minVal + range_ * 0.5, maxVal]
  const isStage   = metric === 'stage'
  const lineColor = isStage ? Colors.doubloonGold : Colors.brackishWater
  const gradId    = isStage ? 'riverStageGrad' : 'riverFlowGrad'
  const scrub     = scrubIdx !== null ? pts[scrubIdx] : null

  const yLabel = v => isStage ? `${v.toFixed(1)}'` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${Math.round(v)}`

  const nowX = range === 'P1D' && series.length > 1
    ? PAD_L + ((Date.now() - series[0].time) / (series[series.length-1].time - series[0].time)) * PLOT_W
    : null

  return (
    <View
      style={ch.wrap}
      onTouchStart={(e) => {
        const i = getIdxFn.current?.(e.nativeEvent.locationX)
        if (i != null) setScrubIdx(i)
      }}
      {...panRef.current.panHandlers}
    >
      <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.35"/>
            <Stop offset="1" stopColor={lineColor} stopOpacity="0.03"/>
          </LinearGradient>
        </Defs>

        {gridVals.map((v, i) => {
          const y = PAD_T + PLOT_H - ((v - minVal) / range_) * PLOT_H
          return <Path key={i} d={`M ${PAD_L},${y.toFixed(1)} L ${CHART_W - PAD_R},${y.toFixed(1)}`}
            stroke={Colors.border} strokeWidth="0.5"/>
        })}

        <Path d={areaPath} fill={`url(#${gradId})`}/>
        <Path d={linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>

        {nowX !== null && nowX >= PAD_L && nowX <= CHART_W - PAD_R && (
          <Path d={`M ${nowX.toFixed(1)},${PAD_T} L ${nowX.toFixed(1)},${CHART_H - PAD_B}`}
            stroke={Colors.doubloonGold} strokeWidth="1.5" opacity="0.7"/>
        )}

        {scrub && (
          <Path d={`M ${PAD_L},${scrub.y.toFixed(1)} L ${scrub.x.toFixed(1)},${scrub.y.toFixed(1)}`}
            stroke={lineColor} strokeWidth="1" strokeDasharray="4,3" opacity="0.6"/>
        )}
      </Svg>

      {gridVals.map((v, i) => {
        const y = PAD_T + PLOT_H - ((v - minVal) / range_) * PLOT_H
        return <Text key={i} style={[ch.gridLbl, { top: y - 6 }]}>{yLabel(v)}</Text>
      })}

      {xLabels.map((l, i) => (
        <Text key={i} style={[ch.xLbl, { left: PAD_L + l.pct * PLOT_W - 10, top: CHART_H - PAD_B + 4 }]}>{l.label}</Text>
      ))}

      {scrub && (
        <>
          <View style={[ch.scrubLine, { left: scrub.x, backgroundColor: lineColor }]}/>
          <View style={[ch.bubble, {
            left: Math.min(Math.max(scrub.x - 36, PAD_L), CHART_W - PAD_R - 80),
            top:  scrub.y - 42,
            borderColor: lineColor,
          }]}>
            <Text style={[ch.bubbleVal, { color: lineColor }]}>
              {isStage ? formatStage(scrub.v) : formatFlow(scrub.v)}
            </Text>
            <Text style={ch.bubbleTime}>{formatScrubTime(scrub.t, range)}</Text>
          </View>
        </>
      )}
    </View>
  )
}

// ── Station strip ─────────────────────────────────────────────────────────────
function StationStrip({ stations, selectedId, favorites, onSelect }) {
  const { Colors } = useTheme()

  const ss = useMemo(() => StyleSheet.create({
    scroll:   { backgroundColor: Colors.topbarBg, maxHeight: 86 },
    content:  { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
    chip:     { width: 110, padding: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 3 },
    chipSel:  { backgroundColor: `${Colors.brackishWater}40`, borderColor: Colors.brackishWater },
    name:     { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '500', lineHeight: 13 },
    nameSel:  { color: '#fff' },
    stage:    { fontSize: Typography.sm, fontWeight: '700', color: '#fff' },
    stageSel: { color: Colors.brackishWater },
    dist:     { fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  }), [Colors])

  const sorted = [
    ...stations.filter(s => favorites.includes(s.id)),
    ...stations.filter(s => !favorites.includes(s.id)),
  ]

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={ss.scroll} contentContainerStyle={ss.content}>
      {sorted.map(st => {
        const selected = st.id === selectedId
        const fav      = favorites.includes(st.id)
        return (
          <TouchableOpacity key={st.id}
            style={[ss.chip, selected && ss.chipSel]}
            onPress={() => onSelect(st)}>
            <Text style={[ss.name, selected && ss.nameSel]} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.7}>{st.name}</Text>
            <Text style={[ss.stage, selected && ss.stageSel]}>{formatStage(st.stage)}</Text>
            <Text style={ss.dist}>{st.distance.toFixed(1)} mi</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RiverScreen() {
  const { Colors } = useTheme()
  const { homePort, riverFavorites, toggleRiverFavorite } = useApp()

  const [stations,        setStations]        = useState([])
  const [selectedStation, setSelectedStation] = useState(null)
  const [seriesData,      setSeriesData]      = useState(null)
  const [loadingStations, setLoadingStations] = useState(true)
  const [loadingChart,    setLoadingChart]    = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [range,           setRange]           = useState('P1D')
  const [metric,          setMetric]          = useState('stage')
  const [error,           setError]           = useState(null)

  const TREND_CONFIG = useMemo(() => ({
    rising:  { icon: '↑', label: 'Rising',  color: '#E07B39' },
    falling: { icon: '↓', label: 'Falling', color: Colors.brackishWater },
    steady:  { icon: '→', label: 'Steady',  color: Colors.textMuted },
  }), [Colors])

  const loadStations = useCallback(async () => {
    setError(null)
    try {
      const results = await fetchNearbyRiverStations(homePort.lat, homePort.lng)
      setStations(results)
      if (results.length > 0 && !selectedStation) {
        setSelectedStation(results[0])
      }
    } catch (e) {
      setError('Could not load river stations. Check your connection.')
    } finally {
      setLoadingStations(false)
      setRefreshing(false)
    }
  }, [homePort.lat, homePort.lng])

  const loadChart = useCallback(async (stationId, period) => {
    setLoadingChart(true)
    try {
      const data = await fetchRiverTimeSeries(stationId, period)
      setSeriesData(data)
    } catch (_) {
      setSeriesData(null)
    } finally {
      setLoadingChart(false)
    }
  }, [])

  useEffect(() => { loadStations() }, [loadStations])

  useEffect(() => {
    if (selectedStation) loadChart(selectedStation.id, range)
  }, [selectedStation, range, loadChart])

  const onRefresh = () => { setRefreshing(true); loadStations() }

  const selectStation = st => {
    setSelectedStation(st)
    setSeriesData(null)
  }

  const trend    = seriesData?.trend ?? 'steady'
  const trendCfg = TREND_CONFIG[trend]
  const stage    = seriesData?.currentStage ?? selectedStation?.stage ?? null
  const flow     = seriesData?.currentFlow  ?? selectedStation?.flow  ?? null
  const chartData = metric === 'stage' ? seriesData?.stageSeries : seriesData?.flowSeries

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },

    topbar:  { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, gap: 8 },
    backBtn: { padding: 4, width: 32 },
    backTxt: { fontSize: 26, color: '#fff', lineHeight: 30 },
    title:   { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: '#fff', letterSpacing: 0.5, textAlign: 'center' },

    stripLoading:    { height: 52, backgroundColor: Colors.topbarBg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    stripLoadingTxt: { fontSize: Typography.sm, color: Colors.textMuted },

    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },

    errorBox: { alignItems: 'center', paddingTop: 60 },
    errorTxt: { fontSize: Typography.base, color: Colors.textMuted, textAlign: 'center' },

    heroCard:    { backgroundColor: Colors.deepSea, borderRadius: Radius.lg, padding: Spacing.lg, gap: 10, borderWidth: 0.5, borderColor: Colors.border },
    heroStation: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    heroSub:     { fontSize: Typography.xs, color: Colors.textMuted },
    heroRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    heroStat:    { flex: 1, alignItems: 'center', gap: 5 },
    heroStatLbl: { fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroStage:   { fontSize: Typography.xl, fontWeight: '700', color: Colors.doubloonGold, fontFamily: 'Georgia' },
    heroFlow:    { fontSize: Typography.xl, fontWeight: '700', color: Colors.brackishWater, fontFamily: 'Georgia' },
    heroDivider: { width: 0.5, height: 48, backgroundColor: Colors.border },
    trendBadge:  { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
    trendTxt:    { fontSize: Typography.xs, fontWeight: '700' },

    card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm },

    toggleRow:   { flexDirection: 'row', gap: 8 },
    toggleBtn:   { flex: 1, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.inputBg },
    toggleBtnOn: { backgroundColor: `${Colors.brackishWater}2E`, borderColor: Colors.brackishWater },
    toggleTxt:   { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    toggleTxtOn: { color: Colors.brackishWater, fontWeight: '700' },

    rangeRow:   { flexDirection: 'row', gap: 8 },
    rangeBtn:   { flex: 1, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: 'transparent', alignItems: 'center' },
    rangeBtnOn: { backgroundColor: `${Colors.doubloonGold}1F`, borderColor: Colors.doubloonGold },
    rangeTxt:   { fontSize: Typography.xs, color: Colors.textMuted },
    rangeTxtOn: { color: Colors.doubloonGold, fontWeight: '600' },

    chartLoading: { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  }), [Colors])

  return (
    <View style={s.container}>

      {/* Topbar */}
      <View style={[s.topbar, { paddingTop: 10 }]}>
        <Text style={s.title}>River Gauges</Text>
      </View>

      {/* Station strip */}
      {loadingStations ? (
        <View style={s.stripLoading}>
          <ActivityIndicator size="small" color={Colors.brackishWater}/>
          <Text style={s.stripLoadingTxt}>Finding nearby gauges…</Text>
        </View>
      ) : stations.length === 0 ? (
        <View style={s.stripLoading}>
          <Text style={s.stripLoadingTxt}>No river gauges found nearby</Text>
        </View>
      ) : (
        <StationStrip
          stations={stations}
          selectedId={selectedStation?.id}
          favorites={riverFavorites}
          onSelect={selectStation}
        />
      )}

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>}
      >
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : selectedStation ? (
          <>
            {/* Hero */}
            <View style={s.heroCard}>
              <Text style={s.heroStation} numberOfLines={2}>{selectedStation.name}</Text>
              <Text style={s.heroSub}>Station {selectedStation.id} · {selectedStation.distance.toFixed(1)} mi away</Text>
              <View style={s.heroRow}>
                <View style={s.heroStat}>
                  <Text style={s.heroStatLbl}>Stage</Text>
                  <Text style={s.heroStage}>{formatStage(stage)}</Text>
                </View>
                <View style={s.heroDivider}/>
                <View style={s.heroStat}>
                  <Text style={s.heroStatLbl}>Flow</Text>
                  <Text style={s.heroFlow}>{formatFlow(flow)}</Text>
                </View>
                <View style={s.heroDivider}/>
                <View style={s.heroStat}>
                  <Text style={s.heroStatLbl}>Trend</Text>
                  <View style={[s.trendBadge, { backgroundColor: `${trendCfg.color}22`, borderColor: trendCfg.color }]}>
                    <Text style={[s.trendTxt, { color: trendCfg.color }]}>{trendCfg.icon} {trendCfg.label}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Chart card */}
            <View style={s.card}>
              <View style={s.toggleRow}>
                <TouchableOpacity
                  style={[s.toggleBtn, metric === 'stage' && s.toggleBtnOn]}
                  onPress={() => setMetric('stage')}>
                  <Text style={[s.toggleTxt, metric === 'stage' && s.toggleTxtOn]}>Stage (ft)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.toggleBtn, metric === 'flow' && s.toggleBtnOn]}
                  onPress={() => setMetric('flow')}>
                  <Text style={[s.toggleTxt, metric === 'flow' && s.toggleTxtOn]}>Flow (CFS)</Text>
                </TouchableOpacity>
              </View>

              <View style={s.rangeRow}>
                {RANGES.map(r => (
                  <TouchableOpacity key={r.key}
                    style={[s.rangeBtn, range === r.key && s.rangeBtnOn]}
                    onPress={() => setRange(r.key)}>
                    <Text style={[s.rangeTxt, range === r.key && s.rangeTxtOn]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loadingChart ? (
                <View style={s.chartLoading}>
                  <ActivityIndicator color={Colors.brackishWater}/>
                </View>
              ) : (
                <RiverChart series={chartData} metric={metric} range={range}/>
              )}
            </View>
          </>
        ) : null}

        <View style={{ height: 100 }}/>
      </ScrollView>

    </View>
  )
}
