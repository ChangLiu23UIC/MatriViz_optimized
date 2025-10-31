import React, { useState, useEffect, useRef, useMemo } from 'react'

/* Visx */
import { Group } from '@visx/group'
import { Circle } from '@visx/shape'
import { scaleLinear } from '@visx/scale'
import { LinearGradient } from '@visx/gradient'
import { TooltipWithBounds, defaultStyles as tooltipStyles } from '@visx/tooltip'
import { GridRows, GridColumns } from '@visx/grid'

/* Lucide */
import { Settings } from 'lucide-react'

/* Components */
import useLassoSimple from './lasso-simple'
import Legend from './legend'
import PlotOptions from './plotOptions'

/* Types */
import { DataPoint, LabelPoint, TooltipData, PlotState } from '../types'

/* Styles */
import styles from '../assets/plot.module.css'

interface PlotProps {
  data: DataPoint[]
  labels: LabelPoint[]
  plotState: PlotState
  setPlotState: (plotState: PlotState) => void
  onSelectedData: (data: DataPoint[]) => void
  selectedPoints: DataPoint[]
  setSelectedPoints: (points: DataPoint[]) => void
}

const Plot = ({
  data,
  labels,
  plotState,
  setPlotState,
  onSelectedData,
  selectedPoints,
  setSelectedPoints
}: PlotProps): JSX.Element => {
  // Debug: Log when selectedPoints prop changes
  useEffect(() => {
    if (selectedPoints.length > 0) {
      console.log('Plot component - selectedPoints prop changed:', selectedPoints.length, 'points')
    }
  }, [selectedPoints])

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.67, // Account for sidebar
    height: window.innerHeight - 50
  })
  const svgContainerRef = useRef<SVGSVGElement | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [tooltip, setTooltip] = useState<TooltipData>()
  const [selectionLostMessage, setSelectionLostMessage] = useState<string>('')

  const [togglePlotOptions, setTogglePlotOptions] = useState(false)

  const scaleOffset = 2

  // Check if data is valid for scaling
  const hasValidData = data && data.length > 0

  // Optimized domain calculations - avoid spread operator with large arrays
  const xDomain = useMemo(() => {
    if (!hasValidData) return [0, 1]
    let minX = Infinity, maxX = -Infinity
    for (const d of data) {
      if (d.x < minX) minX = d.x
      if (d.x > maxX) maxX = d.x
    }
    return [minX - scaleOffset, maxX + scaleOffset]
  }, [data, hasValidData, scaleOffset])

  const yDomain = useMemo(() => {
    if (!hasValidData) return [0, 1]
    let minY = Infinity, maxY = -Infinity
    for (const d of data) {
      if (d.y < minY) minY = d.y
      if (d.y > maxY) maxY = d.y
    }
    return [minY - scaleOffset, maxY + scaleOffset]
  }, [data, hasValidData, scaleOffset])

  const xScale = scaleLinear({
    range: [
      (0 - plotState.transformX) / zoomLevel,
      (dimensions.width - plotState.transformX) / zoomLevel
    ],
    domain: xDomain
  })

  const yScale = scaleLinear({
    range: [
      (dimensions.height - plotState.transformY) / zoomLevel,
      (0 - plotState.transformY) / zoomLevel
    ],
    domain: yDomain
  })


  const colorScale = scaleLinear<string>({
    domain: [plotState.minScore, plotState.maxScore],
    range: [plotState.maxColor, plotState.minColor]
  })

  // Debug color scale
  useEffect(() => {
    // Color scale debugging disabled for performance
  }, [plotState.minScore, plotState.maxScore, plotState.minColor, plotState.maxColor, data])

  useEffect(() => {
    const handleWheel = (event: WheelEvent): void => {
      const scaleFactor = 1.1
      const svgContainer = svgContainerRef.current
      if (!svgContainer) return

      const svgRect = svgContainer.getBoundingClientRect()
      const mouseX = event.clientX - svgRect.left
      const mouseY = event.clientY - svgRect.top

      if (mouseX >= 0 && mouseY >= 0 && mouseX <= svgRect.width && mouseY <= svgRect.height) {
        let newZoomLevel = event.deltaY > 0 ? zoomLevel / scaleFactor : zoomLevel * scaleFactor

        let newTransformX = mouseX - (mouseX - plotState.transformX) * (newZoomLevel / zoomLevel)
        let newTransformY = mouseY - (mouseY - plotState.transformY) * (newZoomLevel / zoomLevel)

        if (newZoomLevel > 1) {
          newZoomLevel = 1
          newTransformX = 0
          newTransformY = 0
        }
        setZoomLevel(newZoomLevel)

        setPlotState({
          ...plotState,
          transformX: newTransformX,
          transformY: newTransformY
        })
      }
    }

    window.addEventListener('wheel', handleWheel)
    const handleResize = (): void => {
      setDimensions({ width: window.innerHeight - 50, height: window.innerHeight - 50 })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('resize', handleResize)
    }
  }, [zoomLevel, plotState])

  useEffect(() => {
    // Set the min and max score
    let newMinScore = plotState.minScore
    let newMaxScore = plotState.maxScore

    if (plotState.autoMinScore || plotState.autoMaxScore) {
      let minScore = Infinity
      let maxScore = -Infinity

      for (const d of data) {
        if (d.score < minScore) minScore = d.score
        if (d.score > maxScore) maxScore = d.score
      }

      // Check if we have any data points with expression data
      const hasExpressionData = data.length > 0 && data[0]?.hasExpressionData === true

      // Only auto-scale if we have meaningful data (not all zeros)
      const hasMeaningfulData = minScore !== Infinity && maxScore !== -Infinity && maxScore > minScore

      if (hasExpressionData) {
        // When genes are selected, always use the computed expression range
        // Even if all values are the same, we should use that value
        if (minScore === maxScore) {
          // If all scores are the same, create a small range around that value
          newMinScore = minScore - 0.1
          newMaxScore = maxScore + 0.1
        } else {
          if (plotState.autoMinScore) newMinScore = minScore
          else newMinScore = 0

          if (plotState.autoMaxScore) newMaxScore = maxScore
          else newMaxScore = 10
        }
      } else if (hasMeaningfulData) {
        // For non-expression data with meaningful range
        if (plotState.autoMinScore) newMinScore = minScore
        else newMinScore = 0

        if (plotState.autoMaxScore) newMaxScore = maxScore
        else newMaxScore = 10
      } else {
        // No meaningful data (all zeros or no data), use default range
        if (plotState.autoMinScore) newMinScore = 0
        else newMinScore = 0

        if (plotState.autoMaxScore) newMaxScore = 1
        else newMaxScore = 10
      }
    }

    setPlotState({ ...plotState, minScore: newMinScore, maxScore: newMaxScore })
  }, [data, plotState.autoMinScore, plotState.autoMaxScore])

  // Filter selected points to only include those that exist in current data
  useEffect(() => {
    if (data.length === 0) return

    // Create a set of current data indices for fast lookup
    const currentDataIndices = new Set(data.map((d) => d.index))

    // Filter selected points to only keep those that exist in current data
    const validSelectedPoints = selectedPoints.filter((point) =>
      currentDataIndices.has(point.index)
    )


    // Update selected points if some were filtered out
    if (validSelectedPoints.length !== selectedPoints.length) {
      setSelectedPoints(validSelectedPoints)

      // Set user message when selections are lost
      if (selectedPoints.length > 0 && validSelectedPoints.length === 0) {
        setSelectionLostMessage(
          `All ${selectedPoints.length} selected points were lost - different dataset`
        )
        // Clear message after 5 seconds
        setTimeout(() => setSelectionLostMessage(''), 5000)
      } else if (validSelectedPoints.length < selectedPoints.length) {
        setSelectionLostMessage(
          `${
            selectedPoints.length - validSelectedPoints.length
          } points lost - not in current dataset`
        )
        setTimeout(() => setSelectionLostMessage(''), 5000)
      } else {
        setSelectionLostMessage('')
      }
    }
  }, [data, selectedPoints])

  useEffect(() => {
    const sortedPoints = [...selectedPoints].sort((a, b) => b.score - a.score)
    const modifiedPoints = sortedPoints.map((point) => ({
      ...point,
      color: colorScale(point.score)
    }))
    onSelectedData(modifiedPoints)
  }, [selectedPoints])


  const handleMouseEnter = (event: React.MouseEvent<SVGCircleElement>, point: DataPoint): void => {
    setTooltip({
      top: event.clientY,
      left: event.clientX,
      data: point
    })
  }

  const handleMouseLeave = (): void => {
    setTooltip({ top: 0, left: 0, data: null })
  }

  const selectedPointIds = useMemo(() => {
    return new Set(selectedPoints.map((point) => point.index))
  }, [selectedPoints])

  const processedData = useMemo(() => {
    if (!data) return []

    const hasSelectedPoints = selectedPoints.length > 0

    return data.map((point) => {
      const isSelected = selectedPointIds.has(point.index)

      // Fix: When no points are selected, always use colorScale
      // When points are selected, selected ones use colorScale, others use gray
      const fill = hasSelectedPoints
        ? (isSelected ? colorScale(point.score) : 'gray')
        : colorScale(point.score)

      return {
        ...point,
        cx: xScale(point.x),
        cy: yScale(point.y),
        fill: fill
      }
    })
  }, [data, xScale, yScale, colorScale, selectedPointIds, selectedPoints.length])

  // Create separate scales for lasso selection (without zoom/transform)
  const { lassoXScale, lassoYScale } = useMemo(() => {
    const lassoXScale = scaleLinear({
      range: [0, dimensions.width],
      domain: xDomain
    })

    const lassoYScale = scaleLinear({
      range: [dimensions.height, 0],
      domain: yDomain
    })

    return { lassoXScale, lassoYScale }
  }, [dimensions.width, dimensions.height, xDomain, yDomain])

  // Pre-computed data for lasso selection (with scaled coordinates)
  const lassoData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      cx: lassoXScale(point.x),
      cy: lassoYScale(point.y)
    }))
  }, [data, lassoXScale, lassoYScale])

  const { handleMouseDown, handleMouseMove, handleMouseUp, Lasso } = useLassoSimple({
    data: lassoData,
    xScale: lassoXScale,
    yScale: lassoYScale,
    onSelection: setSelectedPoints
  })
  return (
    <>
      {togglePlotOptions && <PlotOptions plotState={plotState} setPlotState={setPlotState} />}
      <div className="container" style={{ display: 'flex', width: '100%', height: '100%' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <div
            className={styles.settings}
            onClick={(): void => setTogglePlotOptions(!togglePlotOptions)}
          >
            <p>Plot options </p>
            <Settings />
          </div>

        <svg
          ref={svgContainerRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <LinearGradient id="stroke" from="#6699ff" to="#9933cc" />
          <Group>
            {plotState.toggleGridlines && (
              <>
                <GridRows scale={yScale} width={dimensions.width} stroke="#e0e0e0" />
                <GridColumns scale={xScale} height={dimensions.height} stroke="#e0e0e0" />
              </>
            )}
            {processedData.map((point, index) => (
              <Circle
                key={`point-${point.index || index}`}
                cx={point.cx}
                cy={point.cy}
                r={plotState.pointSize}
                fill={point.fill}
                className={styles.point}
                onMouseEnter={(event): void => handleMouseEnter(event, point)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
            {plotState.toggleLabels &&
              labels?.map((label, index) => (
                <text
                  key={`label-${label.label || index}`}
                  x={xScale(label.x)}
                  y={yScale(label.y)}
                  className={styles.label}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#000000"
                  stroke="#ffffff"
                  strokeWidth="2"
                  paintOrder="stroke"
                >
                  {label.label}
                </text>
              ))}
            <Lasso />
          </Group>
        </svg>

        {tooltip?.data && (
          <TooltipWithBounds top={tooltip.top} left={tooltip.left} style={tooltipStyles}>
            <b>Cell Name:</b> {tooltip.data.index}
            <br />
            <b>Score:</b> {tooltip.data.score}
          </TooltipWithBounds>
        )}

        {selectionLostMessage && (
          <text x={10} y={20} className={styles.selectionLostMessage}>
            {selectionLostMessage}
          </text>
        )}

        <Legend
          x={dimensions.width - 80}
          y={0}
          maxScore={plotState.maxScore}
          minScore={plotState.minScore}
          minColor={plotState.minColor}
          maxColor={plotState.maxColor}
        />
        </div>

      </div>
    </>
  )
}

export default React.memo(Plot)
