import { ScaleLinear } from 'd3-scale'

export interface DataPoint {
  x: number
  y: number
  index: string
  score: number
  color: string | null
  cx?: number // Pre-computed x coordinate for lasso
  cy?: number // Pre-computed y coordinate for lasso
  hasExpressionData?: boolean // Flag to indicate if point has gene expression data
}

export interface LabelPoint {
  x: number
  y: number
  label: string
  color: string | null
  isDragging?: boolean
  dragOffsetX?: number
  dragOffsetY?: number
  originalX?: number
  originalY?: number
}

export interface TooltipData {
  top: number
  left: number
  data: DataPoint | null
}

export type SelectionMode = 'lasso' | 'rectangle' | 'circle'

export interface UseLassoProps {
  data: DataPoint[]
  xScale: ScaleLinear<number, number>
  yScale: ScaleLinear<number, number>
  onSelection: (selectedPoints: DataPoint[]) => void
  selectionMode?: SelectionMode
}

export interface UseLassoReturn {
  handleMouseDown: (event: React.MouseEvent) => void
  handleMouseMove: (event: React.MouseEvent) => void
  handleMouseUp: () => void
  Lasso: React.FC
  lassoPoints: [number, number][]
  isLassoActive: boolean
}

export interface PlotState {
  minScore: number
  maxScore: number
  autoMinScore: boolean
  autoMaxScore: boolean
  minColor: string
  maxColor: string
  pointSize: number
  transformX: number
  transformY: number
  toggleLabels: boolean
  toggleGridlines: boolean
}
