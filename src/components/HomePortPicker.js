import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Location from 'expo-location'
import { Colors, Typography, Spacing, Radius } from '../constants/theme'
import { useApp } from '../context/AppContext'

const GOOGLE_KEY = 'AIzaSyBzwOhq7uIKao4Xw4Bht-op0y4Yj3Umpaw'

export default function HomePortPicker({ visible, onClose }) {
  const { setHomePort } = useApp()
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [loading,    setLoading]    = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error,      setError]      = useState(null)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`
      const res  = await fetch(url)
      const data = await res.json()
      if (data.status === 'OK') {
        setResults(data.results)
      } else {
        setResults([])
        setError('No results found. Try a different search.')
      }
    } catch (_) {
      setError('Search failed. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const useGPS = async () => {
    setGpsLoading(true)
    setError(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setError('Location permission denied.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude, longitude } = loc.coords
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_KEY}`
      const res  = await fetch(url)
      const data = await res.json()
      const name = data.results?.[0]?.formatted_address || 'Current Location'
      await setHomePort({ name, lat: latitude, lng: longitude })
      handleClose()
    } catch (_) {
      setError('Could not get your location.')
    } finally {
      setGpsLoading(false)
    }
  }

  const select = async (result) => {
    const { lat, lng } = result.geometry.location
    await setHomePort({ name: result.formatted_address, lat, lng })
    handleClose()
  }

  const handleClose = () => {
    setQuery('')
    setResults([])
    setError(null)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={s.header}>
          <Text style={s.title}>Set Home Port</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.gpsBtn} onPress={useGPS} disabled={gpsLoading} activeOpacity={0.7}>
          {gpsLoading
            ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
            : <Text style={s.gpsTxt}>📍  Use my current GPS location</Text>
          }
        </TouchableOpacity>

        <View style={s.dividerRow}>
          <View style={s.divider}/>
          <Text style={s.dividerTxt}>or search</Text>
          <View style={s.divider}/>
        </View>

        <View style={s.searchRow}>
          <TextInput
            style={s.input}
            placeholder="Bay, marina, city, or coastal area…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            returnKeyType="search"
            autoCapitalize="words"
          />
          <TouchableOpacity style={s.searchBtn} onPress={search} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color="#fff"/>
              : <Text style={s.searchBtnTxt}>Search</Text>
            }
          </TouchableOpacity>
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <FlatList
          data={results}
          keyExtractor={(_, i) => String(i)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={s.result} onPress={() => select(item)} activeOpacity={0.7}>
              <Text style={s.resultIcon}>⚓</Text>
              <Text style={s.resultName} numberOfLines={2}>{item.formatted_address}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={s.sep}/>}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            !loading && query.length > 0 && results.length === 0 && !error
              ? <Text style={s.empty}>Try "Shell Beach, LA" or "Grand Isle" …</Text>
              : null
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.saltWhite },

  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  title:    { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
  closeBtn: { padding: 4 },
  closeTxt: { fontSize: 18, color: Colors.textSecondary },

  gpsBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: Spacing.lg, backgroundColor: 'rgba(74,143,168,0.1)', borderRadius: Radius.md, paddingVertical: 14, borderWidth: 0.5, borderColor: Colors.brackishWater },
  gpsTxt:  { fontSize: Typography.base, color: Colors.brackishWater, fontWeight: '600' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  divider:    { flex: 1, height: 0.5, backgroundColor: Colors.border },
  dividerTxt: { fontSize: Typography.xs, color: Colors.textMuted, marginHorizontal: 10 },

  searchRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: 8, marginBottom: Spacing.sm },
  input:     { flex: 1, backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: Typography.base, color: Colors.textPrimary },
  searchBtn: { backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  searchBtnTxt:{ fontSize: Typography.sm, color: '#fff', fontWeight: '700' },

  error: { fontSize: Typography.sm, color: '#c0392b', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },

  result:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: 14 },
  resultIcon: { fontSize: 16, marginTop: 1 },
  resultName: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, lineHeight: 22 },
  sep:        { height: 0.5, backgroundColor: Colors.border, marginLeft: Spacing.lg + 28 },

  empty: { textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sm, marginTop: 24, paddingHorizontal: 32 },
})
