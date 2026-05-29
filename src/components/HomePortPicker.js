import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Modal,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Typography, Spacing, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'
import { useApp } from '../context/AppContext'
import { fetchNdbcBuoys } from '../utils/ndbc'

const GOOGLE_MAPS_KEY = 'AIzaSyBzwOhq7uIKao4Xw4Bht-op0y4Yj3Umpaw'

const DEFAULT_REGION = {
  latitude:      30.0,
  longitude:    -90.0,
  latitudeDelta:  12,
  longitudeDelta: 14,
}

async function reverseGeocode(lat, lng) {
  try {
    const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
    const res  = await fetch(url)
    const data = await res.json()
    return data.results?.[0]?.formatted_address || `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W`
  } catch {
    return `${lat.toFixed(4)}° N, ${Math.abs(lng).toFixed(4)}° W`
  }
}

export default function HomePortPicker({ visible, onClose }) {
  const { Colors } = useTheme()
  const { homePort, setHomePort } = useApp()
  const mapRef = useRef(null)

  const [buoys,      setBuoys]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [mapRegion,  setMapRegion]  = useState(DEFAULT_REGION)
  const [pending,    setPending]    = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.topbarBg },

    header:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
    title:    { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    sub:      { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
    closeBtn: { padding: 6 },
    closeTxt: { fontSize: 18, color: Colors.textSecondary },

    mapWrap: { flex: 1, position: 'relative' },
    map:     { flex: 1 },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,33,55,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingTxt:     { fontSize: Typography.base, color: Colors.textOnDark, fontWeight: '500' },

    myLocBtn:  { position: 'absolute', top: 12, left: 12, backgroundColor: Colors.buttonBg, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' },
    myLocTxt:  { fontSize: Typography.sm, color: Colors.buttonText, fontWeight: '600' },

    gpsBtn:    { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(13,33,55,0.92)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    gpsBtnTxt: { fontSize: 18, color: Colors.brackishWater },

    hint:    { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: 'rgba(13,33,55,0.85)', borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
    hintTxt: { fontSize: Typography.xs, color: Colors.textSecondary },

    homeMarker:    { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(13,33,55,0.9)', borderWidth: 2, borderColor: Colors.catFish, alignItems: 'center', justifyContent: 'center' },
    pinMarker:     { alignItems: 'center' },
    buoyMarker:    { backgroundColor: Colors.catTides, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: Colors.textOnDark },
    buoyMarkerSel: { backgroundColor: Colors.catFish, borderColor: Colors.textOnDark, borderWidth: 2 },
    buoyTxt:       { fontSize: 8, color: Colors.textOnDark, fontWeight: '700' },

    card:       { backgroundColor: Colors.topbarBg, borderTopWidth: 0.5, borderTopColor: Colors.border, padding: Spacing.lg, paddingBottom: 32, gap: 14 },
    cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardIcon:   { width: 44, height: 44, borderRadius: 22, backgroundColor: `${Colors.brackishWater}26`, alignItems: 'center', justifyContent: 'center' },
    cardName:   { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
    cardMeta:   { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
    cardClose:  { padding: 4 },
    confirmBtn: { backgroundColor: Colors.buttonBg, borderRadius: Radius.md, paddingVertical: 13, alignItems: 'center' },
    confirmTxt: { fontSize: Typography.base, color: Colors.buttonText, fontWeight: '700' },
  }), [Colors])

  useEffect(() => {
    if (!visible) return
    setPending(null)
    setLoading(true)
    fetchNdbcBuoys()
      .then(all => setBuoys(all.filter(b => b.lat > 10 && b.lat < 55 && b.lng > -140 && b.lng < -50)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible])

  const goToGPS = async () => {
    setGpsLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude, longitude } = loc.coords
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 800)
    } catch (_) {}
    finally { setGpsLoading(false) }
  }

  const useMyLocation = async () => {
    setGpsLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc  = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude: lat, longitude: lng } = loc.coords
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 600)
      const name = await reverseGeocode(lat, lng)
      setPending({ type: 'location', name, lat, lng })
    } catch (_) {}
    finally { setGpsLoading(false) }
  }

  const handleLongPress = async (e) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate
    setPinLoading(true)
    const name = await reverseGeocode(lat, lng)
    setPending({ type: 'location', name, lat, lng })
    setPinLoading(false)
  }

  const selectBuoy = (buoy) => {
    setPending({ type: 'buoy', name: `${buoy.name} (NDBC ${buoy.id})`, lat: buoy.lat, lng: buoy.lng, id: buoy.id })
  }

  const confirm = async () => {
    if (!pending) return
    setSaving(true)
    await setHomePort({ name: pending.name, lat: pending.lat, lng: pending.lng })
    setSaving(false)
    setPending(null)
    onClose()
  }

  const handleClose = () => { setPending(null); onClose() }

  const visibleBuoys = buoys.filter(b =>
    b.lat >= mapRegion.latitude  - mapRegion.latitudeDelta  * 1.5 &&
    b.lat <= mapRegion.latitude  + mapRegion.latitudeDelta  * 1.5 &&
    b.lng >= mapRegion.longitude - mapRegion.longitudeDelta * 1.5 &&
    b.lng <= mapRegion.longitude + mapRegion.longitudeDelta * 1.5
  ).slice(0, 80)

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={handleClose}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Set Home Port</Text>
            <Text style={s.sub}>Use your location, long-press the map, or tap a buoy</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={s.mapWrap}>
          <MapView
            ref={mapRef}
            style={s.map}
            provider={PROVIDER_GOOGLE}
            mapType="satellite"
            initialRegion={DEFAULT_REGION}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            minZoomLevel={3}
            maxZoomLevel={18}
            onRegionChangeComplete={setMapRegion}
            onLongPress={handleLongPress}
          >
            {/* Current home port */}
            <Marker coordinate={{ latitude: homePort.lat, longitude: homePort.lng }}
              anchor={{ x: 0.5, y: 0.5 }} zIndex={10}>
              <View style={s.homeMarker}>
                <Text style={{ fontSize: 18 }}>⚓</Text>
              </View>
            </Marker>

            {/* Pending custom-location pin */}
            {pending?.type === 'location' && (
              <Marker coordinate={{ latitude: pending.lat, longitude: pending.lng }}
                anchor={{ x: 0.5, y: 1 }} zIndex={9}>
                <View style={s.pinMarker}>
                  <Text style={{ fontSize: 22 }}>📍</Text>
                </View>
              </Marker>
            )}

            {/* NDBC buoy markers */}
            {visibleBuoys.map(buoy => {
              const isSel = pending?.type === 'buoy' && pending?.id === buoy.id
              return (
                <Marker key={buoy.id}
                  coordinate={{ latitude: buoy.lat, longitude: buoy.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  onPress={() => selectBuoy(buoy)}
                  tracksViewChanges={isSel}
                  zIndex={isSel ? 8 : 1}
                >
                  <View style={[s.buoyMarker, isSel && s.buoyMarkerSel]} pointerEvents="none">
                    <Text style={s.buoyTxt}>{buoy.id}</Text>
                  </View>
                </Marker>
              )
            })}
          </MapView>

          {(loading || pinLoading) && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.brackishWater}/>
              <Text style={s.loadingTxt}>{pinLoading ? 'Getting location…' : 'Loading buoys…'}</Text>
            </View>
          )}

          {/* Use my location button */}
          <TouchableOpacity style={s.myLocBtn} onPress={useMyLocation} disabled={gpsLoading} activeOpacity={0.85}>
            {gpsLoading
              ? <ActivityIndicator size="small" color="#fff"/>
              : <Text style={s.myLocTxt}>📍  Use my location</Text>
            }
          </TouchableOpacity>

          {/* Pan-to-GPS button */}
          <TouchableOpacity style={s.gpsBtn} onPress={goToGPS} disabled={gpsLoading}>
            <Text style={s.gpsBtnTxt}>◎</Text>
          </TouchableOpacity>

          {!loading && !pending && (
            <View style={s.hint}>
              <Text style={s.hintTxt}>Long-press anywhere · or tap an NDBC buoy</Text>
            </View>
          )}
        </View>

        {/* Confirm card */}
        {pending && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.cardIcon}>
                <Text style={{ fontSize: 22 }}>{pending.type === 'buoy' ? '🌊' : '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName} numberOfLines={2}>{pending.name}</Text>
                <Text style={s.cardMeta}>{pending.lat.toFixed(4)}° N, {Math.abs(pending.lng).toFixed(4)}° W</Text>
              </View>
              <TouchableOpacity onPress={() => setPending(null)} style={s.cardClose}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.confirmBtn} onPress={confirm} disabled={saving} activeOpacity={0.8}>
              {saving
                ? <ActivityIndicator size="small" color="#fff"/>
                : <Text style={s.confirmTxt}>⚓  Set as Home Port</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}
