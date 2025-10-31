# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatriViz is an Electron-based desktop application for visualizing gene expression data using UMAP projections. The application enables interactive exploration of gene expression patterns across different cell types through scatter plots with advanced performance optimizations.

## Architecture

### Electron Multi-Process Architecture

- **Main Process** (`src/main/`): Handles file I/O, parquet processing, and IPC communication
  - `index.ts`: Main window creation and IPC handlers
  - `parquet.ts`: Parquet file querying with column selection
  - `resources.ts`: Resource directory and category management
  - `export.ts`: CSV export functionality
- **Renderer Process** (`src/renderer/`): React-based UI with visualization components
  - `components/`: UI components including multiple plot implementations
  - `services/`: Data processing and caching services
  - `workers/`: Web Workers for performance optimization
- **Preload Script** (`src/preload/`): Secure API bridge between main and renderer processes

### Data Flow Architecture

```
Resource Directory → JSON Config → Parquet Files → Data Processing → Visualization
```

### Performance Optimization Patterns

- **Multi-Rendering Engine Support**: Canvas-based fallback (`Plot.tsx`), WebGL rendering (`PlotDeckGL.tsx`), and hybrid approach with automatic fallback
- **Advanced Caching**: Memory cache, IndexedDB cache (500MB limit with LRU eviction), and DuckDB-WASM for efficient parquet querying
- **Web Worker Architecture**: Offloads point selection calculations to prevent UI blocking
- **DuckDB-WASM Integration**: SQL-based data aggregation in browser for efficient gene expression averaging

## Development Commands

### Core Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build application for production
- `npm run start` - Preview built application

### Code Quality

- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking for both node and web targets

### Platform Builds

- `npm run build:win` - Build Windows executable (portable)
- `npm run build:mac` - Build macOS application
- `npm run build:linux` - Build Linux executable (AppImage, snap, deb)

## Configuration

### Build Configuration

- `electron.vite.config.ts`: Electron-Vite configuration with separate builds for main, preload, and renderer processes
- `electron-builder.yml`: Multi-platform build configuration
- `@renderer` alias configured in Vite for `src/renderer/src/`

### TypeScript Configuration

- `tsconfig.json`: Composite configuration referencing node and web targets
- `tsconfig.node.json`: Node.js/Electron main process configuration
- `tsconfig.web.json`: Browser/renderer process configuration

## Data Structure

### Resource Files

Application expects resource directories containing:

- `.json` files with `fileType: "matriviz"` defining datasets
- Parquet files with gene expression data and UMAP coordinates
- Category files defining gene groupings

### IPC Communication

The main and renderer processes communicate through these channels:

- `feather`: Feather file operations (currently unused)
- `parquet`: Parquet file queries and column retrieval
- `resources`: Resource directory management and category loading
- `export`: CSV export functionality

## Key Dependencies

### Core Frameworks

- **Electron**: Desktop application framework
- **React**: UI framework with hooks
- **TypeScript**: Type safety across codebase

### Visualization Libraries

- **Deck.gl**: WebGL-based high-performance visualization
- **VisX**: D3-based visualization components
- **Regl**: Functional WebGL library

### Data Processing

- **DuckDB-WASM**: In-browser analytical database
- **Apache Arrow**: Columnar memory format
- **ParquetJS**: Parquet file processing

### Build Tooling

- **Electron-Vite**: Modern build tool for Electron
- **Electron-Builder**: Multi-platform packaging

## Development Notes

### Performance Considerations

- Parquet file queries limited to 20,000 records by default for performance
- WebGL hardware acceleration enabled with GPU blacklist bypass
- Memory-efficient data structures for large datasets
- Web Worker-based spatial indexing for fast point-in-polygon operations

### Error Handling

- WebGL error boundaries for graceful fallback
- Comprehensive logging for debugging
- Fallback mechanisms for data processing failures

### Security Model

- Context isolation enabled
- Preload script exposes only safe APIs
- No direct Node.js access from renderer
