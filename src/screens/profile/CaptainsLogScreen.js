import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal, Switch,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useApp } from '../../context/AppContext'
import { useDataLocation } from '../../hooks/useDataLocation'
import HomePortPicker from '../../components/HomePortPicker'
import HomePortChip from '../../components/HomePortChip'
import SubmitReportScreen from '../reports/SubmitReportScreen'

const SPECIES_FILTERS = ['All', 'Speckled Trout', 'Redfish', 'Flounder', 'Sheepshead', 'Black Drum', 'Cobia', 'Tarpon']
const TIME_FILTERS    = ['All time', 'Today', 'This week', 'This month']
const SECTIONS        = ['My Catches', 'Saved Spots', 'Profile']

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hrs   = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  return `${days}d ago`
}

function initials(name) {
  return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'BP'
}

function CatchCard({ report }) {
  const { Colors } = useTheme()
  const s = useMemo(() => StyleSheet.create({
    card:            { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.md },
    photo:           { width: '100%', height: 160 },
    photoPlaceholder:{ height: 72, backgroundColor: Colors.inputBg, alignItems: 'center', justifyContent: 'center' },
    body:            { padding: Spacing.md, gap: 6 },
    row:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    loc:             { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
    when:            { fontSize: Typography.xs, color: Colors.textMuted },
    chips:           { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    chip:            { backgroundColor: `${Colors.brackishWater}33`, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    chipCount:       { backgroundColor: `${Colors.marshGreen}26` },
    chipTxt:         { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '500' },
    notes:           { fontSize: Typography.sm, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
    condRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    cond:            { fontSize: Typography.xs, color: Colors.textSecondary, backgroundColor: Colors.inputBg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.sm },
  }), [Colors])

  return (
    <View style={s.card}>
      {report.photo_url
        ? <Image source={{ uri: report.photo_url }} style={s.photo} resizeMode="cover"/>
        : <View style={s.photoPlaceholder}><Text style={{ fontSize: 28 }}>🎣</Text></View>
      }
      <View style={s.body}>
        <View style={s.row}>
          <Text style={s.loc} numberOfLines={1}>📍 {report.location_name || 'Unknown'}</Text>
          <Text style={s.when}>{timeAgo(report.created_at)}</Text>
        </View>
        <View style={s.chips}>
          {(report.species || []).map((sp, i) => (
            <View key={i} style={s.chip}><Text style={s.chipTxt}>{sp}</Text></View>
          ))}
          {report.count > 0 && (
            <View style={[s.chip, s.chipCount]}>
              <Text style={[s.chipTxt, { color: Colors.marshGreen }]}>{report.count} fish</Text>
            </View>
          )}
        </View>
        {report.notes ? <Text style={s.notes} numberOfLines={2}>"{report.notes}"</Text> : null}
        <View style={s.condRow}>
          {report.bait           && <Text style={s.cond}>🪱 {report.bait}</Text>}
          {report.water_temp     && <Text style={s.cond}>🌡 {report.water_temp}°</Text>}
          {report.tide_direction && <Text style={s.cond}>🌊 {report.tide_direction}</Text>}
        </View>
      </View>
    </View>
  )
}

function MyCatches({ user }) {
  const { Colors } = useTheme()
  const s = useMemo(() => StyleSheet.create({
    strip:       { maxHeight: 44, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    strip2:      { maxHeight: 38 },
    stripContent:{ paddingHorizontal: 12, paddingVertical: 6, gap: 6, flexDirection: 'row' },
    chip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.inputBg },
    chipOn:      { backgroundColor: Colors.buttonBg, borderColor: Colors.buttonBg },
    chipTxt:     { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    chipTxtOn:   { color: Colors.buttonText },
    timeChip:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 0.5, borderColor: 'transparent' },
    timeChipOn:  { backgroundColor: `${Colors.doubloonGold}1F`, borderColor: Colors.doubloonGold },
    timeTxt:     { fontSize: Typography.xs, color: Colors.textSecondary },
    timeTxtOn:   { color: Colors.doubloonGold, fontWeight: '500' },
    feed:        { padding: Spacing.md, paddingBottom: 32 },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    empty:       { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyTitle:  { fontSize: Typography.lg, fontWeight: '500', color: Colors.textPrimary },
    emptySub:    { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
    fab:         { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: Colors.buttonBg, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
    fabTxt:      { fontFamily: 'Georgia', fontSize: Typography.base, fontWeight: '700', color: Colors.buttonText, letterSpacing: 0.5 },
  }), [Colors])

  const [reports,       setReports]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [speciesFilter, setSpeciesFilter] = useState('All')
  const [timeFilter,    setTimeFilter]    = useState('All time')
  const [showSubmit,    setShowSubmit]    = useState(false)

  const fetchReports = useCallback(async () => {
    try {
      let query = supabase
        .from('catch_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (speciesFilter !== 'All') query = query.contains('species', [speciesFilter])
      if (timeFilter === 'Today') {
        const t = new Date(); t.setHours(0, 0, 0, 0)
        query = query.gte('created_at', t.toISOString())
      } else if (timeFilter === 'This week') {
        const t = new Date(); t.setDate(t.getDate() - 7)
        query = query.gte('created_at', t.toISOString())
      } else if (timeFilter === 'This month') {
        const t = new Date(); t.setDate(t.getDate() - 30)
        query = query.gte('created_at', t.toISOString())
      }
      const { data, error } = await query
      if (error) throw error
      setReports(data || [])
    } catch (e) { console.log('Fetch my catches error:', e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [speciesFilter, timeFilter, user.id])

  useEffect(() => { fetchReports() }, [fetchReports])
  const onRefresh = () => { setRefreshing(true); fetchReports() }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip} contentContainerStyle={s.stripContent}>
        {SPECIES_FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.chip, speciesFilter === f && s.chipOn]} onPress={() => setSpeciesFilter(f)}>
            <Text style={[s.chipTxt, speciesFilter === f && s.chipTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip2} contentContainerStyle={s.stripContent}>
        {TIME_FILTERS.map(f => (
          <TouchableOpacity key={f} style={[s.timeChip, timeFilter === f && s.timeChipOn]} onPress={() => setTimeFilter(f)}>
            <Text style={[s.timeTxt, timeFilter === f && s.timeTxtOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={Colors.brackishWater}/></View>
      ) : (
        <ScrollView contentContainerStyle={s.feed}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.doubloonGold}/>}>
          {reports.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🎣</Text>
              <Text style={s.emptyTitle}>No catches yet</Text>
              <Text style={s.emptySub}>Submit your first catch report below.</Text>
            </View>
          ) : (
            reports.map(r => <CatchCard key={r.id} report={r}/>)
          )}
          <View style={{ height: 100 }}/>
        </ScrollView>
      )}
      <TouchableOpacity style={s.fab} onPress={() => setShowSubmit(true)} activeOpacity={0.9}>
        <Text style={s.fabTxt}>＋ Submit catch</Text>
      </TouchableOpacity>
      {showSubmit && (
        <Modal visible animationType="slide" presentationStyle="pageSheet">
          <SubmitReportScreen onClose={() => setShowSubmit(false)} onSubmitted={() => { setShowSubmit(false); fetchReports() }}/>
        </Modal>
      )}
    </View>
  )
}

function SavedSpots() {
  const { Colors } = useTheme()
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>⚓</Text>
      <Text style={{ fontSize: Typography.lg, fontWeight: '500', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>No saved spots yet</Text>
      <Text style={{ fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>Long-press any location on the Map to save it here.</Text>
    </View>
  )
}

function ProfileSection({ user }) {
  const { Colors } = useTheme()
  const { homePort }                                                   = useApp()
  const { tideStation, buoy, weatherLocation, solunarLocation }       = useDataLocation()
  const [showHomePort,       setShowHomePort]       = useState(false)
  const [notifBite,          setNotifBite]          = useState(false)
  const [notifTide,          setNotifTide]          = useState(false)
  const [showFeedback,       setShowFeedback]       = useState(false)
  const [feedbackText,       setFeedbackText]       = useState('')
  const [feedbackCategory,   setFeedbackCategory]   = useState('Feature request')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSuccess,    setFeedbackSuccess]    = useState(false)
  const successTimer = useRef(null)

  const FEEDBACK_CATS = ['Bug report', 'Feature request', 'Design change', 'Other']

  const submitFeedback = useCallback(async () => {
    if (!feedbackText.trim() || feedbackSubmitting) return
    setFeedbackSubmitting(true)
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id:     user.id,
        category:    feedbackCategory,
        message:     feedbackText.trim(),
        app_version: '1.0.0',
      })
      if (error) throw error
      setFeedbackSuccess(true)
      successTimer.current = setTimeout(() => {
        setShowFeedback(false)
        setFeedbackText('')
        setFeedbackCategory('Feature request')
        setFeedbackSuccess(false)
        setFeedbackSubmitting(false)
      }, 2000)
    } catch (e) {
      console.log('Feedback submit error:', e)
      setFeedbackSubmitting(false)
    }
  }, [feedbackText, feedbackCategory, feedbackSubmitting, user.id])

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  const s = useMemo(() => StyleSheet.create({
    content:       { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 32 },
    avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 6 },
    avatar:        { width: 72, height: 72, borderRadius: 36, backgroundColor: `${Colors.brackishWater}40`, borderWidth: 1.5, borderColor: Colors.brackishWater, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:     { fontSize: Typography.xxl, fontWeight: '700', color: Colors.brackishWater, fontFamily: 'Georgia' },
    userName:      { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    userEmail:     { fontSize: Typography.sm, color: Colors.textSecondary },
    statsRow:      { flexDirection: 'row', gap: 8 },
    statBox:       { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, alignItems: 'center', gap: 3 },
    statVal:       { fontSize: Typography.xl, fontWeight: '700', color: Colors.catFish, fontFamily: 'Georgia' },
    statLabel:     { fontSize: Typography.xs, color: Colors.textSecondary },
    card:          { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.lg, gap: Spacing.md },
    cardTitle:     { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
    homePortRow:   { gap: 3 },
    homePortName:  { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary },
    homePortCoords:{ fontSize: Typography.xs, color: Colors.textSecondary },
    homePortEdit:  { fontSize: Typography.sm, color: Colors.brackishWater, marginTop: 4 },
    stationRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    stationBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    stationIcon:   { fontSize: 18, width: 24 },
    stationLabel:  { fontSize: Typography.xs, color: Colors.textSecondary },
    stationVal:    { fontSize: Typography.sm, fontWeight: '500', color: Colors.textPrimary },
    notifRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    notifLabel:    { fontSize: Typography.base, color: Colors.textPrimary },
    signOutBtn:    { backgroundColor: Colors.dangerBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: `${Colors.danger}59`, paddingVertical: 13, alignItems: 'center' },
    signOutTxt:    { fontSize: Typography.base, color: Colors.danger, fontWeight: '600' },
    feedbackRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 14, paddingHorizontal: Spacing.lg },
    feedbackIcon:  { fontSize: 20 },
    feedbackLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, fontWeight: '500' },
    feedbackChev:  { fontSize: Typography.base, color: Colors.textSecondary },
    fbOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    fbSheet:       { backgroundColor: Colors.cardBg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
    fbTitle:       { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    fbInput:       { backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, padding: 12, fontSize: Typography.base, color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top' },
    fbCatRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fbCat:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.inputBg },
    fbCatOn:       { backgroundColor: Colors.buttonBg, borderColor: Colors.buttonBg },
    fbCatTxt:      { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
    fbCatTxtOn:    { color: Colors.buttonText },
    fbSubmit:      { backgroundColor: Colors.buttonBg, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
    fbSubmitTxt:   { fontSize: Typography.base, fontWeight: '700', color: Colors.buttonText, letterSpacing: 0.3 },
    fbSuccess:     { alignItems: 'center', paddingVertical: Spacing.xl, gap: 12 },
    fbSuccessEmoji:{ fontSize: 44 },
    fbSuccessTxt:  { fontSize: Typography.lg, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  }), [Colors])

  const userName     = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Captain'
  const userInitials = initials(userName)
  const stats        = [{ label: 'Catches', val: '—' }, { label: 'Species', val: '—' }, { label: 'Reports', val: '—' }]
  const stationRows  = [
    { icon: '🌊', label: 'Tide station',    val: tideStation.name },
    { icon: '📡', label: 'Wave buoy',        val: buoy.name },
    { icon: '🌤', label: 'Weather location', val: weatherLocation.name },
    { icon: '🌙', label: 'Solunar location', val: solunarLocation.name },
  ]

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.avatarSection}>
        <View style={s.avatar}><Text style={s.avatarTxt}>{userInitials}</Text></View>
        <Text style={s.userName}>{userName}</Text>
        <Text style={s.userEmail}>{user?.email}</Text>
      </View>

      <View style={s.statsRow}>
        {stats.map((st, i) => (
          <View key={i} style={s.statBox}>
            <Text style={s.statVal}>{st.val}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Home Port */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Home Port</Text>
        <TouchableOpacity style={s.homePortRow} onPress={() => setShowHomePort(true)}>
          <Text style={s.homePortName} numberOfLines={1}>{homePort.name}</Text>
          <Text style={s.homePortCoords}>{homePort.lat.toFixed(4)}° N, {Math.abs(homePort.lng).toFixed(4)}° W</Text>
          <Text style={s.homePortEdit}>Change ›</Text>
        </TouchableOpacity>
      </View>

      {/* Active stations */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Active Data Sources</Text>
        {stationRows.map((r, i) => (
          <View key={i} style={[s.stationRow, i < stationRows.length - 1 && s.stationBorder]}>
            <Text style={s.stationIcon}>{r.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.stationLabel}>{r.label}</Text>
              <Text style={s.stationVal} numberOfLines={1}>{r.val}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Notifications */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Notifications</Text>
        <View style={s.notifRow}>
          <Text style={s.notifLabel}>Bite alerts</Text>
          <Switch value={notifBite} onValueChange={setNotifBite}
            trackColor={{ false: Colors.border, true: Colors.buttonBg }}
            thumbColor={notifBite ? Colors.textOnDark : Colors.textMuted}/>
        </View>
        <View style={[s.notifRow, { borderTopWidth: 0.5, borderTopColor: Colors.border }]}>
          <Text style={s.notifLabel}>Tide change alerts</Text>
          <Switch value={notifTide} onValueChange={setNotifTide}
            trackColor={{ false: Colors.border, true: Colors.brackishWater }}
            thumbColor={notifTide ? '#fff' : 'rgba(255,255,255,0.4)'}/>
        </View>
      </View>

      {/* Send feedback */}
      <TouchableOpacity style={s.feedbackRow} onPress={() => setShowFeedback(true)} activeOpacity={0.75}>
        <Text style={s.feedbackIcon}>💬</Text>
        <Text style={s.feedbackLabel}>Suggest a feature or improvement</Text>
        <Text style={s.feedbackChev}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.signOutBtn} onPress={() => supabase.auth.signOut()} activeOpacity={0.8}>
        <Text style={s.signOutTxt}>Sign out</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }}/>
      <HomePortPicker visible={showHomePort} onClose={() => setShowHomePort(false)}/>

      <Modal visible={showFeedback} transparent animationType="slide" onRequestClose={() => setShowFeedback(false)}>
        <KeyboardAvoidingView style={s.fbOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowFeedback(false)}/>
          <View style={s.fbSheet}>
            {feedbackSuccess ? (
              <View style={s.fbSuccess}>
                <Text style={s.fbSuccessEmoji}>🎣</Text>
                <Text style={s.fbSuccessTxt}>Thanks! We read every suggestion.</Text>
              </View>
            ) : (
              <>
                <Text style={s.fbTitle}>Share feedback</Text>
                <TextInput
                  style={s.fbInput}
                  placeholder="Describe your idea or the change you'd like to see..."
                  placeholderTextColor={Colors.textMuted}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  multiline
                  maxLength={1000}
                />
                <View style={s.fbCatRow}>
                  {FEEDBACK_CATS.map(cat => (
                    <TouchableOpacity key={cat} style={[s.fbCat, feedbackCategory === cat && s.fbCatOn]} onPress={() => setFeedbackCategory(cat)}>
                      <Text style={[s.fbCatTxt, feedbackCategory === cat && s.fbCatTxtOn]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[s.fbSubmit, (!feedbackText.trim() || feedbackSubmitting) && { opacity: 0.5 }]}
                  onPress={submitFeedback} activeOpacity={0.85} disabled={!feedbackText.trim() || feedbackSubmitting}>
                  <Text style={s.fbSubmitTxt}>{feedbackSubmitting ? 'Sending…' : 'Submit'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  )
}

export default function CaptainsLogScreen() {
  const insets          = useSafeAreaInsets()
  const { user }        = useAuth()
  const { Colors }      = useTheme()
  const [activeSection, setActiveSection] = useState(0)

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.screenBg },
    topbar:    { backgroundColor: Colors.topbarBg, paddingHorizontal: Spacing.lg, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    topbarTitle:{ flex: 1, fontFamily: 'Georgia', fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.5 },
    tabBar:    { flexDirection: 'row', backgroundColor: Colors.topbarBg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    tabBtn:    { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabBtnOn:  { borderBottomWidth: 2, borderBottomColor: Colors.doubloonGold },
    tabTxt:    { fontSize: Typography.sm, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
    tabTxtOn:  { color: Colors.doubloonGold, fontWeight: '700' },
  }), [Colors])

  return (
    <View style={s.container}>
      <View style={[s.topbar, { paddingTop: insets.top + 10 }]}>
        <HomePortChip/>
        <Text style={s.topbarTitle}>Captain's Log</Text>
      </View>
      <View style={s.tabBar}>
        {SECTIONS.map((sec, i) => (
          <TouchableOpacity key={i} style={[s.tabBtn, activeSection === i && s.tabBtnOn]} onPress={() => setActiveSection(i)}>
            <Text style={[s.tabTxt, activeSection === i && s.tabTxtOn]}>{sec}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flex: 1, backgroundColor: Colors.screenBg }}>
        {activeSection === 0 && user && <MyCatches user={user}/>}
        {activeSection === 1 && <SavedSpots/>}
        {activeSection === 2 && user && <ProfileSection user={user}/>}
      </View>
    </View>
  )
}
