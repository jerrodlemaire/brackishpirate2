import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Typography } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

function StubScreen({ icon, title, sub }) {
  const { Colors } = useTheme()
  const s = useMemo(() => StyleSheet.create({
    container: {
      flex: 1, backgroundColor: Colors.screenBg,
      alignItems: 'center', justifyContent: 'center',
      padding: 32,
    },
    icon:  { fontSize: 48, marginBottom: 16 },
    title: { fontSize: Typography.xl, fontWeight: '500', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
    sub:   { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  }), [Colors])

  return (
    <View style={s.container}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>{sub}</Text>
    </View>
  )
}

export function MapScreen() {
  return <StubScreen icon="🗺" title="Map & Hotspots" sub="Google Maps integration coming in Phase 2"/>
}
export function TidesScreen() {
  return <StubScreen icon="🌊" title="Tides & Solunar" sub="NOAA + solunar engine coming in Phase 3"/>
}
export function ReportsScreen() {
  return <StubScreen icon="🎣" title="Catch Reports" sub="Community reports coming in Phase 4"/>
}
export function ShopScreen() {
  return <StubScreen icon="🛒" title="Shop" sub="Shopify Storefront integration coming in Phase 5"/>
}
export function ProfileScreen() {
  return <StubScreen icon="⚓" title="Captain's Log" sub="Profile & settings coming in Phase 6"/>
}
