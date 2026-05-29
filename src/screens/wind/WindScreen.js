import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native'
import WindCompass from '../../components/WindCompass'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchWeatherAndForecast, windDir, getWindColor } from '../../utils/weather'
import { useDataLocation } from '../../hooks/useDataLocation'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'

const { width } = Dimensions.get('window')
const CHART_W = width - 32

// Convert an hour-of-day (0–23) to a single-line label like 12am / 6pm
function hourLabel(h) {
  const ampm = h < 12 ? 'am' : 'pm'
  const hr   = h % 12 === 0 ? 12 : h % 12
  return `${hr}${ampm}`
}

// Vertical bar graph: one bar per hour (height + color = speed) with a wind
// vane above each bar showing direction at that hour.
const PLOT_H = 150     // total column height: vane + speed label + bar
const ARROW  = 30      // large wind vane atop each bar
const TOP_RESERVE = ARROW + 24   // space kept above the bar for vane + speed label

function WindChart({ bars }) {
  const { Colors } = useTheme()

  const wc = useMemo(() => StyleSheet.create({
    wrap:    { width: CHART_W, marginBottom: 4, paddingHorizontal: 10 },
    plot:    { height: PLOT_H, flexDirection: 'row', alignItems: 'flex-end' },
    col:     { flex: 1, height: PLOT_H, alignItems: 'center', justifyContent: 'flex-end' },
    speed:   { fontSize: Typography.sm, fontWeight: '700', marginBottom: 3 },
    bar:     { width: 24, borderRadius: 5 },
    xRow:    { flexDirection: 'row', marginTop: 6 },
    xCell:   { flex: 1, alignItems: 'center' },
    xLbl:    { fontSize: Typography.xs, fontWeight: '700', color: Colors.textSecondary },
    xLblNow: { color: Colors.doubloonGold },
  }), [Colors])

  if (!bars || bars.length === 0) return (
    <View style={{ width: CHART_W, height: PLOT_H, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={Colors.brackishWater}/>
    </View>
  )

  const rawMax  = Math.max(...bars.map(b => b.speed), 5)
  const barMax  = PLOT_H - TOP_RESERVE

  return (
    <View style={wc.wrap}>
      <View style={wc.plot}>
        {bars.map((b, i) => {
          const color = getWindColor(b.speed)
          const h     = Math.max(4, (b.speed / rawMax) * barMax)
          const isNow = i === 0
          return (
            <View key={i} style={wc.col}>
              {b.dir != null && (
                <WindCompass deg={b.dir} size={ARROW} color={color} strokeWidth={isNow ? 4 : 3}/>
              )}
              <Text style={[wc.speed, { color }]}>{Math.round(b.speed)}</Text>
              <View style={[wc.bar, { height: h, backgroundColor: color, opacity: isNow ? 1 : 0.85 }]}/>
            </View>
          )
        })}
      </View>

      <View style={wc.xRow}>
        {bars.map((b, i) => (
          <View key={i} style={wc.xCell}>
            <Text style={[wc.xLbl, i === 0 && wc.xLblNow]}>{hourLabel(b.hour)}</Text>
          </View>
        ))}
      </View>
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

  // Rolling 6-hour window starting at the current hour (can cross midnight).
  const wSpeedsAll = weather?.hourlyWindSpeedsFull || []
  const wDirsAll   = weather?.hourlyWindDirsFull   || []
  const nowHour    = new Date().getHours()
  const hourlyBars = Array.from({ length: 6 }, (_, k) => {
    const idx = nowHour + k
    return { hour: idx % 24, speed: wSpeedsAll[idx], dir: wDirsAll[idx] }
  }).filter(b => b.speed != null && !isNaN(b.speed))

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
              <Text style={[s.cardSub, { paddingHorizontal: Spacing.lg }]}>Next 6 hours · speed (mph) + direction</Text>
              <WindChart bars={hourlyBars}/>
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
