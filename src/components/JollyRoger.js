import React from 'react'
import Svg, { Line, Path, Circle } from 'react-native-svg'

export default function JollyRoger({ size = 20, flagColor = '#FFFFFF', boneColor = '#0D2137' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      {/* Pole */}
      <Line x1="5" y1="2" x2="5" y2="18" stroke={flagColor} strokeWidth="1.8" strokeLinecap="round"/>
      {/* Triangular flag */}
      <Path d="M5 2 L5 12 L17 7 Z" fill={flagColor}/>
      {/* Skull */}
      <Circle cx="10" cy="7" r="2" fill={boneColor}/>
      {/* Crossbones */}
      <Line x1="8"  y1="9.5"  x2="12" y2="11.5" stroke={boneColor} strokeWidth="1.2" strokeLinecap="round"/>
      <Line x1="12" y1="9.5"  x2="8"  y2="11.5" stroke={boneColor} strokeWidth="1.2" strokeLinecap="round"/>
    </Svg>
  )
}
