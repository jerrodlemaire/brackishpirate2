const STATION_ID   = '8761724'
const BASE_URL     = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
const COMMON_PARAMS = '&product=predictions&datum=MLLW&time_zone=lst_ldt&units=english&application=brackish_pirate&format=json'

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
