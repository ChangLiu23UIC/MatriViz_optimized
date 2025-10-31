interface CachedDataset {
  key: string;
  data: any[];
  timestamp: number;
  size: number;
  query: string;
}

class DatasetCache {
  private dbName = 'MatriVizDatasetCache';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private maxSize = 500 * 1024 * 1024; // 500MB max cache size

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains('datasets')) {
          const store = db.createObjectStore('datasets', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('size', 'size', { unique: false });
        }
      };
    });
  }

  async get(key: string): Promise<any[] | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['datasets'], 'readonly');
      const store = transaction.objectStore('datasets');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedDataset | undefined;
        if (result) {
          // Update timestamp to mark as recently used
          this.updateTimestamp(key);
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
    });
  }

  async set(key: string, data: any[], query: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    const cachedDataset: CachedDataset = {
      key,
      data,
      timestamp: Date.now(),
      size: this.calculateSize(data),
      query
    };

    // Check if we need to make space
    await this.ensureSpace(cachedDataset.size);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['datasets'], 'readwrite');
      const store = transaction.objectStore('datasets');
      const request = store.put(cachedDataset);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['datasets'], 'readwrite');
      const store = transaction.objectStore('datasets');
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['datasets'], 'readwrite');
      const store = transaction.objectStore('datasets');
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getStats(): Promise<{
    totalItems: number;
    totalSize: number;
    oldestItem: number;
    newestItem: number;
  }> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['datasets'], 'readonly');
      const store = transaction.objectStore('datasets');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const items = request.result as CachedDataset[];
        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        const timestamps = items.map(item => item.timestamp);

        resolve({
          totalItems: items.length,
          totalSize,
          oldestItem: timestamps.length > 0 ? Math.min(...timestamps) : 0,
          newestItem: timestamps.length > 0 ? Math.max(...timestamps) : 0
        });
      };
    });
  }

  private async ensureSpace(requiredSize: number): Promise<void> {
    const stats = await this.getStats();

    if (stats.totalSize + requiredSize <= this.maxSize) {
      return;
    }

    // Remove oldest items until we have enough space
    const itemsToRemove: string[] = [];
    let currentSize = stats.totalSize;

    const transaction = this.db!.transaction(['datasets'], 'readonly');
    const store = transaction.objectStore('datasets');
    const index = store.index('timestamp');
    const request = index.openCursor();

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;

        if (cursor && currentSize + requiredSize > this.maxSize) {
          const item = cursor.value as CachedDataset;
          itemsToRemove.push(item.key);
          currentSize -= item.size;
          cursor.continue();
        } else {
          // Delete the identified items
          this.deleteMultiple(itemsToRemove).then(resolve).catch(reject);
        }
      };
    });
  }

  private async deleteMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const transaction = this.db!.transaction(['datasets'], 'readwrite');
    const store = transaction.objectStore('datasets');

    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      keys.forEach(key => {
        const request = store.delete(key);
        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(request.error);
          }
        };
        request.onsuccess = () => {
          completed++;
          if (completed === keys.length && !hasError) {
            resolve();
          }
        };
      });
    });
  }

  private async updateTimestamp(key: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['datasets'], 'readwrite');
    const store = transaction.objectStore('datasets');
    const request = store.get(key);

    request.onsuccess = () => {
      const item = request.result as CachedDataset;
      if (item) {
        item.timestamp = Date.now();
        store.put(item);
      }
    };
  }

  private calculateSize(data: any[]): number {
    // Rough size estimation
    const jsonString = JSON.stringify(data);
    return new Blob([jsonString]).size;
  }

  generateCacheKey(
    parquetFile: string,
    genes: string[],
    highlightedGene: string
  ): string {
    const sortedGenes = [...genes].sort();
    const keyData = `${parquetFile}_${sortedGenes.join('_')}_${highlightedGene}`;

    // Simple hash for shorter keys
    let hash = 0;
    for (let i = 0; i < keyData.length; i++) {
      const char = keyData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `dataset_${Math.abs(hash).toString(36)}`;
  }
}

export const datasetCache = new DatasetCache();
export default datasetCache;