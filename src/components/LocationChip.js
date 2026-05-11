import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Colors, Typography, Radius, Spacing } from '../constants/theme'
import JollyRoger from './JollyRoger'

export default function LocationChip({ label, onPress, color = Colors.brackishWater, boneColor = 'rgba(0,0,0,0.3)' }) {
  return (
    <TouchableOpacity
      style={[st.chip, { backgroundColor: color + '22', borderColor: color + '55' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <JollyRoger size={13} flagColor={color} boneColor={boneColor}/>
      <Text style={[st.label, { color }]} numberOfLines={1}>{label}</Text>
      <Text style={[st.caret, { color }]}>›</Text>
    </TouchableOpacity>
  )
}

const st = StyleSheet.create({
  chip: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   Radius.full,
    borderWidth:    1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    gap: 4,
    maxWidth: 190,
  },
  label: {
    fontSize:   Typography.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
  caret: {
    fontSize:   14,
    fontWeight: '300',
    lineHeight: 16,
  },
})
