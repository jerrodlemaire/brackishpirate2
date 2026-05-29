import React, { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Typography, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'
import { useDataLocation } from '../hooks/useDataLocation'
import { getSolunarForDate, buildCompositeCurve, peakWeightedAverage, scoreColor } from '../utils/solunar'

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString()
}

export { isSameDay, addDays }

export default function DayStrip({ selectedDate, onSelect }) {
  const { Colors } = useTheme()
  const { solunarLocation } = useDataLocation()

  const ds = useMemo(() => StyleSheet.create({
    scroll:       { backgroundColor: Colors.topbarBg },
    content:      { paddingHorizontal: 8, paddingVertical: 14, gap: 4, alignItems: 'center' },
    monthSep:     { justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 4, marginRight: 2 },
    monthTxt:     { fontSize: 9, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
    pill:         { width: 54, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.inputBg, gap: 2 },
    pillSelected: { backgroundColor: Colors.borderMid, borderColor: Colors.textPrimary },
    pillToday:    { borderColor: Colors.catFish },
    dayName:      { fontSize: 9, color: Colors.textSecondary, fontWeight: '600', letterSpacing: 0.3 },
    dayNum:       { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
    moon:         { fontSize: 12 },
    tideVal:      { fontSize: 9, color: Colors.textSecondary },
    dot:          { width: 6, height: 6, borderRadius: 3 },
    textSel:      { color: Colors.textPrimary },
  }), [Colors])

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const { lat, lng } = solunarLocation

  const items = useMemo(() => {
    const result = []
    let lastMonth = -1
    for (let i = 0; i < 120; i++) {
      const d = addDays(today, i)
      const m = d.getMonth()
      if (m !== lastMonth) {
        result.push({ type: 'month', label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), key: `m-${i}` })
        lastMonth = m
      }
      const sol   = getSolunarForDate(d, lat, lng)
      const curve = buildCompositeCurve(sol, [], 0)
      const score = peakWeightedAverage(curve)
      result.push({ type: 'day', date: d, key: `d-${i}`, sol, score })
    }
    return result
  }, [today, lat, lng])

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={ds.scroll} contentContainerStyle={ds.content}>
      {items.map(item => {
        if (item.type === 'month') {
          return (
            <View key={item.key} style={ds.monthSep}>
              <Text style={ds.monthTxt}>{item.label}</Text>
            </View>
          )
        }
        const { date: day, sol, score } = item
        const selected = isSameDay(day, selectedDate)
        const todayDay = isSameDay(day, today)
        return (
          <TouchableOpacity key={item.key}
            style={[ds.pill, selected && ds.pillSelected, todayDay && !selected && ds.pillToday]}
            onPress={() => onSelect(day)}
          >
            <Text style={[ds.dayName, selected && ds.textSel]}>
              {day.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text style={[ds.dayNum, selected && ds.textSel]}>{day.getDate()}</Text>
            <Text style={ds.moon}>{sol.moonPhase.emoji}</Text>
            <Text style={[ds.tideVal, selected && ds.textSel]}>—</Text>
            <View style={[ds.dot, { backgroundColor: scoreColor(score) }]}/>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}
