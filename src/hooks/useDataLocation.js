import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { findNearestStation } from '../utils/tides'
import { fetchNdbcBuoys } from '../utils/ndbc'
import { useApp } from '../context/AppContext'

const DataLocationContext = createContext({})

const DEFAULTS = {
  tideStation:     { id: '8761724', name: 'Grand Isle, LA' },
  buoy:            { id: '42040', name: 'LUKE OFFSHORE', lat: 29.212, lng: -88.208 },
  weatherLocation: { lat: 29.865, lng: -89.674, name: 'Shell Beach Marina' },
  solunarLocation: { lat: 29.865, lng: -89.674, name: 'Shell Beach Marina' },
}

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

export function DataLocationProvider({ children }) {
  const { homePort } = useApp()
  const [tideStation,     setTideStationState]     = useState(DEFAULTS.tideStation)
  const [buoy,            setBuoyState]            = useState(DEFAULTS.buoy)
  const [weatherLocation, setWeatherLocationState] = useState(DEFAULTS.weatherLocation)
  const [solunarLocation, setSolunarLocationState] = useState(DEFAULTS.solunarLocation)

  async function autoInit(hp, doStation, doBuoy) {
    if (!hp) return
    try {
      await Promise.all([
        doStation && findNearestStation(hp.lat, hp.lng).then(s => {
          if (!s) return
          const val = { id: s.id, name: s.name }
          setTideStationState(val)
          return AsyncStorage.setItem('dataLoc_tideStation', JSON.stringify(val))
        }),
        doBuoy && fetchNdbcBuoys().then(buoys => {
          let nearest = null, minDist = Infinity
          buoys.forEach(b => {
            const dist = haversine(hp.lat, hp.lng, b.lat, b.lng)
            if (dist < minDist) { minDist = dist; nearest = b }
          })
          if (!nearest) return
          const val = { id: nearest.id, name: nearest.name, lat: nearest.lat, lng: nearest.lng }
          setBuoyState(val)
          return AsyncStorage.setItem('dataLoc_buoy', JSON.stringify(val))
        }),
      ].filter(Boolean))
    } catch (_) {}
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [ts, b, wl, sl] = await Promise.all([
          AsyncStorage.getItem('dataLoc_tideStation'),
          AsyncStorage.getItem('dataLoc_buoy'),
          AsyncStorage.getItem('dataLoc_weatherLocation'),
          AsyncStorage.getItem('dataLoc_solunarLocation'),
        ])
        if (ts) setTideStationState(JSON.parse(ts))
        if (b)  setBuoyState(JSON.parse(b))
        if (wl) setWeatherLocationState(JSON.parse(wl))
        if (sl) setSolunarLocationState(JSON.parse(sl))
        if (!ts || !b) {
          const hp = JSON.parse(await AsyncStorage.getItem('homePort') || 'null') || homePort
          autoInit(hp, !ts, !b)
        }
      } catch (_) {}
    }
    load()
  }, [])

  const setTideStation = useCallback(async (id, name) => {
    const val = { id, name }
    setTideStationState(val)
    await AsyncStorage.setItem('dataLoc_tideStation', JSON.stringify(val))
  }, [])

  const setBuoy = useCallback(async (id, name, lat, lng) => {
    const val = { id, name, lat, lng }
    setBuoyState(val)
    await AsyncStorage.setItem('dataLoc_buoy', JSON.stringify(val))
  }, [])

  const setWeatherLocation = useCallback(async (lat, lng, name) => {
    const val = { lat, lng, name }
    setWeatherLocationState(val)
    await AsyncStorage.setItem('dataLoc_weatherLocation', JSON.stringify(val))
  }, [])

  const setSolunarLocation = useCallback(async (lat, lng, name) => {
    const val = { lat, lng, name }
    setSolunarLocationState(val)
    await AsyncStorage.setItem('dataLoc_solunarLocation', JSON.stringify(val))
  }, [])

  const findNearestTideStation = useCallback(async (lat, lng) => {
    return findNearestStation(lat, lng)
  }, [])

  const findNearestBuoy = useCallback(async (lat, lng) => {
    const buoys = await fetchNdbcBuoys()
    let nearest = null, minDist = Infinity
    buoys.forEach(b => {
      const dist = haversine(lat, lng, b.lat, b.lng)
      if (dist < minDist) { minDist = dist; nearest = b }
    })
    return nearest ? { ...nearest } : null
  }, [])

  return (
    <DataLocationContext.Provider value={{
      tideStation, buoy, weatherLocation, solunarLocation,
      setTideStation, setBuoy, setWeatherLocation, setSolunarLocation,
      findNearestTideStation, findNearestBuoy,
    }}>
      {children}
    </DataLocationContext.Provider>
  )
}

export function useDataLocation() {
  return useContext(DataLocationContext)
}
