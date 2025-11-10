import * as duckdb from 'duckdb'

interface DuckDBQueryResult {
  columns: string[]
  data: any[][]
}

class DuckDBMainService {
  private db: duckdb.Database | null = null
  private connection: duckdb.Connection | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Starting DuckDB initialization in main process...')

      // Create a new DuckDB database
      this.db = new duckdb.Database(':memory:')
      this.connection = this.db.connect()

      this.isInitialized = true
      console.log('DuckDB initialized successfully in main process')
    } catch (error) {
      console.error('Failed to initialize DuckDB in main process:', error)
      throw error
    }
  }

  async queryParquetFile(
    filePath: string,
    columns: string[]
  ): Promise<DuckDBQueryResult> {
    if (!this.connection) {
      throw new Error('DuckDB not initialized')
    }

    console.log(`DuckDB queryParquetFile called for: ${filePath}`)
    console.log(`Columns: ${columns.join(', ')}`)

    try {
      // Execute the query directly
      const result = await new Promise<any[]>((resolve, reject) => {
        // Escape backslashes in file path for SQL query
        const escapedFilePath = filePath.replace(/\\/g, '\\\\')
        this.connection!.all(`
          SELECT ${columns.map(col => `"${col}"`).join(', ')}
          FROM read_parquet('${escapedFilePath}')
        `, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })

      console.log(`DuckDB query completed, rows: ${result.length}`)

      // Convert result to array format
      const dataArray = result.map(row => Object.values(row))
      const columnNames = Object.keys(result[0] || {})

      return {
        columns: columnNames,
        data: dataArray
      }
    } catch (error) {
      console.error('Error querying parquet file with DuckDB:', error)
      throw error
    }
  }

  async queryParquetFileWithExpression(
    filePath: string,
    geneColumns: string[],
    expressionColumns: string[],
    whereClause: string = ''
  ): Promise<DuckDBQueryResult> {
    if (!this.connection) {
      throw new Error('DuckDB not initialized')
    }

    console.log(`DuckDB queryParquetFileWithExpression called for: ${filePath}`)
    console.log(`Gene columns: ${geneColumns.join(', ')}`)
    console.log(`Expression columns: ${expressionColumns.join(', ')}`)

    try {
      // Calculate average expression per cell
      const avgExpression = expressionColumns
        .map(col => `CAST(\"${col}\" AS FLOAT)`)
        .join(' + ')

      const avgExpressionSql = expressionColumns.length > 1
        ? `(${avgExpression}) / ${expressionColumns.length}`
        : avgExpression

      // Escape backslashes in file path for SQL query
      const escapedFilePath = filePath.replace(/\\/g, '\\\\')
      const result = await new Promise<any[]>((resolve, reject) => {
        this.connection!.all(`
          SELECT
            ${geneColumns.map(col => `"${col}"`).join(', ')},
            ${avgExpressionSql} as avg_expression
          FROM read_parquet('${escapedFilePath}')
          ${whereClause}
        `, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })

      console.log(`DuckDB expression query completed, rows: ${result.length}`)

      // Convert result to array format
      const dataArray = result.map(row => Object.values(row))
      const columnNames = Object.keys(result[0] || {})

      return {
        columns: columnNames,
        data: dataArray
      }
    } catch (error) {
      console.error('Error querying parquet file with expression:', error)
      throw error
    }
  }

  async getParquetColumns(filePath: string): Promise<string[]> {
    if (!this.connection) {
      throw new Error('DuckDB not initialized')
    }

    try {
      // Escape backslashes in file path for SQL query
      const escapedFilePath = filePath.replace(/\\/g, '\\\\')
      const result = await new Promise<any[]>((resolve, reject) => {
        this.connection!.all(`
          DESCRIBE SELECT * FROM read_parquet('${escapedFilePath}')
        `, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })

      // Filter out default coordinate columns that should not be selectable as genes
      const defaultColumns = ['index', 'umap_1', 'umap_2']
      return result
        .map(row => row.column_name as string)
        .filter(column => !defaultColumns.includes(column.toLowerCase()))
    } catch (error) {
      console.error('Error getting parquet columns with DuckDB:', error)
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      this.connection.close()
      this.connection = null
    }
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.isInitialized = false
  }
}

export const duckDBMainService = new DuckDBMainService()
export default duckDBMainService