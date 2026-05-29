import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, Switch,
  Linking, AppState, Dimensions, Platform,
} from 'react-native'
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import {
  getSolunarForDate,
  buildCompositeCurve, peakWeightedAverage,
  scoreColor, scoreLabel,
  WINDOW, DEFAULT_ALERTS,
} from '../../utils/solunar'
import { fetchTideHourly } from '../../utils/tides'
import { fetchPressureTrend } from '../../utils/weather'
import { smoothBezierPath, smoothAreaPath } from '../../utils/chart'
import { getPermissionStatus, requestPermission, scheduleFeedingAlerts, cancelFeedingAlerts } from '../../utils/alerts'
import { useDataLocation } from '../../hooks/useDataLocation'
import { useApp } from '../../context/AppContext'
import ActivityGauge from '../../components/ActivityGauge'
import DayStrip from '../../components/DayStrip'
import LocationChip from '../../components/LocationChip'
import TideStationPickerModal from '../../components/TideStationPickerModal'

const { width } = Dimensions.get('window')
const CHART_W   = width - 64
const CHART_H   = 200
const PAD_L     = 38
const PAD_R     = 12
const PAD_T     = 12
const PAD_B     = 28
const PLOT_W    = CHART_W - PAD_L - PAD_R
const PLOT_H    = CHART_H - PAD_T - PAD_B

const X_LABELS = [
  { label: '4:00am',  h: 4  },
  { label: '8:00am',  h: 8  },
  { label: '12:00pm', h: 12 },
  { label: '4:00pm',  h: 16 },
  { label: '8:00pm',  h: 20 },
]

const Y_GRID = [
  { label: 'High', v: 88 },
  { label: 'Med',  v: 55 },
  { label: 'Low',  v: 22 },
]

const CURVE_GREEN  = '#5DCAA5'  // trendUp
const NOW_GOLD     = '#F5D77A'
const PREFS_KEY    = 'bp_alert_prefs'

// ── Helpers ───────────────────────────────────────────────────────────────────
function hToX(h) {
  return PAD_L + ((h - WINDOW.START) / (WINDOW.END - WINDOW.START)) * PLOT_W
}
function vToY(v) {
  return PAD_T + PLOT_H * (1 - v / 100)
}
function interpolate(curve, decHour) {
  const lo   = Math.floor(decHour)
  const hi   = Math.min(Math.ceil(decHour), curve.length - 1)
  const frac = decHour - lo
  return (curve[lo] ?? 0) * (1 - frac) + (curve[hi] ?? 0) * frac
}

function isSameDay(a, b) { return a.toDateString() === b.toDateString() }

function formatHour(decHour) {
  const h   = Math.floor(decHour)
  const m   = Math.floor((decHour - h) * 60)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${m.toString().padStart(2, '0')}` : ''}${ampm}`
}

// ── Activity chart ─────────────────────────────────────────────────────────────
function ActivityChart({ curve, sol, showMajor, showMinor, onToggleMajor, onToggleMinor, isToday, nowTime, Colors }) {
  const pts = useMemo(() => (
    Array.from({ length: WINDOW.END - WINDOW.START + 1 }, (_, i) => {
      const h = WINDOW.START + i
      return { x: hToX(h), y: vToY(curve[h] ?? 0) }
    })
  ), [curve])

  const linePath = smoothBezierPath(pts)
  const areaPath = smoothAreaPath(pts, CHART_H - PAD_B)

  // Windows for dots and bands
  const windowDefs = [
    { ...sol.major1, type: 'major' },
    { ...sol.major2, type: 'major' },
    { ...sol.minor1, type: 'minor' },
    { ...sol.minor2, type: 'minor' },
  ]

  const peakDots = windowDefs.map((w, i) => {
    const centerH = (w.startH + w.endH) / 2
    if (centerH < WINDOW.START || centerH > WINDOW.END) return null
    const isMaj  = w.type === 'major'
    const active = isMaj ? showMajor : showMinor
    const color  = isMaj ? Colors.doubloonGold : Colors.brackishWater
    return {
      key: i, x: hToX(centerH), y: vToY(interpolate(curve, centerH)),
      color, active, isMaj,
    }
  }).filter(Boolean)

  const bands = windowDefs
    .filter(w => (w.type === 'major' ? showMajor : showMinor))
    .map((w, i) => {
      const x0    = hToX(Math.max(w.startH, WINDOW.START))
      const x1    = hToX(Math.min(w.endH,   WINDOW.END))
      const cx_   = (x0 + x1) / 2
      const color = w.type === 'major' ? Colors.doubloonGold : Colors.brackishWater
      return { key: i, x0, x1, cx: cx_, color }
    })

  // Now marker
  const nowDec     = nowTime.getHours() + nowTime.getMinutes() / 60
  const showNow    = isToday && nowDec >= WINDOW.START && nowDec <= WINDOW.END
  const nowX       = showNow ? hToX(nowDec) : 0
  const nowY       = showNow ? vToY(interpolate(curve, nowDec)) : 0
  const nowTierLabel = showNow ? scoreLabel(Math.round(interpolate(curve, nowDec))) : ''

  return (
    <View>
      {showNow && (
        <Text style={{ fontSize: 9, color: NOW_GOLD, textAlign: 'right', marginBottom: 2, paddingRight: PAD_R }}>
          now {formatHour(nowDec)} · {nowTierLabel.toLowerCase()}
        </Text>
      )}
      <View style={{ height: CHART_H, width: CHART_W }}>
        <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={CURVE_GREEN} stopOpacity="0.35"/>
              <Stop offset="1" stopColor={CURVE_GREEN} stopOpacity="0.03"/>
            </LinearGradient>
          </Defs>

          {Y_GRID.map(g => (
            <Path key={g.label}
              d={`M ${PAD_L},${vToY(g.v).toFixed(1)} L ${CHART_W - PAD_R},${vToY(g.v).toFixed(1)}`}
              stroke={Colors.border} strokeWidth="0.5"
            />
          ))}

          {bands.map(b => (
            <G key={b.key}>
              <Path
                d={`M ${b.x0.toFixed(1)},${PAD_T} L ${b.x1.toFixed(1)},${PAD_T} L ${b.x1.toFixed(1)},${CHART_H - PAD_B} L ${b.x0.toFixed(1)},${CHART_H - PAD_B} Z`}
                fill={b.color} fillOpacity="0.1"
              />
              <Path
                d={`M ${b.cx.toFixed(1)},${PAD_T} L ${b.cx.toFixed(1)},${CHART_H - PAD_B}`}
                stroke={b.color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
              />
            </G>
          ))}

          <Path d={areaPath} fill="url(#actGrad)"/>
          <Path d={linePath} fill="none" stroke={CURVE_GREEN} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"/>

          {showNow && (
            <Path
              d={`M ${nowX.toFixed(1)},${nowY.toFixed(1)} L ${nowX.toFixed(1)},${(CHART_H - PAD_B).toFixed(1)}`}
              stroke={NOW_GOLD} strokeWidth="1" strokeDasharray="3,3" opacity="0.6"
            />
          )}

          {peakDots.map(dot => (
            <G key={dot.key}>
              <Circle cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r="12" fill="transparent"
                onPress={() => dot.isMaj ? onToggleMajor() : onToggleMinor()}/>
              <Circle cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r="5"
                fill={dot.active ? dot.color : 'transparent'}
                stroke={dot.color} strokeWidth="1.5"
              />
            </G>
          ))}

          {showNow && (
            <Circle cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="3" fill={NOW_GOLD}/>
          )}
        </Svg>

        {Y_GRID.map(g => (
          <Text key={g.label} style={{
            position: 'absolute', left: 0, top: vToY(g.v) - 7,
            width: PAD_L - 4, textAlign: 'right',
            fontSize: 9, fontWeight: '700', color: Colors.textMuted,
          }}>
            {g.label}
          </Text>
        ))}

        {showNow && (
          // scaleX must live on the wrapping View — a transform on the <Text>
          // itself does not mirror the emoji glyph on iOS. Flips the natural
          // left-facing 🐟 to face right (its direction of travel).
          <View style={{ position: 'absolute', left: nowX - 7, top: nowY - 14, transform: [{ scaleX: -1 }] }}>
            <Text style={{ fontSize: 11 }}>🐟</Text>
          </View>
        )}

        {X_LABELS.map(({ label, h }) => (
          <Text key={label} numberOfLines={1} style={{
            position: 'absolute', left: hToX(h) - 28, top: CHART_H - PAD_B + 4,
            width: 56, textAlign: 'center', fontSize: 9, fontWeight: '700',
            color: Colors.textMuted,
          }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ── Window box ────────────────────────────────────────────────────────────────
function WindowBox({ type, w1, w2, active, onToggle, Colors }) {
  const isMaj  = type === 'major'
  const color  = isMaj ? Colors.doubloonGold : Colors.brackishWater
  const border = active ? color : Colors.border
  const bg     = active ? `${color}14` : Colors.cardBg

  const FishIcon = () => (
    <Text style={{ fontSize: isMaj ? 24 : 18, lineHeight: 26 }}>🐟</Text>
  )

  return (
    <TouchableOpacity
      style={{ flex: 1, backgroundColor: bg, borderRadius: Radius.lg, borderWidth: 1, borderColor: border, padding: 12, gap: 6 }}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <FishIcon/>
        <Text style={{ fontSize: Typography.xs, fontWeight: '700', color, letterSpacing: 0.8 }}>
          {isMaj ? 'MAJOR' : 'MINOR'}
        </Text>
      </View>
      <Text style={{ fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 18 }}>
        {w1.start} – {w1.end}
      </Text>
      <Text style={{ fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 18 }}>
        {w2.start} – {w2.end}
      </Text>
    </TouchableOpacity>
  )
}

// ── Bell icon ─────────────────────────────────────────────────────────────────
function BellIcon({ state }) {
  const { Colors } = useTheme()
  if (state === 'on')      return <Text style={{ fontSize: 20, color: Colors.catFish }}>🔔</Text>
  if (state === 'blocked') return (
    <View>
      <Text style={{ fontSize: 20, color: Colors.danger }}>🔔</Text>
      <Text style={{ position: 'absolute', right: -4, top: -4, fontSize: 9, color: Colors.danger, fontWeight: '900' }}>!</Text>
    </View>
  )
  return <Text style={{ fontSize: 20, color: Colors.textMuted }}>🔔</Text>
}

// ── Alert preferences sheet ───────────────────────────────────────────────────
function AlertPrefsSheet({ visible, onClose, prefs, setPrefs, osPermission, Colors }) {
  const LEAD_OPTIONS = [
    { label: 'At start',     value: 0  },
    { label: '15 min before', value: 15 },
    { label: '30 min before', value: 30 },
  ]

  const statusColor = osPermission === 'granted' ? Colors.marshGreen : Colors.danger
  const statusLabel = osPermission === 'granted'
    ? 'Alerts active'
    : osPermission === 'denied'
      ? 'Alerts blocked by device Settings'
      : 'Notification permission not yet granted'

  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen">
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
      <View style={{ backgroundColor: Colors.deepSea, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md }}>
        <Text style={{ fontSize: Typography.lg, fontWeight: '700', color: Colors.textOnDark, fontFamily: 'Georgia' }}>
          Feeding window alerts
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Text style={{ fontSize: Typography.base, color: Colors.textOnDark }}>Major windows</Text>
          <Switch
            value={prefs.major}
            onValueChange={v => setPrefs(p => ({ ...p, major: v }))}
            trackColor={{ true: Colors.catFish, false: Colors.borderMid }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
          <Text style={{ fontSize: Typography.base, color: Colors.textOnDark }}>Minor windows</Text>
          <Switch
            value={prefs.minor}
            onValueChange={v => setPrefs(p => ({ ...p, minor: v }))}
            trackColor={{ true: Colors.brackishWater, false: Colors.borderMid }}
          />
        </View>

        <Text style={{ fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 4 }}>
          LEAD TIME
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {LEAD_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.value}
              style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1,
                borderColor: prefs.leadMinutes === opt.value ? Colors.catFish : Colors.border,
                backgroundColor: prefs.leadMinutes === opt.value ? `${Colors.catFish}22` : Colors.inputBg,
              }}
              onPress={() => setPrefs(p => ({ ...p, leadMinutes: opt.value }))}
            >
              <Text style={{ fontSize: Typography.sm, fontWeight: '600', color: prefs.leadMinutes === opt.value ? Colors.catFish : Colors.textSecondary }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 12,
          backgroundColor: `${statusColor}14`, borderRadius: Radius.md, borderWidth: 0.5, borderColor: statusColor }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }}/>
          <Text style={{ fontSize: Typography.sm, color: statusColor, flex: 1 }}>{statusLabel}</Text>
          {osPermission === 'denied' && (
            <TouchableOpacity onPress={() => Linking.openSettings()}>
              <Text style={{ fontSize: Typography.sm, color: statusColor, fontWeight: '700' }}>Open ↗</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={onClose} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: Typography.base, color: Colors.textSecondary }}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// ── Soft pre-prompt modal ─────────────────────────────────────────────────────
function SoftPrePromptModal({ visible, onAllow, onDismiss, Colors }) {
  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: Colors.deepSea, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🔔</Text>
          <Text style={{ fontSize: Typography.lg, fontWeight: '700', color: Colors.textOnDark, fontFamily: 'Georgia', textAlign: 'center' }}>
            Get a heads-up before the bite
          </Text>
          <Text style={{ fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            Brackish Pirate can alert you 15 minutes before major and minor feeding windows at your Home Port. Notifications stay on your device — we don't send marketing or share anything.
          </Text>
          <TouchableOpacity style={{ backgroundColor: Colors.buttonBg, borderRadius: Radius.md, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 4 }}
            onPress={onAllow}>
            <Text style={{ fontSize: Typography.base, color: Colors.buttonText, fontWeight: '700' }}>Turn on alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ paddingVertical: 8 }}>
            <Text style={{ fontSize: Typography.base, color: Colors.textMuted }}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Open Settings modal ───────────────────────────────────────────────────────
function OpenSettingsModal({ visible, onDismiss, Colors }) {
  return (
    <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: Colors.deepSea, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>🔕</Text>
          <Text style={{ fontSize: Typography.lg, fontWeight: '700', color: Colors.textOnDark, fontFamily: 'Georgia', textAlign: 'center' }}>
            Turn on notifications
          </Text>
          <Text style={{ fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            {`To get feeding-window alerts, Brackish Pirate needs notifications enabled in your ${Platform.OS === 'ios' ? 'iPhone' : 'phone\'s'} Settings.`}
          </Text>
          <View style={{ width: '100%', gap: 8, backgroundColor: Colors.inputBg, borderRadius: Radius.md, padding: 12 }}>
            {['Tap Open Settings below', 'Tap Notifications', 'Turn on Allow Notifications'].map((step, i) => (
              <Text key={i} style={{ fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 }}>
                {i + 1}. {step}
              </Text>
            ))}
          </View>
          <TouchableOpacity style={{ backgroundColor: Colors.danger, borderRadius: Radius.md, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 4 }}
            onPress={() => Linking.openSettings()}>
            <Text style={{ fontSize: Typography.base, color: Colors.textOnDark, fontWeight: '700' }}>Open Settings ↗</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={{ paddingVertical: 8 }}>
            <Text style={{ fontSize: Typography.base, color: Colors.textMuted }}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function FishActivityScreen() {
  const { Colors }        = useTheme()
  const { homePort }      = useApp()
  const { tideStation, setTideStation, solunarLocation } = useDataLocation()
  const today             = useRef(new Date()).current

  const [selectedDate,      setSelectedDate]      = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [tideHourly,        setTideHourly]        = useState([])
  const [dP,                setDP]                = useState(0)
  const [loading,           setLoading]           = useState(true)
  const [chartLoading,      setChartLoading]      = useState(false)
  const [refreshing,        setRefreshing]        = useState(false)
  const hasLoadedOnce = useRef(false)
  const [showMajor,         setShowMajor]         = useState(false)
  const [showMinor,         setShowMinor]         = useState(false)
  const [nowTime,           setNowTime]           = useState(new Date())
  const [showStationPicker, setShowStationPicker] = useState(false)
  const [infoVisible,       setInfoVisible]       = useState(false)

  // Alert state
  const [prefs,              setPrefsState]       = useState(DEFAULT_ALERTS)
  const [osPermission,       setOsPermission]     = useState('undetermined')
  const [alertPrefsVisible,  setAlertPrefsVisible] = useState(false)
  const [softPrePromptVis,   setSoftPrePromptVis]  = useState(false)
  const [openSettingsVis,    setOpenSettingsVis]   = useState(false)

  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  // Load persisted prefs
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then(raw => {
      if (raw) {
        try { setPrefsState(JSON.parse(raw)) } catch (_) {}
      }
    })
    getPermissionStatus().then(setOsPermission)
  }, [])

  // Persist prefs + reschedule on change
  const setPrefs = useCallback((updater) => {
    setPrefsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  // Reschedule whenever prefs / permission / homePort change
  useEffect(() => {
    if (osPermission !== 'granted') {
      if (!prefs.major && !prefs.minor) return
      cancelFeedingAlerts().catch(() => {})
      return
    }
    scheduleFeedingAlerts(prefs, homePort.name, solunarLocation.lat, solunarLocation.lng).catch(() => {})
  }, [prefs, osPermission, homePort.name, solunarLocation.lat, solunarLocation.lng])

  // Re-check permission on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return
      getPermissionStatus().then(status => {
        setOsPermission(status)
        if (status === 'granted' && (prefsRef.current.major || prefsRef.current.minor)) {
          scheduleFeedingAlerts(prefsRef.current, homePort.name, solunarLocation.lat, solunarLocation.lng).catch(() => {})
        } else if (status !== 'granted') {
          cancelFeedingAlerts().catch(() => {})
        }
      })
    })
    return () => sub.remove()
  }, [homePort.name, solunarLocation.lat, solunarLocation.lng])

  // Now marker timer
  useEffect(() => {
    const id = setInterval(() => setNowTime(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Data load
  const loadData = useCallback(async (date) => {
    try {
      const [hourly, pressureData] = await Promise.all([
        fetchTideHourly(date, tideStation.id),
        fetchPressureTrend(solunarLocation.lat, solunarLocation.lng),
      ])
      setTideHourly(hourly)
      setDP(pressureData.dP)
    } catch (e) {
      console.log('FishActivity fetch error:', e)
    } finally {
      setLoading(false)
      setChartLoading(false)
      setRefreshing(false)
      hasLoadedOnce.current = true
    }
  }, [tideStation.id, solunarLocation.lat, solunarLocation.lng])

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      setLoading(true)
    } else {
      setChartLoading(true)
    }
    loadData(selectedDate)
  }, [selectedDate, loadData])

  // Derived data
  const sol           = useMemo(() => getSolunarForDate(selectedDate, solunarLocation.lat, solunarLocation.lng), [selectedDate, solunarLocation.lat, solunarLocation.lng])
  const curve         = useMemo(() => buildCompositeCurve(sol, tideHourly, dP), [sol, tideHourly, dP])
  const dayAverage    = useMemo(() => peakWeightedAverage(curve), [curve])
  const isToday       = useMemo(() => isSameDay(selectedDate, today), [selectedDate])

  // Bell state
  const alertsWanted  = prefs.major || prefs.minor
  const bellState     = !alertsWanted ? 'off' : osPermission === 'granted' ? 'on' : 'blocked'

  // Bell tap handler
  const handleBellPress = useCallback(async () => {
    if (!alertsWanted) {
      // Activating from off — check permission first
      const status = await getPermissionStatus()
      setOsPermission(status)
      if (status === 'undetermined') {
        setSoftPrePromptVis(true)
        return
      }
      if (status === 'denied') {
        setPrefs(p => ({ ...p, major: true }))
        setOpenSettingsVis(true)
        return
      }
    }
    setAlertPrefsVisible(true)
  }, [alertsWanted, setPrefs])

  // Soft pre-prompt: user accepted → fire OS prompt
  const handleSoftAllow = useCallback(async () => {
    setSoftPrePromptVis(false)
    const status = await requestPermission()
    setOsPermission(status)
    if (status === 'granted') {
      setPrefs(p => ({ ...p, major: true }))
    } else {
      setPrefs(p => ({ ...p, major: true }))
      setOpenSettingsVis(true)
    }
    setAlertPrefsVisible(true)
  }, [setPrefs])

  // Prefs change: handle new toggle-on when permission needs attention
  const handlePrefsChange = useCallback(async (updater) => {
    const prev = prefsRef.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    const turningOn = (next.major && !prev.major) || (next.minor && !prev.minor)

    if (turningOn) {
      const status = await getPermissionStatus()
      setOsPermission(status)
      if (status === 'denied') {
        setPrefs(next)
        setOpenSettingsVis(true)
        return
      }
    }
    setPrefs(next)
  }, [setPrefs])

  const s = useMemo(() => StyleSheet.create({
    container:   { flex: 1, backgroundColor: Colors.screenBg },
    topbar:      { backgroundColor: Colors.topbarBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: 12, paddingTop: 10, gap: 8 },
    topbarTitle: { flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5 },
    content:     { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },
    card:        { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle:   { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 },
    windowRow:   { flexDirection: 'row', gap: 12 },
  }), [Colors])

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.doubloonGold} size="large"/>
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* TOPBAR */}
      <View style={s.topbar}>
        <Text style={s.topbarTitle}>Fish Activity</Text>
        <TouchableOpacity onPress={handleBellPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <BellIcon state={bellState}/>
        </TouchableOpacity>
        <LocationChip
          label={tideStation.name}
          onPress={() => setShowStationPicker(true)}
          color={Colors.textPrimary}
          boneColor={Colors.topbarBg}
        />
      </View>

      {/* DAY STRIP */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate}/>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(selectedDate) }} tintColor={Colors.catFish}/>}
      >
        {/* Gauge */}
        <View style={{ alignItems: 'center' }}>
          <ActivityGauge score={dayAverage} Colors={Colors}/>
          <TouchableOpacity
            onPress={() => setInfoVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
          >
            <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, marginTop: -4 }}>
              ⓘ how is this scored?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Activity curve */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Activity — 4:00am to 10:00pm</Text>
          {chartLoading ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.doubloonGold}/>
            </View>
          ) : (
            <ActivityChart
              curve={curve}
              sol={sol}
              showMajor={showMajor}
              showMinor={showMinor}
              onToggleMajor={() => { setShowMajor(v => !v); Haptics.selectionAsync() }}
              onToggleMinor={() => { setShowMinor(v => !v); Haptics.selectionAsync() }}
              isToday={isToday}
              nowTime={nowTime}
              Colors={Colors}
            />
          )}
        </View>

        {/* Major / Minor window boxes */}
        <View style={s.windowRow}>
          <WindowBox
            type="major"
            w1={sol.major1}
            w2={sol.major2}
            active={showMajor}
            onToggle={() => { setShowMajor(v => !v); Haptics.selectionAsync() }}
            Colors={Colors}
          />
          <WindowBox
            type="minor"
            w1={sol.minor1}
            w2={sol.minor2}
            active={showMinor}
            onToggle={() => { setShowMinor(v => !v); Haptics.selectionAsync() }}
            Colors={Colors}
          />
        </View>
      </ScrollView>

      {/* Modals */}
      <TideStationPickerModal
        visible={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        onSelect={(id, name) => { setTideStation(id, name); setShowStationPicker(false) }}
        currentStationId={tideStation.id}
      />

      <AlertPrefsSheet
        visible={alertPrefsVisible}
        onClose={() => setAlertPrefsVisible(false)}
        prefs={prefs}
        setPrefs={handlePrefsChange}
        osPermission={osPermission}
        Colors={Colors}
      />

      <SoftPrePromptModal
        visible={softPrePromptVis}
        onAllow={handleSoftAllow}
        onDismiss={() => setSoftPrePromptVis(false)}
        Colors={Colors}
      />

      <OpenSettingsModal
        visible={openSettingsVis}
        onDismiss={() => setOpenSettingsVis(false)}
        Colors={Colors}
      />

      <Modal visible={infoVisible} transparent animationType="fade" presentationStyle="overFullScreen">
        <TouchableOpacity
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 32 }}
          activeOpacity={1}
          onPress={() => setInfoVisible(false)}
        >
          <View style={{ backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border, gap: Spacing.sm, maxWidth: 300 }}>
            <Text style={{ fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' }}>
              About this score
            </Text>
            <Text style={{ fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 20 }}>
              Fish activity score combines solunar, tide movement, and barometric pressure.{'\n\n'}Higher score = higher fish activity.
            </Text>
            <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, marginTop: 4 }}>
              Tap anywhere to close
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}
