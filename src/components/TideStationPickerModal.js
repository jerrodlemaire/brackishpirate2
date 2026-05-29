import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { Typography, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'
import { fetchNoaaStations } from '../utils/tides'

export default function TideStationPickerModal({ visible, onClose, onSelect, currentStationId }) {
  const { Colors } = useTheme()
  const mapRef    = useRef(null)
  const [stations, setStations]   = useState([])
  const [loading,  setLoading]    = useState(false)
  const [region,   setRegion]     = useState({
    latitude: 29.865, longitude: -89.674, latitudeDelta: 6, longitudeDelta: 6,
  })
  const [selected, setSelected] = useState(null)

  const s = useMemo(() => StyleSheet.create({
    container:      { flex: 1, backgroundColor: Colors.topbarBg },
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10, backgroundColor: Colors.topbarBg, gap: 12 },
    closeBtn:       { padding: 4 },
    closeTxt:       { fontSize: 18, color: Colors.textPrimary },
    title:          { flex: 1, fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, fontFamily: 'Georgia' },
    hint:           { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', paddingBottom: 6, backgroundColor: Colors.topbarBg },
    map:            { flex: 1 },
    marker:         { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.catTides, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.borderMid },
    markerCurrent:  { backgroundColor: Colors.catFish },
    markerSelected: { backgroundColor: Colors.catWeather, borderColor: Colors.textPrimary, borderWidth: 2.5, width: 30, height: 30, borderRadius: 15 },
    markerTxt:      { fontSize: 11, fontWeight: '700', color: Colors.textOnDark },
    card:           { backgroundColor: Colors.deepSea, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, borderTopWidth: 0.5, borderTopColor: Colors.border },
    cardInfo:       { flex: 1 },
    cardName:       { fontSize: Typography.md, fontWeight: '600', color: Colors.textOnDark },
    cardSub:        { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 3 },
    useBtn:         { backgroundColor: Colors.buttonBg, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10 },
    useBtnTxt:      { fontSize: Typography.sm, fontWeight: '700', color: Colors.buttonText },
    hintCard:       { flex: 1, fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
  }), [Colors])

  useEffect(() => {
    if (!visible) return
    setSelected(null)
    setLoading(true)
    fetchNoaaStations()
      .then(data => setStations(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible])

  const visibleStations = stations.filter(st => {
    return (
      Math.abs(st.lat - region.latitude) < region.latitudeDelta * 0.8 &&
      Math.abs(st.lng - region.longitude) < region.longitudeDelta * 0.8
    )
  }).slice(0, 60)

  const handleConfirm = () => {
    if (!selected) return
    onSelect(selected.id, selected.name)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>

        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>Select Tide Station</Text>
          {loading && <ActivityIndicator size="small" color={Colors.brackishWater}/>}
        </View>

        <Text style={s.hint}>Zoom and tap a station marker · T = NOAA tide station</Text>

        <MapView
          ref={mapRef}
          style={s.map}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          initialRegion={region}
          minZoomLevel={3}
          maxZoomLevel={18}
          onRegionChangeComplete={setRegion}
        >
          {visibleStations.map(st => {
            const isCurrent  = st.id === currentStationId
            const isSelected = selected?.id === st.id
            return (
              <Marker
                key={st.id}
                coordinate={{ latitude: st.lat, longitude: st.lng }}
                onPress={() => setSelected(st)}
              >
                <View style={[
                  s.marker,
                  isCurrent  && s.markerCurrent,
                  isSelected && s.markerSelected,
                ]}>
                  <Text style={s.markerTxt}>T</Text>
                </View>
              </Marker>
            )
          })}
        </MapView>

        <View style={s.card}>
          {selected ? (
            <>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{selected.name}</Text>
                <Text style={s.cardSub}>Station {selected.id}{selected.state ? ` · ${selected.state}` : ''}</Text>
              </View>
              <TouchableOpacity style={s.useBtn} onPress={handleConfirm}>
                <Text style={s.useBtnTxt}>Use Station</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={s.hintCard}>
              {loading
                ? 'Loading NOAA stations…'
                : `${visibleStations.length} stations visible · Tap to select`}
            </Text>
          )}
        </View>

      </View>
    </Modal>
  )
}
