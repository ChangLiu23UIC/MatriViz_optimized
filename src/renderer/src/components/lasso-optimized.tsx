import React, { useState, useCallback, useMemo } from 'react'
import { polygonContains } from 'd3-polygon'
import { line, curveBasis } from 'd3-shape'
import { UseLassoProps, UseLassoReturn, SelectionMode, DataPoint } from '../types'

// Spatial grid for fast point lookup
const createSpatialGrid = (data: DataPoint[], gridSize: number = 50) => {
  const grid = new Map<string, DataPoint[]>()
  data.forEach(point => {
    const gridX = Math.floor((point.cx || 0) / gridSize)
    const gridY = Math.floor((point.cy || 0) / gridSize)
    const key = `${gridX},${gridY}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(point)
  })
  return grid
}

// Get grid cells that intersect with bounding box
const getIntersectingGridCells = (
  bbox: { minX: number; maxX: number; minY: number; maxY: number },
  gridSize: number
): string[] => {
  const cells: string[] = []
  const startX = Math.floor(bbox.minX / gridSize)
  const endX = Math.floor(bbox.maxX / gridSize)
  const startY = Math.floor(bbox.minY / gridSize)
  const endY = Math.floor(bbox.maxY / gridSize)

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      cells.push(`${x},${y}`)
    }
  }
  return cells
}

// Rectangle selection check
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

// Circle selection check
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

const useLassoOptimized = ({
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

  // Pre-compute spatial grid for fast lookup
  const spatialGrid = useMemo(() => {
    const precomputedData = data.map(point => ({
      ...point,
      cx: point.cx || xScale(point.x),
      cy: point.cy || yScale(point.y)
    }))
    return createSpatialGrid(precomputedData, 50)
  }, [data, xScale, yScale])

  // Helper function to get bounding box of lasso points
  const getBoundingBox = (points: [number, number][]) => {
    if (points.length === 0) return null
    const xs = points.map(p => p[0])
    const ys = points.map(p => p[1])
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    }
  }

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsLassoActive(true)
    const { left, top } = event.currentTarget.getBoundingClientRect()
    const point: [number, number] = [event.clientX - left, event.clientY - top]

    if (selectionMode === 'rectangle') {
      setSelectionRect({ x1: point[0], y1: point[1], x2: point[0], y2: point[1] })
    } else if (selectionMode === 'circle') {
      setSelectionCircle({ center: point, radius: 0 })
    } else {
      setLassoPoints([point])
    }
  }, [selectionMode])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isLassoActive) return

      const { left, top } = event.currentTarget.getBoundingClientRect()
      const newPoint: [number, number] = [event.clientX - left, event.clientY - top]

      if (selectionMode === 'rectangle' && selectionRect) {
        setSelectionRect({ ...selectionRect, x2: newPoint[0], y2: newPoint[1] })
      } else if (selectionMode === 'circle' && selectionCircle) {
        const dx = newPoint[0] - selectionCircle.center[0]
        const dy = newPoint[1] - selectionCircle.center[1]
        const radius = Math.sqrt(dx * dx + dy * dy)
        setSelectionCircle({ ...selectionCircle, radius })
      } else if (selectionMode === 'lasso') {
        const updatedLassoPoints: [number, number][] =
          lassoPoints.length > 1 ? lassoPoints.slice(0, -1) : lassoPoints
        const newPoints: [number, number][] = [...updatedLassoPoints, newPoint]

        // Temporarily close the loop for visual effect
        if (newPoints.length > 1) {
          newPoints.push(newPoints[0])
        }
        setLassoPoints(newPoints)
      }
    },
    [isLassoActive, selectionMode, selectionRect, selectionCircle, lassoPoints]
  )

  const performSelection = useCallback(() => {
    let selected: DataPoint[] = []

    if (selectionMode === 'rectangle' && selectionRect) {
      // Fast rectangle selection using spatial grid
      const bbox = {
        minX: Math.min(selectionRect.x1, selectionRect.x2),
        maxX: Math.max(selectionRect.x1, selectionRect.x2),
        minY: Math.min(selectionRect.y1, selectionRect.y2),
        maxY: Math.max(selectionRect.y1, selectionRect.y2)
      }

      const intersectingCells = getIntersectingGridCells(bbox, 50)
      const candidates: DataPoint[] = []

      intersectingCells.forEach(cellKey => {
        const cellPoints = spatialGrid.get(cellKey)
        if (cellPoints) {
          candidates.push(...cellPoints)
        }
      })

      selected = candidates.filter(point => isPointInRectangle(point, selectionRect))

    } else if (selectionMode === 'circle' && selectionCircle) {
      // Fast circle selection
      const bbox = {
        minX: selectionCircle.center[0] - selectionCircle.radius,
        maxX: selectionCircle.center[0] + selectionCircle.radius,
        minY: selectionCircle.center[1] - selectionCircle.radius,
        maxY: selectionCircle.center[1] + selectionCircle.radius
      }

      const intersectingCells = getIntersectingGridCells(bbox, 50)
      const candidates: DataPoint[] = []

      intersectingCells.forEach(cellKey => {
        const cellPoints = spatialGrid.get(cellKey)
        if (cellPoints) {
          candidates.push(...cellPoints)
        }
      })

      selected = candidates.filter(point =>
        isPointInCircle(point, { x: selectionCircle.center[0], y: selectionCircle.center[1] }, selectionCircle.radius)
      )

    } else if (selectionMode === 'lasso' && lassoPoints.length > 2) {
      // Optimized lasso selection with spatial grid
      const selectionPoints = lassoPoints.slice(0, -1) // Remove closing point
      const bbox = getBoundingBox(selectionPoints)

      if (!bbox) {
        onSelection([])
        return
      }

      // Step 1: Quick spatial grid filtering
      const intersectingCells = getIntersectingGridCells(bbox, 50)
      const candidates: DataPoint[] = []

      intersectingCells.forEach(cellKey => {
        const cellPoints = spatialGrid.get(cellKey)
        if (cellPoints) {
          candidates.push(...cellPoints)
        }
      })

      // Step 2: Precise polygon contains check on candidates only
      selected = candidates.filter((point) => {
        const x = point.cx || 0
        const y = point.cy || 0
        return polygonContains(selectionPoints, [x, y])
      })
    }
    onSelection(selected)
  }, [selectionMode, selectionRect, selectionCircle, lassoPoints, spatialGrid, data.length, onSelection])

  const handleMouseUp = useCallback(() => {
    setIsLassoActive(false)

    performSelection()

    // Clear selection state
    setLassoPoints([])
    setSelectionRect(null)
    setSelectionCircle(null)
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

export default useLassoOptimized