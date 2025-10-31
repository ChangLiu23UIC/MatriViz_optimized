// Web Worker for selection computation

interface Point {
  x: number
  y: number
  index: string
  score: number
}

interface SelectionMessage {
  type: 'rectangle' | 'circle'
  points: Point[]
  bounds: {
    startX: number
    startY: number
    endX: number
    endY: number
  }
}

interface SelectionResult {
  selectedPoints: Point[]
}

// Handle messages from main thread
self.onmessage = function(event: MessageEvent<SelectionMessage>) {
  const { type, points, bounds } = event.data
  let selectedPoints: Point[] = []

  if (type === 'rectangle') {
    const { startX, startY, endX, endY } = bounds
    const minX = Math.min(startX, endX)
    const maxX = Math.max(startX, endX)
    const minY = Math.min(startY, endY)
    const maxY = Math.max(startY, endY)

    selectedPoints = points.filter(point =>
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    )
  } else if (type === 'circle') {
    const { startX, startY, endX, endY } = bounds
    const centerX = startX
    const centerY = startY
    const radius = Math.sqrt(
      Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2)
    )

    selectedPoints = points.filter(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)
      )
      return distance <= radius
    })
  }

  // Send result back to main thread
  self.postMessage({
    selectedPoints
  } as SelectionResult)
}