import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { getSolunarForDate, buildCompositeCurve, peakWeightedAverage, scoreColor } from '../../utils/solunar'
import ActivityGauge from '../../components/ActivityGauge'
import { fetchTideHourly } from '../../utils/tides'
import { fetchWeatherAndForecast, fetchMarineData, fetchWaterTemp, windDir, getWindColor } from '../../utils/weather'
import JollyRoger from '../../components/JollyRoger'
import WindCompass from '../../components/WindCompass'
import HomePortPicker from '../../components/HomePortPicker'
import { useApp } from '../../context/AppContext'
import { useDataLocation } from '../../hooks/useDataLocation'

function shortTime(t) {
  return t.replace(' AM', 'a').replace(' PM', 'p')
}

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


// ── Screen ────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ pagerRef }) {
  const navigation = useNavigation()
  const { Colors, preference, setPreference } = useTheme()
  const { homePort, activeStation } = useApp()
  const { buoy }            = useDataLocation()
  const [showPicker,   setShowPicker]   = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)

  const [weather,    setWeather]    = useState(null)
  const [marine,     setMarine]     = useState(null)
  const [waterTemp,  setWaterTemp]  = useState(null)
  const [hourlyTide, setHourlyTide] = useState([])

  const sol         = getSolunarForDate(new Date(), homePort.lat, homePort.lng)
  const curve       = useMemo(() => buildCompositeCurve(sol, hourlyTide, 0), [sol, hourlyTide])
  const fishScore   = useMemo(() => peakWeightedAverage(curve), [curve])

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

  useEffect(() => { loadData() }, [loadData])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [loadData])

  // ── Derived values ──────────────────────────────────────────────────────────
  const nowHour    = new Date().getHours()
  const curTide    = hourlyTide[nowHour]     ? parseFloat(hourlyTide[nowHour].v)     : null
  const prevTide   = hourlyTide[nowHour - 1] ? parseFloat(hourlyTide[nowHour - 1].v) : null
  const tideRising = curTide !== null && prevTide !== null && curTide > prevTide

  const airTemp    = weather?.current ? Math.round(weather.current.temperature_2m)  : null
  const windSpd    = weather?.current ? Math.round(weather.current.windspeed_10m)   : null
  const windDirStr = weather?.current ? windDir(weather.current.winddirection_10m)  : ''
  const waveHt     = marine?.current?.wave_height != null ? marine.current.wave_height.toFixed(1) : null
  const waveDirStr = marine?.current?.wave_direction != null ? windDir(marine.current.wave_direction) : ''
  const todayHigh  = weather?.daily?.temperature_2m_max?.[0]
  const todayLow   = weather?.daily?.temperature_2m_min?.[0]

  const tideSpark  = hourlyTide.length > 0 ? hourlyTide.slice(0, 24).map(p => parseFloat(p.v)) : null
  const waveSpark  = marine?.hourlyWaves?.filter(v => v != null).length > 0 ? marine.hourlyWaves : null
  const windSpark  = weather?.hourlyWindSpeeds?.length > 0 ? weather.hourlyWindSpeeds : null
  const tempSpark  = weather?.hourlyTemps?.length > 0 ? weather.hourlyTemps : null

  const displayName  = homePort.name.length > 28 ? homePort.name.slice(0, 26) + '…' : homePort.name

  const THEME_OPTS = [
    { key: 'dark',  label: '🌙 Dark'  },
    { key: 'light', label: '☀️ Light' },
    { key: 'auto',  label: '⚡ Auto'  },
  ]

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    content:   { paddingBottom: 32 },

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

    themeRow:   { flexDirection: 'row', marginHorizontal: 12, marginBottom: Spacing.sm, gap: 8 },
    themeBtn:   { flex: 1, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.cardBg },
    themeBtnOn: { backgroundColor: `${Colors.doubloonGold}22`, borderColor: Colors.doubloonGold },
    themeTxt:   { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    themeTxtOn: { color: Colors.doubloonGold, fontWeight: '700' },

    cardGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: Spacing.sm, marginBottom: Spacing.md },
    dataCard:      { width: '47.5%', backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderTopWidth: 3, borderBottomWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderBottomColor: Colors.border, borderLeftColor: Colors.border, borderRightColor: Colors.border, padding: Spacing.md, gap: 1 },
    dataCardTeal:  { borderTopColor: '#4A8FA8' },
    dataCardGold:  { borderTopColor: Colors.doubloonGold },
    dataCardGreen: { borderTopColor: Colors.marshGreen },
    dataCardNavy:  { borderTopColor: '#0D2137' },
    dataCardLabel: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1.2, marginBottom: 2 },
    dataCardVal:   { fontSize: Typography.lg, fontWeight: '700', fontFamily: 'Georgia' },
    dataCardSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 6 },

    utilityGrid: { flexDirection: 'row', paddingHorizontal: 12, gap: Spacing.sm, marginBottom: Spacing.md },
    utilityCard: { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center', gap: 4 },
    utilityIcon: { fontSize: 22 },
    utilityLabel:{ fontSize: Typography.xs, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5 },
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
            <Text style={[s.heroStatVal, { color: scoreColor(fishScore) }]}>{fishScore}/100</Text>
            <Text style={s.heroStatSep}>·</Text>
            <Text style={s.heroStatVal}>{sol.moonPhase.emoji}</Text>
            <Text style={s.heroStatSep}>·</Text>
            <Text style={[s.heroStatVal, { opacity: 0.65 }]} numberOfLines={1}>{activeStation.name}</Text>
          </View>
        </View>
      </View>

      {/* THEME TOGGLE */}
      <View style={s.themeRow}>
        {THEME_OPTS.map(opt => (
          <TouchableOpacity key={opt.key}
            style={[s.themeBtn, preference === opt.key && s.themeBtnOn]}
            onPress={() => setPreference(opt.key)}
          >
            <Text style={[s.themeTxt, preference === opt.key && s.themeTxtOn]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONDITION DATA CARDS 2×3 */}
      <View style={s.cardGrid}>
        {/* Row 1 */}
        <TouchableOpacity style={[s.dataCard, s.dataCardGold]} onPress={() => pagerRef?.current?.setPage(1)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>FISH ACTIVITY</Text>
          <ActivityGauge score={fishScore} Colors={Colors} size={96}/>
          <Text style={{ fontSize: 9, color: Colors.doubloonGold, fontWeight: '700', marginTop: 4 }}>
            MAJ {shortTime(sol.major1.start)} · {shortTime(sol.major2.start)}
          </Text>
          <Text style={{ fontSize: 9, color: Colors.brackishWater, fontWeight: '700' }}>
            MIN {shortTime(sol.minor1.start)} · {shortTime(sol.minor2.start)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => pagerRef?.current?.setPage(2)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>TIDES</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>{curTide !== null ? `${curTide.toFixed(2)} ft` : '—'}</Text>
          <Text style={s.dataCardSub}>{curTide !== null ? (tideRising ? 'Incoming ↑' : 'Outgoing ↓') : 'Loading…'}</Text>
          <MiniSparkline values={tideSpark} color={Colors.brackishWater}/>
        </TouchableOpacity>

        {/* Row 2 */}
        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => pagerRef?.current?.setPage(4)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WIND</Text>
          <Text style={[s.dataCardVal, { color: windSpd !== null ? getWindColor(windSpd) : Colors.brackishWater }]}>{windSpd !== null ? `${windSpd} mph` : '—'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            {weather?.current?.winddirection_10m != null && (
              <WindCompass deg={weather.current.winddirection_10m} size={22} color={windSpd !== null ? getWindColor(windSpd) : Colors.brackishWater}/>
            )}
            <Text style={[s.dataCardSub, { marginBottom: 0 }]}>{windDirStr || 'Loading…'}</Text>
          </View>
          <MiniSparkline values={windSpark} color={windSpd !== null ? getWindColor(windSpd) : Colors.brackishWater}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => pagerRef?.current?.setPage(5)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WAVES</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>{waveHt !== null ? `${waveHt} ft` : '—'}</Text>
          <Text style={s.dataCardSub}>{waveHt !== null ? `${waveDirStr} swell` : 'Loading…'}</Text>
          <MiniSparkline values={waveSpark} color={Colors.brackishWater}/>
        </TouchableOpacity>

        {/* Row 3 */}
        <TouchableOpacity style={[s.dataCard, s.dataCardGreen]} onPress={() => pagerRef?.current?.setPage(6)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>AIR TEMP</Text>
          <Text style={[s.dataCardVal, { color: Colors.marshGreen }]}>{airTemp !== null ? `${airTemp}°F` : '—'}</Text>
          <Text style={s.dataCardSub}>{todayHigh != null && todayLow != null ? `H ${Math.round(todayHigh)}° · L ${Math.round(todayLow)}°` : 'Loading…'}</Text>
          <MiniSparkline values={tempSpark} color={Colors.marshGreen}/>
        </TouchableOpacity>

        <TouchableOpacity style={[s.dataCard, s.dataCardTeal]} onPress={() => pagerRef?.current?.setPage(6)} activeOpacity={0.8}>
          <Text style={s.dataCardLabel}>WATER TEMP</Text>
          <Text style={[s.dataCardVal, { color: Colors.brackishWater }]}>{waterTemp !== null ? `${Math.round(waterTemp)}°F` : '—'}</Text>
          <Text style={s.dataCardSub}>Surface · NOAA</Text>
        </TouchableOpacity>
      </View>

      {/* UTILITY TILES */}
      <View style={s.utilityGrid}>
        <TouchableOpacity style={s.utilityCard} onPress={() => navigation.navigate('Map')} activeOpacity={0.8}>
          <Text style={s.utilityIcon}>◎</Text>
          <Text style={s.utilityLabel}>MAP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.utilityCard} onPress={() => navigation.navigate('CaptainsLog')} activeOpacity={0.8}>
          <Text style={s.utilityIcon}>📖</Text>
          <Text style={s.utilityLabel}>LOGBOOK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.utilityCard} onPress={() => navigation.navigate('Shop')} activeOpacity={0.8}>
          <Text style={s.utilityIcon}>⊕</Text>
          <Text style={s.utilityLabel}>SHOP</Text>
        </TouchableOpacity>
      </View>

      <HomePortPicker visible={showPicker} onClose={() => setShowPicker(false)}/>
    </ScrollView>
  )
}
