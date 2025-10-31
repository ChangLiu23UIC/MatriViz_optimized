import React, { useState, useCallback, useMemo, useRef } from 'react'
import { line, curveBasis } from 'd3-shape'
import { UseLassoProps, UseLassoReturn, SelectionMode, DataPoint } from '../types'

// Simple spatial index - minimal overhead
class SimpleSpatialIndex {
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

// Simple point-in-polygon
const simplePointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
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

const useLassoSimple = ({
  data,
  xScale,
  yScale,
  onSelection,
  selectionMode = 'lasso' as SelectionMode
}: UseLassoProps & { selectionMode?: SelectionMode }): UseLassoReturn => {
  console.log('useLassoSimple called - data length:', data.length, 'xScale:', !!xScale, 'yScale:', !!yScale, 'selectionMode:', selectionMode)
  const [lassoPoints, setLassoPoints] = useState<[number, number][]>([])
  const [isLassoActive, setIsLassoActive] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectionCircle, setSelectionCircle] = useState<{ center: [number, number]; radius: number } | null>(null)

  const spatialIndexRef = useRef<SimpleSpatialIndex>(new SimpleSpatialIndex())
  const lassoPointsRef = useRef<[number, number][]>([])

  // Pre-compute spatial index
  const spatialIndex = useMemo(() => {
    const precomputedData = data.map(point => ({
      ...point,
      cx: point.cx || xScale(point.x),
      cy: point.cy || yScale(point.y)
    }))

    console.log('Building spatial index with', precomputedData.length, 'points')
    console.log('First point coordinates:', precomputedData[0]?.cx, precomputedData[0]?.cy)

    // Log coordinate ranges for debugging
    const allX = precomputedData.map(p => p.cx || 0)
    const allY = precomputedData.map(p => p.cy || 0)
    console.log('Coordinate ranges - X:', Math.min(...allX), 'to', Math.max(...allX))
    console.log('Coordinate ranges - Y:', Math.min(...allY), 'to', Math.max(...allY))

    const index = new SimpleSpatialIndex()
    index.build(precomputedData)
    return index
  }, [data, xScale, yScale])

  // Store spatial index in ref for access in callbacks
  React.useEffect(() => {
    spatialIndexRef.current = spatialIndex
  }, [spatialIndex])

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    console.log('Mouse down - starting lasso')
    console.log('Selection mode:', selectionMode)
    setIsLassoActive(true)
    const { left, top } = event.currentTarget.getBoundingClientRect()
    const point: [number, number] = [event.clientX - left, event.clientY - top]
    console.log('Mouse down point:', point)
    console.log('SVG element bounds:', { left, top, width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight })

    if (selectionMode === 'rectangle') {
      setSelectionRect({ x1: point[0], y1: point[1], x2: point[0], y2: point[1] })
    } else if (selectionMode === 'circle') {
      setSelectionCircle({ center: point, radius: 0 })
    } else {
      const initialPoints = [point]
      console.log('Setting initial lasso points:', initialPoints)
      setLassoPoints(initialPoints)
      lassoPointsRef.current = initialPoints
      console.log('After setLassoPoints - lassoPoints state should be:', initialPoints)
    }
  }, [selectionMode])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      console.log('Mouse move - isLassoActive:', isLassoActive)
      if (!isLassoActive) return

      const { left, top } = event.currentTarget.getBoundingClientRect()
      const newPoint: [number, number] = [event.clientX - left, event.clientY - top]
      console.log('Mouse move point:', newPoint)

      if (selectionMode === 'rectangle' && selectionRect) {
        setSelectionRect({ ...selectionRect, x2: newPoint[0], y2: newPoint[1] })
      } else if (selectionMode === 'circle' && selectionCircle) {
        const dx = newPoint[0] - selectionCircle.center[0]
        const dy = newPoint[1] - selectionCircle.center[1]
        const radius = Math.sqrt(dx * dx + dy * dy)
        setSelectionCircle({ ...selectionCircle, radius })
      } else if (selectionMode === 'lasso') {
        // Always add new point - no filtering for maximum responsiveness
        const updatedLassoPoints: [number, number][] =
          lassoPointsRef.current.length > 1 ? lassoPointsRef.current.slice(0, -1) : lassoPointsRef.current
        const newPoints: [number, number][] = [...updatedLassoPoints, newPoint]

        // Temporarily close the loop for visual effect
        if (newPoints.length > 1) {
          newPoints.push(newPoints[0])
        }

        // Update both state and ref
        setLassoPoints(newPoints)
        lassoPointsRef.current = newPoints.slice(0, -1) // Store without closing point
        console.log('Lasso points updated:', newPoints.length)
      }
    },
    [isLassoActive, selectionMode, selectionRect, selectionCircle]
  )

  const performSelection = useCallback(() => {
    let selected: DataPoint[] = []
    const spatialIndex = spatialIndexRef.current

    console.log('performSelection called - selectionMode:', selectionMode)
    console.log('lassoPointsRef.current:', lassoPointsRef.current.length, 'points')
    console.log('selectionRect:', selectionRect)
    console.log('selectionCircle:', selectionCircle)
    console.log('spatialIndex available:', !!spatialIndex)

    if (selectionMode === 'rectangle') {
      // Always call onSelection, even for empty selections
      if (selectionRect) {
        const bbox = {
          minX: Math.min(selectionRect.x1, selectionRect.x2),
          maxX: Math.max(selectionRect.x1, selectionRect.x2),
          minY: Math.min(selectionRect.y1, selectionRect.y2),
          maxY: Math.max(selectionRect.y1, selectionRect.y2)
        }

        const candidates = spatialIndex.search(bbox)
        selected = candidates.filter(point => {
          const x = point.cx || 0
          const y = point.cy || 0
          const minX = Math.min(selectionRect.x1, selectionRect.x2)
          const maxX = Math.max(selectionRect.x1, selectionRect.x2)
          const minY = Math.min(selectionRect.y1, selectionRect.y2)
          const maxY = Math.max(selectionRect.y1, selectionRect.y2)
          return x >= minX && x <= maxX && y >= minY && y <= maxY
        })
      }

    } else if (selectionMode === 'circle') {
      // Always call onSelection, even for empty selections
      if (selectionCircle) {
        const bbox = {
          minX: selectionCircle.center[0] - selectionCircle.radius,
          maxX: selectionCircle.center[0] + selectionCircle.radius,
          minY: selectionCircle.center[1] - selectionCircle.radius,
          maxY: selectionCircle.center[1] + selectionCircle.radius
        }

        const candidates = spatialIndex.search(bbox)
        selected = candidates.filter(point => {
          const x = point.cx || 0
          const y = point.cy || 0
          const dx = x - selectionCircle.center[0]
          const dy = y - selectionCircle.center[1]
          return dx * dx + dy * dy <= selectionCircle.radius * selectionCircle.radius
        })
      }

    } else if (selectionMode === 'lasso') {
      // Always call onSelection, even for empty selections
      if (lassoPointsRef.current.length >= 2) {
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

        // Simple polygon check on candidates only
        selected = candidates.filter(point => {
          const x = point.cx || 0
          const y = point.cy || 0
          return simplePointInPolygon([x, y], selectionPoints)
        })

        // Fallback: if polygon selection fails, use distance-based selection for small lassos
        if (selected.length === 0 && selectionPoints.length <= 5) {
          console.log('Using fallback distance-based selection')
          console.log('Lasso bbox:', bbox)
          console.log('First candidate point:', candidates[0]?.cx, candidates[0]?.cy)
          const centerX = (bbox.minX + bbox.maxX) / 2
          const centerY = (bbox.minY + bbox.maxY) / 2
          const radius = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) / 2

          selected = candidates.filter(point => {
            const x = point.cx || 0
            const y = point.cy || 0
            const dx = x - centerX
            const dy = y - centerY
            return dx * dx + dy * dy <= radius * radius
          })
        }
      }
      // If lassoPointsRef.current.length < 2, selected remains empty array
    }

    console.log('Selection result:', selected.length, 'points selected')
    if (selected.length > 0) {
      console.log('First selected point:', selected[0])
    } else {
      console.log('No points selected - possible issues:')
      console.log('- lassoPointsRef.current length:', lassoPointsRef.current.length)
      console.log('- selectionMode:', selectionMode)
      console.log('- spatialIndex available:', !!spatialIndex)
      if (lassoPointsRef.current.length > 0) {
        console.log('- First lasso point:', lassoPointsRef.current[0])
        console.log('- Last lasso point:', lassoPointsRef.current[lassoPointsRef.current.length - 1])
      }
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
    console.log('Lasso component rendering - isLassoActive:', isLassoActive, 'selectionMode:', selectionMode)
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
          stroke="#6699ff"
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
          stroke="#6699ff"
          strokeWidth={2}
          strokeDasharray="5,5"
        />
      )
    } else if (selectionMode === 'lasso') {
      const lassoPath = line().curve(curveBasis)(lassoPoints)
      console.log('Lasso path generation - lassoPoints:', lassoPoints.length, 'lassoPath:', lassoPath)
      if (!lassoPath) {
        console.log('Lasso path is undefined, cannot render')
        return null
      }
      return (
        <path
          d={lassoPath}
          fill="none"
          stroke="#6699ff"
          strokeWidth={5}
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

export default useLassoSimple