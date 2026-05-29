import React from 'react'
import { View } from 'react-native'
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg'

export default function WindCompass({ deg, size = 18, color = '#4A8FA8', strokeWidth = 2.5 }) {
  if (deg == null) return <View style={{ width: size, height: size }}/>
  const rad       = (deg - 90) * Math.PI / 180
  const cx = size / 2, cy = size / 2
  const r         = size / 2 - 1.5
  const tx        = cx + r * Math.cos(rad)
  const ty        = cy + r * Math.sin(rad)
  const bx        = cx - (r * 0.45) * Math.cos(rad)
  const by        = cy - (r * 0.45) * Math.sin(rad)
  const headLen   = size * 0.28
  const wingAngle = 0.42
  const w1x = tx - headLen * Math.cos(rad - wingAngle)
  const w1y = ty - headLen * Math.sin(rad - wingAngle)
  const w2x = tx - headLen * Math.cos(rad + wingAngle)
  const w2y = ty - headLen * Math.sin(rad + wingAngle)
  const nFontSize = Math.max(size * 0.28, 5)
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4"/>
      <SvgText x={cx} y={cy - r + nFontSize * 0.85} textAnchor="middle" fontSize={nFontSize} fontWeight="700" fill={color} opacity="0.6">N</SvgText>
      <Line x1={bx} y1={by} x2={tx} y2={ty} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <Polyline points={`${w1x},${w1y} ${tx},${ty} ${w2x},${w2y}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  )
}
