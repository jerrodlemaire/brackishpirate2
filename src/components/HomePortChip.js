import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Radius, Typography } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

export default function HomePortChip() {
  const navigation = useNavigation()
  const { Colors } = useTheme()
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={[s.chip, { backgroundColor: `${Colors.doubloonGold}22`, borderColor: `${Colors.doubloonGold}66` }]}
      activeOpacity={0.75}
    >
      <Text style={[s.txt, { color: Colors.doubloonGold }]}>‹ Home Port</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  chip: {
    borderRadius: Radius.full,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  txt: {
    fontSize: Typography.sm,
    fontWeight: '600',
  },
})
