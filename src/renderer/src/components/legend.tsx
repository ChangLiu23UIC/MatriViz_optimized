import { LinearGradient } from '@visx/gradient'
import { Text } from '@visx/text'

interface LegendProps {
  x: number
  y: number
  maxScore: number
  minScore: number
  minColor: string
  maxColor: string
}

const Legend = ({ x, y, maxScore, minScore, minColor, maxColor }: LegendProps): JSX.Element => {
  console.log('Legend rendering - minScore:', minScore, 'maxScore:', maxScore, 'minColor:', minColor, 'maxColor:', maxColor)

  return (
    <svg width={80} height={100} x={x} y={y}>
      <LinearGradient id="colorScale" from={maxColor} to={minColor} vertical={true} />
      <rect x={0} y={0} width={20} height={100} fill="url(#colorScale)" />
      <Text x={25} y={10} fill="#000" fontSize={12}>
        {maxScore.toFixed(3)}
      </Text>
      <Text x={25} y={100} fill="#000" fontSize={12}>
        {minScore.toFixed(3)}
      </Text>
    </svg>
  )
}

export default Legend
