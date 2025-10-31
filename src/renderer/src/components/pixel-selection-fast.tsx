import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DataPoint, LabelPoint } from '../types'

interface PixelSelectionFastProps {
  data: DataPoint[]
  labels: LabelPoint[]
  width: number
  height: number
  onSelection: (selectedPoints: DataPoint[]) => void
  selectionMode: 'rectangle' | 'circle' | 'lasso'
  onLabelHover?: (label: LabelPoint | null) => void
}

const PixelSelectionFast: React.FC<PixelSelectionFastProps> = ({
  data,
  labels,
  width,
  height,
  onSelection,
  selectionMode,
  onLabelHover
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null)
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([])

  // Simple direct selection without complex spatial indexing
  const performSelection = useCallback(() => {
    if (!startPoint || !currentPoint) return

    const selected: DataPoint[] = []

    if (selectionMode === 'rectangle') {
      const minX = Math.min(startPoint.x, currentPoint.x)
      const maxX = Math.max(startPoint.x, currentPoint.x)
      const minY = Math.min(startPoint.y, currentPoint.y)
      const maxY = Math.max(startPoint.y, currentPoint.y)

      // Direct iteration - optimized for modern browsers
      for (let i = 0; i < data.length; i++) {
        const point = data[i]
        const x = point.cx || 0
        const y = point.cy || 0
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          selected.push(point)
        }
      }

    } else if (selectionMode === 'circle') {
      const centerX = startPoint.x
      const centerY = startPoint.y
      const radius = Math.sqrt(
        Math.pow(currentPoint.x - centerX, 2) +
        Math.pow(currentPoint.y - centerY, 2)
      )

      for (let i = 0; i < data.length; i++) {
        const point = data[i]
        const x = point.cx || 0
        const y = point.cy || 0
        const dx = x - centerX
        const dy = y - centerY
        if (dx * dx + dy * dy <= radius * radius) {
          selected.push(point)
        }
      }

    } else if (selectionMode === 'lasso' && lassoPoints.length > 2) {
      // For lasso, use simple bounding box first for performance
      const bounds = {
        minX: Math.min(...lassoPoints.map(p => p.x)),
        maxX: Math.max(...lassoPoints.map(p => p.x)),
        minY: Math.min(...lassoPoints.map(p => p.y)),
        maxY: Math.max(...lassoPoints.map(p => p.y))
      }

      for (let i = 0; i < data.length; i++) {
        const point = data[i]
        const x = point.cx || 0
        const y = point.cy || 0
        if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
          if (isPointInPolygon({ x, y }, lassoPoints)) {
            selected.push(point)
          }
        }
      }
    }

    onSelection(selected)
  }, [startPoint, currentPoint, lassoPoints, selectionMode, data, onSelection])

  // Helper function for polygon testing
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

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }, [])

  // Ultra-fast mouse handlers with minimal state updates
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const point = getCanvasPoint(event.clientX, event.clientY)
    if (!point) return

    setIsSelecting(true)
    setStartPoint(point)
    setCurrentPoint(point)

    if (selectionMode === 'lasso') {
      setLassoPoints([point])
    }
  }, [getCanvasPoint, selectionMode])

  // Direct mouse move with immediate canvas updates
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const canvasPoint = getCanvasPoint(event.clientX, event.clientY)
    if (!canvasPoint) return

    if (isSelecting) {
      setCurrentPoint(canvasPoint)

      if (selectionMode === 'lasso') {
        setLassoPoints(prev => [...prev, canvasPoint])
      }

      // Immediate canvas update
      drawSelectionPreview(canvasPoint)
    }
  }, [isSelecting, getCanvasPoint, selectionMode])

  const handleMouseUp = useCallback(() => {
    if (!isSelecting) return

    setIsSelecting(false)
    performSelection()

    // Reset selection state
    setStartPoint(null)
    setCurrentPoint(null)
    setLassoPoints([])
  }, [isSelecting, performSelection])

  const handleMouseLeave = useCallback(() => {
    if (isSelecting) {
      handleMouseUp()
    }
  }, [isSelecting, handleMouseUp])

  // Optimized canvas drawing
  const drawSelectionPreview = useCallback((currentPoint: { x: number; y: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw selection preview
    if (isSelecting && startPoint && currentPoint) {
      ctx.strokeStyle = '#6699ff'
      ctx.fillStyle = 'rgba(102, 153, 255, 0.2)'
      ctx.lineWidth = 2

      if (selectionMode === 'rectangle') {
        const x = Math.min(startPoint.x, currentPoint.x)
        const y = Math.min(startPoint.y, currentPoint.y)
        const w = Math.abs(currentPoint.x - startPoint.x)
        const h = Math.abs(currentPoint.y - startPoint.y)

        ctx.strokeRect(x, y, w, h)
        ctx.fillRect(x, y, w, h)
      } else if (selectionMode === 'circle') {
        const centerX = startPoint.x
        const centerY = startPoint.y
        const radius = Math.sqrt(
          Math.pow(currentPoint.x - centerX, 2) +
          Math.pow(currentPoint.y - centerY, 2)
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

  // Draw selection preview when state changes
  useEffect(() => {
    if (currentPoint) {
      drawSelectionPreview(currentPoint)
    }
  }, [currentPoint, drawSelectionPreview])

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

export default PixelSelectionFast