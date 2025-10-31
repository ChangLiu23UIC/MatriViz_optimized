import Flatbush from 'flatbush';

interface Point {
  x: number;
  y: number;
  index: string;
  score: number;
}

interface SelectionMessage {
  type: 'rectangle' | 'circle' | 'lasso';
  points: Point[];
  bounds?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  polygon?: { x: number; y: number }[];
}

interface SelectionResult {
  selectedPoints: Point[];
  processingTime: number;
}

class OptimizedSelectionWorker {
  private spatialIndex: Flatbush | null = null;
  private points: Point[] = [];

  buildSpatialIndex(points: Point[]): void {
    const startTime = performance.now();

    this.points = points;

    // Create Flatbush index
    this.spatialIndex = new Flatbush(points.length);

    for (const point of points) {
      this.spatialIndex.add(point.x, point.y, point.x, point.y);
    }

    this.spatialIndex.finish();

    const buildTime = performance.now() - startTime;
    console.log(`Spatial index built in ${buildTime.toFixed(2)}ms for ${points.length} points`);
  }

  selectRectangle(bounds: { startX: number; startY: number; endX: number; endY: number }): Point[] {
    if (!this.spatialIndex) return [];

    const minX = Math.min(bounds.startX, bounds.endX);
    const maxX = Math.max(bounds.startX, bounds.endX);
    const minY = Math.min(bounds.startY, bounds.endY);
    const maxY = Math.max(bounds.startY, bounds.endY);

    const indices = this.spatialIndex.search(minX, minY, maxX, maxY);
    return indices.map(index => this.points[index]);
  }

  selectCircle(bounds: { startX: number; startY: number; endX: number; endY: number }): Point[] {
    if (!this.spatialIndex) return [];

    const centerX = bounds.startX;
    const centerY = bounds.startY;
    const radius = Math.sqrt(
      Math.pow(bounds.endX - centerX, 2) + Math.pow(bounds.endY - centerY, 2)
    );

    // Use bounding box search first, then filter by distance
    const minX = centerX - radius;
    const maxX = centerX + radius;
    const minY = centerY - radius;
    const maxY = centerY + radius;

    const indices = this.spatialIndex.search(minX, minY, maxX, maxY);

    return indices
      .map(index => this.points[index])
      .filter(point => {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return dx * dx + dy * dy <= radius * radius;
      });
  }

  selectLasso(polygon: { x: number; y: number }[]): Point[] {
    if (!this.spatialIndex || polygon.length < 3) return [];

    // Calculate polygon bounds
    const bounds = {
      minX: Math.min(...polygon.map(p => p.x)),
      maxX: Math.max(...polygon.map(p => p.x)),
      minY: Math.min(...polygon.map(p => p.y)),
      maxY: Math.max(...polygon.map(p => p.y))
    };

    // Search within bounds
    const indices = this.spatialIndex.search(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);

    return indices
      .map(index => this.points[index])
      .filter(point => this.isPointInPolygon(point, polygon));
  }

  private isPointInPolygon(point: Point, polygon: { x: number; y: number }[]): boolean {
    const x = point.x;
    const y = point.y;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  handleMessage(event: MessageEvent<SelectionMessage>): void {
    const { type, points, bounds, polygon } = event.data;
    const startTime = performance.now();

    try {
      // Rebuild spatial index if points changed
      if (!this.spatialIndex || this.points.length !== points.length) {
        this.buildSpatialIndex(points);
      }

      let selectedPoints: Point[] = [];

      switch (type) {
        case 'rectangle':
          if (bounds) {
            selectedPoints = this.selectRectangle(bounds);
          }
          break;

        case 'circle':
          if (bounds) {
            selectedPoints = this.selectCircle(bounds);
          }
          break;

        case 'lasso':
          if (polygon) {
            selectedPoints = this.selectLasso(polygon);
          }
          break;
      }

      const processingTime = performance.now() - startTime;

      // Send result back to main thread
      self.postMessage({
        selectedPoints,
        processingTime
      } as SelectionResult);

    } catch (error) {
      console.error('Error in selection worker:', error);
      self.postMessage({
        selectedPoints: [],
        processingTime: 0
      } as SelectionResult);
    }
  }
}

// Initialize worker
const worker = new OptimizedSelectionWorker();

// Handle messages from main thread
self.onmessage = function(event: MessageEvent<SelectionMessage>) {
  worker.handleMessage(event);
};

export {};