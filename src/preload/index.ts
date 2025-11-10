import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('feather', {
      loadFeatherFile: (filePath: string) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('load-feather-file', filePath)
          ipcRenderer.once('load-feather-file-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      queryGlobalTable: (query?: { select?: string[] }) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('query-global-table', query)
          ipcRenderer.once('query-global-table-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      }
    })
    contextBridge.exposeInMainWorld('parquet', {
      queryParquetFile: (filePath: string, query: string[] = []) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('query-parquet-file', filePath, query)
          ipcRenderer.once('query-parquet-file-reply', (_, response) => {
            // Check if response is an error object (from main process error serialization)
            if (response && typeof response === 'object' && response.message) {
              const error = new Error(response.message)
              if (response.stack) error.stack = response.stack
              if (response.name) error.name = response.name
              reject(error)
            } else if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      getParquetColumns: (filePath: string) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('get-parquet-columns', filePath)
          ipcRenderer.once('get-parquet-columns-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      }
    })
    contextBridge.exposeInMainWorld('resources', {
      getResourceList: (dirPath: string) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('get-resource-list', dirPath)
          ipcRenderer.once('get-resource-list-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      getResourceCategories: (path: string) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('get-resource-categories', path)
          ipcRenderer.once('get-resource-categories-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      getResourceDir: () => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('get-resource-dir')
          ipcRenderer.once('get-resource-dir-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      setResourceDir: () => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('set-resource-dir')
          ipcRenderer.once('set-resource-dir-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      }
    })
    contextBridge.exposeInMainWorld('export', {
      exportCSV: (
        result: Record<string, unknown>,
        selectedGenes: string[],
        parquetFile: string
      ) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('export-csv', result, selectedGenes, parquetFile)
          ipcRenderer.once('export-csv-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      }
    })
    contextBridge.exposeInMainWorld('duckdb', {
      queryParquetFile: (filePath: string, columns: string[]) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('duckdb-query-parquet', filePath, columns)
          ipcRenderer.once('duckdb-query-parquet-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      queryParquetFileWithExpression: (
        filePath: string,
        geneColumns: string[],
        expressionColumns: string[]
      ) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('duckdb-query-parquet-with-expression', filePath, geneColumns, expressionColumns)
          ipcRenderer.once('duckdb-query-parquet-with-expression-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      },
      getParquetColumns: (filePath: string) => {
        return new Promise((resolve, reject) => {
          ipcRenderer.send('duckdb-get-parquet-columns', filePath)
          ipcRenderer.once('duckdb-get-parquet-columns-reply', (_, response) => {
            if (response instanceof Error) {
              reject(response)
            } else {
              resolve(response)
            }
          })
        })
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
