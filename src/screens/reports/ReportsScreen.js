import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal,
} from 'react-native'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import SubmitReportScreen from './SubmitReportScreen'

const SPECIES_FILTERS = [
  'All species', 'Speckled Trout', 'Redfish', 'Flounder',
  'Sheepshead', 'Black Drum', 'Striped Bass', 'Cobia', 'Tarpon',
]

const TIME_FILTERS = ['All time', 'Today', 'This week', 'This month']

function StarRating({ rating }) {
  const { Colors } = useTheme()
  return (
    <Text style={{ fontSize: Typography.sm, color: Colors.catFish }}>
      {Array.from({ length: 5 }, (_, i) => i < rating ? '★' : '☆').join('')}
    </Text>
  )
}

function ReportCard({ report, onPress }) {
  const { Colors } = useTheme()
  const s = useMemo(() => StyleSheet.create({
    reportCard:   { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden' },
    reportHd:     { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: 10 },
    avatar:       { width: 36, height: 36, borderRadius: 18, backgroundColor: `${Colors.brackishWater}33`, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:    { fontSize: Typography.sm, fontWeight: '700', color: Colors.brackishWater },
    reportMeta:   { flex: 1 },
    reportName:   { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
    reportLoc:    { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
    reportPhoto:            { width: '100%', height: 200 },
    reportPhotoPlaceholder: { height: 80, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
    reportPhotoIcon:        { fontSize: 32 },
    chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    chip:         { backgroundColor: `${Colors.brackishWater}33`, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    chipCount:    { backgroundColor: `${Colors.marshGreen}26` },
    chipTxt:      { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '500' },
    chipCountTxt: { color: Colors.marshGreen },
    reportNotes:  { fontSize: Typography.sm, color: Colors.textSecondary, paddingHorizontal: Spacing.md, lineHeight: 20, fontStyle: 'italic' },
    condRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    condTag:      { fontSize: Typography.xs, color: Colors.textSecondary, backgroundColor: Colors.inputBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.sm },
    reportFooter: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: Colors.border, paddingVertical: 4 },
    likeBtn:      { flex: 1, alignItems: 'center', paddingVertical: 8 },
    likeTxt:      { fontSize: Typography.xs, color: Colors.textSecondary },
  }), [Colors])

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
    <TouchableOpacity style={s.reportCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.reportHd}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials(report.user_name)}</Text>
        </View>
        <View style={s.reportMeta}>
          <Text style={s.reportName}>{report.user_name || 'Anonymous'}</Text>
          <Text style={s.reportLoc}>
            📍 {report.location_name || 'Unknown location'} · {timeAgo(report.created_at)}
          </Text>
        </View>
        <StarRating rating={report.rating || 5}/>
      </View>

      {report.photo_url && (
        <Image source={{ uri: report.photo_url }} style={s.reportPhoto} resizeMode="cover"/>
      )}
      {!report.photo_url && (
        <View style={s.reportPhotoPlaceholder}>
          <Text style={s.reportPhotoIcon}>🎣</Text>
        </View>
      )}

      <View style={s.chipRow}>
        {(report.species || []).map((sp, i) => (
          <View key={i} style={s.chip}>
            <Text style={s.chipTxt}>{sp}</Text>
          </View>
        ))}
        {report.count > 0 && (
          <View style={[s.chip, s.chipCount]}>
            <Text style={[s.chipTxt, s.chipCountTxt]}>{report.count} fish</Text>
          </View>
        )}
      </View>

      {report.notes && (
        <Text style={s.reportNotes} numberOfLines={3}>"{report.notes}"</Text>
      )}

      <View style={s.condRow}>
        {report.bait          && <Text style={s.condTag}>🪱 {report.bait}</Text>}
        {report.water_temp    && <Text style={s.condTag}>🌡 {report.water_temp}°</Text>}
        {report.tide_direction && <Text style={s.condTag}>🌊 {report.tide_direction}</Text>}
        {report.wind_speed    && <Text style={s.condTag}>💨 {report.wind_speed} mph</Text>}
      </View>

      <View style={s.reportFooter}>
        <TouchableOpacity style={s.likeBtn}><Text style={s.likeTxt}>♡ {report.likes || 0}</Text></TouchableOpacity>
        <TouchableOpacity style={s.likeBtn}><Text style={s.likeTxt}>💬 Comment</Text></TouchableOpacity>
        <TouchableOpacity style={s.likeBtn}><Text style={s.likeTxt}>↗ Share</Text></TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function ReportsScreen() {
  const { Colors } = useTheme()
  const { user }                          = useAuth()
  const [reports,       setReports]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState('All species')
  const [timeFilter,    setTimeFilter]    = useState('All time')
  const [showSubmit,    setShowSubmit]    = useState(false)

  const s = useMemo(() => StyleSheet.create({
    container:    { flex: 1, backgroundColor: Colors.screenBg },
    filterStrip:  { maxHeight: 44, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    filterStrip2: { maxHeight: 38 },
    filterContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
    filterChip:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
    filterChipOn: { backgroundColor: Colors.brackishWater, borderColor: Colors.brackishWater },
    filterTxt:    { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    filterTxtOn:  { color: Colors.textOnDark },
    timeChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 0.5, borderColor: 'transparent' },
    timeChipOn:   { backgroundColor: `${Colors.doubloonGold}1F`, borderColor: Colors.doubloonGold },
    timeTxt:      { fontSize: Typography.xs, color: Colors.textSecondary },
    timeTxtOn:    { color: Colors.doubloonGold, fontWeight: '500' },
    feed:         { padding: Spacing.md, gap: Spacing.md, paddingBottom: 100 },
    loadingWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingTxt:   { fontSize: Typography.base, color: Colors.textSecondary },
    emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyIcon:    { fontSize: 48 },
    emptyTitle:   { fontSize: Typography.lg, fontWeight: '500', color: Colors.textPrimary },
    emptySub:     { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    submitFab: {
      position: 'absolute', bottom: 16, left: 16, right: 16,
      backgroundColor: Colors.brackishWater, borderRadius: Radius.lg,
      paddingVertical: 14, alignItems: 'center',
      shadowColor: Colors.topbarBg, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
    },
    submitFabTxt: { fontFamily: 'Georgia', fontSize: Typography.base, fontWeight: '700', color: Colors.textOnDark, letterSpacing: 0.5 },
  }), [Colors])

  const fetchReports = useCallback(async () => {
    try {
      let query = supabase
        .from('catch_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (speciesFilter !== 'All species') {
        query = query.contains('species', [speciesFilter])
      }
      if (timeFilter === 'Today') {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        query = query.gte('created_at', today.toISOString())
      } else if (timeFilter === 'This week') {
        const week = new Date(); week.setDate(week.getDate() - 7)
        query = query.gte('created_at', week.toISOString())
      } else if (timeFilter === 'This month') {
        const month = new Date(); month.setDate(month.getDate() - 30)
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

  const onRefresh = () => { setRefreshing(true); fetchReports() }
  const onReportSubmitted = () => { setShowSubmit(false); fetchReports() }

  return (
    <View style={s.container}>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.filterStrip} contentContainerStyle={s.filterContent}
      >
        {SPECIES_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, speciesFilter === f && s.filterChipOn]}
            onPress={() => setSpeciesFilter(f)}
          >
            <Text style={[s.filterTxt, speciesFilter === f && s.filterTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.filterStrip2} contentContainerStyle={s.filterContent}
      >
        {TIME_FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.timeChip, timeFilter === f && s.timeChipOn]}
            onPress={() => setTimeFilter(f)}
          >
            <Text style={[s.timeTxt, timeFilter === f && s.timeTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading
        ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.brackishWater}/>
            <Text style={s.loadingTxt}>Loading catch reports...</Text>
          </View>
        )
        : (
          <ScrollView
            contentContainerStyle={s.feed}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brackishWater}/>
            }
          >
            {reports.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={s.emptyIcon}>🎣</Text>
                <Text style={s.emptyTitle}>No reports yet</Text>
                <Text style={s.emptySub}>Be the first to submit a catch report for this area.</Text>
              </View>
            )}
            {reports.map(r => (
              <ReportCard key={r.id} report={r} onPress={() => {}}/>
            ))}
          </ScrollView>
        )
      }

      <TouchableOpacity style={s.submitFab} onPress={() => setShowSubmit(true)} activeOpacity={0.9}>
        <Text style={s.submitFabTxt}>＋ Submit catch report</Text>
      </TouchableOpacity>

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
