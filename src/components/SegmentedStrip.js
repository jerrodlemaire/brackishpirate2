import React, { useRef, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { Radius, Typography } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'

export default function SegmentedStrip({ pages, activeIndex, onSelect, topInset = 0 }) {
  const { Colors } = useTheme()
  const scrollRef   = useRef(null)
  const chipLayouts = useRef([])
  const stripWidth  = useRef(300)

  useEffect(() => {
    const layout = chipLayouts.current[activeIndex]
    if (layout && scrollRef.current) {
      const centerX = layout.x + layout.width / 2 - stripWidth.current / 2
      scrollRef.current.scrollTo({ x: Math.max(0, centerX), animated: true })
    }
  }, [activeIndex])

  return (
    <View style={[s.container, { paddingTop: topInset, backgroundColor: Colors.topbarBg }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => { stripWidth.current = e.nativeEvent.layout.width }}
        contentContainerStyle={s.content}
      >
        {pages.map((page, i) => {
          const active = activeIndex === i
          return (
            <TouchableOpacity
              key={page.key}
              onLayout={(e) => { chipLayouts.current[i] = e.nativeEvent.layout }}
              onPress={() => onSelect(i)}
              activeOpacity={0.75}
              style={[s.chip, active && { backgroundColor: Colors.doubloonGold }]}
            >
              <Text style={[s.chipTxt, active ? s.chipTxtActive : { color: 'rgba(255,255,255,0.45)' }]}>
                {page.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  chipTxt: {
    fontSize: Typography.sm,
    fontWeight: '500',
  },
  chipTxtActive: {
    color: '#0D2137',
    fontWeight: '600',
  },
})
