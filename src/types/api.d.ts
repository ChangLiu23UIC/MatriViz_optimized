/* Global definitions */

import { ResourceFile } from './types'

declare global {
  interface Window {
    feather: {
      loadFeatherFile: (filePath: string) => Promise<void>
      queryGlobalTable: (query?: { select?: string[] }) => Table | null
    }
    parquet: {
      queryParquetFile: (filePath: string, query?: string[]) => Promise<Record<string, unknown>[]>
      getParquetColumns: (filePath: string) => Promise<string[]>
    }
    resources: {
      getResourceList: (dirPath: string) => Promise<ResourceFile[]>
      getResourceCategories: (path: string) => Promise<Record<string, string[]>>
      setResourceDir: () => Promise<string>
      getResourceDir: () => Promise<string>
    }
    export: {
      exportCSV: (
        result: Record<string, unknown>[],
        selectedGenes: string[],
        parquetFile: string
      ) => Promise<void>
    }
    duckdb: {
      queryParquetFile: (filePath: string, columns: string[]) => Promise<{
        columns: string[]
        data: any[][]
      }>
      queryParquetFileWithExpression: (
        filePath: string,
        geneColumns: string[],
        expressionColumns: string[]
      ) => Promise<{
        columns: string[]
        data: any[][]
      }>
      getParquetColumns: (filePath: string) => Promise<string[]>
    }
  }
}

export {}
