import { DataPoint } from '../types';

interface ProcessedData {
  positions: Float32Array;  // [x1, y1, x2, y2, ...]
  scores: Float32Array;     // [score1, score2, ...]
  indices: string[];        // Original indices for mapping
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minScore: number;
    maxScore: number;
  };
}

class DataProcessor {
  processDataForGPU(data: DataPoint[]): ProcessedData {
    console.log('Processing data for GPU, data length:', data.length);
    if (data.length > 0) {
      console.log('First data point:', data[0]);
    }

    const positions = new Float32Array(data.length * 2);
    const scores = new Float32Array(data.length);
    const indices: string[] = new Array(data.length);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minScore = Infinity, maxScore = -Infinity;

    // Single pass through data to compute everything
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const posIndex = i * 2;

      // Store positions
      positions[posIndex] = point.x;
      positions[posIndex + 1] = point.y;

      // Store scores
      scores[i] = point.score;

      // Store indices
      indices[i] = point.index;

      // Update bounds
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
      if (point.score < minScore) minScore = point.score;
      if (point.score > maxScore) maxScore = point.score;
    }

    console.log('Computed bounds:', { minX, maxX, minY, maxY, minScore, maxScore });

    const processedData: ProcessedData = {
      positions,
      scores,
      indices,
      bounds: {
        minX: minX === Infinity ? 0 : minX,
        maxX: maxX === -Infinity ? 1 : maxX,
        minY: minY === Infinity ? 0 : minY,
        maxY: maxY === -Infinity ? 1 : maxY,
        minScore: minScore === Infinity ? 0 : minScore,
        maxScore: maxScore === -Infinity ? 1 : maxScore
      }
    };

    return processedData;
  }

  processCentroidsForGPU(centroids: DataPoint[]): ProcessedData {
    // Similar processing but for centroid data
    return this.processDataForGPU(centroids);
  }

  createSelectionBuffer(selectedIndices: Set<string>, allData: ProcessedData): {
    selectedPositions: Float32Array;
    selectedScores: Float32Array;
    selectedCount: number;
  } {
    const selectedCount = Array.from(selectedIndices).length;
    const selectedPositions = new Float32Array(selectedCount * 2);
    const selectedScores = new Float32Array(selectedCount);

    let writeIndex = 0;
    for (let i = 0; i < allData.indices.length; i++) {
      if (selectedIndices.has(allData.indices[i])) {
        const readIndex = i * 2;
        const writePosIndex = writeIndex * 2;

        selectedPositions[writePosIndex] = allData.positions[readIndex];
        selectedPositions[writePosIndex + 1] = allData.positions[readIndex + 1];
        selectedScores[writeIndex] = allData.scores[i];

        writeIndex++;
      }
    }

    return {
      selectedPositions,
      selectedScores,
      selectedCount
    };
  }

  normalizePositions(
    positions: Float32Array,
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): Float32Array {
    const normalized = new Float32Array(positions.length);
    const rangeX = bounds.maxX - bounds.minX;
    const rangeY = bounds.maxY - bounds.minY;

    for (let i = 0; i < positions.length; i += 2) {
      // Normalize x to [-1, 1]
      normalized[i] = ((positions[i] - bounds.minX) / rangeX) * 2 - 1;
      // Normalize y to [-1, 1]
      normalized[i + 1] = ((positions[i + 1] - bounds.minY) / rangeY) * 2 - 1;
    }

    return normalized;
  }

  normalizeScores(
    scores: Float32Array,
    bounds: { minScore: number; maxScore: number }
  ): Float32Array {
    const normalized = new Float32Array(scores.length);
    const range = bounds.maxScore - bounds.minScore;

    for (let i = 0; i < scores.length; i++) {
      normalized[i] = range === 0 ? 0 : (scores[i] - bounds.minScore) / range;
    }

    return normalized;
  }

}

export const dataProcessor = new DataProcessor();
export default dataProcessor;