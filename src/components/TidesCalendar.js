import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  Dimensions, Modal,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../constants/theme'

const { width } = Dimensions.get('window')

// ── SOLUNAR ENGINE ────────────────────────────────────────────────────────────
function getSolunarForDate(date, lat = 30.1766, lng = -90.1146) {
  const JD    = date / 86400000 + 2440587.5
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
  const moonPhase = phaseNames.find(p => phase >= p.range[0] && phase < p.range[1]) || phaseNames[0]
  const moonScore = illumination > 80 || illumination < 20 ? 92 : 55 + illumination * 0.35
  const activityScore = Math.min(100, Math.round(moonScore))

  return {
    major1:        { start: toTime(solunarBase),      end: toTime(solunarBase + 2) },
    major2:        { start: toTime(solunarBase + 12), end: toTime(solunarBase + 14) },
    minor1:        { start: toTime(solunarBase + 6),  end: toTime(solunarBase + 7) },
    minor2:        { start: toTime(solunarBase + 18), end: toTime(solunarBase + 19) },
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
function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

function isToday(date) {
  return isSameDay(date, new Date())
}

function scoreColor(score) {
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
  return (
    <View style={[barStyles.wrap, compact && barStyles.compact]}>
      <View style={[barStyles.track, compact && barStyles.trackCompact]}>
        <View style={[barStyles.fill, { width: `${score}%`, backgroundColor: scoreColor(score) }]}/>
      </View>
      {!compact && (
        <Text style={[barStyles.label, { color: scoreColor(score) }]}>
          {score} · {scoreLabel(score)}
        </Text>
      )}
    </View>
  )
}

const barStyles = StyleSheet.create({
  wrap:         { gap: 4 },
  compact:      { gap: 2 },
  track:        { height: 6, backgroundColor: 'rgba(74,143,168,0.15)', borderRadius: 3, overflow: 'hidden' },
  trackCompact: { height: 3 },
  fill:         { height: '100%', borderRadius: 3 },
  label:        { fontSize: Typography.xs, fontWeight: Typography.medium },
})

// ── DAY DETAIL MODAL ──────────────────────────────────────────────────────────
function DayDetailModal({ date, onClose }) {
  const [tides,   setTides]   = useState([])
  const [loading, setLoading] = useState(true)

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
      <View style={modalStyles.container}>

        {/* Header */}
        <View style={modalStyles.header}>
          <View>
            <Text style={modalStyles.headerDate}>{dayLabel}</Text>
            <Text style={modalStyles.headerSub}>Tides & solunar forecast</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
            <Text style={modalStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={modalStyles.content}>

          {/* Activity score */}
          <View style={modalStyles.scoreCard}>
            <View style={[modalStyles.scoreDot, { backgroundColor: scoreColor(sol.activityScore) }]}>
              <Text style={modalStyles.scoreNum}>{sol.activityScore}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modalStyles.scoreTitle}>
                {scoreLabel(sol.activityScore)} fishing conditions
              </Text>
              <ActivityBar score={sol.activityScore}/>
            </View>
          </View>

          {/* Moon */}
          <View style={modalStyles.card}>
            <View style={modalStyles.moonRow}>
              <Text style={modalStyles.moonEmoji}>{sol.moonPhase.emoji}</Text>
              <View>
                <Text style={modalStyles.moonName}>{sol.moonPhase.name}</Text>
                <Text style={modalStyles.moonSub}>{sol.illumination}% illuminated</Text>
              </View>
            </View>
          </View>

          {/* Solunar windows */}
          <View style={modalStyles.card}>
            <Text style={modalStyles.cardTitle}>Solunar feeding windows</Text>
            <View style={modalStyles.solGrid}>
              {[
                { label: 'Major feed AM', start: sol.major1.start, end: sol.major1.end, major: true,  emoji: '🌟' },
                { label: 'Minor feed AM', start: sol.minor1.start, end: sol.minor1.end, major: false, emoji: '⭐' },
                { label: 'Major feed PM', start: sol.major2.start, end: sol.major2.end, major: true,  emoji: '🌟' },
                { label: 'Minor feed PM', start: sol.minor2.start, end: sol.minor2.end, major: false, emoji: '⭐' },
              ].map((w, i) => (
                <View key={i} style={[modalStyles.solCard, w.major && modalStyles.solCardMajor]}>
                  <Text style={modalStyles.solEmoji}>{w.emoji}</Text>
                  <Text style={modalStyles.solLabel}>{w.label}</Text>
                  <Text style={modalStyles.solTime}>{w.start}</Text>
                  <Text style={modalStyles.solDur}>{w.major ? '2 hr window' : '1 hr window'}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Tides */}
          <View style={modalStyles.card}>
            <Text style={modalStyles.cardTitle}>Tide predictions</Text>
            {loading
              ? <ActivityIndicator color={Colors.brackishWater}/>
              : tides.length === 0
                ? <Text style={modalStyles.noData}>No tide data available</Text>
                : tides.map((t, i) => {
                    const isHigh = t.type === 'H'
                    const time   = t.t.split(' ')[1]
                    return (
                      <View key={i} style={modalStyles.tideRow}>
                        <View style={[modalStyles.tideBadge, {
                          backgroundColor: isHigh
                            ? 'rgba(74,143,168,0.12)'
                            : 'rgba(196,154,42,0.1)',
                        }]}>
                          <Text style={[modalStyles.tideType, {
                            color: isHigh ? Colors.brackishWater : Colors.doubloonGold,
                          }]}>
                            {isHigh ? '▲ High' : '▼ Low'}
                          </Text>
                        </View>
                        <Text style={modalStyles.tideTime}>{time}</Text>
                        <Text style={modalStyles.tideVal}>{parseFloat(t.v).toFixed(1)} ft</Text>
                      </View>
                    )
                  })
            }
          </View>

          {/* Best times */}
          <View style={modalStyles.card}>
            <Text style={modalStyles.cardTitle}>Best fishing windows</Text>
            <View style={modalStyles.bestList}>
              {[
                { label: '🌅 Dawn bite',      detail: 'First light to 2hr after sunrise' },
                { label: `🌟 Major solunar`,   detail: `${sol.major1.start} – ${sol.major1.end}` },
                { label: `🌟 Evening major`,   detail: `${sol.major2.start} – ${sol.major2.end}` },
                { label: '🌇 Dusk bite',      detail: '2hr before sunset to dark' },
              ].map((b, i) => (
                <View key={i} style={modalStyles.bestRow}>
                  <Text style={modalStyles.bestLabel}>{b.label}</Text>
                  <Text style={modalStyles.bestDetail}>{b.detail}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },
  header:    {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.lg, paddingTop: 20,
    backgroundColor: Colors.brackishWater,
  },
  headerDate: { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: '700', color: Colors.saltWhite },
  headerSub:  { fontSize: Typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  closeBtn:   { padding: 4 },
  closeTxt:   { fontSize: 18, color: 'rgba(255,255,255,0.8)' },
  content:    { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg,
  },
  scoreDot: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: Typography.xl, fontWeight: '700', color: '#fff' },
  scoreTitle:{ fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 6 },

  card:      { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg },
  cardTitle: { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, marginBottom: 12 },

  moonRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  moonEmoji: { fontSize: 40 },
  moonName:  { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
  moonSub:   { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },

  solGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  solCard:      { flex: 1, minWidth: '45%', backgroundColor: Colors.saltWhite, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 10 },
  solCardMajor: { borderColor: Colors.doubloonGold, backgroundColor: 'rgba(196,154,42,0.05)' },
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
})

// ── WEEK STRIP ────────────────────────────────────────────────────────────────
function WeekStrip({ selectedDate, onSelectDate }) {
  const today = new Date()
  const days  = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={weekStyles.scroll}>
      {days.map((day, i) => {
        const sol      = getSolunarForDate(day)
        const selected = isSameDay(day, selectedDate)
        const todayDay = isToday(day)
        return (
          <TouchableOpacity
            key={i}
            style={[weekStyles.day, selected && weekStyles.daySelected, todayDay && !selected && weekStyles.dayToday]}
            onPress={() => onSelectDate(day)}
          >
            <Text style={[weekStyles.dayName, selected && weekStyles.dayTextSel]}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[weekStyles.dayNum, selected && weekStyles.dayTextSel]}>
              {day.getDate()}
            </Text>
            <Text style={weekStyles.moonMini}>{sol.moonPhase.emoji}</Text>
            <View style={[weekStyles.scoreDot, { backgroundColor: scoreColor(sol.activityScore) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const weekStyles = StyleSheet.create({
  scroll:       { paddingVertical: 4 },
  day:          { width: 56, alignItems: 'center', paddingVertical: 10, marginRight: 6, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  daySelected:  { backgroundColor: Colors.brackishWater, borderColor: Colors.brackishWater },
  dayToday:     { borderColor: Colors.doubloonGold },
  dayName:      { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 3 },
  dayNum:       { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  dayTextSel:   { color: Colors.saltWhite },
  moonMini:     { fontSize: 14, marginBottom: 4 },
  scoreDot:     { width: 8, height: 8, borderRadius: 4 },
})

// ── MONTH CALENDAR ────────────────────────────────────────────────────────────
function MonthCalendar({ selectedDate, onSelectDate, displayMonth }) {
  const today      = new Date()
  const firstDay   = startOfMonth(displayMonth)
  const totalDays  = daysInMonth(displayMonth)
  const startDow   = firstDay.getDay() // 0=Sun
  const cellW      = (width - 32 - 12) / 7

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(displayMonth.getFullYear(), displayMonth.getMonth(), d))
  }

  return (
    <View style={calStyles.wrap}>
      {/* Day of week headers */}
      <View style={calStyles.dowRow}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <Text key={d} style={[calStyles.dowLabel, { width: cellW }]}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={calStyles.grid}>
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
                calStyles.cell,
                { width: cellW, opacity: isPast ? 0.5 : 1 },
                selected && calStyles.cellSelected,
                todayDay && !selected && calStyles.cellToday,
              ]}
              onPress={() => onSelectDate(date)}
            >
              <Text style={[calStyles.cellNum, selected && calStyles.cellNumSel, todayDay && !selected && calStyles.cellNumToday]}>
                {date.getDate()}
              </Text>
              <Text style={calStyles.cellMoon}>{sol.moonPhase.emoji}</Text>
              <ActivityBar score={sol.activityScore} compact/>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const calStyles = StyleSheet.create({
  wrap:        { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.md },
  dowRow:      { flexDirection: 'row', marginBottom: 6 },
  dowLabel:    { textAlign: 'center', fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  cell:        { height: 58, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: Radius.sm, paddingHorizontal: 2, paddingVertical: 4 },
  cellSelected:{ backgroundColor: Colors.brackishWater },
  cellToday:   { borderWidth: 1.5, borderColor: Colors.doubloonGold },
  cellNum:     { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  cellNumSel:  { color: Colors.saltWhite },
  cellNumToday:{ color: Colors.doubloonGold },
  cellMoon:    { fontSize: 12 },
})

// ── MAIN CALENDAR COMPONENT ───────────────────────────────────────────────────
export default function TidesCalendar({ onClose }) {
  const today                           = new Date()
  const [view,          setView]        = useState('week')   // 'week' | 'month'
  const [selectedDate,  setSelectedDate]= useState(today)
  const [displayMonth,  setDisplayMonth]= useState(today)
  const [showDetail,    setShowDetail]  = useState(false)
  const [detailDate,    setDetailDate]  = useState(null)

  const sol = getSolunarForDate(selectedDate)

  const prevMonth = () => setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const handleSelectDate = (date) => {
    setSelectedDate(date)
  }

  const handleDayTap = (date) => {
    setDetailDate(date)
    setShowDetail(true)
  }

  return (
    <View style={mainStyles.container}>

      {/* Header */}
      <View style={mainStyles.header}>
        <View>
          <Text style={mainStyles.headerTitle}>Tides & Solunar</Text>
          <Text style={mainStyles.headerSub}>Tap any day for full forecast</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={mainStyles.closeBtn}>
            <Text style={mainStyles.closeTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* View toggle */}
      <View style={mainStyles.toggleRow}>
        <TouchableOpacity
          style={[mainStyles.toggleBtn, view === 'week' && mainStyles.toggleActive]}
          onPress={() => setView('week')}
        >
          <Text style={[mainStyles.toggleTxt, view === 'week' && mainStyles.toggleTxtActive]}>
            2-week strip
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[mainStyles.toggleBtn, view === 'month' && mainStyles.toggleActive]}
          onPress={() => setView('month')}
        >
          <Text style={[mainStyles.toggleTxt, view === 'month' && mainStyles.toggleTxtActive]}>
            Month view
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={mainStyles.content}>

        {/* Month nav (month view only) */}
        {view === 'month' && (
          <View style={mainStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={mainStyles.monthNavBtn}>
              <Text style={mainStyles.monthNavTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={mainStyles.monthLabel}>
              {displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={mainStyles.monthNavBtn}>
              <Text style={mainStyles.monthNavTxt}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Calendar */}
        {view === 'week'
          ? <WeekStrip selectedDate={selectedDate} onSelectDate={handleSelectDate}/>
          : <MonthCalendar selectedDate={selectedDate} onSelectDate={handleSelectDate} displayMonth={displayMonth}/>
        }

        {/* Selected day summary */}
        <TouchableOpacity
          style={mainStyles.daySummary}
          onPress={() => handleDayTap(selectedDate)}
          activeOpacity={0.85}
        >
          <View style={mainStyles.daySummaryHd}>
            <View>
              <Text style={mainStyles.daySummaryDate}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              <Text style={mainStyles.daySummaryTap}>Tap for full day detail →</Text>
            </View>
            <View style={[mainStyles.daySummaryScore, { backgroundColor: scoreColor(sol.activityScore) }]}>
              <Text style={mainStyles.daySummaryScoreNum}>{sol.activityScore}</Text>
            </View>
          </View>

          <View style={mainStyles.daySummaryRow}>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>Moon</Text>
              <Text style={mainStyles.daySumVal}>{sol.moonPhase.emoji} {sol.moonPhase.name}</Text>
            </View>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>Illumination</Text>
              <Text style={mainStyles.daySumVal}>{sol.illumination}%</Text>
            </View>
          </View>

          <View style={mainStyles.daySummaryRow}>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>🌟 Major AM</Text>
              <Text style={mainStyles.daySumVal}>{sol.major1.start}</Text>
            </View>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>🌟 Major PM</Text>
              <Text style={mainStyles.daySumVal}>{sol.major2.start}</Text>
            </View>
          </View>

          <View style={mainStyles.daySummaryRow}>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>⭐ Minor AM</Text>
              <Text style={mainStyles.daySumVal}>{sol.minor1.start}</Text>
            </View>
            <View style={mainStyles.daySumItem}>
              <Text style={mainStyles.daySumLabel}>⭐ Minor PM</Text>
              <Text style={mainStyles.daySumVal}>{sol.minor2.start}</Text>
            </View>
          </View>

          <ActivityBar score={sol.activityScore}/>
        </TouchableOpacity>

        {/* Legend */}
        <View style={mainStyles.legend}>
          <Text style={mainStyles.legendTitle}>Activity score</Text>
          <View style={mainStyles.legendRow}>
            {[
              { color: Colors.marshGreen,    label: '80–100 Excellent' },
              { color: Colors.doubloonGold,  label: '65–79 Good' },
              { color: Colors.brackishWater, label: '50–64 Fair' },
              { color: Colors.textSecondary, label: '<50 Slow' },
            ].map((l, i) => (
              <View key={i} style={mainStyles.legendItem}>
                <View style={[mainStyles.legendDot, { backgroundColor: l.color }]}/>
                <Text style={mainStyles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* Day detail modal */}
      {showDetail && detailDate && (
        <DayDetailModal
          date={detailDate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </View>
  )
}

const mainStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },
  header:    {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.lg, paddingTop: 20,
    backgroundColor: Colors.brackishWater,
  },
  headerTitle: { fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.saltWhite },
  headerSub:   { fontSize: Typography.xs, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  closeBtn:    { padding: 4 },
  closeTxt:    { fontSize: 18, color: 'rgba(255,255,255,0.8)' },

  toggleRow: { flexDirection: 'row', margin: Spacing.lg, marginBottom: 0, backgroundColor: Colors.parchment, borderRadius: Radius.md, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm },
  toggleActive: { backgroundColor: Colors.brackishWater },
  toggleTxt:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  toggleTxtActive: { color: Colors.saltWhite },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },

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
})
