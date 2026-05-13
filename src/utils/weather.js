const LAT  = 29.865
const LNG  = -89.674
const NOAA_STATION = '8761724'

const WMO_EMOJI = {
  0: '☀️',  1: '🌤️', 2: '⛅',  3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️',  73: '❄️',  75: '❄️',  77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '❄️',  86: '❄️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']

export function weatherEmoji(code) {
  return WMO_EMOJI[code] ?? '🌤️'
}

export function windDir(deg) {
  if (deg == null) return ''
  return COMPASS[Math.round(deg / 22.5) % 16]
}

export async function fetchWeatherAndForecast(lat = LAT, lng = LNG) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,windspeed_10m,winddirection_10m,weathercode&hourly=temperature_2m,windspeed_10m,winddirection_10m&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FChicago&forecast_days=10`
  const res  = await fetch(url)
  const data = await res.json()
  return {
    current:          data.current,
    daily:            data.daily,
    hourlyTemps:      data.hourly?.temperature_2m?.slice(0, 24) ?? [],
    hourlyWindSpeeds: data.hourly?.windspeed_10m?.slice(0, 24) ?? [],
    hourlyWindDirs:   data.hourly?.winddirection_10m?.slice(0, 24) ?? [],
  }
}

export async function fetchMarineData(lat = LAT, lng = LNG) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_direction&hourly=wave_height&daily=wave_height_max&length_unit=imperial&forecast_days=7`
  const res  = await fetch(url)
  const data = await res.json()
  return {
    current:      data.current,
    hourlyWaves:  data.hourly?.wave_height?.slice(0, 24) ?? [],
    dailyMaxWaves:data.daily?.wave_height_max ?? [],
  }
}

export async function fetchWaterTemp(stationId = NOAA_STATION) {
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${stationId}&product=water_temperature&date=latest&units=english&time_zone=lst_ldt&application=brackish_pirate&format=json`
  const res  = await fetch(url)
  const data = await res.json()
  const v    = data.data?.[0]?.v
  return v != null ? parseFloat(v) : null
}
