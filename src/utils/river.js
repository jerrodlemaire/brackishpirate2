const USGS_IV = 'https://waterservices.usgs.gov/nwis/iv/'

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function validVal(str) {
  const n = parseFloat(str)
  return !isNaN(n) && n > -999000 ? n : null
}

export async function fetchNearbyRiverStations(lat, lng) {
  const delta = 1.0
  const bbox  = [
    (lng - delta).toFixed(4),
    (lat - delta).toFixed(4),
    (lng + delta).toFixed(4),
    (lat + delta).toFixed(4),
  ].join(',')
  const url  = `${USGS_IV}?format=json&bBox=${bbox}&parameterCd=00065,00060&siteType=ST&siteStatus=active`
  const res  = await fetch(url)
  const data = await res.json()

  const sites = {}
  for (const ts of (data.value?.timeSeries ?? [])) {
    const id      = ts.sourceInfo.siteCode[0].value
    const name    = ts.sourceInfo.siteName
    const sLat    = parseFloat(ts.sourceInfo.geoLocation.geogLocation.latitude)
    const sLng    = parseFloat(ts.sourceInfo.geoLocation.geogLocation.longitude)
    const varCode = ts.variable.variableCode[0].value
    const latest  = ts.values[0]?.value?.slice(-1)[0]
    const val     = latest ? validVal(latest.value) : null

    if (!sites[id]) sites[id] = { id, name, lat: sLat, lng: sLng, stage: null, flow: null }
    if (varCode === '00065') sites[id].stage = val
    if (varCode === '00060') sites[id].flow  = val
  }

  return Object.values(sites)
    .filter(s => s.stage !== null)
    .map(s => ({ ...s, distance: haversine(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 25)
}

export async function fetchRiverTimeSeries(siteId, period = 'P1D') {
  const url  = `${USGS_IV}?format=json&sites=${siteId}&parameterCd=00065,00060&period=${period}`
  const res  = await fetch(url)
  const data = await res.json()

  let stageSeries = [], flowSeries = []
  let currentStage = null, currentFlow = null

  for (const ts of (data.value?.timeSeries ?? [])) {
    const varCode = ts.variable.variableCode[0].value
    const parsed  = (ts.values[0]?.value ?? [])
      .map(v => ({ time: new Date(v.dateTime).getTime(), value: validVal(v.value) }))
      .filter(v => v.value !== null)

    if (varCode === '00065') {
      stageSeries  = parsed
      currentStage = parsed.length ? parsed[parsed.length - 1].value : null
    }
    if (varCode === '00060') {
      flowSeries  = parsed
      currentFlow = parsed.length ? parsed[parsed.length - 1].value : null
    }
  }

  // Trend: compare last reading to ~1.5 hrs ago (6 readings at 15-min intervals)
  let trend = 'steady'
  if (stageSeries.length >= 6) {
    const diff = stageSeries[stageSeries.length - 1].value - stageSeries[stageSeries.length - 6].value
    if (diff >  0.1) trend = 'rising'
    if (diff < -0.1) trend = 'falling'
  }

  // Downsample long series to max 200 pts for chart performance
  const downsample = arr => {
    if (arr.length <= 200) return arr
    const step = Math.ceil(arr.length / 200)
    return arr.filter((_, i) => i % step === 0)
  }

  return {
    stageSeries:  downsample(stageSeries),
    flowSeries:   downsample(flowSeries),
    currentStage,
    currentFlow,
    trend,
  }
}

export function formatStage(ft) {
  if (ft === null || ft === undefined) return '—'
  return `${ft.toFixed(2)} ft`
}

export function formatFlow(cfs) {
  if (cfs === null || cfs === undefined) return '—'
  if (cfs >= 10000) return `${(cfs / 1000).toFixed(1)}k CFS`
  if (cfs >= 1000)  return `${(cfs / 1000).toFixed(2)}k CFS`
  return `${Math.round(cfs)} CFS`
}
