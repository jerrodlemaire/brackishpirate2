import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { findNearestStation } from '../utils/tides'
import { fetchNdbcBuoys } from '../utils/ndbc'
import { useApp, DEFAULT_HOME_PORT } from '../context/AppContext'

const DataLocationContext = createContext({})

const DEFAULTS = {
  tideStation:     { id: '8761724', name: 'Grand Isle, LA' },
  buoy:            { id: '42040', name: 'LUKE OFFSHORE', lat: 29.212, lng: -88.208 },
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
  const [weatherLocation, setWeatherLocationState] = useState({ lat: DEFAULT_HOME_PORT.lat, lng: DEFAULT_HOME_PORT.lng, name: DEFAULT_HOME_PORT.name })
  const [solunarLocation, setSolunarLocationState] = useState({ lat: DEFAULT_HOME_PORT.lat, lng: DEFAULT_HOME_PORT.lng, name: DEFAULT_HOME_PORT.name })

  // When Home Port changes, sync all four data sources.
  // Session-only: overrides via individual tab pickers are not persisted.
  useEffect(() => {
    if (!homePort?.lat || !homePort?.lng) return
    setWeatherLocationState({ lat: homePort.lat, lng: homePort.lng, name: homePort.name })
    setSolunarLocationState({ lat: homePort.lat, lng: homePort.lng, name: homePort.name })
    findNearestStation(homePort.lat, homePort.lng)
      .then(s => { if (s) setTideStationState({ id: s.id, name: s.name }) })
      .catch(() => {})
    fetchNdbcBuoys()
      .then(buoys => {
        let nearest = null, minDist = Infinity
        buoys.forEach(b => {
          const dist = haversine(homePort.lat, homePort.lng, b.lat, b.lng)
          if (dist < minDist) { minDist = dist; nearest = b }
        })
        if (nearest) setBuoyState({ id: nearest.id, name: nearest.name, lat: nearest.lat, lng: nearest.lng })
      })
      .catch(() => {})
  }, [homePort.lat, homePort.lng])

  // Session-only overrides: update state only, not persisted
  const setTideStation = useCallback((id, name) => setTideStationState({ id, name }), [])
  const setBuoy = useCallback((id, name, lat, lng) => setBuoyState({ id, name, lat, lng }), [])
  const setWeatherLocation = useCallback((lat, lng, name) => setWeatherLocationState({ lat, lng, name }), [])
  const setSolunarLocation = useCallback((lat, lng, name) => setSolunarLocationState({ lat, lng, name }), [])

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
