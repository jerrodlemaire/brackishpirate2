import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
  Dimensions, Animated,
} from 'react-native'
import { fetchWeatherAndForecast } from '../../utils/weather'
import MapView, { Marker, Circle, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
import { fetchNoaaStations } from '../../utils/tides'
import { useApp } from '../../context/AppContext'

const { width } = Dimensions.get('window')

const GOOGLE_MAPS_KEY = 'AIzaSyBzwOhq7uIKao4Xw4Bht-op0y4Yj3Umpaw'

const HOTSPOTS = [
  { id: '1', name: 'Shell Beach Reef',   lat: 29.8650, lng: -89.6740, activity: 'hot',      score: 92, depth: '8 ft',  species: ['Speckled Trout', 'Redfish'],            distance: '2.1 mi', tip: 'Morning incoming tide. Gulp shrimp under cork.' },
  { id: '2', name: 'Rigolets Pass',      lat: 30.1650, lng: -89.7300, activity: 'moderate', score: 68, depth: '14 ft', species: ['Flounder', 'Sheepshead'],                distance: '5.4 mi', tip: 'Live shrimp near bridge pilings on outgoing tide.' },
  { id: '3', name: 'MRGO Channel',       lat: 29.9500, lng: -89.8200, activity: 'moderate', score: 61, depth: '22 ft', species: ['Redfish', 'Black Drum'],                 distance: '7.8 mi', tip: 'Deep jigging near structure. Best at first light.' },
  { id: '4', name: 'Lake Borgne Flats',  lat: 30.0200, lng: -89.6100, activity: 'hot',      score: 88, depth: '4 ft',  species: ['Speckled Trout', 'Flounder'],            distance: '9.2 mi', tip: 'Sight casting on the flats. Popping cork with live shrimp.' },
  { id: '5', name: 'Point Aux Herbes',   lat: 30.1100, lng: -89.5800, activity: 'low',      score: 42, depth: '6 ft',  species: ['Redfish'],                               distance: '11.4 mi', tip: 'Slow bite. Try early morning on the marsh edges.' },
  { id: '6', name: 'Chef Pass',          lat: 30.0750, lng: -89.7800, activity: 'hot',      score: 85, depth: '10 ft', species: ['Speckled Trout', 'Redfish', 'Flounder'], distance: '4.6 mi', tip: 'Triple species day possible. Incoming tide at dawn.' },
]

const ACTIVITY_COLORS = {
  hot:      { fill: 'rgba(231,76,60,0.25)',  stroke: 'rgba(231,76,60,0.7)',  dot: '#E74C3C', label: '🔥 Hot bite' },
  moderate: { fill: 'rgba(196,154,42,0.2)',  stroke: 'rgba(196,154,42,0.7)', dot: '#C49A2A', label: '⚡ Moderate' },
  low:      { fill: 'rgba(74,143,168,0.15)', stroke: 'rgba(74,143,168,0.6)', dot: '#4A8FA8', label: 'Active' },
}

const LAYERS = [
  { id: 'fish',  label: 'Fish activity', icon: '🐟' },
  { id: 'tides', label: 'Tide stations', icon: '🌊' },
  { id: 'radar', label: 'Live radar',    icon: '🌧' },
  { id: 'wind',  label: 'Wind',          icon: '💨' },
  { id: 'ramps', label: 'Boat ramps',    icon: '⚓' },
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
        p.tx.setValue(0)
        p.ty.setValue(0)
        p.opacity.setValue(0)
        p.startX = Math.random() * W
        p.startY = Math.random() * H
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
          position: 'absolute',
          left: p.startX,
          top:  p.startY,
          width:  p.size,
          height: p.size,
          borderRadius: p.size / 2,
          backgroundColor: '#4A8FA8',
          transform: [{ translateX: p.tx }, { translateY: p.ty }],
          opacity: p.opacity,
        }}/>
      ))}
    </View>
  )
}

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function radarFrameTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function MapScreen({ navigation }) {
  const { Colors } = useTheme()
  const { homePort, setHomePort, activeStation, setActiveStation } = useApp()
  const mapRef                             = useRef(null)
  const [region,          setRegion]       = useState(DEFAULT_REGION)
  const [location,        setLocation]     = useState(null)
  const [selectedSpot,    setSelectedSpot] = useState(null)
  const [activeLayers,    setActiveLayers] = useState(['fish'])
  const [mapType,         setMapType]      = useState('satellite')
  const [locLoading,      setLocLoading]   = useState(false)
  const [showLayers,      setShowLayers]   = useState(false)
  const [noaaStations,    setNoaaStations]    = useState([])
  const [stationsLoaded,  setStationsLoaded]  = useState(false)
  const [stationsLoading, setStationsLoading] = useState(false)
  const [selectedStation, setSelectedStationCard] = useState(null)
  const [radarFrames,    setRadarFrames]    = useState([])
  const [radarFrameIdx,  setRadarFrameIdx]  = useState(0)
  const [radarPlaying,   setRadarPlaying]   = useState(false)
  const [windData,       setWindData]       = useState(null)
  const [windLoading,    setWindLoading]    = useState(false)
  const radarIntervalRef                    = useRef(null)
  const slideAnim                           = useRef(new Animated.Value(0)).current

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

    locBtn:     { position: 'absolute', right: 12, bottom: 220, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(13,33,55,0.92)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    locBtnText: { fontSize: 22, color: Colors.brackishWater },

    legend:     { position: 'absolute', left: 12, bottom: 220, backgroundColor: 'rgba(13,33,55,0.82)', borderRadius: Radius.md, padding: 10, gap: 5 },
    legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot:  { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: Typography.xs, color: '#F5F0E8' },

    markerDot:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    markerScore: { fontSize: Typography.xs, color: '#fff', fontWeight: '700' },

    stationMarker:       { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.brackishWater, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
    stationMarkerActive: { backgroundColor: Colors.doubloonGold, borderColor: '#fff', borderWidth: 2 },
    stationMarkerTxt:    { fontSize: 11, color: '#fff', fontWeight: '700' },

    spotCard:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.topbarBg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 32, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.1)' },
    spotCardHd:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    spotName:    { fontSize: Typography.md, fontWeight: '700', color: '#fff' },
    spotMeta:    { fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    scoreBadge:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    scoreText:   { fontSize: Typography.sm, color: '#fff', fontWeight: '700' },
    closeBtn:    { padding: 4, marginLeft: 8 },
    closeBtnText:{ fontSize: 16, color: 'rgba(255,255,255,0.45)' },
    speciesRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
    chip:        { backgroundColor: `${Colors.brackishWater}33`, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
    chipText:    { fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '500' },
    spotTip:     { fontSize: Typography.sm, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginBottom: 14 },
    saveBtn:     { backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
    saveBtnText: { fontSize: Typography.base, color: '#fff', fontWeight: '500' },
    activeBadge: { backgroundColor: `${Colors.brackishWater}1A`, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10, alignSelf: 'flex-start', borderWidth: 0.5, borderColor: Colors.brackishWater },
    activeBadgeTxt:{ fontSize: Typography.xs, color: Colors.brackishWater, fontWeight: '600' },

    radarBar:       { position: 'absolute', bottom: 155, left: 12, right: 12, backgroundColor: 'rgba(13,33,55,0.95)', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
    radarPlayBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brackishWater, alignItems: 'center', justifyContent: 'center' },
    radarPlayIcon:  { fontSize: 13, color: '#fff' },
    radarTimeline:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
    radarTick:      { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
    radarTickActive:{ backgroundColor: Colors.brackishWater, height: 7, borderRadius: 3.5 },
    radarTime:      { fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)', width: 62, textAlign: 'right' },

    nearbyStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(13,33,55,0.97)', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: 14, paddingBottom: 28, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
    nearbyTitle: { fontSize: Typography.sm, fontWeight: '500', color: 'rgba(255,255,255,0.45)', paddingHorizontal: 16, marginBottom: 10 },
    nearbyCard:  { width: 140, marginLeft: 12, backgroundColor: '#1A3A52', borderRadius: Radius.md, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
    nearbyDot:   { width: 8, height: 8, borderRadius: 4, marginBottom: 5 },
    nearbyName:  { fontSize: Typography.sm, fontWeight: '500', color: '#fff', marginBottom: 2 },
    nearbyMeta:  { fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)', marginBottom: 3 },
    nearbyActivity:{ fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)' },
  }), [Colors])

  useEffect(() => { getLocation() }, [])

  useEffect(() => {
    if (activeLayers.includes('tides') && !stationsLoaded && !stationsLoading) {
      setStationsLoading(true)
      fetchNoaaStations()
        .then(data => { setNoaaStations(data); setStationsLoaded(true) })
        .catch(() => {})
        .finally(() => setStationsLoading(false))
    }
  }, [activeLayers, stationsLoaded, stationsLoading])

  useEffect(() => {
    if (activeLayers.includes('wind') && !windData && !windLoading) {
      setWindLoading(true)
      const lat = region.latitude, lng = region.longitude
      fetchWeatherAndForecast(lat, lng)
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
          if (frames.length) {
            setRadarFrames(frames)
            setRadarFrameIdx(frames.length - 1)
            setRadarPlaying(true)
          }
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
      const newRegion = {
        latitude:      loc.coords.latitude,
        longitude:     loc.coords.longitude,
        latitudeDelta:  0.3,
        longitudeDelta: 0.3,
      }
      setLocation(loc.coords)
      setRegion(newRegion)
      mapRef.current?.animateToRegion(newRegion, 1000)
    } catch (e) {
      console.log('Location error:', e)
    } finally {
      setLocLoading(false)
    }
  }

  const toggleLayer = (id) => {
    setActiveLayers(prev => {
      const next = prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
      if (id === 'radar' && !next.includes('radar')) {
        setRadarFrames([])
        setRadarFrameIdx(0)
        setRadarPlaying(false)
      }
      if (id === 'wind' && !next.includes('wind')) {
        setWindData(null)
      }
      return next
    })
  }

  const toggleLayerPanel = () => {
    setShowLayers(!showLayers)
    Animated.spring(slideAnim, { toValue: showLayers ? 0 : 1, useNativeDriver: true }).start()
  }

  const selectSpot = (spot) => {
    setSelectedSpot(spot)
    setSelectedStationCard(null)
    mapRef.current?.animateToRegion({
      latitude:      spot.lat - 0.02,
      longitude:     spot.lng,
      latitudeDelta:  0.12,
      longitudeDelta: 0.12,
    }, 600)
  }

  const selectNoaaStation = (station) => {
    setSelectedStationCard(station)
    setSelectedSpot(null)
    mapRef.current?.animateToRegion({
      latitude:      station.lat - 0.02,
      longitude:     station.lng,
      latitudeDelta:  0.12,
      longitudeDelta: 0.12,
    }, 600)
  }

  const useThisStation = async () => {
    if (!selectedStation) return
    await setActiveStation({ id: selectedStation.id, name: selectedStation.name })
    setSelectedStationCard(null)
    navigation.navigate('Tides')
  }

  const handleLongPress = useCallback(async (coord) => {
    const { latitude, longitude } = coord
    try {
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_KEY}`
      const res  = await fetch(url)
      const data = await res.json()
      const name = data.results?.[0]?.formatted_address || `${latitude.toFixed(4)}° N, ${Math.abs(longitude).toFixed(4)}° W`
      Alert.alert(
        'Set Home Port',
        `Set "${name}" as your Home Port?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Home Port', onPress: () => setHomePort({ name, lat: latitude, lng: longitude }) },
        ]
      )
    } catch (_) {
      Alert.alert('Set Home Port', `Set this location as Home Port?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set', onPress: () => setHomePort({ name: `${latitude.toFixed(4)}° N`, lat: latitude, lng: longitude }) },
      ])
    }
  }, [setHomePort])

  const visibleStations = activeLayers.includes('tides')
    ? noaaStations
        .filter(st =>
          st.lat >= region.latitude - region.latitudeDelta * 1.5 &&
          st.lat <= region.latitude + region.latitudeDelta * 1.5 &&
          st.lng >= region.longitude - region.longitudeDelta * 1.5 &&
          st.lng <= region.longitude + region.longitudeDelta * 1.5
        )
        .slice(0, 40)
    : []

  const fishLayerOn = activeLayers.includes('fish')

  const userLat = location?.latitude ?? homePort.lat
  const userLng = location?.longitude ?? homePort.lng

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
        onPress={() => { setSelectedSpot(null); setSelectedStationCard(null) }}
        onLongPress={(e) => handleLongPress(e.nativeEvent.coordinate)}
        onRegionChangeComplete={setRegion}
      >
        {/* Fish activity circles + markers */}
        {fishLayerOn && HOTSPOTS.map(spot => {
          const colors = ACTIVITY_COLORS[spot.activity]
          return (
            <React.Fragment key={spot.id}>
              <Circle center={{ latitude: spot.lat, longitude: spot.lng }} radius={2200}
                fillColor={colors.fill} strokeColor={colors.stroke} strokeWidth={1.5}/>
              <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}
                onPress={() => { try { selectSpot(spot) } catch(_){} }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.markerDot, { backgroundColor: colors.dot }]}>
                  <Text style={styles.markerScore}>{spot.score}</Text>
                </View>
              </Marker>
            </React.Fragment>
          )
        })}

        {/* NOAA tide station markers */}
        {visibleStations.map(st => {
          const isActive = st.id === activeStation.id
          return (
            <Marker key={st.id}
              coordinate={{ latitude: st.lat, longitude: st.lng }}
              onPress={() => { try { selectNoaaStation(st) } catch(_){} }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.stationMarker, isActive && styles.stationMarkerActive]}>
                <Text style={styles.stationMarkerTxt}>T</Text>
              </View>
            </Marker>
          )
        })}

        {/* Live radar tile overlay */}
        {activeLayers.includes('radar') && radarFrames.map((frame, i) => (
          <UrlTile
            key={i}
            urlTemplate={`${frame.url}/256/{z}/{x}/{y}/2/1_1.png`}
            zIndex={2}
            opacity={i === radarFrameIdx ? 0.65 : 0}
            tileSize={256}
            minimumZ={1}
            maximumZ={12}
            maximumNativeZ={8}
          />
        ))}
      </MapView>

      {/* ANIMATED WIND PARTICLES */}
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
                {layer.id === 'tides' && stationsLoading && <ActivityIndicator size="small" color={Colors.brackishWater} style={{ marginLeft: 4 }}/>}
                {layer.id === 'radar' && activeLayers.includes('radar') && radarFrames.length === 0 && <ActivityIndicator size="small" color={Colors.brackishWater} style={{ marginLeft: 4 }}/>}
                {layer.id === 'wind'  && windLoading && <ActivityIndicator size="small" color={Colors.brackishWater} style={{ marginLeft: 4 }}/>}
              </TouchableOpacity>
            )
          })}
          <Text style={styles.layerHint}>Long-press map to set Home Port</Text>
        </View>
      )}

      {/* MY LOCATION BUTTON */}
      <TouchableOpacity style={styles.locBtn} onPress={getLocation}>
        {locLoading
          ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
          : <Text style={styles.locBtnText}>◎</Text>
        }
      </TouchableOpacity>

      {/* ACTIVITY LEGEND */}
      {fishLayerOn && !selectedSpot && !selectedStation && (
        <View style={styles.legend}>
          {Object.entries(ACTIVITY_COLORS).map(([key, val]) => (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: val.dot }]}/>
              <Text style={styles.legendText}>{val.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* SELECTED SPOT CARD */}
      {selectedSpot && (
        <View style={styles.spotCard}>
          <View style={styles.spotCardHd}>
            <View style={{ flex: 1 }}>
              <Text style={styles.spotName}>{selectedSpot.name}</Text>
              <Text style={styles.spotMeta}>{selectedSpot.distance} · Depth: {selectedSpot.depth}</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: ACTIVITY_COLORS[selectedSpot.activity].dot }]}>
              <Text style={styles.scoreText}>{selectedSpot.score}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedSpot(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.speciesRow}>
            {selectedSpot.species.map((sp, i) => (
              <View key={i} style={styles.chip}><Text style={styles.chipText}>{sp}</Text></View>
            ))}
          </View>
          <Text style={styles.spotTip}>💡 {selectedSpot.tip}</Text>
          <TouchableOpacity style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>⊕ Save this spot</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* NOAA STATION CARD */}
      {selectedStation && (
        <View style={styles.spotCard}>
          <View style={styles.spotCardHd}>
            <View style={{ flex: 1 }}>
              <Text style={styles.spotName}>{selectedStation.name}</Text>
              <Text style={styles.spotMeta}>
                Station {selectedStation.id}
                {selectedStation.state ? ` · ${selectedStation.state}` : ''}
                {' · '}{haversine(userLat, userLng, selectedStation.lat, selectedStation.lng).toFixed(1)} mi away
              </Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: Colors.brackishWater }]}>
              <Text style={styles.scoreText}>🌊</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedStationCard(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          {activeStation.id === selectedStation.id && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeTxt}>✓ Active tide station</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: activeStation.id === selectedStation.id ? 'rgba(255,255,255,0.2)' : Colors.brackishWater }]}
            onPress={useThisStation}
            disabled={activeStation.id === selectedStation.id}
          >
            <Text style={styles.saveBtnText}>
              {activeStation.id === selectedStation.id ? '✓ Already active' : '🌊 Use this station for tide data'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RADAR TIMELINE */}
      {activeLayers.includes('radar') && radarFrames.length > 0 && !selectedSpot && !selectedStation && (
        <View style={styles.radarBar}>
          <TouchableOpacity onPress={() => setRadarPlaying(p => !p)} style={styles.radarPlayBtn}>
            <Text style={styles.radarPlayIcon}>{radarPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.radarTimeline}>
            {radarFrames.map((frame, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setRadarFrameIdx(i); setRadarPlaying(false) }}
                style={[styles.radarTick, i === radarFrameIdx && styles.radarTickActive]}
              />
            ))}
          </View>
          <Text style={styles.radarTime}>{radarFrameTime(radarFrames[radarFrameIdx].time)}</Text>
        </View>
      )}

      {/* NEARBY SPOTS STRIP */}
      {!selectedSpot && !selectedStation && (
        <View style={styles.nearbyStrip}>
          <Text style={styles.nearbyTitle}>Nearby spots</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {HOTSPOTS.map(spot => {
              const colors = ACTIVITY_COLORS[spot.activity]
              return (
                <TouchableOpacity key={spot.id} style={styles.nearbyCard} onPress={() => selectSpot(spot)}>
                  <View style={[styles.nearbyDot, { backgroundColor: colors.dot }]}/>
                  <Text style={styles.nearbyName} numberOfLines={1}>{spot.name}</Text>
                  <Text style={styles.nearbyMeta}>{spot.distance}</Text>
                  <Text style={styles.nearbyActivity}>{colors.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}
    </View>
  )
}
