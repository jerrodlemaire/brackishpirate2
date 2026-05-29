import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
} from 'react-native'
import Svg, { Path, Circle, Line, G, Text as SvgText } from 'react-native-svg'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { getSolunarForDate, getMoonData, getSunData, buildMoonAltitudeCurve } from '../../utils/solunar'
import { useDataLocation } from '../../hooks/useDataLocation'
import DayStrip from '../../components/DayStrip'
import LocationChip from '../../components/LocationChip'
import LocationPickerModal from '../../components/LocationPickerModal'

const { width } = Dimensions.get('window')

// ── Moon altitude chart ───────────────────────────────────────────────────────
const MOON_CHART_W   = width - 64
const MOON_CHART_H   = 148
const MOON_PAD_L     = 14
const MOON_PAD_R     = 14
const MOON_PAD_T     = 16
const MOON_PAD_B     = 40
const MOON_PLOT_W    = MOON_CHART_W - MOON_PAD_L - MOON_PAD_R
const MOON_PLOT_H    = MOON_CHART_H - MOON_PAD_T - MOON_PAD_B
const MOON_HORIZON_Y = MOON_PAD_T + MOON_PLOT_H * 0.55

function MoonAltitudeChart({ samples, moon, Colors }) {
  const ALT_MAX = 60
  const ALT_MIN = -60

  const toY = (alt) => {
    const clamped = Math.max(ALT_MIN, Math.min(ALT_MAX, alt))
    if (clamped >= 0) {
      const upRange = MOON_HORIZON_Y - MOON_PAD_T
      return MOON_HORIZON_Y - (clamped / ALT_MAX) * upRange
    } else {
      const dnRange = (MOON_PAD_T + MOON_PLOT_H) - MOON_HORIZON_Y
      return MOON_HORIZON_Y + (-clamped / Math.abs(ALT_MIN)) * dnRange
    }
  }
  const toX = (h) => MOON_PAD_L + (h / 24) * MOON_PLOT_W

  const pts = samples.map(s => ({ x: toX(s.hour), y: toY(s.altitude), alt: s.altitude, hour: s.hour }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const fillPath = [
    `M ${pts[0].x.toFixed(1)},${MOON_HORIZON_Y.toFixed(1)}`,
    ...pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L ${pts[pts.length - 1].x.toFixed(1)},${MOON_HORIZON_Y.toFixed(1)}`,
    'Z',
  ].join(' ')

  const crossings = []
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1].alt
    const curr = pts[i].alt
    if (prev < 0 && curr >= 0) {
      const t = -prev / (curr - prev)
      const x = pts[i - 1].x + t * (pts[i].x - pts[i - 1].x)
      crossings.push({ x, type: 'rise' })
    } else if (prev > 0 && curr <= 0) {
      const t = prev / (prev - curr)
      const x = pts[i - 1].x + t * (pts[i].x - pts[i - 1].x)
      crossings.push({ x, type: 'set' })
    }
  }

  const now = new Date()
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const isToday = samples.length > 0 && (now - dayStart) < 24 * 3600 * 1000
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowX = toX(nowHour)
  const i0 = Math.floor(nowHour)
  const frac = nowHour - i0
  const nowAlt = samples[i0] && samples[i0 + 1]
    ? samples[i0].altitude + frac * (samples[i0 + 1].altitude - samples[i0].altitude)
    : 0
  const nowY = toY(nowAlt)
  const showNow = isToday

  return (
    <Svg width={MOON_CHART_W} height={MOON_CHART_H}>
      <Path
        d={fillPath}
        fill={Colors.brackishWater}
        fillRule="evenodd"
        opacity={0.22}
      />
      <Line
        x1={MOON_PAD_L}
        y1={MOON_HORIZON_Y}
        x2={MOON_PAD_L + MOON_PLOT_W}
        y2={MOON_HORIZON_Y}
        stroke={Colors.border}
        strokeWidth={1}
      />
      <Path
        d={linePath}
        fill="none"
        stroke={Colors.brackishWater}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {crossings.map((c, i) => {
        const labelX  = c.type === 'rise' ? c.x + 7 : c.x - 7
        const anchor  = c.type === 'rise' ? 'start' : 'end'
        return (
          <G key={i}>
            <Circle
              cx={c.x}
              cy={MOON_HORIZON_Y}
              r={4}
              fill={Colors.cardBg}
              stroke={Colors.doubloonGold}
              strokeWidth={1.5}
            />
            <SvgText x={labelX} y={MOON_HORIZON_Y + 15} textAnchor={anchor}
              fontSize={10} fontWeight="600" fill={Colors.textSecondary}>
              {c.type === 'rise' ? 'Moonrise' : 'Moonset'}
            </SvgText>
            <SvgText x={labelX} y={MOON_HORIZON_Y + 29} textAnchor={anchor}
              fontSize={11} fontWeight="600" fill={Colors.textPrimary}>
              {c.type === 'rise' ? moon?.moonrise : moon?.moonset}
            </SvgText>
          </G>
        )
      })}
      {showNow && (
        <G>
          <Circle cx={nowX} cy={nowY} r={6} fill={Colors.brackishWater} stroke={Colors.cardBg} strokeWidth={1.5} />
        </G>
      )}
    </Svg>
  )
}

// ── Sun arc chart ─────────────────────────────────────────────────────────────
const SUN_CHART_W   = width - 64
const SUN_CHART_H   = 200
const SUN_PAD_L     = 14
const SUN_PAD_R     = 14
const SUN_PAD_T     = 0
const SUN_PAD_B     = 22
const SUN_PLOT_W    = SUN_CHART_W - SUN_PAD_L - SUN_PAD_R
const SUN_PLOT_H    = SUN_CHART_H - SUN_PAD_T - SUN_PAD_B
const SUN_EQUATOR_Y = SUN_PAD_T + SUN_PLOT_H * 0.5

function dateToSunX(date, dayStart) {
  if (!date || isNaN(date.getTime())) return null
  const elapsed = (date - dayStart) / (24 * 3600 * 1000)
  if (elapsed < 0 || elapsed > 1) return null
  return SUN_PAD_L + elapsed * SUN_PLOT_W
}

function SunArcChart({ sun, selectedDate, Colors }) {
  const dayStart = new Date(selectedDate)
  dayStart.setHours(0, 0, 0, 0)

  const ARC_TOP    = SUN_PAD_T + 18
  const ARC_BOTTOM = SUN_PAD_T + SUN_PLOT_H - 12

  const samples = []
  const N = 49
  for (let i = 0; i < N; i++) {
    const frac = i / (N - 1)
    const x = SUN_PAD_L + frac * SUN_PLOT_W
    let altNorm
    if (sun.sunriseDate && sun.sunsetDate) {
      const noonFrac = ((sun.sunriseDate - dayStart) / (24 * 3600 * 1000)
                      + (sun.sunsetDate  - dayStart) / (24 * 3600 * 1000)) / 2
      const dayLen  = (sun.sunsetDate - sun.sunriseDate) / (24 * 3600 * 1000)
      const phi = (frac - noonFrac) * Math.PI / dayLen
      altNorm = Math.cos(phi)
    } else {
      altNorm = Math.cos((frac - 0.5) * Math.PI * 2)
    }
    const y = SUN_EQUATOR_Y - altNorm * Math.max(SUN_EQUATOR_Y - ARC_TOP, ARC_BOTTOM - SUN_EQUATOR_Y)
    samples.push({ x, y, frac })
  }
  const arcPath = samples.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const dateToArcXY = (date) => {
    const x = dateToSunX(date, dayStart)
    if (x == null) return null
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].x >= x) {
        const a = samples[i - 1], b = samples[i]
        const t = (x - a.x) / (b.x - a.x || 1)
        return { x, y: a.y + t * (b.y - a.y) }
      }
    }
    return { x, y: samples[samples.length - 1].y }
  }

  const nauticalDawnP = dateToArcXY(sun.nauticalDawnDate)
  const dawnP         = dateToArcXY(sun.dawnDate)
  const sunriseP      = dateToArcXY(sun.sunriseDate)
  const sunsetP       = dateToArcXY(sun.sunsetDate)
  const duskP         = dateToArcXY(sun.duskDate)
  const nauticalDuskP = dateToArcXY(sun.nauticalDuskDate)

  const now = new Date()
  const showNow = now >= dayStart && now < new Date(dayStart.getTime() + 24 * 3600 * 1000)
  const nowP = showNow ? dateToArcXY(now) : null

  const earthR  = 72
  const earthCx = SUN_PAD_L + SUN_PLOT_W / 2
  const earthCy = SUN_EQUATOR_Y

  const C_SUN      = Colors.doubloonGold
  const C_CIVIL    = '#a78bfa'
  const C_NAUTICAL = '#60a5fa'

  return (
    <Svg width={SUN_CHART_W} height={SUN_CHART_H}>
      {/* Earth: top half = day (lit), bottom half = night (dark) */}
      <Path
        d={`M ${earthCx - earthR},${earthCy} A ${earthR},${earthR} 0 0 0 ${earthCx + earthR},${earthCy} Z`}
        fill="#1b3352"
      />
      <Path
        d={`M ${earthCx - earthR},${earthCy} A ${earthR},${earthR} 0 0 1 ${earthCx + earthR},${earthCy} Z`}
        fill="#0c1e2e"
      />
      <Circle cx={earthCx} cy={earthCy} r={earthR} fill="none" stroke="#2a4a68" strokeWidth={0.75} />
      <Line
        x1={SUN_PAD_L}
        y1={SUN_EQUATOR_Y}
        x2={SUN_PAD_L + SUN_PLOT_W}
        y2={SUN_EQUATOR_Y}
        stroke={C_SUN}
        strokeWidth={1}
        opacity={0.55}
      />
      <Path
        d={arcPath}
        fill="none"
        stroke={C_SUN}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {nauticalDawnP && (
        <Circle cx={nauticalDawnP.x} cy={nauticalDawnP.y} r={3.5} fill={Colors.cardBg} stroke={C_NAUTICAL} strokeWidth={1.4} />
      )}
      {dawnP && (
        <Circle cx={dawnP.x} cy={dawnP.y} r={3.5} fill={Colors.cardBg} stroke={C_CIVIL} strokeWidth={1.4} />
      )}
      {sunriseP && (
        <Circle cx={sunriseP.x} cy={sunriseP.y} r={4} fill={Colors.cardBg} stroke={C_SUN} strokeWidth={1.6} />
      )}
      {sunsetP && (
        <Circle cx={sunsetP.x} cy={sunsetP.y} r={4} fill={Colors.cardBg} stroke={C_SUN} strokeWidth={1.6} />
      )}
      {duskP && (
        <Circle cx={duskP.x} cy={duskP.y} r={3.5} fill={Colors.cardBg} stroke={C_CIVIL} strokeWidth={1.4} />
      )}
      {nauticalDuskP && (
        <Circle cx={nauticalDuskP.x} cy={nauticalDuskP.y} r={3.5} fill={Colors.cardBg} stroke={C_NAUTICAL} strokeWidth={1.4} />
      )}
      {nowP && (
        <Circle cx={nowP.x} cy={nowP.y} r={8} fill={C_SUN} />
      )}
    </Svg>
  )
}

function SunArcLabels({ sun, selectedDate, Colors }) {
  const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0)
  const sunriseX = dateToSunX(sun.sunriseDate, dayStart)
  const sunsetX  = dateToSunX(sun.sunsetDate,  dayStart)

  const labelStyle = {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: Colors.doubloonGold,
  }

  return (
    <>
      {sunriseX != null && (
        <Text style={[labelStyle, { left: sunriseX - 26, top: SUN_EQUATOR_Y - 24 }]}>
          ↑ {sun.sunrise.replace(' ', '').toLowerCase()}
        </Text>
      )}
      {sunsetX != null && (
        <Text style={[labelStyle, { left: sunsetX - 26, top: SUN_EQUATOR_Y - 24 }]}>
          ↓ {sun.sunset.replace(' ', '').toLowerCase()}
        </Text>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function SolunarScreen() {
  const { Colors } = useTheme()
  const { solunarLocation, setSolunarLocation } = useDataLocation()
  const [selectedDate,       setSelectedDate]       = useState(new Date())
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const sol = useMemo(
    () => getSolunarForDate(selectedDate, solunarLocation.lat, solunarLocation.lng),
    [selectedDate, solunarLocation]
  )
  const moon = useMemo(
    () => getMoonData(selectedDate, solunarLocation.lat, solunarLocation.lng),
    [selectedDate, solunarLocation]
  )
  const sun = useMemo(
    () => getSunData(selectedDate, solunarLocation.lat, solunarLocation.lng),
    [selectedDate, solunarLocation]
  )
  const moonCurve = useMemo(
    () => buildMoonAltitudeCurve(selectedDate, solunarLocation.lat, solunarLocation.lng),
    [selectedDate, solunarLocation]
  )

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },

    topbar:        { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12 },
    topbarTitle:   { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5 },

    content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },

    banner:        { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    bannerHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    bannerTitle:   { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginLeft: 8 },
    bannerTitleRow:{ flexDirection: 'row', alignItems: 'center' },
    bannerIcon:    { fontSize: 22 },
    bannerMeta:    { fontSize: Typography.xs, color: Colors.textMuted },

    moonHero:      { paddingBottom: Spacing.md, marginBottom: 8 },
    moonImageWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
    moonEmoji:     { fontSize: 96 },
    daysToFull:    { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 10, letterSpacing: 0.2 },
    daysToFullVal: { color: Colors.textPrimary, fontWeight: '600' },

    riseSetRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8, marginBottom: 12 },
    riseSetItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    riseSetLabel:  { fontSize: Typography.xs, color: Colors.textSecondary },
    riseSetVal:    { fontSize: Typography.xs, color: Colors.textPrimary, fontWeight: '600' },
    riseSetIcon:   { fontSize: 14, color: Colors.textSecondary },

    tileGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tile:          { flex: 1, minWidth: '47%', backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8 },
    tileWide:      { minWidth: '100%' },
    tileLabelRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    tileLabel:     { fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
    tileVal:       { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
    tileUnit:      { fontSize: 11, color: Colors.textMuted, fontWeight: '400' },
    tileDot:       { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },

    sunChartWrap:  { position: 'relative', marginBottom: 14, marginHorizontal: -Spacing.lg, alignItems: 'center' },

    dnRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
    dnCard:        { flex: 1, backgroundColor: Colors.inputBg, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    dnIcon:        { fontSize: 16 },
    dnLabel:       { fontSize: 10, color: Colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
    dnVal:         { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  }), [Colors])

  const C_SUN      = Colors.doubloonGold
  const C_CIVIL    = '#a78bfa'
  const C_NAUTICAL = '#60a5fa'

  return (
    <View style={s.container}>

      <View style={[s.topbar, { paddingTop: 10 }]}>
        <Text style={s.topbarTitle}>Solunar</Text>
        <LocationChip
          label={solunarLocation.name}
          onPress={() => setShowLocationPicker(true)}
          color={Colors.catFish}
          boneColor={Colors.topbarBg}
        />
      </View>

      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} />

      <ScrollView contentContainerStyle={s.content}>

        {/* ═══ MOON BANNER ═══ */}
        <View style={s.banner}>
          <View style={s.bannerHeader}>
            <View style={s.bannerTitleRow}>
              <Text style={s.bannerIcon}>{sol.moonPhase.emoji}</Text>
              <Text style={s.bannerTitle}>Moon</Text>
            </View>
            <Text style={s.bannerMeta}>Up {moon.upDuration} today</Text>
          </View>

          <View style={s.moonHero}>
            <View style={s.moonImageWrap}>
              <Text style={s.moonEmoji}>{sol.moonPhase.emoji}</Text>
              <Text style={s.daysToFull}>
                Days to full <Text style={s.daysToFullVal}>{sol.daysToFull}</Text>
              </Text>
            </View>
            <MoonAltitudeChart samples={moonCurve} moon={moon} Colors={Colors} />
          </View>

          <View style={s.riseSetRow}>
            <View style={s.riseSetItem}>
              <Text style={s.riseSetIcon}>↗</Text>
              <Text style={s.riseSetLabel}>Moonrise</Text>
              <Text style={s.riseSetVal}>{moon.moonrise}</Text>
            </View>
            <View style={s.riseSetItem}>
              <Text style={s.riseSetIcon}>↘</Text>
              <Text style={s.riseSetLabel}>Moonset</Text>
              <Text style={s.riseSetVal}>{moon.moonset}</Text>
            </View>
          </View>

          <View style={s.tileGrid}>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Distance</Text>
              <Text style={s.tileVal}>
                {moon.distanceNM.toLocaleString()}{' '}
                <Text style={s.tileUnit}>NM</Text>
              </Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Illumination</Text>
              <Text style={s.tileVal}>
                {sol.illumination}<Text style={s.tileUnit}>%</Text>
              </Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Age</Text>
              <Text style={s.tileVal}>
                {moon.age} <Text style={s.tileUnit}>days</Text>
              </Text>
            </View>
            <View style={s.tile}>
              <Text style={s.tileLabel}>Phase</Text>
              <Text style={s.tileVal}>{sol.moonPhase.name}</Text>
            </View>
          </View>
        </View>

        {/* ═══ SUN BANNER ═══ */}
        <View style={s.banner}>
          <View style={s.bannerHeader}>
            <View style={s.bannerTitleRow}>
              <Text style={s.bannerIcon}>☀️</Text>
              <Text style={s.bannerTitle}>Sun</Text>
            </View>
            <Text style={s.bannerMeta}>{sun.dayDuration} daylight</Text>
          </View>

          <View style={s.sunChartWrap}>
            <SunArcChart sun={sun} selectedDate={selectedDate} Colors={Colors} />
            <SunArcLabels sun={sun} selectedDate={selectedDate} Colors={Colors} />
          </View>

          <View style={s.dnRow}>
            <View style={s.dnCard}>
              <Text style={s.dnIcon}>☀️</Text>
              <View>
                <Text style={s.dnLabel}>Day</Text>
                <Text style={s.dnVal}>{sun.dayDuration}</Text>
              </View>
            </View>
            <View style={s.dnCard}>
              <Text style={s.dnIcon}>🌙</Text>
              <View>
                <Text style={s.dnLabel}>Night</Text>
                <Text style={s.dnVal}>{sun.nightDuration}</Text>
              </View>
            </View>
          </View>

          <View style={s.tileGrid}>
            <View style={s.tile}>
              <View style={s.tileLabelRow}>
                <View style={[s.tileDot, { borderColor: C_CIVIL }]} />
                <Text style={s.tileLabel}>Dawn</Text>
              </View>
              <Text style={s.tileVal}>{sun.dawn}</Text>
            </View>
            <View style={s.tile}>
              <View style={s.tileLabelRow}>
                <View style={[s.tileDot, { borderColor: C_SUN }]} />
                <Text style={s.tileLabel}>Sunrise</Text>
              </View>
              <Text style={s.tileVal}>{sun.sunrise}</Text>
            </View>
            <View style={s.tile}>
              <View style={s.tileLabelRow}>
                <View style={[s.tileDot, { borderColor: C_SUN }]} />
                <Text style={s.tileLabel}>Sunset</Text>
              </View>
              <Text style={s.tileVal}>{sun.sunset}</Text>
            </View>
            <View style={s.tile}>
              <View style={s.tileLabelRow}>
                <View style={[s.tileDot, { borderColor: C_CIVIL }]} />
                <Text style={s.tileLabel}>Dusk</Text>
              </View>
              <Text style={s.tileVal}>{sun.dusk}</Text>
            </View>
            <View style={[s.tile, s.tileWide]}>
              <View style={s.tileLabelRow}>
                <View style={[s.tileDot, { borderColor: C_NAUTICAL }]} />
                <Text style={s.tileLabel}>Nautical twilight</Text>
              </View>
              <Text style={s.tileVal}>
                {sun.nauticalDawn} <Text style={s.tileUnit}>– {sun.nauticalDusk}</Text>
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(lat, lng, name) => setSolunarLocation(lat, lng, name)}
        title="Set Solunar Location"
        initialLat={solunarLocation.lat}
        initialLng={solunarLocation.lng}
      />

    </View>
  )
}
