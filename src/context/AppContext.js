import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { findNearestStation } from '../utils/tides'

const AppContext = createContext({})

export const DEFAULT_HOME_PORT = {
  name: 'Shell Beach Marina',
  lat:   29.865,
  lng:  -89.674,
}

export const DEFAULT_STATION = {
  id:   '8761724',
  name: 'Grand Isle, LA',
}

export function AppProvider({ children }) {
  const [homePort,        setHomePortState]        = useState(DEFAULT_HOME_PORT)
  const [activeStation,   setActiveStationState]   = useState(DEFAULT_STATION)
  const [riverFavorites,  setRiverFavoritesState]  = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const [hp, st, rf] = await Promise.all([
          AsyncStorage.getItem('homePort'),
          AsyncStorage.getItem('activeStation'),
          AsyncStorage.getItem('riverFavorites'),
        ])
        if (hp) setHomePortState(JSON.parse(hp))
        if (st) setActiveStationState(JSON.parse(st))
        if (rf) setRiverFavoritesState(JSON.parse(rf))
      } catch (_) {}
    }
    load()
  }, [])

  const setHomePort = useCallback(async (hp) => {
    setHomePortState(hp)
    await AsyncStorage.setItem('homePort', JSON.stringify(hp))
    try {
      const nearest = await findNearestStation(hp.lat, hp.lng)
      if (nearest) {
        const st = { id: nearest.id, name: nearest.name }
        setActiveStationState(st)
        await AsyncStorage.setItem('activeStation', JSON.stringify(st))
      }
    } catch (_) {}
  }, [])

  const setActiveStation = useCallback(async (st) => {
    setActiveStationState(st)
    await AsyncStorage.setItem('activeStation', JSON.stringify(st))
  }, [])

  const toggleRiverFavorite = useCallback(async (stationId) => {
    setRiverFavoritesState(prev => {
      const next = prev.includes(stationId)
        ? prev.filter(id => id !== stationId)
        : [...prev, stationId]
      AsyncStorage.setItem('riverFavorites', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AppContext.Provider value={{ homePort, setHomePort, activeStation, setActiveStation, riverFavorites, toggleRiverFavorite }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
