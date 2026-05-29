let _buoysCache = null

export async function fetchNdbcBuoys() {
  if (_buoysCache) return _buoysCache
  const res  = await fetch('https://www.ndbc.noaa.gov/activestations.xml')
  const text = await res.text()
  const buoys = []
  const re    = /<station\b([^>]+?)(?:\/>|>)/g
  let m
  while ((m = re.exec(text)) !== null) {
    const attrs = m[1]
    const id    = /\bid="([^"]+)"/.exec(attrs)?.[1]
    const lat   = /\blat="([^"]+)"/.exec(attrs)?.[1]
    const lon   = /\blon="([^"]+)"/.exec(attrs)?.[1]
    const name  = /\bname="([^"]+)"/.exec(attrs)?.[1]
    const type  = /\btype="([^"]+)"/.exec(attrs)?.[1]
    if (id && lat && lon && name) {
      const latF = parseFloat(lat)
      const lngF = parseFloat(lon)
      if (!isNaN(latF) && !isNaN(lngF)) {
        buoys.push({ id, lat: latF, lng: lngF, name, type: type || 'buoy' })
      }
    }
  }
  _buoysCache = buoys
  return _buoysCache
}

export async function fetchNdbcObservations(buoyId) {
  try {
    const res   = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${buoyId}.txt`)
    const text  = await res.text()
    const lines = text.split('\n')

    // Line 0: column names (starts with #YY MM DD ...)
    const cols     = lines[0]?.replace(/^#+\s*/, '').trim().split(/\s+/) ?? []
    // NDBC lists newest-first. Sensors report on different cadences, so any
    // single row has 'MM' (missing) scattered across columns — e.g. wave
    // height/period only appear every other row. Read the most recent
    // non-missing value per field by scanning recent rows newest → oldest,
    // instead of trusting only the latest row.
    const dataRows = lines
      .filter(l => !l.startsWith('#') && l.trim())
      .slice(0, 24)
      .map(l => l.trim().split(/\s+/))
    if (!dataRows.length || !cols.length) return null

    const get = (col) => {
      const i = cols.indexOf(col)
      if (i < 0) return null
      for (const vals of dataRows) {
        const raw = vals[i]
        if (raw == null || raw === 'MM') continue
        const n = parseFloat(raw)
        if (!isNaN(n)) return n
      }
      return null
    }

    const wvht = get('WVHT')
    const dpd  = get('DPD')
    const mwd  = get('MWD')
    const wspd = get('WSPD')
    const wdir = get('WDIR')
    const atmp = get('ATMP')
    const wtmp = get('WTMP')
    const pres = get('PRES')
    return {
      waveHeight: wvht != null ? +(wvht * 3.28084).toFixed(1) : null,  // m → ft
      period:     dpd,
      waveDir:    mwd,
      windSpeed:  wspd != null ? +(wspd * 1.94384).toFixed(1) : null,  // m/s → kt
      windDir:    wdir,
      airTemp:    atmp != null ? +(atmp * 9/5 + 32).toFixed(0) : null, // °C → °F
      waterTemp:  wtmp != null ? +(wtmp * 9/5 + 32).toFixed(0) : null,
      pressure:   pres,
    }
  } catch (_) {
    return null
  }
}
