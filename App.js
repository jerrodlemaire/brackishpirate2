import 'react-native-gesture-handler'
import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { AuthProvider, useAuth } from './src/hooks/useAuth'
import { AppProvider } from './src/context/AppContext'
import { DataLocationProvider } from './src/hooks/useDataLocation'
import AppNavigator from './src/navigation/AppNavigator'
import LoginScreen from './src/screens/auth/LoginScreen'
import { Colors } from './src/constants/theme'

function RootRouter() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.brackishWater}/>
      </View>
    )
  }
  return user ? <AppNavigator /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <DataLocationProvider>
          <NavigationContainer>
            <StatusBar style="light"/>
            <RootRouter />
          </NavigationContainer>
        </DataLocationProvider>
      </AppProvider>
    </AuthProvider>
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.saltWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
})