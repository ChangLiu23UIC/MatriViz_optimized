// Web Worker for lasso selection - runs in separate thread
class SimpleSpatialIndex {
  constructor(gridSize = 50) {
    this.gridSize = gridSize
    this.grid = new Map()
  }

  build(points) {
    this.grid.clear()

    points.forEach(point => {
      const gridX = Math.floor((point.cx || 0) / this.gridSize)
      const gridY = Math.floor((point.cy || 0) / this.gridSize)
      const key = `${gridX},${gridY}`

      if (!this.grid.has(key)) {
        this.grid.set(key, [])
      }
      this.grid.get(key).push(point)
    })
  }

  search(bbox) {
    const startX = Math.floor(bbox.minX / this.gridSize)
    const endX = Math.floor(bbox.maxX / this.gridSize)
    const startY = Math.floor(bbox.minY / this.gridSize)
    const endY = Math.floor(bbox.maxY / this.gridSize)

    const result = []

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
const simplePointInPolygon = (point, polygon) => {
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
const isPointInRectangle = (point, rect) => {
  const x = point.cx || 0
  const y = point.cy || 0
  const minX = Math.min(rect.x1, rect.x2)
  const maxX = Math.max(rect.x1, rect.x2)
  const minY = Math.min(rect.y1, rect.y2)
  const maxY = Math.max(rect.y1, rect.y2)
  return x >= minX && x <= maxX && y >= minY && y <= maxY
}

// Circle selection
const isPointInCircle = (point, center, radius) => {
  const x = point.cx || 0
  const y = point.cy || 0
  const dx = x - center.x
  const dy = y - center.y
  return dx * dx + dy * dy <= radius * radius
}

let spatialIndex = null

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, data } = e.data

  switch (type) {
    case 'INIT_DATA':
      // Initialize spatial index with pre-computed data
      spatialIndex = new SimpleSpatialIndex()
      spatialIndex.build(data.points)
      self.postMessage({ type: 'INIT_COMPLETE' })
      break

    case 'SELECT_RECTANGLE':
      if (!spatialIndex) break
      const bboxRect = {
        minX: Math.min(data.x1, data.x2),
        maxX: Math.max(data.x1, data.x2),
        minY: Math.min(data.y1, data.y2),
        maxY: Math.max(data.y1, data.y2)
      }
      const rectCandidates = spatialIndex.search(bboxRect)
      const rectSelected = rectCandidates.filter(point =>
        isPointInRectangle(point, data)
      )
      self.postMessage({ type: 'SELECTION_RESULT', selected: rectSelected })
      break

    case 'SELECT_CIRCLE':
      if (!spatialIndex) break
      const bboxCircle = {
        minX: data.center[0] - data.radius,
        maxX: data.center[0] + data.radius,
        minY: data.center[1] - data.radius,
        maxY: data.center[1] + data.radius
      }
      const circleCandidates = spatialIndex.search(bboxCircle)
      const circleSelected = circleCandidates.filter(point =>
        isPointInCircle(point, { x: data.center[0], y: data.center[1] }, data.radius)
      )
      self.postMessage({ type: 'SELECTION_RESULT', selected: circleSelected })
      break

    case 'SELECT_LASSO':
      if (!spatialIndex || data.points.length < 3) break

      // Calculate bounding box
      const xs = data.points.map(p => p[0])
      const ys = data.points.map(p => p[1])
      const bboxLasso = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      }

      // Fast spatial search
      const lassoCandidates = spatialIndex.search(bboxLasso)

      // Fast polygon check on candidates only
      const lassoSelected = lassoCandidates.filter(point => {
        const x = point.cx || 0
        const y = point.cy || 0
        return simplePointInPolygon([x, y], data.points)
      })

      self.postMessage({ type: 'SELECTION_RESULT', selected: lassoSelected })
      break

    default:
      console.warn('Unknown message type:', type)
  }
}