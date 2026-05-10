import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, PanResponder, Modal,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
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

async function fetchTideHourly(stationId = '8761724') {
  const today   = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
    + `?begin_date=${dateStr}&end_date=${dateStr}`
    + `&station=${stationId}&product=predictions&datum=MLLW`
    + `&time_zone=lst_ldt&interval=60&units=english`
    + `&application=brackish_pirate&format=json`
  const res  = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}

async function fetchTideHiLo(stationId = '8761724') {
  const today   = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
    + `?begin_date=${dateStr}&end_date=${dateStr}`
    + `&station=${stationId}&product=predictions&datum=MLLW`
    + `&time_zone=lst_ldt&interval=hilo&units=english`
    + `&application=brackish_pirate&format=json`
  const res  = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}

function TideChart({ hourlyData }) {
  const [scrubIdx, setScrubIdx]     = useState(null)
  const lastHaptic                  = useRef(-1)

  if (!hourlyData || hourlyData.length === 0) {
    return (
      <View style={[cs.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
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
    onPanResponderRelease: () => {
      setTimeout(() => setScrubIdx(null), 2500)
    },
  })

  const pts = values.map((v, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + PLOT_H - ((v - minVal) / range) * PLOT_H,
    v,
    t: hourlyData[i]?.t?.split(' ')[1] || '',
  }))

  const nowHour = new Date().getHours()
  const nowX    = PAD_L + Math.min(nowHour, values.length - 1) * stepX
  const scrub   = scrubIdx !== null ? pts[scrubIdx] : null
  const bubbleL = scrub
    ? Math.min(Math.max(scrub.x - 36, PAD_L), CHART_W - PAD_R - 80)
    : 0

  return (
    <View style={cs.wrap} {...pan.panHandlers}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <View key={i} style={[cs.grid, { top: PAD_T + PLOT_H * (1 - f) }]}>
          <Text style={cs.gridLbl}>{(minVal + range * f).toFixed(1)}</Text>
        </View>
      ))}
      {pts.map((pt, i) => {
        if (i === pts.length - 1) return null
        const next = pts[i + 1]
        const avgY = (pt.y + next.y) / 2
        return (
          <View key={i} style={{
            position: 'absolute', left: pt.x, top: avgY,
            width: stepX + 0.5,
            height: Math.max(0, CHART_H - PAD_B - avgY),
            backgroundColor: scrubIdx === i
              ? 'rgba(74,143,168,0.45)' : 'rgba(74,143,168,0.18)',
          }}/>
        )
      })}
      {pts.map((pt, i) => (
        <View key={i} style={[
          cs.dot,
          { left: pt.x - 2, top: pt.y - 2 },
          scrubIdx === i && cs.dotActive,
        ]}/>
      ))}
      <View style={[cs.nowLine, { left: nowX }]}>
        <Text style={cs.nowLbl}>NOW</Text>
      </View>
      {scrub && (
        <>
          <View style={[cs.scrubLine, { left: scrub.x }]}/>
          <View style={[cs.bubble, { left: bubbleL, top: scrub.y - 40 }]}>
            <Text style={cs.bubbleVal}>{scrub.v.toFixed(2)} ft</Text>
            <Text style={cs.bubbleTime}>{scrub.t}</Text>
          </View>
        </>
      )}
      {['12a','6a','12p','6p','11p'].map((l, i) => (
        <Text key={i} style={[cs.xLbl, {
          left: PAD_L + (PLOT_W / 4) * i - 8,
          top:  CHART_H - PAD_B + 5,
        }]}>{l}</Text>
      ))}
      {scrubIdx === null && (
        <Text style={cs.hint}>← slide to explore →</Text>
      )}
    </View>
  )
}

const cs = StyleSheet.create({
  wrap:      { height: CHART_H, width: CHART_W, position: 'relative', marginBottom: 4 },
  grid:      { position: 'absolute', left: 0, right: PAD_R, height: 0.5, backgroundColor: 'rgba(74,143,168,0.2)', flexDirection: 'row', alignItems: 'center' },
  gridLbl:   { position: 'absolute', left: 0, fontSize: 9, color: Colors.textMuted, width: PAD_L - 4, textAlign: 'right' },
  dot:       { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.brackishWater },
  dotActive: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff', marginLeft: -3, marginTop: -3 },
  nowLine:   { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.doubloonGold },
  nowLbl:    { position: 'absolute', top: -14, left: -12, fontSize: 8, color: Colors.doubloonGold, fontWeight: '700' },
  scrubLine: { position: 'absolute', top: PAD_T, bottom: PAD_B, width: 1.5, backgroundColor: Colors.brackishWater, opacity: 0.8 },
  bubble:    { position: 'absolute', backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6, minWidth: 80, alignItems: 'center' },
  bubbleVal: { fontSize: 14, fontWeight: '700', color: '#fff' },
  bubbleTime:{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  xLbl:      { position: 'absolute', fontSize: 9, color: Colors.textSecondary },
  hint:      { position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: Colors.textMuted },
})

export default function TidesScreen() {
  const [hourly,      setHourly]      = useState([])
  const [hiLo,        setHiLo]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [showCalendar,setShowCalendar]= useState(false)

  const STATION_ID   = '8761724'
  const STATION_NAME = 'Grand Isle, LA'

  const loadData = useCallback(async () => {
    try {
      const [h, hl] = await Promise.all([fetchTideHourly(STATION_ID), fetchTideHiLo(STATION_ID)])
      setHourly(h)
      setHiLo(hl)
    } catch (e) {
      console.log('Tide error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const nowHour    = new Date().getHours()
  const currentVal = hourly[nowHour] ? parseFloat(hourly[nowHour].v) : null
  const prevVal    = hourly[nowHour - 1] ? parseFloat(hourly[nowHour - 1].v) : null
  const tideDir    = currentVal && prevVal
    ? currentVal > prevVal ? 'Incoming ↑' : 'Outgoing ↓' : '—'

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={Colors.brackishWater}/>
        <Text style={s.loadingTxt}>Loading tide data...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData() }} tintColor={Colors.brackishWater}/>}
    >
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroLeft}>
          <Text style={s.heroLabel}>Current tide</Text>
          <Text style={s.heroVal}>{currentVal !== null ? `${currentVal.toFixed(2)} ft` : '—'}</Text>
          <Text style={s.heroDir}>{tideDir}</Text>
        </View>
        <View style={s.heroRight}>
          <Text style={s.heroStation}>{STATION_NAME}</Text>
          <TouchableOpacity style={s.calBtn} onPress={() => setShowCalendar(true)}>
            <Text style={s.calBtnTxt}>📅 Forecast calendar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      <View style={s.chartCard}>
        <Text style={s.cardTitle}>Today's tide chart</Text>
        <Text style={s.chartSub}>Slide your finger to explore tide heights</Text>
        <TideChart hourlyData={hourly}/>
      </View>

      {/* Hi/Lo */}
      <View style={s.card}>
        <Text style={s.cardTitle}>High & low tides today</Text>
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
          { icon: '📍', label: 'Station', val: STATION_NAME },
          { icon: '📐', label: 'Datum', val: 'MLLW' },
        ].map((c, i) => (
          <View key={i} style={s.infoCard}>
            <Text style={s.infoIcon}>{c.icon}</Text>
            <Text style={s.infoLabel}>{c.label}</Text>
            <Text style={s.infoVal} numberOfLines={2}>{c.val}</Text>
          </View>
        ))}
      </View>

      {/* Tips */}
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

      {/* Calendar modal */}
      {showCalendar && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <TidesCalendar onClose={() => setShowCalendar(false)}/>
        </Modal>
      )}

    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.saltWhite },
  content:    { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },
  loading:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.saltWhite },
  loadingTxt: { fontSize: Typography.base, color: Colors.textSecondary },
  hero:       { backgroundColor: Colors.brackishWater, borderRadius: Radius.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center' },
  heroLeft:   { flex: 1 },
  heroLabel:  { fontSize: Typography.sm, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  heroVal:    { fontSize: 36, fontWeight: '700', color: Colors.saltWhite, fontFamily: 'Georgia' },
  heroDir:    { fontSize: Typography.base, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroRight:  { alignItems: 'flex-end', gap: 10 },
  heroStation:{ fontSize: Typography.xs, color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  calBtn:     { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  calBtnTxt:  { fontSize: Typography.xs, color: Colors.saltWhite, fontWeight: '500' },
  chartCard:  { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle:  { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 2 },
  chartSub:   { fontSize: Typography.xs, color: Colors.textMuted, marginBottom: 14 },
  card:       { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  hiLoGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hiLoCard:   { flex: 1, minWidth: '45%', borderRadius: Radius.md, padding: 12, alignItems: 'center', gap: 4 },
  hiLoHigh:   { backgroundColor: 'rgba(74,143,168,0.1)', borderWidth: 0.5, borderColor: Colors.brackishWater },
  hiLoLow:    { backgroundColor: 'rgba(196,154,42,0.08)', borderWidth: 0.5, borderColor: Colors.doubloonGold },
  hiLoIcon:   { fontSize: 20 },
  hiLoType:   { fontSize: Typography.xs, color: Colors.textSecondary },
  hiLoVal:    { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
  hiLoTime:   { fontSize: Typography.sm, color: Colors.textSecondary },
  infoRow:    { flexDirection: 'row', gap: 8 },
  infoCard:   { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 4 },
  infoIcon:   { fontSize: 20 },
  infoLabel:  { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  infoVal:    { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary, textAlign: 'center' },
  tipRow:     { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  tipBadge:   { backgroundColor: 'rgba(74,143,168,0.12)', borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: Colors.brackishWater, minWidth: 72, alignItems: 'center' },
  tipBadgeTxt:{ fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '500' },
  tipTxt:     { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
})
