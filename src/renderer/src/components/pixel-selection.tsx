import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DataPoint, LabelPoint } from '../types'


interface PixelSelectionProps {
  data: DataPoint[]
  labels: LabelPoint[]
  width: number
  height: number
  onSelection: (selectedPoints: DataPoint[]) => void
  selectionMode: 'rectangle' | 'circle' | 'lasso'
  onLabelHover?: (label: LabelPoint | null) => void
}

const PixelSelection: React.FC<PixelSelectionProps> = ({
  data,
  labels,
  width,
  height,
  onSelection,
  selectionMode,
  onLabelHover
}) => {
  console.log('PixelSelection mounted with', data.length, 'data points')
  if (data.length > 0) {
    console.log('First data point in PixelSelection:', data[0])
  }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([])

  // Use refs for frequently updated values to avoid re-renders
  const currentPointRef = useRef<{ x: number; y: number } | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Simple spatial grid for fast point lookup
  const spatialGrid = useRef<Map<string, DataPoint[]>>(new Map())
  const cellSize = 50 // pixels

  // Initialize spatial grid when data changes
  useEffect(() => {
    spatialGrid.current.clear()

    console.log('Initializing spatial grid with', data.length, 'points')
    if (data.length > 0) {
      console.log('First point in pixel selection:', data[0])
      console.log('First point cx/cy:', { cx: data[0].cx, cy: data[0].cy })
    }

    for (const point of data) {
      const cellX = Math.floor((point.cx || 0) / cellSize)
      const cellY = Math.floor((point.cy || 0) / cellSize)
      const cellKey = `${cellX},${cellY}`

      if (!spatialGrid.current.has(cellKey)) {
        spatialGrid.current.set(cellKey, [])
      }
      spatialGrid.current.get(cellKey)!.push(point)
    }

    console.log('Spatial grid initialized with', spatialGrid.current.size, 'cells')
  }, [data])

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }, [])

  // Fast pixel-based selection using spatial grid
  const performPixelSelection = useCallback(() => {
    if (!startPoint || !currentPoint) return

    console.log('Performing selection:', { startPoint, currentPoint, selectionMode, lassoPoints: lassoPoints.length })
    console.log('Spatial grid size:', spatialGrid.current.size)

    const selected: DataPoint[] = []

    // Debug: log the selection area
    console.log('Selection area:', {
      minX: Math.min(startPoint.x, currentPoint.x),
      maxX: Math.max(startPoint.x, currentPoint.x),
      minY: Math.min(startPoint.y, currentPoint.y),
      maxY: Math.max(startPoint.y, currentPoint.y)
    })

    if (selectionMode === 'rectangle') {
      const minX = Math.min(startPoint.x, currentPoint.x)
      const maxX = Math.max(startPoint.x, currentPoint.x)
      const minY = Math.min(startPoint.y, currentPoint.y)
      const maxY = Math.max(startPoint.y, currentPoint.y)

      // Get cells that intersect with the rectangle
      const minCellX = Math.floor(minX / cellSize)
      const maxCellX = Math.floor(maxX / cellSize)
      const minCellY = Math.floor(minY / cellSize)
      const maxCellY = Math.floor(maxY / cellSize)

      // Check only points in intersecting cells
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
          const cellKey = `${cellX},${cellY}`
          const cellPoints = spatialGrid.current.get(cellKey)
          if (cellPoints) {
            for (const point of cellPoints) {
              const x = point.cx || 0
              const y = point.cy || 0
              if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                selected.push(point)
              }
            }
          }
        }
      }

    } else if (selectionMode === 'circle') {
      const centerX = startPoint.x
      const centerY = startPoint.y
      const radius = Math.sqrt(
        Math.pow(currentPoint.x - centerX, 2) +
        Math.pow(currentPoint.y - centerY, 2)
      )

      // Get cells that intersect with the circle
      const minCellX = Math.floor((centerX - radius) / cellSize)
      const maxCellX = Math.floor((centerX + radius) / cellSize)
      const minCellY = Math.floor((centerY - radius) / cellSize)
      const maxCellY = Math.floor((centerY + radius) / cellSize)

      // Check only points in intersecting cells
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
          const cellKey = `${cellX},${cellY}`
          const cellPoints = spatialGrid.current.get(cellKey)
          if (cellPoints) {
            for (const point of cellPoints) {
              const x = point.cx || 0
              const y = point.cy || 0
              const dx = x - centerX
              const dy = y - centerY
              if (dx * dx + dy * dy <= radius * radius) {
                selected.push(point)
              }
            }
          }
        }
      }

    } else if (selectionMode === 'lasso' && lassoPoints.length > 2) {
      // For lasso, calculate bounding box first
      const bounds = {
        minX: Math.min(...lassoPoints.map(p => p.x)),
        maxX: Math.max(...lassoPoints.map(p => p.x)),
        minY: Math.min(...lassoPoints.map(p => p.y)),
        maxY: Math.max(...lassoPoints.map(p => p.y))
      }

      // Get cells that intersect with the bounding box
      const minCellX = Math.floor(bounds.minX / cellSize)
      const maxCellX = Math.floor(bounds.maxX / cellSize)
      const minCellY = Math.floor(bounds.minY / cellSize)
      const maxCellY = Math.floor(bounds.maxY / cellSize)

      // Check only points in intersecting cells
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
          const cellKey = `${cellX},${cellY}`
          const cellPoints = spatialGrid.current.get(cellKey)
          if (cellPoints) {
            for (const point of cellPoints) {
              const x = point.cx || 0
              const y = point.cy || 0
              if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
                if (isPointInPolygon({ x, y }, lassoPoints)) {
                  selected.push(point)
                }
              }
            }
          }
        }
      }
    }

    console.log('Selected', selected.length, 'points')
    if (selected.length > 0) {
      console.log('First selected point:', selected[0])
    }

    onSelection(selected)
  }, [startPoint, currentPoint, lassoPoints, selectionMode, onSelection])

  // Helper function for polygon testing (only used for lasso)
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
    const x = point.x
    const y = point.y

    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y
      const xj = polygon[j].x, yj = polygon[j].y

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    console.log('Mouse down event:', { clientX: event.clientX, clientY: event.clientY })
    const point = getCanvasPoint(event.clientX, event.clientY)
    console.log('Canvas point:', point)
    if (!point) return

    setIsSelecting(true)
    setStartPoint(point)
    setCurrentPoint(point)
    currentPointRef.current = point

    if (selectionMode === 'lasso') {
      setLassoPoints([point])
    }
  }, [getCanvasPoint, selectionMode])

  // Direct mouse move handler without throttling for immediate response
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const canvasPoint = getCanvasPoint(event.clientX, event.clientY)
    if (!canvasPoint) return

    if (isSelecting) {
      // Update ref immediately for smooth rendering
      currentPointRef.current = canvasPoint

      // Schedule canvas update on next animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        // Only update state for lasso mode (which needs to track points)
        if (selectionMode === 'lasso') {
          setLassoPoints(prev => [...prev, canvasPoint])
        }
        // Force canvas redraw
        drawSelectionPreview()
      })
    }
  }, [isSelecting, getCanvasPoint, selectionMode])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return

    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setIsSelecting(false)

    // Update current point state for final selection
    if (currentPointRef.current) {
      setCurrentPoint(currentPointRef.current)
    }

    // Perform selection immediately with current values
    performPixelSelection()

    // Reset selection state after selection is complete
    setStartPoint(null)
    setCurrentPoint(null)
    setLassoPoints([])
    currentPointRef.current = null
  }, [isSelecting, performPixelSelection])

  const handleMouseLeave = useCallback(() => {
    // If we were selecting, complete the selection
    if (isSelecting) {
      handleMouseUp()
    }
  }, [isSelecting, handleMouseUp])

  // Optimized canvas drawing function
  const drawSelectionPreview = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw selection preview
    if (isSelecting && startPoint && currentPointRef.current) {
      ctx.strokeStyle = '#6699ff'
      ctx.fillStyle = 'rgba(102, 153, 255, 0.2)'
      ctx.lineWidth = 2

      if (selectionMode === 'rectangle') {
        const x = Math.min(startPoint.x, currentPointRef.current.x)
        const y = Math.min(startPoint.y, currentPointRef.current.y)
        const w = Math.abs(currentPointRef.current.x - startPoint.x)
        const h = Math.abs(currentPointRef.current.y - startPoint.y)

        ctx.strokeRect(x, y, w, h)
        ctx.fillRect(x, y, w, h)
      } else if (selectionMode === 'circle') {
        const centerX = startPoint.x
        const centerY = startPoint.y
        const radius = Math.sqrt(
          Math.pow(currentPointRef.current.x - centerX, 2) +
          Math.pow(currentPointRef.current.y - centerY, 2)
        )

        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.fill()
      } else if (selectionMode === 'lasso' && lassoPoints.length > 1) {
        ctx.beginPath()
        ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y)
        for (let i = 1; i < lassoPoints.length; i++) {
          ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y)
        }
        // Close the loop for lasso
        if (lassoPoints.length > 2) {
          ctx.closePath()
          ctx.fill()
        }
        ctx.stroke()
      }
    }
  }, [isSelecting, startPoint, lassoPoints, selectionMode, width, height])

  // Draw selection preview when state changes (for lasso mode)
  useEffect(() => {
    drawSelectionPreview()
  }, [drawSelectionPreview])

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'all',
        cursor: 'crosshair',
        zIndex: 10
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}

export default PixelSelection