import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'

import { loadFeatherFile, queryGlobalTable, tableToJson } from './feather'
import { queryParquetFile, getAllColumns } from './parquet'
import { getResourceList, getCategories } from './resources'
import { writeToCSV } from './export'
import duckDBMainService from './duckdb'

import icon from '../../resources/icon.png?asset'

const store = new Store()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Set CSP header to allow DuckDB-WASM to work
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:;",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:;",
      "worker-src blob: 'self' 'unsafe-inline' 'unsafe-eval';",
      "child-src blob: 'self' 'unsafe-inline' 'unsafe-eval';",
      "connect-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:;"
    ].join(' ')

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// Enable hardware acceleration for WebGL
// app.disableHardwareAcceleration();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Initialize DuckDB in main process
  console.log('Attempting to initialize DuckDB...')
  try {
    await duckDBMainService.initialize()
    console.log('DuckDB initialized successfully in main process')
  } catch (error) {
    console.error('Failed to initialize DuckDB in main process:', error)
  }

  // WebGL configuration
  app.commandLine.appendSwitch('--ignore-gpu-blacklist');
  app.commandLine.appendSwitch('--enable-gpu-rasterization');
  app.commandLine.appendSwitch('--enable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('--enable-webgl');
  app.commandLine.appendSwitch('--enable-webgl2');

  // CSP configuration for DuckDB-WASM
  app.commandLine.appendSwitch('--disable-web-security');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

ipcMain.on('load-feather-file', async (event, filePath: string) => {
  try {
    const table = await loadFeatherFile(filePath)
    event.reply('load-feather-file-reply', table)
  } catch (error) {
    event.reply('load-feather-file-reply', error)
  }
})

ipcMain.on('query-global-table', (event, query?: { select?: string[] }) => {
  try {
    const table = queryGlobalTable(query)
    if (table) {
      const json = tableToJson(table)
      event.reply('query-global-table-reply', json)
    } else {
      event.reply('query-global-table-reply', [])
    }
  } catch (error) {
    event.reply('query-global-table-reply', error)
  }
})

ipcMain.on('query-parquet-file', async (event, filePath: string, query?: string[]) => {
  try {
    const json = await queryParquetFile(filePath, query)
    event.reply('query-parquet-file-reply', json)
  } catch (error) {
    event.reply('query-parquet-file-reply', error)
  }
})

ipcMain.on('get-parquet-columns', async (event, filePath: string) => {
  try {
    const columns = await getAllColumns(filePath)
    event.reply('get-parquet-columns-reply', columns)
  } catch (error) {
    event.reply('get-parquet-columns-reply', error)
  }
})

// DuckDB IPC handlers
ipcMain.on('duckdb-query-parquet', async (event, filePath: string, columns: string[]) => {
  try {
    const result = await duckDBMainService.queryParquetFile(filePath, columns)
    event.reply('duckdb-query-parquet-reply', result)
  } catch (error) {
    event.reply('duckdb-query-parquet-reply', error)
  }
})

ipcMain.on('duckdb-query-parquet-with-expression', async (
  event,
  filePath: string,
  geneColumns: string[],
  expressionColumns: string[]
) => {
  try {
    const result = await duckDBMainService.queryParquetFileWithExpression(
      filePath,
      geneColumns,
      expressionColumns
    )
    event.reply('duckdb-query-parquet-with-expression-reply', result)
  } catch (error) {
    event.reply('duckdb-query-parquet-with-expression-reply', error)
  }
})

ipcMain.on('duckdb-get-parquet-columns', async (event, filePath: string) => {
  try {
    const columns = await duckDBMainService.getParquetColumns(filePath)
    event.reply('duckdb-get-parquet-columns-reply', columns)
  } catch (error) {
    event.reply('duckdb-get-parquet-columns-reply', error)
  }
})

ipcMain.on('get-resource-list', async (event, dirPath: string) => {
  try {
    const files = await getResourceList(dirPath)
    event.reply('get-resource-list-reply', files)
  } catch (error) {
    event.reply('get-resource-list-reply', error)
  }
})

ipcMain.on('get-resource-categories', async (event, path: string) => {
  try {
    const categories = await getCategories(path)
    event.reply('get-resource-categories-reply', categories)
  } catch (error) {
    event.reply('get-resource-categories-reply', error)
  }
})

ipcMain.on(
  'export-csv',
  async (event, result: [], selectedGenes: string[], parquetFile: string) => {
    const options = {
      title: 'Export CSV',
      defaultPath: 'export.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    }

    const filePath = await dialog.showSaveDialog(options)

    if (!filePath.canceled) {
      console.log(filePath.filePath)
      if (filePath.filePath) writeToCSV(result, selectedGenes, parquetFile, filePath.filePath)
    } else {
      console.log('Export canceled')
      event.reply('export-csv-reply', 'Export canceled')
    }
  }
)

ipcMain.on('get-resource-dir', (event) => {
  const dir = store.get('resourceDir')
  event.sender.send('get-resource-dir-reply', dir)
})

ipcMain.on('set-resource-dir', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Resource Directory'
  })

  if (!result.canceled && result.filePaths.length > 0) {
    let resourceDir = result.filePaths[0]
    if (!resourceDir.endsWith(path.sep)) {
      resourceDir += path.sep
    }
    store.set('resourceDir', resourceDir)
    event.sender.send('set-resource-dir-reply', resourceDir)
  }
})
