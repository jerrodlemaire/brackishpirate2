import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Condition strip */}
      <View style={styles.condStrip}>
        {[
          { val: '82°',    lbl: 'Air',   dot: Colors.marshGreen },
          { val: '74°',    lbl: 'Water', dot: Colors.marshGreen },
          { val: '1.8 ft', lbl: 'Waves', dot: Colors.doubloonGold },
          { val: 'SSE 9',  lbl: 'Wind',  dot: Colors.marshGreen },
          { val: '+0.6',   lbl: 'Tide',  dot: Colors.marshGreen },
        ].map((c, i) => (
          <View key={i} style={[styles.condItem, i < 4 && styles.condBorder]}>
            <View style={[styles.condDot, { backgroundColor: c.dot }]}/>
            <Text style={styles.condVal}>{c.val}</Text>
            <Text style={styles.condLbl}>{c.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Map placeholder */}
      <View style={styles.mapHero}>
        <Text style={styles.mapHeroText}>🗺  Live map loading...</Text>
        <Text style={styles.mapHeroSub}>Google Maps integration — Phase 2</Text>
      </View>

      {/* Section: forecast */}
      <View style={styles.section}>
        <View style={styles.sectionHd}>
          <Text style={styles.sectionTitle}>7-day forecast</Text>
          <TouchableOpacity><Text style={styles.seeAll}>Tides & solunar ›</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { day: 'Today', ico: '☀️', temp: '84°', wind: '9 mph', today: true },
            { day: 'Sat',   ico: '⛅', temp: '81°', wind: '12 mph' },
            { day: 'Sun',   ico: '🌦️', temp: '77°', wind: '16 mph' },
            { day: 'Mon',   ico: '⛈️', temp: '72°', wind: '22 mph' },
            { day: 'Tue',   ico: '☀️', temp: '83°', wind: '8 mph' },
            { day: 'Wed',   ico: '☀️', temp: '86°', wind: '7 mph' },
            { day: 'Thu',   ico: '⛅', temp: '82°', wind: '10 mph' },
          ].map((f, i) => (
            <View key={i} style={[styles.fcCard, f.today && styles.fcCardToday]}>
              <Text style={[styles.fcDay, f.today && styles.fcDayToday]}>{f.day}</Text>
              <Text style={styles.fcIco}>{f.ico}</Text>
              <Text style={styles.fcTemp}>{f.temp}</Text>
              <Text style={styles.fcWind}>{f.wind}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Section: catch reports */}
      <View style={styles.section}>
        <View style={styles.sectionHd}>
          <Text style={styles.sectionTitle}>Recent catch reports</Text>
          <TouchableOpacity><Text style={styles.seeAll}>See all ›</Text></TouchableOpacity>
        </View>

        {[
          {
            initials: 'JB', name: 'Jake B.', time: '2h ago',
            loc: 'South Shore, Pontchartrain',
            species: ['Speckled Trout', 'Redfish'],
            note: 'Gulp shrimp under cork · 14 fish · AM incoming tide',
            stars: '★★★★★',
          },
          {
            initials: 'ML', name: 'M. Landry', time: '5h ago',
            loc: 'Chef Menteur Pass',
            species: ['Flounder', 'Sheepshead'],
            note: 'Live shrimp, jig · 8 fish · Outgoing tide',
            stars: '★★★★☆',
          },
        ].map((r, i) => (
          <View key={i} style={styles.reportCard}>
            <View style={styles.reportHd}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{r.initials}</Text>
              </View>
              <View style={styles.reportMeta}>
                <Text style={styles.reportName}>{r.name} · {r.time}</Text>
                <Text style={styles.reportLoc}>📍 {r.loc}</Text>
              </View>
              <Text style={styles.stars}>{r.stars}</Text>
            </View>
            <View style={styles.chipRow}>
              {r.species.map((s, j) => (
                <View key={j} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.reportNote}>{r.note}</Text>
          </View>
        ))}
      </View>

    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.saltWhite },
  content:    { paddingBottom: 32 },

  condStrip:  { flexDirection: 'row', backgroundColor: Colors.saltWhite, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  condItem:   { flex: 1, alignItems: 'center', paddingVertical: 10 },
  condBorder: { borderRightWidth: 0.5, borderRightColor: Colors.border },
  condDot:    { width: 6, height: 6, borderRadius: 3, marginBottom: 3 },
  condVal:    { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  condLbl:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 1 },

  mapHero: {
    height: 180, margin: Spacing.lg, borderRadius: Radius.lg,
    backgroundColor: Colors.midnightTide,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: Colors.brackishWater,
  },
  mapHeroText: { fontSize: Typography.md, color: Colors.saltWhite },
  mapHeroSub:  { fontSize: Typography.sm, color: Colors.brackishWater, marginTop: 6 },

  section:    { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  sectionHd:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle:{ fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  seeAll:     { fontSize: Typography.sm, color: Colors.brackishWater },

  fcCard: {
    width: 66, marginRight: 8, backgroundColor: Colors.cardBg,
    borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border,
    padding: 8, alignItems: 'center',
  },
  fcCardToday: { borderColor: Colors.doubloonGold, backgroundColor: 'rgba(196,154,42,0.06)' },
  fcDay:    { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 3 },
  fcDayToday: { color: Colors.doubloonGold },
  fcIco:    { fontSize: 18, marginBottom: 2 },
  fcTemp:   { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  fcWind:   { fontSize: Typography.xs, color: Colors.textSecondary },

  reportCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  reportHd:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  avatar:     {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#D0E4EE', alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.deepSea },
  reportMeta: { flex: 1 },
  reportName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  reportLoc:  { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  stars:      { fontSize: Typography.sm, color: Colors.doubloonGold },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  chip:       { backgroundColor: '#D0E4EE', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  chipText:   { fontSize: Typography.xs, color: Colors.deepSea, fontWeight: Typography.medium },
  reportNote: { fontSize: Typography.xs, color: Colors.textSecondary },
})
