import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Dimensions, Modal,
} from 'react-native'
import { Typography, Spacing, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

const { width } = Dimensions.get('window')

// ── SOLUNAR ENGINE ────────────────────────────────────────────────────────────
function getSolunarForDate(date, lat = 30.1766, lng = -90.1146) {
  const JD      = date / 86400000 + 2440587.5
  const moonLng = (218.3165 + 13.176396 * (JD - 2451545)) % 360
  const moonTransit = ((moonLng - lng) / 360) * 24
  const solunarBase = ((moonTransit % 24) + 24) % 24

  const toTime = (h) => {
    const hNorm = ((h % 24) + 24) % 24
    const hours = Math.floor(hNorm)
    const mins  = Math.floor((hNorm - hours) * 60)
    const ampm  = hours >= 12 ? 'PM' : 'AM'
    const h12   = hours % 12 === 0 ? 12 : hours % 12
    return `${h12}:${mins.toString().padStart(2, '0')} ${ampm}`
  }

  const phase        = ((JD - 2451549.5) / 29.53058867) % 1
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100)

  const phaseNames = [
    { name: 'New Moon',        emoji: '🌑', range: [0,    0.06] },
    { name: 'Waxing Crescent', emoji: '🌒', range: [0.06, 0.25] },
    { name: 'First Quarter',   emoji: '🌓', range: [0.25, 0.31] },
    { name: 'Waxing Gibbous',  emoji: '🌔', range: [0.31, 0.50] },
    { name: 'Full Moon',       emoji: '🌕', range: [0.50, 0.56] },
    { name: 'Waning Gibbous',  emoji: '🌖', range: [0.56, 0.75] },
    { name: 'Last Quarter',    emoji: '🌗', range: [0.75, 0.81] },
    { name: 'Waning Crescent', emoji: '🌘', range: [0.81, 1.00] },
  ]
  const moonPhase    = phaseNames.find(p => phase >= p.range[0] && phase < p.range[1]) || phaseNames[0]
  const moonScore    = illumination > 80 || illumination < 20 ? 92 : 55 + illumination * 0.35
  const activityScore = Math.min(100, Math.round(moonScore))

  return {
    major1:       { start: toTime(solunarBase),      end: toTime(solunarBase + 2) },
    major2:       { start: toTime(solunarBase + 12), end: toTime(solunarBase + 14) },
    minor1:       { start: toTime(solunarBase + 6),  end: toTime(solunarBase + 7) },
    minor2:       { start: toTime(solunarBase + 18), end: toTime(solunarBase + 19) },
    moonPhase,
    illumination,
    activityScore,
    phase,
  }
}

// ── NOAA TIDE FETCHER FOR A DATE ──────────────────────────────────────────────
async function fetchTidesForDate(dateStr, stationId = '8761724') {
  const d = dateStr.replace(/-/g, '')
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
    + `?begin_date=${d}&end_date=${d}`
    + `&station=${stationId}&product=predictions&datum=MLLW`
    + `&time_zone=lst_ldt&interval=hilo&units=english`
    + `&application=brackish_pirate&format=json`
  const res  = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatDateKey(date) { return date.toISOString().slice(0, 10) }
function addDays(date, n)    { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function startOfMonth(date)  { return new Date(date.getFullYear(), date.getMonth(), 1) }
function daysInMonth(date)   { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() }
function isSameDay(a, b)     { return a.toDateString() === b.toDateString() }
function isToday(date)       { return isSameDay(date, new Date()) }

function scoreColor(score, Colors) {
  if (score >= 80) return Colors.marshGreen
  if (score >= 65) return Colors.doubloonGold
  if (score >= 50) return Colors.brackishWater
  return Colors.textSecondary
}

function scoreLabel(score) {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Slow'
}

// ── ACTIVITY BAR ──────────────────────────────────────────────────────────────
function ActivityBar({ score, compact = false }) {
  const { Colors } = useTheme()
  const b = useMemo(() => StyleSheet.create({
    wrap:         { gap: 4 },
    compact:      { gap: 2 },
    track:        { height: 6, backgroundColor: `${Colors.brackishWater}26`, borderRadius: 3, overflow: 'hidden' },
    trackCompact: { height: 3 },
    fill:         { height: '100%', borderRadius: 3 },
    label:        { fontSize: Typography.xs, fontWeight: '500' },
  }), [Colors])

  return (
    <View style={[b.wrap, compact && b.compact]}>
      <View style={[b.track, compact && b.trackCompact]}>
        <View style={[b.fill, { width: `${score}%`, backgroundColor: scoreColor(score, Colors) }]}/>
      </View>
      {!compact && (
        <Text style={[b.label, { color: scoreColor(score, Colors) }]}>
          {score} · {scoreLabel(score)}
        </Text>
      )}
    </View>
  )
}

// ── DAY DETAIL MODAL ──────────────────────────────────────────────────────────
function DayDetailModal({ date, onClose }) {
  const { Colors } = useTheme()
  const [tides,   setTides]   = useState([])
  const [loading, setLoading] = useState(true)

  const m = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    header:    {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: Spacing.lg, paddingTop: 20,
      backgroundColor: Colors.cardBg,
    },
    headerDate: { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
    headerSub:  { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 3 },
    closeBtn:   { padding: 4 },
    closeTxt:   { fontSize: 18, color: Colors.textSecondary },
    content:    { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
    scoreCard:  {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg,
    },
    scoreDot:  { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    scoreNum:  { fontSize: Typography.xl, fontWeight: '700', color: '#fff' },
    scoreTitle:{ fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 6 },
    card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
    cardTitle: { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 12 },
    moonRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
    moonEmoji: { fontSize: 40 },
    moonName:  { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
    moonSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
    solGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    solCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 10 },
    solCardMajor: { borderColor: Colors.doubloonGold, backgroundColor: `${Colors.doubloonGold}0D` },
    solEmoji:     { fontSize: 14, marginBottom: 3 },
    solLabel:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 3 },
    solTime:      { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
    solDur:       { fontSize: Typography.xs, color: Colors.brackishWater, marginTop: 2 },
    tideRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    tideBadge: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
    tideType:  { fontSize: Typography.sm, fontWeight: '500' },
    tideTime:  { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
    tideVal:   { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
    noData:    { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', padding: 12 },
    bestList:   { gap: 10 },
    bestRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    bestLabel:  { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
    bestDetail: { fontSize: Typography.sm, color: Colors.textSecondary },
  }), [Colors])

  const sol     = getSolunarForDate(date)
  const dateStr = formatDateKey(date)

  useEffect(() => {
    fetchTidesForDate(dateStr).then(t => {
      setTides(t)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [dateStr])

  const dayLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.header}>
          <View>
            <Text style={m.headerDate}>{dayLabel}</Text>
            <Text style={m.headerSub}>Tides & solunar forecast</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <Text style={m.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={m.content}>
          <View style={m.scoreCard}>
            <View style={[m.scoreDot, { backgroundColor: scoreColor(sol.activityScore, Colors) }]}>
              <Text style={m.scoreNum}>{sol.activityScore}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.scoreTitle}>{scoreLabel(sol.activityScore)} fishing conditions</Text>
              <ActivityBar score={sol.activityScore}/>
            </View>
          </View>

          <View style={m.card}>
            <View style={m.moonRow}>
              <Text style={m.moonEmoji}>{sol.moonPhase.emoji}</Text>
              <View>
                <Text style={m.moonName}>{sol.moonPhase.name}</Text>
                <Text style={m.moonSub}>{sol.illumination}% illuminated</Text>
              </View>
            </View>
          </View>

          <View style={m.card}>
            <Text style={m.cardTitle}>Solunar feeding windows</Text>
            <View style={m.solGrid}>
              {[
                { label: 'Major feed AM', start: sol.major1.start, end: sol.major1.end, major: true,  emoji: '🌟' },
                { label: 'Minor feed AM', start: sol.minor1.start, end: sol.minor1.end, major: false, emoji: '⭐' },
                { label: 'Major feed PM', start: sol.major2.start, end: sol.major2.end, major: true,  emoji: '🌟' },
                { label: 'Minor feed PM', start: sol.minor2.start, end: sol.minor2.end, major: false, emoji: '⭐' },
              ].map((w, i) => (
                <View key={i} style={[m.solCard, w.major && m.solCardMajor]}>
                  <Text style={m.solEmoji}>{w.emoji}</Text>
                  <Text style={m.solLabel}>{w.label}</Text>
                  <Text style={m.solTime}>{w.start}</Text>
                  <Text style={m.solDur}>{w.major ? '2 hr window' : '1 hr window'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={m.card}>
            <Text style={m.cardTitle}>Tide predictions</Text>
            {loading
              ? <ActivityIndicator color={Colors.brackishWater}/>
              : tides.length === 0
                ? <Text style={m.noData}>No tide data available</Text>
                : tides.map((t, i) => {
                    const isHigh = t.type === 'H'
                    const time   = t.t.split(' ')[1]
                    return (
                      <View key={i} style={m.tideRow}>
                        <View style={[m.tideBadge, {
                          backgroundColor: isHigh ? `${Colors.brackishWater}1F` : `${Colors.doubloonGold}1A`,
                        }]}>
                          <Text style={[m.tideType, { color: isHigh ? Colors.brackishWater : Colors.doubloonGold }]}>
                            {isHigh ? '▲ High' : '▼ Low'}
                          </Text>
                        </View>
                        <Text style={m.tideTime}>{time}</Text>
                        <Text style={m.tideVal}>{parseFloat(t.v).toFixed(1)} ft</Text>
                      </View>
                    )
                  })
            }
          </View>

          <View style={m.card}>
            <Text style={m.cardTitle}>Best fishing windows</Text>
            <View style={m.bestList}>
              {[
                { label: '🌅 Dawn bite',    detail: 'First light to 2hr after sunrise' },
                { label: '🌟 Major solunar', detail: `${sol.major1.start} – ${sol.major1.end}` },
                { label: '🌟 Evening major', detail: `${sol.major2.start} – ${sol.major2.end}` },
                { label: '🌇 Dusk bite',    detail: '2hr before sunset to dark' },
              ].map((b, i) => (
                <View key={i} style={m.bestRow}>
                  <Text style={m.bestLabel}>{b.label}</Text>
                  <Text style={m.bestDetail}>{b.detail}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

// ── WEEK STRIP ────────────────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onSelectDate }) {
  const { Colors } = useTheme()
  const w = useMemo(() => StyleSheet.create({
    scroll:      { paddingVertical: 4 },
    day:         { width: 56, alignItems: 'center', paddingVertical: 10, marginRight: 6, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
    daySelected: { backgroundColor: Colors.brackishWater, borderColor: Colors.brackishWater },
    dayToday:    { borderColor: Colors.doubloonGold },
    dayName:     { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 3 },
    dayNum:      { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
    dayTextSel:  { color: Colors.textOnDark },
    moonMini:    { fontSize: 14, marginBottom: 4 },
    scoreDot:    { width: 8, height: 8, borderRadius: 4 },
  }), [Colors])

  const today = new Date()
  const days  = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.scroll}>
      {days.map((day, i) => {
        const sol      = getSolunarForDate(day)
        const selected = isSameDay(day, selectedDate)
        const todayDay = isToday(day)
        return (
          <TouchableOpacity
            key={i}
            style={[w.day, selected && w.daySelected, todayDay && !selected && w.dayToday]}
            onPress={() => onSelectDate(day)}
          >
            <Text style={[w.dayName, selected && w.dayTextSel]}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[w.dayNum, selected && w.dayTextSel]}>
              {day.getDate()}
            </Text>
            <Text style={w.moonMini}>{sol.moonPhase.emoji}</Text>
            <View style={[w.scoreDot, { backgroundColor: scoreColor(sol.activityScore, Colors) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// ── MONTH CALENDAR ────────────────────────────────────────────────────────────
function MonthCalendar({ selectedDate, onSelectDate, displayMonth }) {
  const { Colors } = useTheme()
  const c = useMemo(() => StyleSheet.create({
    wrap:         { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.md },
    dowRow:       { flexDirection: 'row', marginBottom: 6 },
    dowLabel:     { textAlign: 'center', fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
    grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
    cell:         { height: 58, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: Radius.sm, paddingHorizontal: 2, paddingVertical: 4 },
    cellSelected: { backgroundColor: Colors.brackishWater },
    cellToday:    { borderWidth: 1.5, borderColor: Colors.doubloonGold },
    cellNum:      { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
    cellNumSel:   { color: Colors.textOnDark },
    cellNumToday: { color: Colors.doubloonGold },
    cellMoon:     { fontSize: 12 },
  }), [Colors])

  const today     = new Date()
  const firstDay  = startOfMonth(displayMonth)
  const totalDays = daysInMonth(displayMonth)
  const startDow  = firstDay.getDay()
  const cellW     = (width - 32 - 12) / 7

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d))
  }

  return (
    <View style={c.wrap}>
      <View style={c.dowRow}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <Text key={d} style={[c.dowLabel, { width: cellW }]}>{d}</Text>
        ))}
      </View>
      <View style={c.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`empty-${i}`} style={{ width: cellW, height: 58 }}/>
          const sol      = getSolunarForDate(date)
          const selected = isSameDay(date, selectedDate)
          const todayDay = isToday(date)
          const isPast   = date < today && !isToday(date)

          return (
            <TouchableOpacity
              key={i}
              style={[
                c.cell,
                { width: cellW, opacity: isPast ? 0.5 : 1 },
                selected && c.cellSelected,
                todayDay && !selected && c.cellToday,
              ]}
              onPress={() => onSelectDate(date)}
            >
              <Text style={[c.cellNum, selected && c.cellNumSel, todayDay && !selected && c.cellNumToday]}>
                {date.getDate()}
              </Text>
              <Text style={c.cellMoon}>{sol.moonPhase.emoji}</Text>
              <ActivityBar score={sol.activityScore} compact/>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ── MAIN CALENDAR COMPONENT ───────────────────────────────────────────────────
export default function TidesCalendar({ onClose }) {
  const { Colors } = useTheme()
  const today                           = new Date()
  const [view,          setView]        = useState('week')
  const [selectedDate,  setSelectedDate]= useState(today)
  const [displayMonth,  setDisplayMonth]= useState(today)
  const [showDetail,    setShowDetail]  = useState(false)
  const [detailDate,    setDetailDate]  = useState(null)

  const ms = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    header:    {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: Spacing.lg, paddingTop: 20,
      backgroundColor: Colors.cardBg,
    },
    headerTitle: { fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
    headerSub:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 3 },
    closeBtn:    { padding: 4 },
    closeTxt:    { fontSize: 18, color: Colors.textSecondary },
    toggleRow:   { flexDirection: 'row', margin: Spacing.lg, marginBottom: 0, backgroundColor: Colors.inputBg, borderRadius: Radius.md, padding: 3 },
    toggleBtn:   { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm },
    toggleActive:    { backgroundColor: Colors.brackishWater },
    toggleTxt:       { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    toggleTxtActive: { color: Colors.textOnDark },
    content:     { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
    monthNav:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    monthNavBtn: { padding: 8 },
    monthNavTxt: { fontSize: 24, color: Colors.brackishWater, fontWeight: '300' },
    monthLabel:  { fontSize: Typography.md, fontWeight: '500', color: Colors.textPrimary },
    daySummary: {
      backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
      borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg, gap: 12,
    },
    daySummaryHd:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    daySummaryDate:     { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
    daySummaryTap:      { fontSize: Typography.xs, color: Colors.brackishWater, marginTop: 3 },
    daySummaryScore:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    daySummaryScoreNum: { fontSize: Typography.base, fontWeight: '700', color: '#fff' },
    daySummaryRow:      { flexDirection: 'row', gap: 12 },
    daySumItem:         { flex: 1 },
    daySumLabel:        { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 3 },
    daySumVal:          { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
    legend:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.md },
    legendTitle: { fontSize: Typography.sm, fontWeight: '500', color: Colors.textSecondary, marginBottom: 8 },
    legendRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot:   { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  }), [Colors])

  const sol = getSolunarForDate(selectedDate)

  const prevMonth = () => setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const handleDayTap = (date) => {
    setDetailDate(date)
    setShowDetail(true)
  }

  return (
    <View style={ms.container}>
      <View style={ms.header}>
        <View>
          <Text style={ms.headerTitle}>Tides & Solunar</Text>
          <Text style={ms.headerSub}>Tap any day for full forecast</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
            <Text style={ms.closeTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={ms.toggleRow}>
        <TouchableOpacity
          style={[ms.toggleBtn, view === 'week' && ms.toggleActive]}
          onPress={() => setView('week')}
        >
          <Text style={[ms.toggleTxt, view === 'week' && ms.toggleTxtActive]}>2-week strip</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ms.toggleBtn, view === 'month' && ms.toggleActive]}
          onPress={() => setView('month')}
        >
          <Text style={[ms.toggleTxt, view === 'month' && ms.toggleTxtActive]}>Month view</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={ms.content}>
        {view === 'month' && (
          <View style={ms.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={ms.monthNavBtn}>
              <Text style={ms.monthNavTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={ms.monthLabel}>
              {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={ms.monthNavBtn}>
              <Text style={ms.monthNavTxt}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {view === 'week'
          ? <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate}/>
          : <MonthCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} displayMonth={displayMonth}/>
        }

        <TouchableOpacity
          style={ms.daySummary}
          onPress={() => handleDayTap(selectedDate)}
          activeOpacity={0.85}
        >
          <View style={ms.daySummaryHd}>
            <View>
              <Text style={ms.daySummaryDate}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={ms.daySummaryTap}>Tap for full day detail →</Text>
            </View>
            <View style={[ms.daySummaryScore, { backgroundColor: scoreColor(sol.activityScore, Colors) }]}>
              <Text style={ms.daySummaryScoreNum}>{sol.activityScore}</Text>
            </View>
          </View>

          <View style={ms.daySummaryRow}>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>Moon</Text>
              <Text style={ms.daySumVal}>{sol.moonPhase.emoji} {sol.moonPhase.name}</Text>
            </View>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>Illumination</Text>
              <Text style={ms.daySumVal}>{sol.illumination}%</Text>
            </View>
          </View>

          <View style={ms.daySummaryRow}>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>🌟 Major AM</Text>
              <Text style={ms.daySumVal}>{sol.major1.start}</Text>
            </View>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>🌟 Major PM</Text>
              <Text style={ms.daySumVal}>{sol.major2.start}</Text>
            </View>
          </View>

          <View style={ms.daySummaryRow}>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>⭐ Minor AM</Text>
              <Text style={ms.daySumVal}>{sol.minor1.start}</Text>
            </View>
            <View style={ms.daySumItem}>
              <Text style={ms.daySumLabel}>⭐ Minor PM</Text>
              <Text style={ms.daySumVal}>{sol.minor2.start}</Text>
            </View>
          </View>

          <ActivityBar score={sol.activityScore}/>
        </TouchableOpacity>

        <View style={ms.legend}>
          <Text style={ms.legendTitle}>Activity score</Text>
          <View style={ms.legendRow}>
            {[
              { color: Colors.marshGreen,    label: '80–100 Excellent' },
              { color: Colors.doubloonGold,  label: '65–79 Good' },
              { color: Colors.brackishWater, label: '50–64 Fair' },
              { color: Colors.textSecondary, label: '<50 Slow' },
            ].map((l, i) => (
              <View key={i} style={ms.legendItem}>
                <View style={[ms.legendDot, { backgroundColor: l.color }]}/>
                <Text style={ms.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {showDetail && detailDate && (
        <DayDetailModal
          date={detailDate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </View>
  )
}
