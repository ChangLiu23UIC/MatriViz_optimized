import React, { useEffect, useRef, useMemo, useState } from 'react'
import { DataPoint, LabelPoint, PlotState } from '../types'
import Legend from './legend'
import AnnotationList from './annotation-list'

interface PlotCanvasProps {
  data: DataPoint[]
  labels: LabelPoint[]
  plotState: PlotState
  setPlotState: (plotState: PlotState) => void
  onSelectedData: (data: DataPoint[]) => void
  selectedPoints: DataPoint[]
  setSelectedPoints: (points: DataPoint[]) => void
}

const PlotCanvas = ({
  data,
  labels,
  plotState,
  setPlotState,
  onSelectedData,
  selectedPoints,
  setSelectedPoints
}: PlotCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.67,
    height: window.innerHeight - 50
  })
  const [isDrawing, setIsDrawing] = useState(false)
  const [lassoPoints, setLassoPoints] = useState<[number, number][]>([])
  const [hoveredAnnotation, setHoveredAnnotation] = useState<LabelPoint | null>(null)
  const [selectedAnnotation, setSelectedAnnotation] = useState<LabelPoint | null>(null)
  const [draggingLabel, setDraggingLabel] = useState<LabelPoint | null>(null)
  const [draggedLabels, setDraggedLabels] = useState<LabelPoint[]>([])
  const [selectionMode, setSelectionMode] = useState<'freeform' | 'square'>('freeform')
  const [squareSelection, setSquareSelection] = useState<{
    start: [number, number]
    end: [number, number]
  } | null>(null)
  const [showAnnotationList, setShowAnnotationList] = useState(true)
  const [showCentroidText, setShowCentroidText] = useState(true)

  // Auto-scaling for expression data
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

      console.log('Canvas auto-scaling debug - computed minScore:', minScore, 'maxScore:', maxScore, 'data length:', data.length)
      console.log('Canvas auto-scaling debug - hasExpressionData check:', data[0]?.hasExpressionData)

      // Check if we have any data points with expression data
      const hasExpressionData = data.length > 0 && data[0]?.hasExpressionData === true

      console.log('Canvas auto-scaling debug - hasExpressionData:', hasExpressionData)

      // Only auto-scale if we have meaningful data (not all zeros)
      const hasMeaningfulData = minScore !== Infinity && maxScore !== -Infinity && maxScore > minScore

      console.log('Canvas auto-scaling debug - hasMeaningfulData:', hasMeaningfulData)

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
        console.log('Canvas auto-scaling debug - using default range because no meaningful data')
        if (plotState.autoMinScore) newMinScore = 0
        else newMinScore = 0

        if (plotState.autoMaxScore) newMaxScore = 1
        else newMaxScore = 10
      }
    }

    console.log('Canvas auto-scaling results - minScore:', newMinScore, 'maxScore:', newMaxScore, 'data length:', data.length)
    setPlotState({ ...plotState, minScore: newMinScore, maxScore: newMaxScore })
  }, [data, plotState.autoMinScore, plotState.autoMaxScore])

  // Optimized scales
  const { xScale, yScale, colorScale, xScaleInvert, yScaleInvert } = useMemo(() => {
    if (!data || data.length === 0) {
      return { xScale: null, yScale: null, colorScale: null, xScaleInvert: null, yScaleInvert: null }
    }

    // Calculate domains - include both data and labels
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

    // Include data points in domain calculation
    for (const d of data) {
      if (d.x < minX) minX = d.x
      if (d.x > maxX) maxX = d.x
      if (d.y < minY) minY = d.y
      if (d.y > maxY) maxY = d.y
    }

    // Include label points in domain calculation
    for (const label of labels) {
      if (label.x < minX) minX = label.x
      if (label.x > maxX) maxX = label.x
      if (label.y < minY) minY = label.y
      if (label.y > maxY) maxY = label.y
    }

    console.log('Domain calculation - minX:', minX, 'maxX:', maxX, 'minY:', minY, 'maxY:', maxY)
    console.log('Data points:', data.length, 'Label points:', labels.length)


    const scaleOffset = 2
    const xDomain = [minX - scaleOffset, maxX + scaleOffset]
    const yDomain = [minY - scaleOffset, maxY + scaleOffset]

    console.log('Scale calculation:')
    console.log('  xDomain:', xDomain)
    console.log('  yDomain:', yDomain)
    console.log('  dimensions:', dimensions)

    const xScale = (x: number) => ((x - xDomain[0]) / (xDomain[1] - xDomain[0])) * dimensions.width
    const yScale = (y: number) => ((y - yDomain[0]) / (yDomain[1] - yDomain[0])) * dimensions.height

    // Inverse scaling functions for converting canvas coordinates back to data coordinates
    const xScaleInvert = (canvasX: number) => (canvasX / dimensions.width) * (xDomain[1] - xDomain[0]) + xDomain[0]
    const yScaleInvert = (canvasY: number) => (canvasY / dimensions.height) * (yDomain[1] - yDomain[0]) + yDomain[0]

    // Test the scales
    console.log('Scale test - xScale(0):', xScale(0), 'yScale(0):', yScale(0))
    console.log('Scale test - xScale(minX):', xScale(minX), 'yScale(minY):', yScale(minY))
    console.log('Scale test - xScale(maxX):', xScale(maxX), 'yScale(maxY):', yScale(maxY))

    // Proper color interpolation using plotState colors
    const colorScale = (score: number) => {
      // Handle edge cases - don't log to avoid console spam
      if (plotState.maxScore === plotState.minScore || !isFinite(plotState.maxScore) || !isFinite(plotState.minScore)) {
        return plotState.minColor
      }

      const normalized = (score - plotState.minScore) / (plotState.maxScore - plotState.minScore)

      // Parse hex colors to RGB
      const hexToRgb = (hex: string) => {
        // Handle 3-character hex codes
        let hexValue = hex
        if (hex.length === 4 && hex.startsWith('#')) {
          hexValue = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
        }

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexValue)
        if (!result) {
          console.log(`WARNING: Invalid hex color: ${hex}, using black`)
          return { r: 0, g: 0, b: 0 }
        }
        return {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      }

      const minRgb = hexToRgb(plotState.minColor)
      const maxRgb = hexToRgb(plotState.maxColor)

      const r = Math.floor(minRgb.r + (maxRgb.r - minRgb.r) * normalized)
      const g = Math.floor(minRgb.g + (maxRgb.g - minRgb.g) * normalized)
      const b = Math.floor(minRgb.b + (maxRgb.b - minRgb.b) * normalized)

      const resultColor = `rgb(${r},${g},${b})`

      return resultColor
    }

    return { xScale, yScale, colorScale, xScaleInvert, yScaleInvert }
  }, [data, dimensions, plotState.minScore, plotState.maxScore, plotState.minColor, plotState.maxColor])

  // Draw points on canvas
  useEffect(() => {
    console.log('=== DRAW EFFECT TRIGGERED ===')
    console.log('Data points:', data.length)
    console.log('Labels:', labels.length)
    console.log('xScale exists:', !!xScale)
    console.log('yScale exists:', !!yScale)
    console.log('colorScale exists:', !!colorScale)

    const canvas = canvasRef.current
    if (!canvas) {
      console.log('ERROR: Canvas ref is null')
      return
    }
    if (!xScale || !yScale || !colorScale) {
      console.log('ERROR: Scales not available')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('ERROR: Canvas context not available')
      return
    }

    console.log('Canvas dimensions:', dimensions.width, 'x', dimensions.height)
    console.log('Canvas element size:', canvas.width, 'x', canvas.height)

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    // Draw points
    const selectedPointIds = new Set(selectedPoints.map(p => p.index))
    const hasSelectedPoints = selectedPoints.length > 0

    console.log('Drawing points - total:', data.length, 'selected:', selectedPoints.length)
    console.log('Plot state - minScore:', plotState.minScore, 'maxScore:', plotState.maxScore)
    console.log('Plot state - minColor:', plotState.minColor, 'maxColor:', plotState.maxColor)

    ctx.save()

    // Draw all points
    let pointsDrawn = 0
    for (const point of data) {
      const x = xScale(point.x)
      const y = yScale(point.y)
      const isSelected = selectedPointIds.has(point.index)

      let color: string
      if (hasSelectedPoints) {
        color = isSelected ? colorScale(point.score) : 'gray'
      } else {
        color = colorScale(point.score)
      }

      if (pointsDrawn < 5) {
        console.log(`Point ${pointsDrawn}: x=${point.x}, y=${point.y}, score=${point.score}, color=${color}`)
      }

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, plotState.pointSize, 0, 2 * Math.PI)
      ctx.fill()
      pointsDrawn++
    }

    console.log(`Total points drawn: ${pointsDrawn}`)
    ctx.restore()

    // Draw annotation labels
    if (showCentroidText && displayLabels && displayLabels.length > 0 && xScale && yScale) {
      console.log('Drawing annotations on canvas:', displayLabels.length, 'labels')
      if (displayLabels.length > 0) {
        console.log('First label:', displayLabels[0])
        console.log('First label coordinates (data):', displayLabels[0].x, displayLabels[0].y)
        console.log('First label coordinates (canvas):', xScale(displayLabels[0].x), yScale(displayLabels[0].y))
      }

      ctx.save()
      ctx.font = 'bold 12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (const label of displayLabels) {
        const x = xScale(label.x)
        const y = yScale(label.y)
        console.log(`Drawing label "${label.label}" at (${label.x}, ${label.y}) -> canvas (${x}, ${y})`)

        const isHovered = hoveredAnnotation?.label === label.label
        const isSelected = selectedAnnotation?.label === label.label
        const isDragging = label.isDragging

        // Draw centroid line if dragging
        if (isDragging && label.originalX !== undefined && label.originalY !== undefined) {
          ctx.save()
          ctx.strokeStyle = '#ff4444'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(xScale(label.originalX), yScale(label.originalY))
          ctx.stroke()
          ctx.restore()
        }

        // Draw white stroke/outline with transparency
        ctx.strokeStyle = isHovered || isSelected || isDragging
          ? 'rgba(255, 255, 255, 0.9)' // More opaque when highlighted
          : 'rgba(255, 255, 255, 0.5)' // 0.5 alpha as default
        ctx.lineWidth = isHovered || isSelected || isDragging ? 4 : 3
        ctx.strokeText(label.label, x, y)

        // Draw text with different colors based on state
        if (isDragging) {
          ctx.fillStyle = 'rgba(255, 68, 68, 0.9)' // Red for dragging
        } else if (isHovered || isSelected) {
          ctx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.9)' : 'rgba(0, 100, 255, 0.9)'
        } else {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)' // 0.5 alpha as default
        }
        ctx.fillText(label.label, x, y)
      }
      ctx.restore()
    }

    // Draw lasso if active
    if (isDrawing && selectionMode === 'freeform' && lassoPoints.length > 0) {
      console.log('Canvas drawing lasso - points:', lassoPoints.length, 'first point:', lassoPoints[0])
      ctx.strokeStyle = '#6699ff'
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(lassoPoints[0][0], lassoPoints[0][1])
      for (let i = 1; i < lassoPoints.length; i++) {
        ctx.lineTo(lassoPoints[i][0], lassoPoints[i][1])
      }
      ctx.closePath()
      ctx.stroke()
      console.log('Canvas lasso drawn')
    }

    // Draw square selection if active
    if (isDrawing && selectionMode === 'square' && squareSelection) {
      console.log('Canvas drawing square selection - bounds:', squareSelection)
      const { start, end } = squareSelection
      const width = end[0] - start[0]
      const height = end[1] - start[1]

      ctx.strokeStyle = '#ff6699'
      ctx.lineWidth = 3
      ctx.setLineDash([])
      ctx.strokeRect(start[0], start[1], width, height)

      // Fill with semi-transparent color
      ctx.fillStyle = 'rgba(255, 102, 153, 0.2)'
      ctx.fillRect(start[0], start[1], width, height)

      console.log('Canvas square selection drawn')
    }

  }, [data, xScale, yScale, colorScale, plotState.pointSize, selectedPoints, isDrawing, lassoPoints, squareSelection, selectionMode, dimensions, labels, draggedLabels, hoveredAnnotation, selectedAnnotation, showCentroidText])

  // Helper function to find label at a point
  const findLabelAtPoint = (point: [number, number]): LabelPoint | null => {
    if (!xScale || !yScale) {
      console.log('findLabelAtPoint - scales not available')
      return null
    }

    const [mouseX, mouseY] = point
    let closestLabel: LabelPoint | null = null
    let minDistance = Infinity

    console.log('findLabelAtPoint - checking point:', point, 'displayLabels count:', displayLabels.length)
    console.log('findLabelAtPoint - scales available:', !!xScale, !!yScale)

    for (const label of displayLabels) {
      const labelX = xScale(label.x)
      const labelY = yScale(label.y)
      const distance = Math.sqrt((mouseX - labelX) ** 2 + (mouseY - labelY) ** 2)

      console.log(`findLabelAtPoint - checking label "${label.label}" at canvas (${labelX}, ${labelY}) - distance: ${distance}`)

      // Consider label as clicked if within 20 pixels
      if (distance < 20 && distance < minDistance) {
        minDistance = distance
        closestLabel = label
        console.log('findLabelAtPoint - found label:', label.label, 'at distance:', distance)
      }
    }

    console.log('findLabelAtPoint - result:', closestLabel?.label)
    return closestLabel
  }

  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.log('Canvas not available for mouse down')
      return
    }

    const rect = canvas.getBoundingClientRect()
    const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]

    console.log('Canvas Mouse down - starting selection at:', point, 'mode:', selectionMode)
    console.log('Canvas bounds:', rect)

    // Check if clicking on an annotation first
    const clickedLabel = findLabelAtPoint(point)
    console.log('Annotation detection - clickedLabel:', clickedLabel, 'displayLabels count:', displayLabels.length)
    if (clickedLabel) {
      console.log('Starting annotation drag for:', clickedLabel.label)
      handleLabelMouseDown(clickedLabel, event)
      return
    }

    // Otherwise start lasso selection
    console.log('No annotation clicked, starting lasso selection')
    if (selectionMode === 'freeform') {
      setIsDrawing(true)
      setLassoPoints([point])
    } else if (selectionMode === 'square') {
      setIsDrawing(true)
      setSquareSelection({
        start: point,
        end: point
      })
    }
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    // Handle annotation drag first
    handleLabelMouseMove(event)

    if (isDrawing && !draggingLabel) {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top]

      if (selectionMode === 'freeform') {
        // Use requestAnimationFrame for smoother drawing
        requestAnimationFrame(() => {
          setLassoPoints(prev => {
            if (prev.length === 0) return [point]
            const lastPoint = prev[prev.length - 1]
            const distance = Math.sqrt((point[0] - lastPoint[0]) ** 2 + (point[1] - lastPoint[1]) ** 2)
            // Increase distance threshold to 10 pixels for better performance
            if (distance > 10) {
              return [...prev, point]
            }
            return prev
          })
        })
      } else if (selectionMode === 'square') {
        // Update square selection end point
        setSquareSelection(prev => prev ? { ...prev, end: point } : null)
      }
    } else if (!draggingLabel) {
      handleMouseMoveForHover(event)
    }
  }

  const handleMouseUp = () => {
    // Handle annotation drag end
    handleLabelMouseUp()

    console.log('Canvas Mouse up - isDrawing:', isDrawing, 'selectionMode:', selectionMode)
    if (!isDrawing) {
      setIsDrawing(false)
      setLassoPoints([])
      setSquareSelection(null)
      return
    }

    if (selectionMode === 'freeform') {
      // If lasso has less than 3 points, clear selection
      if (lassoPoints.length < 3) {
        console.log('Canvas Lasso selection cleared - less than 3 points')
        setSelectedPoints([])
        onSelectedData([]) // Clear selection
        setIsDrawing(false)
        setLassoPoints([])
        return
      }

      console.log('Canvas Lasso selection - points:', lassoPoints.length, 'data points:', data.length)
      console.log('First lasso point:', lassoPoints[0])

      // Simple point-in-polygon selection - use canvas coordinates for lasso and data coordinates for points
      const selected: DataPoint[] = []
      for (const point of data) {
        if (xScale && yScale) {
          const canvasX = xScale(point.x)
          const canvasY = yScale(point.y)
          if (isPointInPolygon([canvasX, canvasY], lassoPoints)) {
            selected.push(point)
          }
        }
      }

      console.log('Canvas Lasso selection result:', selected.length, 'points selected')
      setSelectedPoints(selected)
      onSelectedData(selected) // Notify parent component
      setIsDrawing(false)
      setLassoPoints([])
    } else if (selectionMode === 'square') {
      if (!squareSelection) {
        console.log('Canvas Square selection cleared - no selection')
        setSelectedPoints([])
        onSelectedData([]) // Clear selection
        setIsDrawing(false)
        setSquareSelection(null)
        return
      }

      console.log('Canvas Square selection - bounds:', squareSelection, 'data points:', data.length)

      // Select points within the square bounds
      const selected: DataPoint[] = []
      const { start, end } = squareSelection
      const minX = Math.min(start[0], end[0])
      const maxX = Math.max(start[0], end[0])
      const minY = Math.min(start[1], end[1])
      const maxY = Math.max(start[1], end[1])

      for (const point of data) {
        if (xScale && yScale) {
          const canvasX = xScale(point.x)
          const canvasY = yScale(point.y)
          if (canvasX >= minX && canvasX <= maxX && canvasY >= minY && canvasY <= maxY) {
            selected.push(point)
          }
        }
      }

      console.log('Canvas Square selection result:', selected.length, 'points selected')
      setSelectedPoints(selected)
      onSelectedData(selected) // Notify parent component
      setIsDrawing(false)
      setSquareSelection(null)
    }
  }

  // Drag handlers for annotations
  const handleLabelMouseDown = (label: LabelPoint, event: React.MouseEvent): void => {
    event.stopPropagation()
    setDraggingLabel(label)

    // Initialize drag state
    const updatedLabel = {
      ...label,
      isDragging: true,
      originalX: label.originalX ?? label.x,
      originalY: label.originalY ?? label.y,
      dragOffsetX: 0,
      dragOffsetY: 0
    }

    // Update the labels array with drag state
    const updatedLabels = labels.map(l =>
      l.label === label.label ? updatedLabel : l
    )
    setDraggedLabels(updatedLabels)
  }

  const handleLabelMouseMove = (event: React.MouseEvent): void => {
    if (!draggingLabel || !canvasRef.current || !xScale || !yScale || !xScaleInvert || !yScaleInvert) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Convert mouse coordinates to data coordinates
    const dataX = xScaleInvert(mouseX)
    const dataY = yScaleInvert(mouseY)

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
    setDraggingLabel(null)
  }

  // Use dragged labels if available, otherwise use original labels
  const displayLabels = draggedLabels.length > 0 ? draggedLabels : labels

  // Handle mouse move for annotation hover detection
  const handleMouseMoveForHover = (event: React.MouseEvent) => {
    if (isDrawing) return // Don't interfere with lasso drawing

    const canvas = canvasRef.current
    if (!canvas || !xScale || !yScale) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    // Check if mouse is near any label
    let closestLabel: LabelPoint | null = null
    let minDistance = Infinity

    for (const label of labels) {
      const labelX = xScale(label.x)
      const labelY = yScale(label.y)
      const distance = Math.sqrt((mouseX - labelX) ** 2 + (mouseY - labelY) ** 2)

      // Consider label as hovered if within 20 pixels
      if (distance < 20 && distance < minDistance) {
        minDistance = distance
        closestLabel = label
      }
    }

    setHoveredAnnotation(closestLabel)
  }

  // Simple point-in-polygon algorithm
  const isPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
    const [x, y] = point
    let inside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]
      const [xj, yj] = polygon[j]

      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }

    return inside
  }

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth * 0.67, height: window.innerHeight - 50 })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex'
    }}>
      {/* Main canvas area */}
      <div style={{
        flex: 1,
        position: 'relative'
      }}>
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: 'crosshair' }}
        />

        {/* Legend - Moved to bottom right */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          right: 10,
          zIndex: 10
        }}>
          <Legend
            x={0}
            y={0}
            maxScore={plotState.maxScore}
            minScore={plotState.minScore}
            minColor={plotState.minColor}
            maxColor={plotState.maxColor}
          />
        </div>

        {/* Selection Mode Controls */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
            Selection Mode
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSelectionMode('freeform')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: selectionMode === 'freeform' ? '#6699ff' : '#f0f0f0',
                color: selectionMode === 'freeform' ? 'white' : '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Freeform
            </button>
            <button
              onClick={() => setSelectionMode('square')}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: selectionMode === 'square' ? '#ff6699' : '#f0f0f0',
                color: selectionMode === 'square' ? 'white' : '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Square
            </button>
          </div>
        </div>

        {/* Annotation List Toggle */}
        <div style={{
          position: 'absolute',
          top: 120, // Moved lower to avoid blocking legend
          right: 10,
          zIndex: 10,
          display: 'flex',
          gap: '6px'
        }}>
          <button
            onClick={() => setShowCentroidText(!showCentroidText)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: showCentroidText ? '#2196F3' : '#f0f0f0',
              color: showCentroidText ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showCentroidText ? 'Hide Text' : 'Show Text'}
          </button>
          <button
            onClick={() => setShowAnnotationList(!showAnnotationList)}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: showAnnotationList ? '#4CAF50' : '#f0f0f0',
              color: showAnnotationList ? 'white' : '#333',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {showAnnotationList ? 'Hide List' : 'Show List'}
          </button>
        </div>

      </div>

      {/* Docked Sidebar for Annotation List */}
      {showAnnotationList && (
        <div style={{
          width: '300px', // Increased width for better visibility
          height: '100vh', // Use viewport height for full height
          background: 'white', // Solid white background
          borderLeft: '2px solid #ccc', // Thicker border
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)' // Add shadow for depth
        }}>
          <div style={{
            padding: '12px',
            borderBottom: '1px solid #eee',
            background: '#f8f9fa',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            Centroid Labels ({Array.from(new Map(labels.map(label => [label.label, label])).values()).length})
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 0 // Remove padding to fill full width
          }}>
            <AnnotationList
              labels={labels}
              onAnnotationHover={setHoveredAnnotation}
              hoveredAnnotation={hoveredAnnotation}
              selectedAnnotation={selectedAnnotation}
              onAnnotationSelect={setSelectedAnnotation}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default PlotCanvas