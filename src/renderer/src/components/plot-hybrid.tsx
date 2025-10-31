import { DataPoint, LabelPoint, PlotState } from '../types'
import Plot from './plot'
import PlotCanvas from './plot-canvas'

interface PlotHybridProps {
  data: DataPoint[]
  labels: LabelPoint[]
  plotState: PlotState
  setPlotState: (plotState: PlotState) => void
  onSelectedData: (data: DataPoint[]) => void
  selectedPoints: DataPoint[]
  setSelectedPoints: (points: DataPoint[]) => void
}

const PlotHybrid = (props: PlotHybridProps): JSX.Element => {
  const { data } = props

  // Use canvas for large datasets (more than 1,000 points)
  // Use SVG for smaller datasets for better interactivity
  const useCanvas = data.length > 1000

  console.log('PlotHybrid - data length:', data.length, 'useCanvas:', useCanvas, 'using:', useCanvas ? 'Canvas' : 'SVG', 'FORCE RELOAD')

  if (useCanvas) {
    console.log('PlotHybrid - RENDERING PlotCanvas component')
    return <PlotCanvas {...props} />
  } else {
    console.log('PlotHybrid - RENDERING Plot (SVG) component')
    return <Plot {...props} />
  }
}

export default PlotHybrid