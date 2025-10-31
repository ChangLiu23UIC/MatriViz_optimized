import parquet from 'parquetjs-lite'

export const queryParquetFile = async (
  filePath: string,
  query: string[] = []
): Promise<Record<string, unknown>[]> => {
  const reader = await parquet.ParquetReader.openFile(filePath)
  const cursor = reader.getCursor(query)
  const json: Record<string, unknown>[] = []
  let record = null

  while ((record = await cursor.next())) {
    json.push(record)
  }

  return json
}

export const queryParquetFileByIndex = async (
  filePath: string,
  query: string[] = [],
  indices: string[]
): Promise<Record<string, unknown>[]> => {
  try {
    const reader = await parquet.ParquetReader.openFile(filePath)
    const cursor = reader.getCursor(query)

    const json: Record<string, unknown>[] = []
    let record: Record<string, unknown> | null = null

    while ((record = await cursor.next())) {
      if (indices.includes(record.index?.toString() ?? '')) {
        json.push(record)
      }
    }

    return json
  } catch (error) {
    throw new Error(`Error querying Parquet file: ${error}`)
  }
}

export const getAllColumns = async (filePath: string): Promise<string[]> => {
  const reader = await parquet.ParquetReader.openFile(filePath)
  const schema = reader.getSchema()
  const columns = schema.fieldList.map((field) => field.name)
  return columns
}
