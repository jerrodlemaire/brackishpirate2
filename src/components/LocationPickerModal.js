import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import * as Location from 'expo-location'
import { Typography, Spacing, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

const GOOGLE_KEY = 'AIzaSyBzwOhq7uIKao4Xw4Bht-op0y4Yj3Umpaw'

async function reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`)
    const data = await res.json()
    return data.results?.[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  } catch (_) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

export default function LocationPickerModal({
  visible, onClose, onSelect, title = 'Set Location',
  initialLat = 29.865, initialLng = -89.674,
}) {
  const { Colors } = useTheme()
  const mapRef      = useRef(null)
  const [pin,        setPin]        = useState({ lat: initialLat, lng: initialLng })
  const [pinName,    setPinName]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const s = useMemo(() => StyleSheet.create({
    container:      { flex: 1, backgroundColor: Colors.topbarBg },
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10, backgroundColor: Colors.topbarBg, gap: 12 },
    closeBtn:       { padding: 4 },
    closeTxt:       { fontSize: 18, color: '#fff' },
    title:          { flex: 1, fontSize: Typography.md, fontWeight: '700', color: '#fff', fontFamily: 'Georgia' },
    gpsBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
    gpsTxt:         { fontSize: Typography.sm, color: '#fff', fontWeight: '600' },
    hint:           { fontSize: Typography.xs, color: 'rgba(255,255,255,0.45)', textAlign: 'center', paddingBottom: 6, backgroundColor: Colors.topbarBg },
    map:            { flex: 1 },
    pinEmoji:       { fontSize: 28 },
    bottom:         { backgroundColor: Colors.topbarBg, padding: Spacing.lg, gap: Spacing.md },
    locationName:   { fontSize: Typography.base, color: '#fff', textAlign: 'center', lineHeight: 22, minHeight: 36 },
    confirmBtn:     { backgroundColor: Colors.brackishWater, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
    confirmDisabled:{ opacity: 0.35 },
    confirmTxt:     { fontSize: Typography.base, fontWeight: '700', color: '#fff' },
  }), [Colors])

  const handleMapPress = async (e) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate
    setPin({ lat, lng })
    setLoading(true)
    setPinName(await reverseGeocode(lat, lng))
    setLoading(false)
  }

  const handleGPS = async () => {
    setGpsLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const { latitude: lat, longitude: lng } = loc.coords
      setPin({ lat, lng })
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }, 600)
      setLoading(true)
      setPinName(await reverseGeocode(lat, lng))
      setLoading(false)
    } catch (_) {} finally {
      setGpsLoading(false)
    }
  }

  const handleConfirm = () => {
    const name = pinName || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
    onSelect(pin.lat, pin.lng, name)
    onClose()
  }

  const handleClose = () => {
    setPinName('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={s.container}>

        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={handleGPS} style={s.gpsBtn} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
              : <Text style={s.gpsTxt}>📍 GPS</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>Tap the map to set your location</Text>

        <MapView
          ref={mapRef}
          style={s.map}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          initialRegion={{ latitude: initialLat, longitude: initialLng, latitudeDelta: 0.8, longitudeDelta: 0.8 }}
          minZoomLevel={3}
          maxZoomLevel={18}
          onPress={handleMapPress}
        >
          {pin && (
            <Marker coordinate={{ latitude: pin.lat, longitude: pin.lng }} anchor={{ x: 0.5, y: 1 }}>
              <Text style={s.pinEmoji}>📍</Text>
            </Marker>
          )}
        </MapView>

        <View style={s.bottom}>
          {loading
            ? <ActivityIndicator color={Colors.brackishWater} style={{ height: 36 }}/>
            : <Text style={s.locationName} numberOfLines={2}>
                {pinName || 'Tap the map to choose a spot'}
              </Text>
          }
          <TouchableOpacity
            style={[s.confirmBtn, !pinName && s.confirmDisabled]}
            onPress={handleConfirm}
            disabled={!pinName}
          >
            <Text style={s.confirmTxt}>Set Location</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  )
}
