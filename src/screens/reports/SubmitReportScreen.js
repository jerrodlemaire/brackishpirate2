import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { Colors, Typography, Spacing, Radius } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const SPECIES_OPTIONS = [
  'Speckled Trout', 'Redfish', 'Flounder', 'Sheepshead',
  'Black Drum', 'Striped Bass', 'Cobia', 'Tarpon',
  'Largemouth Bass', 'Catfish', 'Crappie', 'Other',
]

const BAIT_OPTIONS = [
  'Live shrimp', 'Gulp shrimp', 'Popping cork', 'Jig head',
  'Soft plastic', 'Spinnerbait', 'Topwater', 'Cut bait',
  'Live croaker', 'Crab', 'Other',
]

const TECHNIQUE_OPTIONS = [
  'Sight casting', 'Trolling', 'Bottom fishing', 'Drift fishing',
  'Fly fishing', 'Jigging', 'Still fishing', 'Casting',
]

const TIDE_OPTIONS = ['Incoming', 'Outgoing', 'High slack', 'Low slack']

const RATING_LABELS = ['', 'Poor', 'Fair', 'Average', 'Good', 'Excellent']

function SectionHeader({ title }) {
  return <Text style={styles.sectionHd}>{title}</Text>
}

function MultiSelect({ options, selected, onToggle, columns = 2 }) {
  return (
    <View style={styles.multiGrid}>
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.multiBtn, on && styles.multiBtnOn, { width: `${100 / columns - 2}%` }]}
            onPress={() => onToggle(opt)}
          >
            <Text style={[styles.multiTxt, on && styles.multiTxtOn]}>{opt}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function SingleSelect({ options, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.singleRow}>
        {options.map(opt => {
          const on = selected === opt
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.singleChip, on && styles.singleChipOn]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.singleTxt, on && styles.singleTxtOn]}>{opt}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

export default function SubmitReportScreen({ onClose, onSubmitted }) {
  const { user } = useAuth()

  // Form state
  const [species,       setSpecies]       = useState([])
  const [count,         setCount]         = useState('1')
  const [sizeInches,    setSizeInches]    = useState('')
  const [bait,          setBait]          = useState('')
  const [technique,     setTechnique]     = useState('')
  const [locationName,  setLocationName]  = useState('')
  const [notes,         setNotes]         = useState('')
  const [rating,        setRating]        = useState(5)
  const [waterTemp,     setWaterTemp]     = useState('')
  const [windSpeed,     setWindSpeed]     = useState('')
  const [windDir,       setWindDir]       = useState('')
  const [tideDir,       setTideDir]       = useState('')
  const [photo,         setPhoto]         = useState(null)
  const [useGPS,        setUseGPS]        = useState(true)
  const [gpsCoords,     setGpsCoords]     = useState(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [gpsLoading,    setGpsLoading]    = useState(false)

  const toggleSpecies = (s) => {
    setSpecies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const getGPS = async () => {
    setGpsLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed to tag your catch.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      Alert.alert('Location captured', `${loc.coords.latitude.toFixed(4)}° N, ${loc.coords.longitude.toFixed(4)}° W`)
    } catch (e) {
      Alert.alert('GPS error', 'Could not get your location. Try again.')
    } finally {
      setGpsLoading(false)
    }
  }

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to attach a photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0])
    }
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    })
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0])
    }
  }

  const uploadPhoto = async (photoAsset) => {
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`
      const response = await fetch(photoAsset.uri)
      const blob     = await response.blob()
      const { data, error } = await supabase.storage
        .from('catch-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { data: urlData } = supabase.storage
        .from('catch-photos')
        .getPublicUrl(fileName)
      return urlData.publicUrl
    } catch (e) {
      console.log('Photo upload error:', e)
      return null
    }
  }

  const handleSubmit = async () => {
    if (species.length === 0) {
      Alert.alert('Missing info', 'Please select at least one species.')
      return
    }
    if (!locationName) {
      Alert.alert('Missing info', 'Please enter a location name.')
      return
    }

    setSubmitting(true)
    try {
      let photoUrl = null
      if (photo) {
        photoUrl = await uploadPhoto(photo)
      }

      // Get user profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const report = {
        user_id:        user.id,
        user_name:      profile?.full_name || user.email,
        species,
        count:          parseInt(count) || 1,
        size_inches:    sizeInches ? parseFloat(sizeInches) : null,
        bait:           bait || null,
        technique:      technique || null,
        location_name:  locationName,
        latitude:       gpsCoords?.lat || null,
        longitude:      gpsCoords?.lng || null,
        water_temp:     waterTemp ? parseFloat(waterTemp) : null,
        wind_speed:     windSpeed ? parseFloat(windSpeed) : null,
        wind_direction: windDir || null,
        tide_direction: tideDir || null,
        notes:          notes || null,
        photo_url:      photoUrl,
        rating,
        likes:          0,
      }

      const { error } = await supabase.from('catch_reports').insert(report)
      if (error) throw error

      Alert.alert('Report submitted! 🎣', 'Your catch report is now live for the community.', [
        { text: 'Awesome', onPress: onSubmitted },
      ])
    } catch (e) {
      Alert.alert('Submit failed', e.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catch Report</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color={Colors.saltWhite}/>
            : <Text style={styles.submitTxt}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Species */}
        <SectionHeader title="Species caught *"/>
        <MultiSelect options={SPECIES_OPTIONS} selected={species} onToggle={toggleSpecies}/>

        {/* Count & Size */}
        <SectionHeader title="Count & size"/>
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Number of fish</Text>
            <TextInput
              style={styles.input}
              value={count}
              onChangeText={setCount}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Largest (inches)</Text>
            <TextInput
              style={styles.input}
              value={sizeInches}
              onChangeText={setSizeInches}
              keyboardType="decimal-pad"
              placeholder="e.g. 18.5"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* Location */}
        <SectionHeader title="Location *"/>
        <TextInput
          style={styles.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g. South Shore, Lake Pontchartrain"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={getGPS}
          disabled={gpsLoading}
        >
          {gpsLoading
            ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
            : <Text style={styles.gpsTxt}>
                {gpsCoords ? '✓ GPS location captured' : '◎ Capture GPS coordinates'}
              </Text>
          }
        </TouchableOpacity>

        {/* Bait */}
        <SectionHeader title="Bait / lure"/>
        <SingleSelect options={BAIT_OPTIONS} selected={bait} onSelect={setBait}/>

        {/* Technique */}
        <SectionHeader title="Technique"/>
        <SingleSelect options={TECHNIQUE_OPTIONS} selected={technique} onSelect={setTechnique}/>

        {/* Conditions */}
        <SectionHeader title="Water conditions"/>
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Water temp (°F)</Text>
            <TextInput
              style={styles.input}
              value={waterTemp}
              onChangeText={setWaterTemp}
              keyboardType="decimal-pad"
              placeholder="e.g. 74"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Wind speed (mph)</Text>
            <TextInput
              style={styles.input}
              value={windSpeed}
              onChangeText={setWindSpeed}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* Tide */}
        <Text style={styles.fieldLabel}>Tide direction</Text>
        <SingleSelect options={TIDE_OPTIONS} selected={tideDir} onSelect={setTideDir}/>

        {/* Rating */}
        <SectionHeader title="Trip rating"/>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(r => (
            <TouchableOpacity key={r} onPress={() => setRating(r)} style={styles.ratingBtn}>
              <Text style={[styles.ratingStar, r <= rating && styles.ratingStarOn]}>★</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.ratingLabel}>{RATING_LABELS[rating]}</Text>
        </View>

        {/* Notes */}
        <SectionHeader title="Notes & tips"/>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Share what worked — bait presentation, time of day, water clarity, specific structure..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Photo */}
        <SectionHeader title="Photo"/>
        {photo && (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} resizeMode="cover"/>
        )}
        <View style={styles.photoRow}>
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnTxt}>📷 Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
            <Text style={styles.photoBtnTxt}>🖼 Choose photo</Text>
          </TouchableOpacity>
        </View>

        {/* Submit button (bottom) */}
        <TouchableOpacity
          style={[styles.bigSubmit, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={Colors.saltWhite}/>
            : <Text style={styles.bigSubmitTxt}>Submit catch report 🎣</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.saltWhite },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, paddingTop: 20, backgroundColor: Colors.brackishWater },
  cancelBtn:    { padding: 4 },
  cancelTxt:    { fontSize: Typography.base, color: 'rgba(255,255,255,0.8)' },
  headerTitle:  { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: '700', color: Colors.saltWhite },
  submitBtn:    { backgroundColor: Colors.doubloonGold, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 6 },
  submitBtnDisabled: { opacity: 0.5 },
  submitTxt:    { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.deepSea },

  content:      { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  sectionHd:    { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: 6 },

  multiGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  multiBtn:     { paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  multiBtnOn:   { backgroundColor: Colors.brackishWater, borderColor: Colors.brackishWater },
  multiTxt:     { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  multiTxtOn:   { color: Colors.saltWhite },

  singleRow:    { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  singleChip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
  singleChipOn: { backgroundColor: Colors.doubloonGold, borderColor: Colors.doubloonGold },
  singleTxt:    { fontSize: Typography.sm, color: Colors.textSecondary },
  singleTxtOn:  { color: Colors.deepSea, fontWeight: Typography.medium },

  row:          { flexDirection: 'row', gap: Spacing.md },
  halfField:    { flex: 1, gap: 5 },
  fieldLabel:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },

  input:        { backgroundColor: Colors.parchment, borderWidth: 0.5, borderColor: Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: Typography.base, color: Colors.textPrimary },
  textarea:     { minHeight: 100, paddingTop: 11 },

  gpsBtn:       { borderWidth: 0.5, borderColor: Colors.brackishWater, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  gpsTxt:       { fontSize: Typography.sm, color: Colors.brackishWater, fontWeight: Typography.medium },

  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingBtn:    { padding: 4 },
  ratingStar:   { fontSize: 28, color: Colors.border },
  ratingStarOn: { color: Colors.doubloonGold },
  ratingLabel:  { fontSize: Typography.sm, color: Colors.textSecondary, marginLeft: 8 },

  photoPreview: { width: '100%', height: 200, borderRadius: Radius.lg, marginBottom: 8 },
  photoRow:     { flexDirection: 'row', gap: Spacing.md },
  photoBtn:     { flex: 1, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.cardBg },
  photoBtnTxt:  { fontSize: Typography.sm, color: Colors.textSecondary },

  bigSubmit:    { backgroundColor: Colors.brackishWater, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.lg },
  bigSubmitTxt: { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.saltWhite, letterSpacing: 0.5 },
}) 
