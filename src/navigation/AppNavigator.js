import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet } from 'react-native'
import { Typography } from '../constants/theme'
import { useTheme } from '../hooks/useTheme'
import HelmCrest from '../components/HelmCrest'

import DashboardScreen from '../screens/dashboard/DashboardScreen'
import MapScreen from '../screens/map/MapScreen'
import TidesScreen from '../screens/tides/TidesScreen'
import SolunarScreen from '../screens/tides/SolunarScreen'
import WeatherScreen from '../screens/weather/WeatherScreen'
import WavesScreen from '../screens/waves/WavesScreen'
import RiverScreen from '../screens/river/RiverScreen'
import CaptainsLogScreen from '../screens/profile/CaptainsLogScreen'
import { ShopScreen } from '../screens/StubScreens'

const Tab = createBottomTabNavigator()

const TEXT_ICONS = {
  Dashboard:   '⊞',
  Map:         '◎',
  CaptainsLog: '📖',
  Shop:        '⊕',
}

function TabIcon({ name, focused, activeColor }) {
  if (name === 'Tides') {
    return (
      <View style={{ opacity: focused ? 1 : 0.35 }}>
        <HelmCrest size={32} variant="mono"/>
      </View>
    )
  }
  return (
    <View style={s.iconWrap}>
      <Text style={[s.iconText, focused && { color: activeColor }]}>
        {TEXT_ICONS[name] || '·'}
      </Text>
    </View>
  )
}

export default function AppNavigator() {
  const { Colors } = useTheme()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle:      { backgroundColor: Colors.topbarBg, height: 56 },
        headerTitleStyle: {
          fontFamily: Typography.fontSerif,
          fontSize:   Typography.lg,
          fontWeight: Typography.bold,
          color:      Colors.textOnDark,
          letterSpacing: 1,
        },
        headerTintColor: Colors.textOnDark,
        tabBarStyle: {
          backgroundColor: '#0D2137',
          height:          105,
          paddingBottom:   28,
          paddingTop:      8,
          borderTopColor:  'rgba(255,255,255,0.06)',
          borderTopWidth:  0.5,
        },
        tabBarActiveTintColor:   Colors.doubloonGold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: {
          fontSize:   13,
          fontWeight: '600',
          marginTop:  2,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingHorizontal: 0,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} activeColor={Colors.doubloonGold}/>
        ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'BRACKISH PIRATE', tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Map & Hotspots', tabBarLabel: 'Map' }}
      />
      <Tab.Screen
        name="Tides"
        component={TidesScreen}
        options={{ title: 'Forecast', tabBarLabel: 'Forecast', headerShown: false }}
      />
      <Tab.Screen
        name="CaptainsLog"
        component={CaptainsLogScreen}
        options={{ title: "Captain's Log", tabBarLabel: 'Logbook', headerShown: false }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ title: 'Shop' }}
      />

      {/* Hidden screens — navigatable but no tab button */}
      <Tab.Screen
        name="Solunar"
        component={SolunarScreen}
        options={{ title: 'Solunar', headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Weather"
        component={WeatherScreen}
        options={{ title: 'Weather', headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Waves"
        component={WavesScreen}
        options={{ title: 'Waves', headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="River"
        component={RiverScreen}
        options={{ title: 'River Gauges', headerShown: false, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  )
}

const s = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 32, color: 'rgba(255,255,255,0.4)' },
})
