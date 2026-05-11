import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { Colors, Typography, Radius } from '../constants/theme'
import { fetchNdbcBuoys } from '../utils/ndbc'

export default function BuoyPickerModal({ visible, onClose, onSelect, currentBuoyId }) {
  const mapRef    = useRef(null)
  const [buoys,    setBuoys]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [region,   setRegion]   = useState({
    latitude: 29.865, longitude: -89.674, latitudeDelta: 8, longitudeDelta: 8,
  })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!visible) return
    setSelected(null)
    setLoading(true)
    fetchNdbcBuoys()
      .then(data => setBuoys(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visible])

  const visibleBuoys = buoys.filter(b => {
    return (
      Math.abs(b.lat - region.latitude) < region.latitudeDelta * 0.8 &&
      Math.abs(b.lng - region.longitude) < region.longitudeDelta * 0.8
    )
  }).slice(0, 60)

  const handleConfirm = () => {
    if (!selected) return
    onSelect(selected.id, selected.name, selected.lat, selected.lng)
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>

        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>Select NDBC Buoy</Text>
          {loading && <ActivityIndicator size="small" color={Colors.doubloonGold}/>}
        </View>

        <Text style={s.hint}>Zoom and tap a buoy · B = weather/wave buoy</Text>

        <MapView
          ref={mapRef}
          style={s.map}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          initialRegion={region}
          onRegionChangeComplete={setRegion}
        >
          {visibleBuoys.map(b => {
            const isCurrent  = b.id === currentBuoyId
            const isSelected = selected?.id === b.id
            return (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                onPress={() => setSelected(b)}
              >
                <View style={[
                  s.marker,
                  isCurrent  && s.markerCurrent,
                  isSelected && s.markerSelected,
                ]}>
                  <Text style={s.markerTxt}>B</Text>
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
                <Text style={s.cardSub}>NDBC {selected.id} · {selected.type}</Text>
                <Text style={s.cardCoords}>
                  {selected.lat.toFixed(3)}°N {Math.abs(selected.lng).toFixed(3)}°W
                </Text>
              </View>
              <TouchableOpacity style={s.useBtn} onPress={handleConfirm}>
                <Text style={s.useBtnTxt}>Use Buoy</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={s.hintCard}>
              {loading
                ? 'Loading NDBC buoys…'
                : `${visibleBuoys.length} buoys visible · Tap to select`}
            </Text>
          )}
        </View>

      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.deepSea },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10, backgroundColor: Colors.deepSea, gap: 12 },
  closeBtn:       { padding: 4 },
  closeTxt:       { fontSize: 18, color: '#fff' },
  title:          { flex: 1, fontSize: Typography.md, fontWeight: '700', color: '#fff', fontFamily: 'Georgia' },
  hint:           { fontSize: Typography.xs, color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingBottom: 6, backgroundColor: Colors.deepSea },
  map:            { flex: 1 },
  marker:         { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.doubloonGold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  markerCurrent:  { backgroundColor: Colors.amberLight, borderColor: '#fff' },
  markerSelected: { backgroundColor: Colors.marshGreen, borderColor: '#fff', borderWidth: 2.5, width: 30, height: 30, borderRadius: 15 },
  markerTxt:      { fontSize: 11, fontWeight: '700', color: Colors.deepSea },
  card:           { backgroundColor: Colors.midnightTide, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
  cardInfo:       { flex: 1 },
  cardName:       { fontSize: Typography.md, fontWeight: '600', color: '#fff' },
  cardSub:        { fontSize: Typography.sm, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  cardCoords:     { fontSize: Typography.xs, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  useBtn:         { backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  useBtnTxt:      { fontSize: Typography.sm, fontWeight: '700', color: Colors.deepSea },
  hintCard:       { flex: 1, fontSize: Typography.sm, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
})
