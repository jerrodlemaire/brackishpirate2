export function getTheme(mode = 'dark') {
  const d = mode !== 'light'
  return {
    // Brand — same in both modes
    brackishWater: '#4A8FA8',
    deepSea:       '#0D2137',      // navy brand color (fixed)
    accent:        '#4A8FA8',      // links, active tab indicator, focus rings

    // Interactive — fill flips by mode so components don't branch
    buttonBg:   d ? '#4A8FA8' : '#0D2137',
    buttonText: d ? '#0D2137' : '#4A8FA8',

    // Category — color only dots, icons, thin accents; never value text
    catFish:    d ? '#C49A2A' : '#A87A10',   // fish activity
    catTides:   d ? '#4A90D9' : '#2F73C2',   // tides
    catWind:    d ? '#9B86D4' : '#6E5BB5',   // wind
    catWeather: d ? '#2E8B5A' : '#25794D',   // weather / air temp

    // Trend — for barometric pressure arrows and scales
    trendUp:  d ? '#5DCAA5' : '#1F8A5C',
    trendDown: d ? '#E07050' : '#C5502E',

    // Alerts — reserved; never use as a category color
    danger:    d ? '#E24B4A' : '#C0322F',
    dangerBg:  d ? 'rgba(226,75,74,0.15)'  : 'rgba(226,75,74,0.14)',
    warning:   d ? '#E8A838' : '#8A5A00',
    warningBg: d ? 'rgba(232,168,56,0.15)' : 'rgba(232,168,56,0.22)',
    success:   d ? '#5DCAA5' : '#1F8A5C',  // alias for trendUp

    // Surfaces — mode-dependent
    screenBg: d ? '#070F18' : '#DCDCE1',
    cardBg:   d ? '#0D2137' : '#E8E8EC',
    topbarBg: d ? '#070F18' : '#DCDCE1',
    tabBarBg: d ? '#0D2137' : '#E8E8EC',
    inputBg:  d ? 'rgba(255,255,255,0.06)' : '#F0F0F2',

    // Text — mode-dependent
    textPrimary:   d ? '#F5F0E8' : '#0D2137',
    textSecondary: d ? 'rgba(255,255,255,0.45)' : '#5A7A8A',
    textMuted:     d ? 'rgba(255,255,255,0.30)' : 'rgba(13,33,55,0.45)',
    textOnDark:    '#F5F0E8',   // always light cream — use on fixed-dark surfaces

    // Borders — mode-dependent
    border:      d ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.07)',
    borderMid:   d ? 'rgba(255,255,255,0.15)' : 'rgba(13,33,55,0.12)',
    inputBorder: d ? 'rgba(255,255,255,0.15)' : 'rgba(13,33,55,0.12)',

    // Air-temp gradient array — cool → warm; use for temp charts/scales
    tempScale: d
      ? ['#4A90D9', '#5DCAA5', '#E8A838', '#E07050']
      : ['#2F73C2', '#25794D', '#D98A1E', '#D35A33'],

    // Backward-compat aliases — kept so nothing crashes; same underlying value
    doubloonGold:        d ? '#C49A2A' : '#A87A10',  // → catFish
    marshGreen:          d ? '#2E8B5A' : '#25794D',  // → catWeather
    saltWhite:           d ? '#F5F0E8' : '#0D2137',  // → textPrimary
    textOnDarkSecondary: d ? 'rgba(255,255,255,0.45)' : '#5A7A8A',
    borderDark:          d ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.07)',

    // Deprecated — still defined to avoid crashes; migrate callers off these
    amberLight:   d ? '#C49A2A' : '#A87A10',  // → doubloonGold / warning
    parchment:    d ? '#070F18' : '#DCDCE1',  // → screenBg
    midnightTide: d ? '#070F18' : '#DCDCE1',  // → screenBg
  }
}

// Static dark-mode export for code not yet on dynamic theme
export const Colors = getTheme('dark')

export const Typography = {
  fontSerif: 'Georgia',
  fontSans:  'System',
  xs:   10,
  sm:   11,
  base: 13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  26,
  hero: 32,
  regular: '400',
  medium:  '500',
  bold:    '700',
}

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
  section: 14,
}

export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   20,
  full: 999,
}

export const Shadow = {
  card: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  strong: {
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
}
