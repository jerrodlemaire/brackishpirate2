import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTheme } from '../hooks/useTheme'

import ConditionsPager from './ConditionsPager'
import MapScreen from '../screens/map/MapScreen'
import CaptainsLogScreen from '../screens/profile/CaptainsLogScreen'
import { ShopScreen } from '../screens/StubScreens'
import HomePortChip from '../components/HomePortChip'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const { Colors } = useTheme()

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={ConditionsPager}/>
      <Stack.Screen
        name="Map"
        component={MapScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.topbarBg },
          headerTintColor: Colors.textPrimary,
          headerTitle: 'Map & Hotspots',
          headerLeft: () => <HomePortChip/>,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="CaptainsLog"
        component={CaptainsLogScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Shop"
        component={ShopScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.topbarBg },
          headerTintColor: Colors.textPrimary,
          headerTitle: 'Shop',
          headerLeft: () => <HomePortChip/>,
          headerBackVisible: false,
        }}
      />
    </Stack.Navigator>
  )
}
