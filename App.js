import 'react-native-gesture-handler'
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native'
import { AuthProvider, useAuth } from './src/hooks/useAuth'
import { AppProvider } from './src/context/AppContext'
import { DataLocationProvider } from './src/hooks/useDataLocation'
import { ThemeProvider, useTheme } from './src/hooks/useTheme'
import AppNavigator from './src/navigation/AppNavigator'
import LoginScreen from './src/screens/auth/LoginScreen'
import { supabase } from './src/lib/supabase'

const linking = {
  prefixes: ['brackishpirate://'],
}

// Supabase puts auth tokens in the URL fragment (#) or query string (?)
function parseAuthTokens(url) {
  if (!url) return null
  const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1]
  if (!fragment) return null
  const params = Object.fromEntries(
    fragment.split('&').map(pair => {
      const [k, v] = pair.split('=')
      return [decodeURIComponent(k), decodeURIComponent(v ?? '')]
    })
  )
  return (params.access_token && params.refresh_token) ? params : null
}

async function handleAuthUrl(url) {
  if (!url) return
  const tokens = parseAuthTokens(url)
  if (tokens) {
    await supabase.auth.setSession({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
    })
  }
}

function RootRouter() {
  const { user, loading } = useAuth()
  const { Colors }        = useTheme()
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.screenBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.brackishWater}/>
      </View>
    )
  }
  return user ? <AppNavigator /> : <LoginScreen />
}

function AppContent() {
  const { resolvedMode } = useTheme()
  useEffect(() => {
    Linking.getInitialURL().then(handleAuthUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url))
    return () => sub.remove()
  }, [])
  return (
    <NavigationContainer linking={linking}>
      <StatusBar style={resolvedMode === 'light' ? 'dark' : 'light'}/>
      <RootRouter />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <DataLocationProvider>
            <AppContent />
          </DataLocationProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
