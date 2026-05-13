import React from 'react'
import Svg, {
  Circle, Line, Ellipse, Path, Text as SvgText, G
} from 'react-native-svg'

// variant: 'dark' (gold on navy) | 'light' (navy on parchment) | 'mono' (all gold)
export default function HelmCrest({ size = 80, variant = 'dark', hubColor }) {
  const scale = size / 100

  const ring      = variant === 'light' ? '#0D2137' : '#C49A2A'
  const field     = variant === 'dark'  ? '#0D2137'
                  : variant === 'mono'  ? 'transparent'
                  : '#EDE5D0'
  const spoke     = variant === 'light' ? '#0D2137' : '#C49A2A'
  const hub       = variant === 'light' ? '#0D2137' : '#C49A2A'
  const hubCenter = hubColor ?? (variant === 'dark'  ? '#0D2137'
                  : variant === 'mono'  ? 'transparent'
                  : '#EDE5D0')
  const hubDot    = '#C49A2A'
  const wave      = '#4A8FA8'
  const wordmark  = variant === 'light' ? '#0D2137' : '#F5F0E8'
  const submark   = '#C49A2A'

  return (
    <Svg
      width={size}
      height={size * 1.18}
      viewBox="0 0 100 118"
    >
      {/* Outer ring */}
      <Circle cx="50" cy="50" r="44" fill="none" stroke={ring} strokeWidth="1.4"/>
      {/* Dashed inner ring */}
      <Circle cx="50" cy="50" r="40" fill={field} stroke={ring} strokeWidth="0.5" strokeDasharray="3 4"/>

      {/* Helm outer rim */}
      <Circle cx="50" cy="50" r="26" fill="none" stroke={spoke} strokeWidth="2.8"/>

      {/* Hub */}
      <Circle cx="50" cy="50" r="8" fill={hub}/>
      <Circle cx="50" cy="50" r="4.5" fill={hubCenter}/>
      <Circle cx="50" cy="50" r="1.8" fill={hubDot}/>

      {/* 8 spokes + knobs */}
      {/* 0° top */}
      <Line x1="50" y1="45" x2="50" y2="28" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="50" cy="25.5" rx="2.8" ry="4" fill={spoke}/>
      {/* 45° */}
      <Line x1="54.5" y1="46.8" x2="65.2" y2="36.2" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="67.8" cy="33.6" rx="2.8" ry="4" fill={spoke} transform="rotate(45 67.8 33.6)"/>
      {/* 90° right */}
      <Line x1="56" y1="50" x2="73" y2="50" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="75.5" cy="50" rx="2.8" ry="4" fill={spoke} transform="rotate(90 75.5 50)"/>
      {/* 135° */}
      <Line x1="54.5" y1="53.2" x2="65.2" y2="63.8" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="67.8" cy="66.4" rx="2.8" ry="4" fill={spoke} transform="rotate(135 67.8 66.4)"/>
      {/* 180° bottom */}
      <Line x1="50" y1="55" x2="50" y2="72" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="50" cy="74.5" rx="2.8" ry="4" fill={spoke} transform="rotate(180 50 74.5)"/>
      {/* 225° */}
      <Line x1="45.5" y1="53.2" x2="34.8" y2="63.8" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="32.2" cy="66.4" rx="2.8" ry="4" fill={spoke} transform="rotate(225 32.2 66.4)"/>
      {/* 270° left */}
      <Line x1="44" y1="50" x2="27" y2="50" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="24.5" cy="50" rx="2.8" ry="4" fill={spoke} transform="rotate(270 24.5 50)"/>
      {/* 315° */}
      <Line x1="45.5" y1="46.8" x2="34.8" y2="36.2" stroke={spoke} strokeWidth="2.2" strokeLinecap="round"/>
      <Ellipse cx="32.2" cy="33.6" rx="2.8" ry="4" fill={spoke} transform="rotate(315 32.2 33.6)"/>

      {/* Wave base */}
      <Path
        d="M14 74 C20 70.5 26 74 32 71.5 C35 70.5 38 71.5 50 71 C62 71.5 65 70.5 68 71.5 C74 74 80 70.5 86 74"
        fill="none" stroke={wave} strokeWidth="1.6" strokeLinecap="round"
      />
      <Path
        d="M18 79 C24 75.5 30 79 36 76.5 C39 75.5 43 76.5 50 76 C57 76.5 61 75.5 64 76.5 C70 79 76 75.5 82 79"
        fill="none" stroke={wave} strokeWidth="0.9" strokeLinecap="round" opacity={0.55}
      />

      {/* Wordmark */}
      <SvgText
        x="50" y="95"
        fontSize="10"
        fontFamily="Georgia"
        fontWeight="700"
        fill={wordmark}
        textAnchor="middle"
        letterSpacing="2"
      >
        BRACKISH
      </SvgText>
      <SvgText
        x="50" y="107"
        fontSize="6.5"
        fontFamily="Georgia"
        fill={submark}
        textAnchor="middle"
        letterSpacing="4"
      >
        PIRATE
      </SvgText>
    </Svg>
  )
}
