import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { Typography, Spacing, Radius } from '../../constants/theme'
import { useTheme } from '../../hooks/useTheme'
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

function SectionHeader({ title, Colors, s }) {
  return <Text style={s.sectionHd}>{title}</Text>
}

function MultiSelect({ options, selected, onToggle, columns = 2, Colors, s }) {
  return (
    <View style={s.multiGrid}>
      {options.map(opt => {
        const on = selected.includes(opt)
        return (
          <TouchableOpacity
            key={opt}
            style={[s.multiBtn, on && s.multiBtnOn, { width: `${100 / columns - 2}%` }]}
            onPress={() => onToggle(opt)}
          >
            <Text style={[s.multiTxt, on && s.multiTxtOn]}>{opt}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function SingleSelect({ options, selected, onSelect, s }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.singleRow}>
        {options.map(opt => {
          const on = selected === opt
          return (
            <TouchableOpacity
              key={opt}
              style={[s.singleChip, on && s.singleChipOn]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[s.singleTxt, on && s.singleTxtOn]}>{opt}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

export default function SubmitReportScreen({ onClose, onSubmitted }) {
  const { Colors } = useTheme()
  const { user } = useAuth()

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
  const [gpsCoords,     setGpsCoords]     = useState(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [gpsLoading,    setGpsLoading]    = useState(false)

  const s = useMemo(() => StyleSheet.create({
    container:    { flex: 1, backgroundColor: Colors.screenBg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, paddingTop: 20, backgroundColor: Colors.topbarBg },
    cancelBtn:    { padding: 4 },
    cancelTxt:    { fontSize: Typography.base, color: Colors.textSecondary },
    headerTitle:  { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
    submitBtn:    { backgroundColor: Colors.buttonBg, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 6 },
    submitBtnDisabled: { opacity: 0.5 },
    submitTxt:    { fontSize: Typography.base, fontWeight: '700', color: Colors.buttonText },
    content:      { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
    sectionHd:    { fontSize: Typography.sm, fontWeight: '500', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: Spacing.md, marginBottom: 6 },
    multiGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    multiBtn:     { paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
    multiBtnOn:   { backgroundColor: Colors.buttonBg, borderColor: Colors.buttonBg },
    multiTxt:     { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '500' },
    multiTxtOn:   { color: Colors.buttonText },
    singleRow:    { flexDirection: 'row', gap: 6, paddingBottom: 4 },
    singleChip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.cardBg },
    singleChipOn: { backgroundColor: Colors.catFish, borderColor: Colors.catFish },
    singleTxt:    { fontSize: Typography.sm, color: Colors.textSecondary },
    singleTxtOn:  { color: Colors.deepSea, fontWeight: '500' },
    row:          { flexDirection: 'row', gap: Spacing.md },
    halfField:    { flex: 1, gap: 5 },
    fieldLabel:   { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
    input:        { backgroundColor: Colors.inputBg, borderWidth: 0.5, borderColor: Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: Typography.base, color: Colors.textPrimary },
    textarea:     { minHeight: 100, paddingTop: 11 },
    gpsBtn:       { borderWidth: 0.5, borderColor: Colors.brackishWater, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
    gpsTxt:       { fontSize: Typography.sm, color: Colors.brackishWater, fontWeight: '500' },
    ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ratingBtn:    { padding: 4 },
    ratingStar:   { fontSize: 28, color: Colors.border },
    ratingStarOn: { color: Colors.catFish },
    ratingLabel:  { fontSize: Typography.sm, color: Colors.textSecondary, marginLeft: 8 },
    photoPreview: { width: '100%', height: 200, borderRadius: Radius.lg, marginBottom: 8 },
    photoRow:     { flexDirection: 'row', gap: Spacing.md },
    photoBtn:     { flex: 1, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.cardBg },
    photoBtnTxt:  { fontSize: Typography.sm, color: Colors.textSecondary },
    bigSubmit:    { backgroundColor: Colors.brackishWater, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.lg },
    bigSubmitTxt: { fontFamily: 'Georgia', fontSize: Typography.md, fontWeight: '700', color: Colors.textOnDark, letterSpacing: 0.5 },
  }), [Colors])

  const toggleSpecies = (sp) => {
    setSpecies(prev => prev.includes(sp) ? prev.filter(x => x !== sp) : [...prev, sp])
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
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0])
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
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0])
  }

  const uploadPhoto = async (photoAsset) => {
    const fileName = `${user.id}/${Date.now()}.jpg`
    const response = await fetch(photoAsset.uri)
    const arrayBuffer = await response.arrayBuffer()
    const { error } = await supabase.storage
      .from('catch-photos')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' })
    if (error) throw error
    const { data: urlData } = supabase.storage
      .from('catch-photos')
      .getPublicUrl(fileName)
    return urlData.publicUrl
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
      if (photo) photoUrl = await uploadPhoto(photo)

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
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Catch Report</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[s.submitBtn, submitting && s.submitBtnDisabled]}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator size="small" color="#0D2137"/>
            : <Text style={s.submitTxt}>Submit</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>

        <Text style={s.sectionHd}>Species caught *</Text>
        <MultiSelect options={SPECIES_OPTIONS} selected={species} onToggle={toggleSpecies} Colors={Colors} s={s}/>

        <Text style={s.sectionHd}>Count & size</Text>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.fieldLabel}>Number of fish</Text>
            <TextInput
              style={s.input}
              value={count}
              onChangeText={setCount}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.halfField}>
            <Text style={s.fieldLabel}>Largest (inches)</Text>
            <TextInput
              style={s.input}
              value={sizeInches}
              onChangeText={setSizeInches}
              keyboardType="decimal-pad"
              placeholder="e.g. 18.5"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <Text style={s.sectionHd}>Location *</Text>
        <TextInput
          style={s.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g. South Shore, Lake Pontchartrain"
          placeholderTextColor={Colors.textMuted}
        />
        <TouchableOpacity style={s.gpsBtn} onPress={getGPS} disabled={gpsLoading}>
          {gpsLoading
            ? <ActivityIndicator size="small" color={Colors.brackishWater}/>
            : <Text style={s.gpsTxt}>
                {gpsCoords ? '✓ GPS location captured' : '◎ Capture GPS coordinates'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={s.sectionHd}>Bait / lure</Text>
        <SingleSelect options={BAIT_OPTIONS} selected={bait} onSelect={setBait} s={s}/>

        <Text style={s.sectionHd}>Technique</Text>
        <SingleSelect options={TECHNIQUE_OPTIONS} selected={technique} onSelect={setTechnique} s={s}/>

        <Text style={s.sectionHd}>Water conditions</Text>
        <View style={s.row}>
          <View style={s.halfField}>
            <Text style={s.fieldLabel}>Water temp (°F)</Text>
            <TextInput
              style={s.input}
              value={waterTemp}
              onChangeText={setWaterTemp}
              keyboardType="decimal-pad"
              placeholder="e.g. 74"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={s.halfField}>
            <Text style={s.fieldLabel}>Wind speed (mph)</Text>
            <TextInput
              style={s.input}
              value={windSpeed}
              onChangeText={setWindSpeed}
              keyboardType="decimal-pad"
              placeholder="e.g. 10"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <Text style={s.fieldLabel}>Tide direction</Text>
        <SingleSelect options={TIDE_OPTIONS} selected={tideDir} onSelect={setTideDir} s={s}/>

        <Text style={s.sectionHd}>Trip rating</Text>
        <View style={s.ratingRow}>
          {[1, 2, 3, 4, 5].map(r => (
            <TouchableOpacity key={r} onPress={() => setRating(r)} style={s.ratingBtn}>
              <Text style={[s.ratingStar, r <= rating && s.ratingStarOn]}>★</Text>
            </TouchableOpacity>
          ))}
          <Text style={s.ratingLabel}>{RATING_LABELS[rating]}</Text>
        </View>

        <Text style={s.sectionHd}>Notes & tips</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Share what worked — bait presentation, time of day, water clarity, specific structure..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={s.sectionHd}>Photo</Text>
        {photo && (
          <Image source={{ uri: photo.uri }} style={s.photoPreview} resizeMode="cover"/>
        )}
        <View style={s.photoRow}>
          <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
            <Text style={s.photoBtnTxt}>📷 Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.photoBtn} onPress={pickPhoto}>
            <Text style={s.photoBtnTxt}>🖼 Choose photo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.bigSubmit, submitting && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={Colors.textOnDark}/>
            : <Text style={s.bigSubmitTxt}>Submit catch report 🎣</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  )
}
