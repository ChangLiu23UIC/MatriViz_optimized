import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { line, curveBasis } from 'd3-shape'
import { UseLassoProps, UseLassoReturn, SelectionMode, DataPoint } from '../types'

const useLassoWorker = ({
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

  const workerRef = useRef<Worker | null>(null)
  const lassoPointsRef = useRef<[number, number][]>([])

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/lasso-worker.js', import.meta.url))

    // Handle worker messages
    workerRef.current.onmessage = (e) => {
      const { type, selected } = e.data
      if (type === 'SELECTION_RESULT') {
        onSelection(selected)
      }
    }

    // Cleanup
    return () => {
      workerRef.current?.terminate()
    }
  }, [onSelection])

  // Initialize worker with data when data changes
  useEffect(() => {
    if (!workerRef.current || !data.length) return

    // Pre-compute data for worker
    const precomputedData = data.map(point => ({
      ...point,
      cx: point.cx || xScale(point.x),
      cy: point.cy || yScale(point.y)
    }))

    workerRef.current.postMessage({
      type: 'INIT_DATA',
      data: { points: precomputedData }
    })
  }, [data, xScale, yScale])

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
        // Rectangle mode - immediate visual update
        setSelectionRect({ ...selectionRect, x2: newPoint[0], y2: newPoint[1] })
      } else if (selectionMode === 'circle' && selectionCircle) {
        // Circle mode - immediate visual update
        const dx = newPoint[0] - selectionCircle.center[0]
        const dy = newPoint[1] - selectionCircle.center[1]
        const radius = Math.sqrt(dx * dx + dy * dy)
        setSelectionCircle({ ...selectionCircle, radius })
      } else if (selectionMode === 'lasso') {
        // Lasso mode - immediate visual update, no computation
        const lastPoint = lassoPointsRef.current[lassoPointsRef.current.length - 1]

        // Only add point if it's different from last point
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

          // Update both state and ref
          setLassoPoints(newPoints)
          lassoPointsRef.current = newPoints.slice(0, -1) // Store without closing point
        }
      }
    },
    [isLassoActive, selectionMode, selectionRect, selectionCircle]
  )

  const performSelection = useCallback(() => {
    if (!workerRef.current) return

    if (selectionMode === 'rectangle' && selectionRect) {
      workerRef.current.postMessage({
        type: 'SELECT_RECTANGLE',
        data: selectionRect
      })
    } else if (selectionMode === 'circle' && selectionCircle) {
      workerRef.current.postMessage({
        type: 'SELECT_CIRCLE',
        data: selectionCircle
      })
    } else if (selectionMode === 'lasso' && lassoPointsRef.current.length > 2) {
      workerRef.current.postMessage({
        type: 'SELECT_LASSO',
        data: { points: lassoPointsRef.current }
      })
    }
  }, [selectionMode, selectionRect, selectionCircle])

  const handleMouseUp = useCallback(() => {
    setIsLassoActive(false)

    // Perform selection in Web Worker
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

export default useLassoWorker