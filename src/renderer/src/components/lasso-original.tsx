import React, { useState, useCallback } from 'react'
import { polygonContains } from 'd3-polygon'
import { line, curveBasis } from 'd3-shape'
import { UseLassoProps, UseLassoReturn } from '../types'

const useLasso = ({ data, xScale, yScale, onSelection }: UseLassoProps): UseLassoReturn => {
  const [lassoPoints, setLassoPoints] = useState<[number, number][]>([])
  const [isLassoActive, setIsLassoActive] = useState(false)

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
    console.log('Lasso: Mouse down event triggered')
    setIsLassoActive(true)
    const { left, top } = event.currentTarget.getBoundingClientRect()
    const point: [number, number] = [event.clientX - left, event.clientY - top]
    console.log('Lasso: Starting lasso at:', point)
    setLassoPoints([point])
  }, [])

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isLassoActive) {
        console.log('Lasso: Mouse move - lasso not active')
        return
      }

      const { left, top } = event.currentTarget.getBoundingClientRect()
      const updatedLassoPoints: [number, number][] =
        lassoPoints.length > 1 ? lassoPoints.slice(0, -1) : lassoPoints

      const newPoint: [number, number] = [event.clientX - left, event.clientY - top]

      const newPoints: [number, number][] = [...updatedLassoPoints, newPoint]

      // Temporarily close the loop for visual effect
      if (newPoints.length > 1) {
        newPoints.push(newPoints[0])
      }

      setLassoPoints(newPoints)
    },
    [isLassoActive, lassoPoints]
  )

  const handleMouseUp = useCallback(() => {
    console.log('Lasso: Mouse up event')
    setIsLassoActive(false)

    // Remove the closing point (duplicate of first point) before selection
    const selectionPoints = lassoPoints.length > 2 ? lassoPoints.slice(0, -1) : lassoPoints
    console.log('Lasso: Final points for selection:', selectionPoints)

    // Get bounding box for quick pre-filtering
    const bbox = getBoundingBox(selectionPoints)

    if (!bbox) {
      console.log('Lasso: No valid bounding box, clearing selection')
      onSelection([])
      setLassoPoints([])
      return
    }

    // Step 1: Quick bounding box pre-filtering
    console.time('Lasso: Bounding box filtering')
    const candidates = data.filter((d) => {
      // Use pre-computed coordinates (cx, cy) from lassoData
      const x = d.cx || xScale(d.x)
      const y = d.cy || yScale(d.y)
      return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY
    })
    console.timeEnd('Lasso: Bounding box filtering')
    console.log(`Lasso: ${candidates.length} candidates after bounding box filtering (from ${data.length} total)`)

    // Step 2: Precise polygon contains check on candidates only
    console.time('Lasso: Polygon contains check')
    const selected = candidates.filter((d) => {
      const x = d.cx || xScale(d.x)
      const y = d.cy || yScale(d.y)
      return polygonContains(selectionPoints, [x, y])
    })
    console.timeEnd('Lasso: Polygon contains check')

    console.log('Lasso: Selected points:', selected.length)
    onSelection(selected)
    setLassoPoints([]) // Clear lasso points after selection
  }, [lassoPoints, data, xScale, yScale])

  const Lasso: React.FC = () => {
    console.log('Lasso: Rendering component, isActive:', isLassoActive, 'points:', lassoPoints.length)
    const lassoPath = line().curve(curveBasis)(lassoPoints)
    return (
      isLassoActive && <path d={lassoPath!} fill="none" stroke="url(#stroke)" strokeWidth={3} />
    )
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

export default useLasso