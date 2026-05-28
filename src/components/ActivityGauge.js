import React from 'react'
import { View, Text } from 'react-native'
import Svg, { Path, Text as SvgText } from 'react-native-svg'
import { Typography } from '../constants/theme'
import { scoreColor, scoreLabel } from '../utils/solunar'

const ARC_START_DEG = 135
const ARC_SWEEP_DEG = 270

function svgArc(cx, cy, r, startDeg, sweepDeg) {
  if (Math.abs(sweepDeg) < 0.1) return ''
  const s = startDeg * Math.PI / 180
  const e = (startDeg + sweepDeg) * Math.PI / 180
  const x1 = cx + r * Math.cos(s)
  const y1 = cy + r * Math.sin(s)
  const x2 = cx + r * Math.cos(e)
  const y2 = cy + r * Math.sin(e)
  const large = sweepDeg > 180 ? 1 : 0
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

export default function ActivityGauge({ score, Colors, size = 200 }) {
  const cx = size / 2
  const cy = size / 2
  const r  = Math.round(size * 0.36)
  const sw = Math.max(6, Math.round(size * 0.06))

  const fillSweep  = ARC_SWEEP_DEG * (Math.max(0, Math.min(100, score)) / 100)
  const color      = scoreColor(score, Colors)
  const tier       = scoreLabel(score)

  const scoreFont  = Math.round(size * 0.21)
  const subFont    = Math.max(7, Math.round(size * 0.047))
  const scoreDy    = Math.round(size * 0.088)
  const subDy      = Math.round(size * 0.188)
  const tierFont   = Math.max(10, Math.round(size * 0.068))
  const tierMT     = -Math.round(size * 0.065)
  const large      = size >= 150

  return (
    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
      <Svg width={size} height={size}>
        <Path
          d={svgArc(cx, cy, r, ARC_START_DEG, ARC_SWEEP_DEG)}
          fill="none" stroke={Colors.border} strokeWidth={sw} strokeLinecap="round"
        />
        {fillSweep > 0 && (
          <Path
            d={svgArc(cx, cy, r, ARC_START_DEG, fillSweep)}
            fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          />
        )}
        <SvgText x={cx} y={cy + scoreDy} textAnchor="middle"
          fontSize={scoreFont} fontWeight="700" fontFamily="Georgia" fill={color}>
          {score}
        </SvgText>
        {large && (
          <SvgText x={cx} y={cy + subDy} textAnchor="middle"
            fontSize={subFont} fill={Colors.textMuted}>
            fish activity avg
          </SvgText>
        )}
      </Svg>
      {large && (
        <Text style={{ fontSize: tierFont, fontWeight: '600', color, marginTop: tierMT }}>
          {tier} fish activity
        </Text>
      )}
    </View>
  )
}
