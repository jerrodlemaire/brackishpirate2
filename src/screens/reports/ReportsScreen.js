import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal,
} from 'react-native'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import SubmitReportScreen from './SubmitReportScreen'

const SPECIES_FILTERS = [
  'All species', 'Speckled Trout', 'Redfish', 'Flounder',
  'Sheepshead', 'Black Drum', 'Striped Bass', 'Cobia', 'Tarpon',
]

const TIME_FILTERS = ['All time', 'Today', 'This week', 'This month']

function StarRating({ rating }) {
  return (
    <Text style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => i < rating ? '★' : '☆').join('')}
    </Text>
  )
}

function ReportCard({ report, onPress }) {
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hrs   = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (mins < 60)  return `${mins}m ago`
    if (hrs  < 24)  return `${hrs}h ago`
    return `${days}d ago`
  }

  const initials = (name) => name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'BP'

  return (
    <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.85}>
      {/* Header */}
      <View style={styles.reportHd}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initials(report.user_name)}</Text>
        </View>
        <View style={styles.reportMeta}>
          <Text style={styles.reportName}>{report.user_name || 'Anonymous'}</Text>
          <Text style={styles.reportLoc}>
            📍 {report.location_name || 'Unknown location'} · {timeAgo(report.created_at)}
          </Text>
        </View>
        <StarRating rating={report.rating || 5}/>
      </View>

      {/* Photo */}
      {report.photo_url && (
        <Image
          source={{ uri: report.photo_url }}
          style={styles.reportPhoto}
          resizeMode="cover"
        />
      )}

      {/* No photo placeholder */}
      {!report.photo_url && (
        <View style={styles.reportPhotoPlaceholder}>
          <Text style={styles.reportPhotoIcon}>🎣</Text>
        </View>
      )}

      {/* Species chips */}
      <View style={styles.chipRow}>
        {(report.species || []).map((s, i) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipTxt}>{s}</Text>
          </View>
        ))}
        {report.count > 0 && (
          <View style={[styles.chip, styles.chipCount]}>
            <Text style={[styles.chipTxt, { color: Colors.marshGreen }]}>
              {report.count} fish
            </Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {report.notes && (
        <Text style={styles.reportNotes} numberOfLines={3}>
          "{report.notes}"
        </Text>
      )}

      {/* Conditions row */}
      <View style={styles.condRow}>
        {report.bait && (
          <Text style={styles.condTag}>🪱 {report.bait}</Text>
        )}
        {report.water_temp && (
          <Text style={styles.condTag}>🌡 {report.water_temp}°</Text>
        )}
        {report.tide_direction && (
          <Text style={styles.condTag}>🌊 {report.tide_direction}</Text>
        )}
        {report.wind_speed && (
          <Text style={styles.condTag}>💨 {report.wind_speed} mph</Text>
        )}
      </View>

      {/* Footer */}
      <View style={styles.reportFooter}>
        <TouchableOpacity style={styles.likeBtn}>
          <Text style={styles.likeTxt}>♡ {report.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.likeBtn}>
          <Text style={styles.likeTxt}>💬 Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.likeBtn}>
          <Text style={styles.likeTxt}>↗ Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function ReportsScreen() {
  const { user }                          = useAuth()
  const [reports,       setReports]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState('All species')
  const [timeFilter,    setTimeFilter]    = useState('All time')
  const [showSubmit,    setShowSubmit]    = useState(false)

  const fetchReports = useCallback(async () => {
    try {
      let query = supabase
        .from('catch_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      // Species filter
      if (speciesFilter !== 'All species') {
        query = query.contains('species', [speciesFilter])
      }

      // Time filter
      if (timeFilter === 'Today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        query = query.gte('created_at', today.toISOString())
      } else if (timeFilter === 'This week') {
        const week = new Date()
        week.setDate(week.getDate() - 7)
        query = query.gte('created_at', week.toISOString())
      } else if (timeFilter === 'This month') {
        const month = new Date()
        month.setDate(month.getDate() - 30)
        query = query.gte('created_at', month.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      setReports(data || [])
    } catch (e) {
      console.log('Fetch reports error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [speciesFilter, timeFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  const onRefresh = () => {
    setRefreshing(true)
    fetchReports()
  }

  const onReportSubmitted = () => {
    setShowSubmit(false)
    fetchReports()
  }

  return (
    <View style={styles.container}>

      {/* Species filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip}
        contentContainerStyle={styles.filterContent}
      >
        {SPECIES_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, speciesFilter === f && styles.filterChipOn]}
            onPress={() => setSpeciesFilter(f)}
          >
            <Text style={[styles.filterTxt, speciesFilter === f && styles.filterTxtOn]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Time filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStrip2}
        contentContainerStyle={styles.filterContent}
      >
        {TIME_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.timeChip, timeFilter === f && styles.timeChipOn]}
            onPress={() => setTimeFilter(f)}
          >
            <Text style={[styles.timeTxt, timeFilter === f && styles.timeTxtOn]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Reports feed */}
      {loading
        ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.brackishWater}/>
            <Text style={styles.loadingTxt}>Loading catch reports...</Text>
          </View>
        )
        : (
          <ScrollView
            contentContainerStyle={styles.feed}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>
            }
          >
            {reports.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🎣</Text>
                <Text style={styles.emptyTitle}>No reports yet</Text>
                <Text style={styles.emptySub}>
                  Be the first to submit a catch report for this area.
                </Text>
              </View>
            )}
            {reports.map(r => (
              <ReportCard
                key={r.id}
                report={r}
                onPress={() => {}}
              />
            ))}
          </ScrollView>
        )
      }

      {/* Submit button */}
      <TouchableOpacity
        style={styles.submitFab}
        onPress={() => setShowSubmit(true)}
        activeOpacity={0.9}
      >
        <Text style={styles.submitFabTxt}>＋ Submit catch report</Text>
      </TouchableOpacity>

      {/* Submit modal */}
      {showSubmit && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <SubmitReportScreen
            onClose={() => setShowSubmit(false)}
            onSubmitted={onReportSubmitted}
          />
        </Modal>
      )}

    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.saltWhite },

  filterStrip:  { maxHeight: 44, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  filterStrip2: { maxHeight: 38 },
  filterContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
  filterChip:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  filterChipOn: { backgroundColor: Colors.brackishWater, borderColor: Colors.brackishWater },
  filterTxt:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  filterTxtOn:  { color: Colors.saltWhite },
  timeChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 0.5, borderColor: 'transparent' },
  timeChipOn:   { backgroundColor: 'rgba(196,154,42,0.12)', borderColor: Colors.doubloonGold },
  timeTxt:      { fontSize: Typography.xs, color: Colors.textSecondary },
  timeTxtOn:    { color: Colors.doubloonGold, fontWeight: Typography.medium },

  feed:         { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },

  loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:   { fontSize: Typography.base, color: Colors.textSecondary },

  emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon:    { fontSize: 48 },
  emptyTitle:   { fontSize: Typography.lg, fontWeight: Typography.medium, color: Colors.textPrimary },
  emptySub:     { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  reportCard:   { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
  reportHd:     { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: 10 },
  avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D0E4EE', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:    { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.deepSea },
  reportMeta:   { flex: 1 },
  reportName:   { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  reportLoc:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  stars:        { fontSize: Typography.sm, color: Colors.doubloonGold },

  reportPhoto:            { width: '100%', height: 200 },
  reportPhotoPlaceholder: { height: 80, backgroundColor: Colors.midnightTide, alignItems: 'center', justifyContent: 'center' },
  reportPhotoIcon:        { fontSize: 32 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  chip:         { backgroundColor: '#D0E4EE', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  chipCount:    { backgroundColor: 'rgba(46,139,90,0.1)' },
  chipTxt:      { fontSize: Typography.xs, color: Colors.deepSea, fontWeight: Typography.medium },

  reportNotes:  { fontSize: Typography.sm, color: Colors.textSecondary, paddingHorizontal: Spacing.md, lineHeight: 20, fontStyle: 'italic' },

  condRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  condTag:      { fontSize: Typography.xs, color: Colors.textSecondary, backgroundColor: Colors.parchment, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.sm },

  reportFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingVertical: 4 },
  likeBtn:      { flex: 1, alignItems: 'center', paddingVertical: 8 },
  likeTxt:      { fontSize: Typography.xs, color: Colors.textSecondary },

  submitFab:    {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: Colors.brackishWater, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: Colors.deepSea, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  submitFabTxt: { fontFamily: 'Georgia', fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.saltWhite, letterSpacing: 0.5 },
}) 
