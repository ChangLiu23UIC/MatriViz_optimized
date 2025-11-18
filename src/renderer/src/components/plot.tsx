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
  const [draggingLabel, setDraggingLabel] = useState<LabelPoint | null>(null)
  const [draggedLabels, setDraggedLabels] = useState<LabelPoint[]>([])
  const [originalLabelPositions, setOriginalLabelPositions] = useState<Record<string, {x: number, y: number}>>({})

  const [togglePlotOptions, setTogglePlotOptions] = useState(false)
  const [visibleLabels, setVisibleLabels] = useState<Set<string>>(new Set()) // Track which labels are visible

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

  // Drag handlers for annotations
  const handleLabelMouseDown = (event: React.MouseEvent<SVGTextElement>, label: LabelPoint): void => {
    console.log('SVG annotation drag started for:', label.label)
    event.stopPropagation()
    setDraggingLabel(label)

    // Store original position if not already stored
    if (!originalLabelPositions[label.label]) {
      setOriginalLabelPositions(prev => ({
        ...prev,
        [label.label]: { x: label.x, y: label.y }
      }))
    }

    // Initialize drag state - preserve existing dragged labels
    const updatedLabel = {
      ...label,
      isDragging: true,
      originalX: label.originalX ?? label.x,
      originalY: label.originalY ?? label.y,
      dragOffsetX: 0,
      dragOffsetY: 0
    }

    // Update the labels array with drag state, preserving other dragged labels
    const updatedLabels = draggedLabels.length > 0
      ? draggedLabels.map(l => l.label === label.label ? updatedLabel : l)
      : labels.map(l => l.label === label.label ? updatedLabel : l)

    setDraggedLabels(updatedLabels)
  }

  const handleLabelMouseMove = (event: React.MouseEvent<SVGElement>): void => {
    if (!draggingLabel || !svgContainerRef.current) return

    const svgRect = svgContainerRef.current.getBoundingClientRect()
    const mouseX = event.clientX - svgRect.left
    const mouseY = event.clientY - svgRect.top

    // Convert mouse coordinates to data coordinates
    const dataX = xScale.invert(mouseX)
    const dataY = yScale.invert(mouseY)

    // Update the dragged label position
    const updatedLabels = draggedLabels.map(label => {
      if (label.label === draggingLabel.label) {
        return {
          ...label,
          x: dataX,
          y: dataY
        }
      }
      return label
    })

    setDraggedLabels(updatedLabels)
  }

  const handleLabelMouseUp = (): void => {
    if (draggingLabel) {
      // Clear dragging state but keep the new position
      const updatedLabels = draggedLabels.map(label =>
        label.label === draggingLabel.label
          ? { ...label, isDragging: false }
          : label
      )
      setDraggedLabels(updatedLabels)
    }
    setDraggingLabel(null)
  }

  // Reset all labels to their original positions
  const resetLabelPositions = (): void => {
    console.log('Resetting all label positions')
    setDraggedLabels([])
    setOriginalLabelPositions({})
  }


  // Show all labels
  const showAllLabels = (): void => {
    const allLabelNames = new Set(labels.map(label => label.label))
    setVisibleLabels(allLabelNames)
  }

  // Hide all labels
  const hideAllLabels = (): void => {
    setVisibleLabels(new Set())
  }

  // Use dragged labels if available, otherwise use original labels, filtered by visibility
  const baseLabels = draggedLabels.length > 0 ? draggedLabels : labels
  const displayLabels = baseLabels.filter(label => {
    // If no labels are explicitly set as visible, show all labels
    if (visibleLabels.size === 0) return true
    // Otherwise, only show labels that are in the visible set
    return visibleLabels.has(label.label)
  })

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
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              zIndex: 20
            }}
          >
            <p>Plot options </p>
            <Settings />
          </div>

          {/* Label Visibility Controls */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <button
              onClick={showAllLabels}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: '1px solid #1976D2',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Select All
            </button>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.9)',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                cursor: draggedLabels.length > 0 ? 'pointer' : 'not-allowed',
                userSelect: 'none',
                fontSize: '12px',
                fontWeight: 'bold',
                color: draggedLabels.length > 0 ? '#FF5722' : '#999',
                backgroundColor: draggedLabels.length > 0 ? 'rgba(255, 87, 34, 0.1)' : 'rgba(240, 240, 240, 0.9)',
                textAlign: 'center'
              }}
              onClick={draggedLabels.length > 0 ? resetLabelPositions : undefined}
            >
              Reset Labels
            </div>
          </div>

        <svg
          ref={svgContainerRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={(event): void => {
            // Only handle lasso if not dragging an annotation
            if (!draggingLabel) {
              handleMouseDown(event)
            }
          }}
          onMouseMove={(event): void => {
            // Handle annotation drag first
            handleLabelMouseMove(event)
            // Then handle lasso if not dragging
            if (!draggingLabel) {
              handleMouseMove(event)
            }
          }}
          onMouseUp={(): void => {
            // Handle annotation drag end
            handleLabelMouseUp()
            // Then handle lasso
            handleMouseUp()
          }}
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
              displayLabels?.map((label, index) => (
                <g key={`label-${label.label || index}`}>
                  {/* Centroid line from current position to original position */}
                  {label.isDragging && label.originalX !== undefined && label.originalY !== undefined && (
                    <line
                      x1={xScale(label.x)}
                      y1={yScale(label.y)}
                      x2={xScale(label.originalX)}
                      y2={yScale(label.originalY)}
                      stroke="#ff4444"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  )}
                  <text
                    x={xScale(label.x)}
                    y={yScale(label.y)}
                    className={`${styles.label} ${label.isDragging ? styles.dragging : ''}`}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill={label.isDragging ? "#ff4444" : "#000000"}
                    stroke={label.isDragging ? "#ffffff" : "#ffffff"}
                    strokeWidth="2"
                    paintOrder="stroke"
                    onMouseDown={(event): void => handleLabelMouseDown(event, label)}
                    style={{ cursor: 'move' }}
                  >
                    {label.label}
                  </text>
                </g>
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
