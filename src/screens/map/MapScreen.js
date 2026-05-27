import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Modal,
  Dimensions, Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { fetchWeatherAndForecast } from '../../utils/weather'
import MapView, { Marker, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')

const GOOGLE_MAPS_KEY = 'AIzaSyBzwOhq7uIKao4Xw4Bht-op0y4Yj3Umpaw'

const LAYERS = [
  { id: 'radar',  label: 'Live radar',      icon: '🌧' },
  { id: 'wind',   label: 'Wind',            icon: '💨' },
  { id: 'charts', label: 'Nautical charts', icon: '🗺' },
]

const DEFAULT_REGION = {
  latitude:      30.1766,
  longitude:    -90.1146,
  latitudeDelta:  0.5,
  longitudeDelta: 0.5,
}

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0d2137' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ABEDC' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d2137' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1A3A52' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4A8FA8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A3A52' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#4A8FA8' }] },
]

const PARTICLE_COUNT = 28

function WindParticleOverlay({ windSpeed, windDeg }) {
  const { width: W, height: H } = Dimensions.get('window')
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      startX: Math.random() * W,
      startY: Math.random() * H,
      tx:      new Animated.Value(0),
      ty:      new Animated.Value(0),
      opacity: new Animated.Value(0),
      size:    2 + Math.random() * 2,
    }))
  ).current

  useEffect(() => {
    const rad   = (windDeg * Math.PI) / 180
    const dx    = -Math.sin(rad)
    const dy    = Math.cos(rad)
    const speed = Math.max(3, windSpeed)
    const dist  = Math.min(W, H) * 0.7
    const dur   = Math.round((dist / speed) * 350)

    const loops = particles.map((p, i) => {
      let loop
      const start = () => {
        p.tx.setValue(0); p.ty.setValue(0); p.opacity.setValue(0)
        p.startX = Math.random() * W; p.startY = Math.random() * H
        loop = Animated.parallel([
          Animated.timing(p.tx, { toValue: dx * dist, duration: dur, useNativeDriver: true }),
          Animated.timing(p.ty, { toValue: dy * dist, duration: dur, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.opacity, { toValue: 0.75, duration: Math.round(dur * 0.15), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0.75, duration: Math.round(dur * 0.65), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0,    duration: Math.round(dur * 0.2),  useNativeDriver: true }),
          ]),
        ])
        loop.start(({ finished }) => { if (finished) start() })
      }
      const delay = (dur / PARTICLE_COUNT) * i
      const timer = setTimeout(start, delay)
      return () => { clearTimeout(timer); loop?.stop() }
    })
    return () => { loops.forEach(cancel => cancel()) }
  }, [windDeg, windSpeed])

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.startX, top: p.startY,
          width: p.size, height: p.size, borderRadius: p.size / 2,
          backgroundColor: '#4A8FA8',
          transform: [{ translateX: p.tx }, { translateY: p.ty }],
          opacity: p.opacity,
        }}/>
      ))}
    </View>
  )
}

function radarFrameTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function MapScreen({ navigation }) {
  const { Colors } = useTheme()
  const { homePort, setHomePort } = useApp()
  const { user } = useAuth()
  const mapRef                              = useRef(null)
  const [region,          setRegion]        = useState(DEFAULT_REGION)
  const [location,        setLocation]      = useState(null)
  const [activeLayers,    setActiveLayers]  = useState([])
  const [mapType,         setMapType]       = useState('satellite')
  const [locLoading,      setLocLoading]    = useState(false)
  const [showLayers,      setShowLayers]    = useState(false)
  const [radarFrames,     setRadarFrames]   = useState([])
  const [radarFrameIdx,   setRadarFrameIdx] = useState(0)
  const [radarPlaying,    setRadarPlaying]  = useState(false)
  const [windData,        setWindData]      = useState(null)
  const [windLoading,     setWindLoading]   = useState(false)
  const radarIntervalRef                    = useRef(null)
  const slideAnim                           = useRef(new Animated.Value(0)).current

  // Saved fishing spots
  const [savedSpots,        setSavedSpots]        = useState([])
  const [selectedSavedSpot, setSelectedSavedSpot] = useState(null)
  const [spotModalVisible,  setSpotModalVisible]  = useState(false)
  const [pendingCoord,      setPendingCoord]       = useState(null)
  const [spotName,          setSpotName]           = useState('')
  const [spotNotes,         setSpotNotes]          = useState('')
  const [spotSaving,        setSpotSaving]         = useState(false)

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1 },
    map:       { flex: 1 },

    topBar:     { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    topBtn:     { backgroundColor: 'rgba(13,33,55,0.92)', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)' },
    topBtnText: { fontSize: Typography.sm, color: '#F5F0E8', fontWeight: '500' },

    layerPanel:  { position: 'absolute', top: 52, right: 12, backgroundColor: 'rgba(13,33,55,0.97)', borderRadius: Radius.lg, padding: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
    layerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'transparent' },
    layerBtnOn:  { backgroundColor: `${Colors.brackishWater}1F`, borderColor: Colors.brackishWater },
    layerIcon:   { fontSize: 14 },
    layerLabel:  { fontSize: Typography.sm, color: 'rgba(255,255,255,0.45)' },
    layerLabelOn:{ color: Colors.brackishWater, fontWeight: '500' },
    layerHint:   { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingHorizontal: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', marginTop: 4 },

    locBtn:     { position: 'absolute', right: 12, bottom: 100, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(13,33,55,0.92)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    locBtnText: { fontSize: 22, color: Colors.brackishWater },

    goldMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.doubloonGold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    goldMarkerTxt: { fontSize: 13 },

    spotCard:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.topbarBg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 32, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
    spotCardHd:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
    spotName:    { fontSize: Typography.md, fontWeight: '700', color: '#fff', flex: 1 },
    spotNotes:   { fontSize: Typography.sm, color: 'rgba(255,255,255,0.6)', marginBottom: 6, lineHeight: 20 },
    spotCoords:  { fontSize: Typography.xs, color: 'rgba(255,255,255,0.35)', marginBottom: 14 },
    closeBtn:    { padding: 4, marginLeft: 8 },
    closeBtnText:{ fontSize: 16, color: 'rgba(255,255,255,0.45)' },
    removeBtn:   { backgroundColor: 'rgba(226,75,74,0.15)', borderRadius: Radius.md, borderWidth: 0.5, borderColor: 'rgba(226,75,74,0.4)', paddingVertical: 12, alignItems: 'center' },
    removeBtnTxt:{ fontSize: Typography.base, color: '#E24B4A', fontWeight: '600' },

    radarBar:       { position: 'absolute', bottom: 60, left: 12, right: 12, backgroundColor: 'rgba(13,33,55,0.95)', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
    radarPlayBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brackishWater, alignItems: 'center', justifyContent: 'center' },
    radarPlayIcon:  { fontSize: 13, color: '#fff' },
    radarTimeline:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
    radarTick:      { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
    radarTickActive:{ backgroundColor: Colors.brackishWater, height: 7, borderRadius: 3.5 },
    radarTime:      { fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)', width: 62, textAlign: 'right' },

    // Save spot modal
    modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalSheet:    { backgroundColor: Colors.deepSea, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
    modalTitle:    { fontSize: Typography.lg, fontWeight: '700', color: '#fff', fontFamily: 'Georgia', marginBottom: 4 },
    modalInput:    { backgroundColor: Colors.inputBg, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, color: '#fff', fontSize: Typography.base, padding: 12 },
    modalInputNotes:{ height: 80, textAlignVertical: 'top' },
    modalSaveBtn:  { backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    modalSaveTxt:  { fontSize: Typography.base, color: Colors.deepSea, fontWeight: '700' },
    modalCancelBtn:{ paddingVertical: 10, alignItems: 'center' },
    modalCancelTxt:{ fontSize: Typography.base, color: 'rgba(255,255,255,0.4)' },
  }), [Colors])

  // Load saved spots
  useEffect(() => {
    if (!user) return
    supabase.from('saved_spots').select('*').eq('user_id', user.id)
      .then(({ data }) => setSavedSpots(data || []))
      .catch(() => {})
  }, [user?.id])

  useEffect(() => { getLocation() }, [])

  useEffect(() => {
    if (activeLayers.includes('wind') && !windData && !windLoading) {
      setWindLoading(true)
      fetchWeatherAndForecast(region.latitude, region.longitude)
        .then(w => setWindData(w?.current ?? null))
        .catch(() => {})
        .finally(() => setWindLoading(false))
    }
  }, [activeLayers, windData, windLoading, region.latitude, region.longitude])

  useEffect(() => {
    if (activeLayers.includes('radar') && radarFrames.length === 0) {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(r => r.json())
        .then(data => {
          const past = data.radar?.past ?? []
          const host = data.host ?? 'https://tilecache.rainviewer.com'
          const frames = past.map(f => ({ url: `${host}${f.path}`, time: f.time }))
          if (frames.length) { setRadarFrames(frames); setRadarFrameIdx(frames.length - 1); setRadarPlaying(true) }
        })
        .catch(() => {})
    }
  }, [activeLayers, radarFrames.length])

  const radarPlayingRef = useRef(true)
  const radarFramesRef  = useRef([])
  radarPlayingRef.current = radarPlaying
  radarFramesRef.current  = radarFrames

  useEffect(() => {
    const id = setInterval(() => {
      if (radarPlayingRef.current && radarFramesRef.current.length > 1) {
        setRadarFrameIdx(i => (i + 1) % radarFramesRef.current.length)
      }
    }, 600)
    return () => clearInterval(id)
  }, [])

  const getLocation = async () => {
    setLocLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') { setLocLoading(false); return }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const newRegion = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.3, longitudeDelta: 0.3 }
      setLocation(loc.coords)
      setRegion(newRegion)
      mapRef.current?.animateToRegion(newRegion, 1000)
    } catch (e) { console.log('Location error:', e) }
    finally { setLocLoading(false) }
  }

  const toggleLayer = (id) => {
    setActiveLayers(prev => {
      const next = prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
      if (id === 'radar' && !next.includes('radar')) { setRadarFrames([]); setRadarFrameIdx(0); setRadarPlaying(false) }
      if (id === 'wind'  && !next.includes('wind'))  { setWindData(null) }
      return next
    })
  }

  const toggleLayerPanel = () => {
    setShowLayers(!showLayers)
    Animated.spring(slideAnim, { toValue: showLayers ? 0 : 1, useNativeDriver: true }).start()
  }

  const openSaveSpotModal = useCallback((lat, lng, name) => {
    setPendingCoord({ lat, lng })
    setSpotName(name)
    setSpotNotes('')
    setSpotModalVisible(true)
  }, [])

  const handleLongPress = useCallback(async (coord) => {
    const { latitude, longitude } = coord
    try {
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}`
      const res  = await fetch(url)
      const data = await res.json()
      const name = data.results?.[0]?.formatted_address || `${latitude.toFixed(4)}° N, ${Math.abs(longitude).toFixed(4)}° W`
      Alert.alert('Location', name, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set as Home Port', onPress: () => setHomePort({ name, lat: latitude, lng: longitude }) },
        { text: 'Save as fishing spot', onPress: () => openSaveSpotModal(latitude, longitude, name) },
      ])
    } catch (_) {
      const name = `${latitude.toFixed(4)}° N, ${Math.abs(longitude).toFixed(4)}° W`
      Alert.alert('Location', name, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set as Home Port', onPress: () => setHomePort({ name, lat: latitude, lng: longitude }) },
        { text: 'Save as fishing spot', onPress: () => openSaveSpotModal(latitude, longitude, name) },
      ])
    }
  }, [setHomePort, openSaveSpotModal])

  const saveSpot = async () => {
    if (!user || !pendingCoord || !spotName.trim()) return
    setSpotSaving(true)
    try {
      const { data, error } = await supabase.from('saved_spots').insert({
        user_id:   user.id,
        name:      spotName.trim(),
        latitude:  pendingCoord.lat,
        longitude: pendingCoord.lng,
        notes:     spotNotes.trim() || null,
      }).select()
      if (!error && data?.[0]) setSavedSpots(prev => [...prev, data[0]])
    } catch (_) {}
    setSpotSaving(false)
    setSpotModalVisible(false)
  }

  const removeSpot = async (spotId) => {
    await supabase.from('saved_spots').delete().eq('id', spotId).catch(() => {})
    setSavedSpots(prev => prev.filter(s => s.id !== spotId))
    setSelectedSavedSpot(null)
  }

  return (
    <View style={styles.container}>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        customMapStyle={mapStyle}
        googleMapsApiKey={GOOGLE_MAPS_KEY}
        minZoomLevel={3}
        maxZoomLevel={18}
        onPress={() => { setSelectedSavedSpot(null) }}
        onLongPress={(e) => handleLongPress(e.nativeEvent.coordinate)}
        onRegionChangeComplete={setRegion}
      >
        {/* Radar tiles */}
        {activeLayers.includes('radar') && radarFrames.map((frame, i) => (
          <UrlTile key={i} urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
            zIndex={2} opacity={i === radarFrameIdx ? 0.65 : 0} tileSize={256}
            minimumZ={1} maximumZ={12} maximumNativeZ={8}/>
        ))}

        {/* Nautical charts tile overlay — NOAA RNC via ArcGIS (note {y}/{x} order) */}
        {activeLayers.includes('charts') && (
          <UrlTile
            urlTemplate="https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/rest/services/RNC/NOAA_RNC/MapServer/tile/{z}/{y}/{x}"
            zIndex={2}
            opacity={0.85}
            tileSize={256}
            minimumZ={4}
            maximumZ={16}
          />
        )}

        {/* Saved fishing spot markers */}
        {savedSpots.map(spot => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => { setSelectedSavedSpot(spot) }}
          >
            <View style={styles.goldMarker}>
              <Text style={styles.goldMarkerTxt}>⚓</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Wind particle overlay */}
      {activeLayers.includes('wind') && windData && (
        <WindParticleOverlay
          windSpeed={windData.windspeed_10m ?? 10}
          windDeg={windData.winddirection_10m ?? 180}
        />
      )}

      {/* TOP CONTROLS */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn}
          onPress={() => setMapType(t => t === 'satellite' ? 'standard' : 'satellite')}>
          <Text style={styles.topBtnText}>{mapType === 'satellite' ? '🗺 Map' : '🛰 Satellite'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}/>
        <TouchableOpacity style={styles.topBtn} onPress={toggleLayerPanel}>
          <Text style={styles.topBtnText}>⊞ Layers</Text>
        </TouchableOpacity>
      </View>

      {/* LAYER PANEL */}
      {showLayers && (
        <View style={styles.layerPanel}>
          {LAYERS.map(layer => {
            const on = activeLayers.includes(layer.id)
            return (
              <TouchableOpacity key={layer.id}
                style={[styles.layerBtn, on && styles.layerBtnOn]}
                onPress={() => toggleLayer(layer.id)}>
                <Text style={styles.layerIcon}>{layer.icon}</Text>
                <Text style={[styles.layerLabel, on && styles.layerLabelOn]}>{layer.label}</Text>
                {layer.id === 'radar' && on && radarFrames.length === 0 && <ActivityIndicator size="small" color={Colors.brackishWater} style={{ marginLeft: 4 }}/>}
                {layer.id === 'wind'  && windLoading && <ActivityIndicator size="small" color={Colors.brackishWater} style={{ marginLeft: 4 }}/>}
              </TouchableOpacity>
            )
          })}
          <Text style={styles.layerHint}>Long-press map to save spots or set Home Port</Text>
        </View>
      )}

      {/* MY LOCATION BUTTON */}
      <TouchableOpacity style={styles.locBtn} onPress={getLocation}>
        {locLoading
          ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
          : <Text style={styles.locBtnText}>◎</Text>
        }
      </TouchableOpacity>

      {/* RADAR TIMELINE */}
      {activeLayers.includes('radar') && radarFrames.length > 0 && !selectedSavedSpot && (
        <View style={styles.radarBar}>
          <TouchableOpacity onPress={() => setRadarPlaying(p => !p)} style={styles.radarPlayBtn}>
            <Text style={styles.radarPlayIcon}>{radarPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.radarTimeline}>
            {radarFrames.map((frame, i) => (
              <TouchableOpacity key={i}
                onPress={() => { setRadarFrameIdx(i); setRadarPlaying(false) }}
                style={[styles.radarTick, i === radarFrameIdx && styles.radarTickActive]}
              />
            ))}
          </View>
          <Text style={styles.radarTime}>{radarFrameTime(radarFrames[radarFrameIdx].time)}</Text>
        </View>
      )}

      {/* SELECTED SAVED SPOT CARD */}
      {selectedSavedSpot && (
        <View style={styles.spotCard}>
          <View style={styles.spotCardHd}>
            <Text style={styles.spotName}>{selectedSavedSpot.name}</Text>
            <TouchableOpacity onPress={() => setSelectedSavedSpot(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          {selectedSavedSpot.notes ? <Text style={styles.spotNotes}>{selectedSavedSpot.notes}</Text> : null}
          <Text style={styles.spotCoords}>
            {Number(selectedSavedSpot.latitude).toFixed(4)}° N · {Math.abs(Number(selectedSavedSpot.longitude)).toFixed(4)}° W
          </Text>
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeSpot(selectedSavedSpot.id)}>
            <Text style={styles.removeBtnTxt}>Remove spot</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SAVE FISHING SPOT MODAL */}
      <Modal visible={spotModalVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSpotModalVisible(false)}/>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Save fishing spot</Text>
            <TextInput
              style={styles.modalInput}
              value={spotName}
              onChangeText={setSpotName}
              placeholder="Spot name"
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputNotes]}
              value={spotNotes}
              onChangeText={setSpotNotes}
              placeholder="Notes (optional)"
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
            />
            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveSpot} disabled={spotSaving || !spotName.trim()}>
              <Text style={styles.modalSaveTxt}>{spotSaving ? 'Saving…' : 'Save spot'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSpotModalVisible(false)}>
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
