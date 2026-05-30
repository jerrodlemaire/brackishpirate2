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

export function getWindColor(speed) {
  if (speed >= 16) return '#E24B4A'  // danger
  if (speed >= 11) return '#C49A2A'  // catFish / warning-gold
  return '#5DCAA5'                   // trendUp / calm
}

// Fetch JSON with one retry. The pager mounts several screens that hit
// Open-Meteo simultaneously on load, so a request occasionally comes back
// non-OK / rate-limited. Retry once, then surface the real cause (HTTP status
// or the API's "reason") rather than a generic "unavailable".
async function fetchJson(url, label) {
  let lastErr
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.error) throw new Error(data.reason || 'API error')
      return data
    } catch (e) {
      lastErr = e
      if (attempt === 0) await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`${label} unavailable (${lastErr?.message || 'network error'})`)
}

export async function fetchWeatherAndForecast(lat = LAT, lng = LNG) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,windspeed_10m,winddirection_10m,windgusts_10m,weathercode&hourly=temperature_2m,windspeed_10m,winddirection_10m&daily=temperature_2m_max,temperature_2m_min,windspeed_10m_max,winddirection_10m_dominant,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FChicago&forecast_days=10`
  const data = await fetchJson(url, 'Weather API')
  if (!data.current) throw new Error('Weather API returned no current conditions')
  return {
    current:          data.current,
    daily:            data.daily,
    hourlyTemps:      data.hourly?.temperature_2m?.slice(0, 24) ?? [],
    hourlyWindSpeeds: data.hourly?.windspeed_10m?.slice(0, 24) ?? [],
    hourlyWindDirs:   data.hourly?.winddirection_10m?.slice(0, 24) ?? [],
    // Full (multi-day) hourly series — used for the Wind page's rolling
    // "next 6 hours" window, which can cross midnight.
    hourlyWindSpeedsFull: data.hourly?.windspeed_10m ?? [],
    hourlyWindDirsFull:   data.hourly?.winddirection_10m ?? [],
  }
}

export async function fetchPressureTrend(lat = LAT, lng = LNG) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=pressure_msl&past_hours=6&forecast_days=1&timezone=America%2FChicago`
  const res  = await fetch(url)
  const data = await res.json()
  const arr  = data.hourly?.pressure_msl ?? []
  // Index 0 = 6 h ago, index 5 = ~now, index 6+ = forecast
  const p0   = arr[0] ?? null
  const p5   = arr[Math.min(5, arr.length - 1)] ?? null
  return {
    dP:              p0 != null && p5 != null ? p5 - p0 : 0,
    hourlyPressure:  arr,
  }
}

export async function fetchMarineData(lat = LAT, lng = LNG) {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_direction&hourly=wave_height&daily=wave_height_max&length_unit=imperial&forecast_days=7`
  const data = await fetchJson(url, 'Marine API')
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
