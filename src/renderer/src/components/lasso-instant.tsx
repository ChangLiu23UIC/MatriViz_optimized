import React, { useState, useCallback, useMemo, useRef } from 'react'
import { line, curveBasis } from 'd3-shape'
import { UseLassoProps, UseLassoReturn, SelectionMode, DataPoint } from '../types'

// Minimal spatial index - only stores points
class InstantSpatialIndex {
  private gridSize = 50
  private grid: Map<string, DataPoint[]> = new Map()

  build(points: DataPoint[]): void {
    this.grid.clear()

    points.forEach(point => {
      const gridX = Math.floor((point.cx || 0) / this.gridSize)
      const gridY = Math.floor((point.cy || 0) / this.gridSize)
      const key = `${gridX},${gridY}`

      if (!this.grid.has(key)) {
        this.grid.set(key, [])
      }
      this.grid.get(key)!.push(point)
    })
  }

  search(bbox: { minX: number; maxX: number; minY: number; maxY: number }): DataPoint[] {
    const startX = Math.floor(bbox.minX / this.gridSize)
    const endX = Math.floor(bbox.maxX / this.gridSize)
    const startY = Math.floor(bbox.minY / this.gridSize)
    const endY = Math.floor(bbox.maxY / this.gridSize)

    const result: DataPoint[] = []

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const key = `${x},${y}`
        const cell = this.grid.get(key)
        if (cell) {
          result.push(...cell)
        }
      }
    }

    return result
  }
}

// Fast point-in-polygon
const fastPointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
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

// Rectangle selection
const isPointInRectangle = (
  point: DataPoint,
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean => {
  const x = point.cx || 0
  const y = point.cy || 0
  const minX = Math.min(rect.x1, rect.x2)
  const maxX = Math.max(rect.x1, rect.x2)
  const minY = Math.min(rect.y1, rect.y2)
  const maxY = Math.max(rect.y1, rect.y2)
  return x >= minX && x <= maxX && y >= minY && y <= maxY
}

// Circle selection
const isPointInCircle = (
  point: DataPoint,
  center: { x: number; y: number },
  radius: number
): boolean => {
  const x = point.cx || 0
  const y = point.cy || 0
  const dx = x - center.x
  const dy = y - center.y
  return dx * dx + dy * dy <= radius * radius
}

const useLassoInstant = ({
  data,
  xScale,
  yScale,
  onSelection,
  selectionMode = 'lasso' as SelectionMode
}: UseLassoProps & { selectionMode?: SelectionMode }): UseLassoReturn => {
  const [lassoPoints, setLassoPoints] = useState<[number, number][]>([])
  const [isLassoActive, setIsLassoActive] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectionCircle, setSelectionCircle] = useState<{ center: [number, number]; radius: number } | null>(null)

  const spatialIndexRef = useRef<InstantSpatialIndex>(new InstantSpatialIndex())
  const lassoPointsRef = useRef<[number, number][]>([])

  // Pre-compute spatial index
  const spatialIndex = useMemo(() => {
    const precomputedData = data.map(point => ({
      ...point,
      cx: point.cx || xScale(point.x),
      cy: point.cy || yScale(point.y)
    }))

    const index = new InstantSpatialIndex()
    index.build(precomputedData)
    return index
  }, [data, xScale, yScale])

  // Store spatial index in ref for access in callbacks
  React.useEffect(() => {
    spatialIndexRef.current = spatialIndex
  }, [spatialIndex])

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsLassoActive(true)
    const { left, top } = event.currentTarget.getBoundingClientRect()
    const point: [number, number] = [event.clientX - left, event.clientY - top]

    if (selectionMode === 'rectangle') {
      setSelectionRect({ x1: point[0], y1: point[1], x2: point[0], y2: point[1] })
    } else if (selectionMode === 'circle') {
      setSelectionCircle({ center: point, radius: 0 })
    } else {
      const initialPoints = [point]
      setLassoPoints(initialPoints)
      lassoPointsRef.current = initialPoints
    }
  }, [selectionMode])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isLassoActive) return

      const { left, top } = event.currentTarget.getBoundingClientRect()
      const newPoint: [number, number] = [event.clientX - left, event.clientY - top]

      if (selectionMode === 'rectangle' && selectionRect) {
        // Rectangle mode - immediate update
        setSelectionRect({ ...selectionRect, x2: newPoint[0], y2: newPoint[1] })
      } else if (selectionMode === 'circle' && selectionCircle) {
        // Circle mode - immediate update
        const dx = newPoint[0] - selectionCircle.center[0]
        const dy = newPoint[1] - selectionCircle.center[1]
        const radius = Math.sqrt(dx * dx + dy * dy)
        setSelectionCircle({ ...selectionCircle, radius })
      } else if (selectionMode === 'lasso') {
        // Lasso mode - immediate update with minimal filtering
        const lastPoint = lassoPointsRef.current[lassoPointsRef.current.length - 1]

        // Only add point if it's different from last point (no throttling!)
        if (!lastPoint ||
            Math.abs(newPoint[0] - lastPoint[0]) > 2 ||
            Math.abs(newPoint[1] - lastPoint[1]) > 2) {

          const updatedLassoPoints: [number, number][] =
            lassoPointsRef.current.length > 1 ? lassoPointsRef.current.slice(0, -1) : lassoPointsRef.current
          const newPoints: [number, number][] = [...updatedLassoPoints, newPoint]

          // Temporarily close the loop for visual effect
          if (newPoints.length > 1) {
            newPoints.push(newPoints[0])
          }

          // Update both state and ref - NO THROTTLING!
          setLassoPoints(newPoints)
          lassoPointsRef.current = newPoints.slice(0, -1) // Store without closing point
        }
      }
    },
    [isLassoActive, selectionMode, selectionRect, selectionCircle]
  )

  const performSelection = useCallback(() => {
    let selected: DataPoint[] = []
    const spatialIndex = spatialIndexRef.current

    if (selectionMode === 'rectangle' && selectionRect) {
      const bbox = {
        minX: Math.min(selectionRect.x1, selectionRect.x2),
        maxX: Math.max(selectionRect.x1, selectionRect.x2),
        minY: Math.min(selectionRect.y1, selectionRect.y2),
        maxY: Math.max(selectionRect.y1, selectionRect.y2)
      }

      const candidates = spatialIndex.search(bbox)
      selected = candidates.filter(point => isPointInRectangle(point, selectionRect))

    } else if (selectionMode === 'circle' && selectionCircle) {
      const bbox = {
        minX: selectionCircle.center[0] - selectionCircle.radius,
        maxX: selectionCircle.center[0] + selectionCircle.radius,
        minY: selectionCircle.center[1] - selectionCircle.radius,
        maxY: selectionCircle.center[1] + selectionCircle.radius
      }

      const candidates = spatialIndex.search(bbox)
      selected = candidates.filter(point => isPointInCircle(point,
        { x: selectionCircle.center[0], y: selectionCircle.center[1] },
        selectionCircle.radius))

    } else if (selectionMode === 'lasso' && lassoPointsRef.current.length > 2) {
      const selectionPoints = lassoPointsRef.current

      // Calculate bounding box
      const xs = selectionPoints.map(p => p[0])
      const ys = selectionPoints.map(p => p[1])
      const bbox = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      }

      // Fast spatial search
      const candidates = spatialIndex.search(bbox)

      // Fast polygon check on candidates only
      selected = candidates.filter(point => {
        const x = point.cx || 0
        const y = point.cy || 0
        return fastPointInPolygon([x, y], selectionPoints)
      })
    }

    onSelection(selected)
  }, [selectionMode, selectionRect, selectionCircle, onSelection])

  const handleMouseUp = useCallback(() => {
    setIsLassoActive(false)

    // Perform selection only when mouse is released
    performSelection()

    // Clear selection state
    setLassoPoints([])
    setSelectionRect(null)
    setSelectionCircle(null)
    lassoPointsRef.current = []
  }, [performSelection])

  const Lasso: React.FC = () => {
    if (!isLassoActive) return null

    if (selectionMode === 'rectangle' && selectionRect) {
      const width = Math.abs(selectionRect.x2 - selectionRect.x1)
      const height = Math.abs(selectionRect.y2 - selectionRect.y1)
      const x = Math.min(selectionRect.x1, selectionRect.x2)
      const y = Math.min(selectionRect.y1, selectionRect.y2)

      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="url(#stroke)"
          strokeWidth={2}
          strokeDasharray="5,5"
        />
      )
    } else if (selectionMode === 'circle' && selectionCircle) {
      return (
        <circle
          cx={selectionCircle.center[0]}
          cy={selectionCircle.center[1]}
          r={selectionCircle.radius}
          fill="none"
          stroke="url(#stroke)"
          strokeWidth={2}
          strokeDasharray="5,5"
        />
      )
    } else if (selectionMode === 'lasso') {
      const lassoPath = line().curve(curveBasis)(lassoPoints)
      return (
        <path
          d={lassoPath!}
          fill="none"
          stroke="url(#stroke)"
          strokeWidth={3}
        />
      )
    }

    return null
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    Lasso,
    lassoPoints,
    isLassoActive
  }
}

export default useLassoInstant