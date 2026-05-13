export function getTheme(mode = 'dark') {
  const d = mode !== 'light'
  return {
    // Accent — same in both modes
    brackishWater: '#4A8FA8',
    doubloonGold:  '#C49A2A',
    amberLight:    '#E8A838',
    marshGreen:    '#2E8B5A',
    parchment:     '#EDE5D0',

    // Semantic — same in both modes
    danger:  '#E24B4A',
    warning: '#F39C12',
    success: '#2E8B5A',

    // Always fixed (topbar, tabbar)
    topbarBg: '#0D2137',
    tabBarBg: '#0D2137',

    // Surface — mode-dependent
    midnightTide: d ? '#1A3A52' : '#F0EBE0',
    deepSea:      d ? '#0D2137' : '#FFFFFF',
    cardBg:       d ? '#0D2137' : '#FFFFFF',
    screenBg:     d ? '#1A3A52' : '#F0EBE0',
    inputBg:      d ? 'rgba(255,255,255,0.06)' : '#F7F3EC',
    inputBorder:  d ? 'rgba(255,255,255,0.15)'  : 'rgba(13,33,55,0.12)',

    // Text — mode-dependent
    saltWhite:     d ? '#F5F0E8' : '#0D2137',
    textPrimary:   d ? '#F5F0E8' : '#0D2137',
    textSecondary: d ? 'rgba(255,255,255,0.45)' : '#5A7A8A',
    textMuted:     d ? 'rgba(255,255,255,0.3)'  : 'rgba(13,33,55,0.4)',
    textOnDark:    '#F5F0E8',

    // Borders — mode-dependent
    border:    d ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.1)',
    borderMid: d ? 'rgba(255,255,255,0.15)' : 'rgba(13,33,55,0.15)',

    // Backward-compat aliases
    textOnDarkSecondary: d ? 'rgba(255,255,255,0.45)' : '#5A7A8A',
    borderDark:          d ? 'rgba(255,255,255,0.08)'  : 'rgba(13,33,55,0.1)',
  }
}

// Static dark-mode export kept for any code not yet on dynamic theme
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
