import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getTheme } from '../constants/theme'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const systemScheme                  = useColorScheme()
  const [preference, setPreferenceState] = useState('dark')

  useEffect(() => {
    AsyncStorage.getItem('themePreference').then(val => {
      if (val === 'dark' || val === 'light' || val === 'auto') setPreferenceState(val)
    })
  }, [])

  const setPreference = async (val) => {
    setPreferenceState(val)
    await AsyncStorage.setItem('themePreference', val)
  }

  const resolvedMode = preference === 'auto'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : preference

  const Colors = useMemo(() => getTheme(resolvedMode), [resolvedMode])

  return (
    <ThemeContext.Provider value={{ preference, setPreference, resolvedMode, Colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) return { preference: 'dark', setPreference: () => {}, resolvedMode: 'dark', Colors: getTheme('dark') }
  return ctx
}
