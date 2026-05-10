const STATION_ID   = '8761724'
const BASE_URL     = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
const COMMON_PARAMS = '&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&application=brackish_pirate&format=json'

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

let _stationsCache = null

export async function findNearestStation(lat, lng) {
  if (!_stationsCache) {
    const res  = await fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english')
    const data = await res.json()
    _stationsCache = data.stations || []
  }
  let nearest = null
  let minDist = Infinity
  _stationsCache.forEach(st => {
    const dist = haversine(lat, lng, parseFloat(st.lat), parseFloat(st.lng))
    if (dist < minDist) {
      minDist = dist
      nearest = { id: st.id, name: st.name, lat: parseFloat(st.lat), lng: parseFloat(st.lng), dist }
    }
  })
  return nearest
}

export async function fetchNoaaStations() {
  if (!_stationsCache) {
    const res  = await fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions&units=english')
    const data = await res.json()
    _stationsCache = (data.stations || []).map(st => ({
      id:   st.id,
      name: st.name,
      state:st.state,
      lat:  parseFloat(st.lat),
      lng:  parseFloat(st.lng),
    }))
  }
  return _stationsCache
}

function dateKey(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export async function fetchTideHourly(date = new Date(), stationId = STATION_ID) {
  const d   = dateKey(date)
  const url = `${BASE_URL}?begin_date=${d}&end_date=${d}&station=${stationId}&interval=60${COMMON_PARAMS}`
  const res = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}

export async function fetchTideHiLo(date = new Date(), stationId = STATION_ID) {
  const d   = dateKey(date)
  const url = `${BASE_URL}?begin_date=${d}&end_date=${d}&station=${stationId}&interval=hilo${COMMON_PARAMS}`
  const res = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}

export async function fetchTidesForDate(dateStr, stationId = STATION_ID) {
  const d   = dateStr.replace(/-/g, '')
  const url = `${BASE_URL}?begin_date=${d}&end_date=${d}&station=${stationId}&interval=hilo${COMMON_PARAMS}`
  const res = await fetch(url)
  const data = await res.json()
  return data.predictions || []
}
