import React, { useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import PagerView from 'react-native-pager-view'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../hooks/useTheme'
import SegmentedStrip from '../components/SegmentedStrip'

import DashboardScreen from '../screens/dashboard/DashboardScreen'
import FishActivityScreen from '../screens/fishactivity/FishActivityScreen'
import TidesScreen from '../screens/tides/TidesScreen'
import SolunarScreen from '../screens/tides/SolunarScreen'
import WindScreen from '../screens/wind/WindScreen'
import WavesScreen from '../screens/waves/WavesScreen'
import WeatherScreen from '../screens/weather/WeatherScreen'
import RiverScreen from '../screens/river/RiverScreen'

const PAGES = [
  { key: 'home',     label: 'Home Port'     },
  { key: 'fish',     label: 'Fish Activity' },
  { key: 'tides',    label: 'Tides'         },
  { key: 'solunar',  label: 'Solunar'       },
  { key: 'wind',     label: 'Wind'          },
  { key: 'waves',    label: 'Waves'         },
  { key: 'weather',  label: 'Weather'       },
  { key: 'rivers',   label: 'Rivers'        },
]

export default function ConditionsPager() {
  const { Colors }    = useTheme()
  const insets        = useSafeAreaInsets()
  const pagerRef      = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const goToPage = (i) => pagerRef.current?.setPage(i)

  return (
    <View style={[s.root, { backgroundColor: Colors.topbarBg }]}>
      <SegmentedStrip
        pages={PAGES}
        activeIndex={activeIndex}
        onSelect={goToPage}
        topInset={insets.top}
      />
      <PagerView
        ref={pagerRef}
        style={[s.pager, { backgroundColor: Colors.screenBg }]}
        initialPage={0}
        onPageSelected={(e) => setActiveIndex(e.nativeEvent.position)}
      >
        <View key="0" style={s.page}>
          <DashboardScreen pagerRef={pagerRef}/>
        </View>
        <View key="1" style={s.page}>
          <FishActivityScreen/>
        </View>
        <View key="2" style={s.page}>
          <TidesScreen/>
        </View>
        <View key="3" style={s.page}>
          <SolunarScreen/>
        </View>
        <View key="4" style={s.page}>
          <WindScreen/>
        </View>
        <View key="5" style={s.page}>
          <WavesScreen/>
        </View>
        <View key="6" style={s.page}>
          <WeatherScreen/>
        </View>
        <View key="7" style={s.page}>
          <RiverScreen/>
        </View>
      </PagerView>
    </View>
  )
}

const s = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
})
