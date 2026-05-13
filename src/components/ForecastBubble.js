import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Typography, Radius } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

const TABS = [
  { route: 'Tides',   label: 'Tides',   icon: '∿'  },
  { route: 'Solunar', label: 'Solunar',  icon: '◑'  },
  { route: 'Weather', label: 'Weather',  icon: '☁'  },
  { route: 'Waves',   label: 'Waves',    icon: '≈'  },
  { route: 'River',   label: 'River',    icon: '〰' },
]

export default function ForecastBubble({ navigation, activeRoute }) {
  const { Colors } = useTheme()

  const s = useMemo(() => StyleSheet.create({
    outer: {
      position: 'absolute',
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    bubble: {
      flexDirection: 'row',
      backgroundColor: 'rgba(13,33,55,0.96)',
      borderRadius: Radius.full,
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.12)',
      paddingVertical: 5,
      paddingHorizontal: 5,
      gap: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: Radius.full,
    },
    pillActive: {
      backgroundColor: Colors.brackishWater,
      paddingHorizontal: 14,
    },
    icon:        { fontSize: 14, color: 'rgba(255,255,255,0.45)' },
    iconActive:  { color: '#fff' },
    labelActive: { fontSize: 11, fontWeight: '700', color: '#fff' },
  }), [Colors])

  return (
    <View style={s.outer} pointerEvents="box-none">
      <View style={s.bubble}>
        {TABS.map(tab => {
          const active = activeRoute === tab.route
          return (
            <TouchableOpacity
              key={tab.route}
              style={[s.pill, active && s.pillActive]}
              onPress={() => { if (!active) navigation.navigate(tab.route) }}
              activeOpacity={0.75}
            >
              <Text style={[s.icon, active && s.iconActive]}>{tab.icon}</Text>
              {active && <Text style={s.labelActive}>{tab.label}</Text>}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}
