import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Typography } from '../constants/theme'

import DashboardScreen from '../screens/dashboard/DashboardScreen'
import MapScreen from '../screens/map/MapScreen'
import TidesScreen from '../screens/tides/TidesScreen'
import ReportsScreen from '../screens/reports/ReportsScreen'
import { ShopScreen, ProfileScreen } from '../screens/StubScreens'
import SolunarScreen from '../screens/tides/SolunarScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }) {
  const icons = {
    Dashboard: '⊞',
    Map:       '◎',
    Tides:     '◐',
    Reports:   '✦',
    Shop:      '⊕',
    Profile:   '◉',
  }
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconText, focused && styles.iconFocused]}>
        {icons[name]}
      </Text>
    </View>
  )
}

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle:     { backgroundColor: Colors.brackishWater, height: 56 },
        headerTitleStyle: {
          fontFamily: Typography.fontSerif,
          fontSize: Typography.lg,
          fontWeight: Typography.bold,
          color: Colors.saltWhite,
          letterSpacing: 1,
        },
        headerTintColor: Colors.saltWhite,
        tabBarStyle: {
          backgroundColor: Colors.deepSea,
          borderTopColor: Colors.midnightTide,
          borderTopWidth: 0.5,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor:   Colors.doubloonGold,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: {
          fontSize: Typography.xs,
          fontWeight: Typography.medium,
          marginTop: 2,
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused}/>
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
        options={{ title: 'Map & Hotspots' }}
      />
      <Tab.Screen
        name="Tides"
        component={TidesScreen}
        options={{ title: 'Tides & Solunar', headerShown: false }}
      />
      <Tab.Screen
        name="Solunar"
        component={SolunarScreen}
        options={{ title: 'Solunar', tabBarLabel: 'Solunar', headerShown: false }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Catch Reports', tabBarLabel: 'Reports' }}
      />
      <Tab.Screen
        name="Shop"
        component={ShopScreen}
        options={{ title: 'Shop' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Captain's Log", tabBarLabel: 'Me' }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18, color: 'rgba(255,255,255,0.4)' },
  iconFocused: { color: Colors.doubloonGold },
})
