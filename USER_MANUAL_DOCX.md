# MatriViz User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Getting Started](#getting-started)
5. [User Interface Overview](#user-interface-overview)
6. [Data Loading](#data-loading)
7. [Gene Selection](#gene-selection)
8. [Visualization Features](#visualization-features)
9. [Interactive Plot Controls](#interactive-plot-controls)
10. [Label Management](#label-management)
11. [Data Export](#data-export)
12. [Performance Tips](#performance-tips)
13. [Troubleshooting](#troubleshooting)
14. [Keyboard Shortcuts](#keyboard-shortcuts)

## Introduction

MatriViz is a powerful desktop application designed for visualizing gene expression data using UMAP projections. It enables researchers and biologists to interactively explore gene expression patterns across different cell types through high-performance scatter plots with advanced optimization features.

### Key Features

- **Interactive UMAP Visualization**: Explore gene expression patterns in 2D space
- **High-Performance Rendering**: Handle large datasets with thousands of data points
- **Multi-Platform Support**: Available for Windows, macOS, and Linux
- **Advanced Data Processing**: SQL-based aggregation using DuckDB-WASM
- **Flexible Export Options**: Export selected data for further analysis

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 10.14+, or Ubuntu 18.04+
- **RAM**: 4GB minimum, 8GB recommended for large datasets
- **Storage**: 500MB free space
- **Display**: 1280x720 resolution minimum

### Recommended Requirements

- **RAM**: 16GB for optimal performance with large datasets
- **GPU**: WebGL-compatible graphics card
- **Storage**: SSD for faster data loading

## Installation

### Windows

1. Download the latest `.exe` file from the releases page
2. Run the installer and follow the setup wizard
3. Launch MatriViz from the Start menu or desktop shortcut

### macOS

1. Download the latest `.dmg` file
2. Open the disk image and drag MatriViz to Applications
3. Launch from Applications folder

### Linux

1. Download the appropriate package (AppImage, snap, or deb)
2. For AppImage: `chmod +x MatriViz-*.AppImage && ./MatriViz-*.AppImage`
3. For deb package: `sudo dpkg -i matriviz_*.deb`

## Getting Started

### First Launch

1. **Select Resource Directory**: When you first launch MatriViz, you'll be prompted to select a directory containing your data files
2. **Data Structure**: Ensure your directory contains:
   - JSON configuration files with `fileType: "matriviz"`
   - Parquet files with gene expression data
   - UMAP coordinate files
   - Category files for gene groupings

### Quick Start Workflow

1. Select your resource directory
2. Choose a dataset from the resource dropdown
3. Select genes of interest
4. Explore the UMAP visualization
5. Export findings as needed

## User Interface Overview

### Main Layout

MatriViz features a clean, responsive interface with two main panels:

**Left Panel (33%) - Controls**
- Resource and dataset selection
- Gene search and selection
- Category filtering
- Selection management

**Right Panel (67%) - Visualization**
- UMAP scatter plot
- Interactive plot controls
- Floating options panel

### Navigation Elements

- **Resource Dropdown**: Select between available datasets/tissues
- **Category Dropdown**: Filter genes by predefined categories
- **Gene Search**: Real-time search through available genes
- **Plot Options**: Floating panel with visualization settings

## Data Loading

### Supported File Formats

- **JSON Configuration**: Files with `fileType: "matriviz"` defining datasets
- **Parquet Files**: Columnar storage format for gene expression data
- **UMAP Coordinates**: 2D coordinates for scatter plot visualization
- **Category Files**: Gene groupings and classifications

### Loading Process

1. Click "Select Resource Directory" button
2. Navigate to your data directory
3. MatriViz automatically scans for compatible files
4. Select your desired dataset from the resource dropdown
5. The UMAP plot will load automatically

### Data Validation

- Automatic validation of file formats
- Error messages for incompatible files
- Progress indicators during loading

## Gene Selection

### Search and Selection

1. **Search Box**: Type to filter genes in real-time
2. **Checkbox Selection**: Click individual genes to select/deselect
3. **"All Genes" Option**: Quickly select all available genes
4. **Category Filtering**: Use category dropdown to focus on specific gene groups

### Selection Management

- **Selection Summary**: Shows count of selected genes
- **Clear Selection**: Remove all selected genes
- **Pagination**: Navigate through large gene lists (50 genes per page)
- **Visual Feedback**: Selected genes are highlighted in the list

### Gene Categories

- Predefined gene groupings based on biological function
- Category files define logical groupings
- Useful for focused analysis of specific gene families

## Visualization Features

### UMAP Plot Display

- **Automatic Rendering**: Canvas-based for large datasets (>1000 points), SVG for smaller sets
- **Color Gradient**: Customizable min/max colors for expression scores
- **Point Size**: Adjustable from 1-10 pixels
- **Score Range**: Automatic or manual adjustment

### Plot Customization

#### Color Settings

- **Min Color**: Color for lowest expression values
- **Max Color**: Color for highest expression values
- **Gradient**: Smooth transition between min and max colors

#### Display Options

- **Point Size**: Control visibility of individual points
- **Gridlines**: Show/hide background reference grid
- **Labels**: Toggle centroid labels on/off
- **Auto-scaling**: Automatic adjustment of score ranges

### Interactive Features

- **Tooltips**: Hover over points to see detailed information
- **Selection**: Click and drag to select points
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Click and drag to navigate the plot

## Interactive Plot Controls

### Selection Tools

#### Point Selection

- **Click Selection**: Individual point selection
- **Drag Selection**: Rectangle selection for multiple points
- **Lasso Selection**: Irregular shape selection
- **Clear Selection**: Remove all selected points

#### Selection Information

- **Counter**: Real-time count of selected points
- **Point Details**: Index and score for each selected point
- **Export Ready**: Selected points can be exported to CSV

### Navigation Controls

- **Zoom**: Mouse wheel or zoom buttons
- **Pan**: Click and drag anywhere on the plot
- **Reset View**: Return to default zoom and position
- **Fit to View**: Automatically adjust view to show all points

### Floating Options Panel

- **Draggable**: Move the panel anywhere on the plot
- **Collapsible**: Hide/show to maximize plot area
- **Persistent Settings**: Options maintained during session

## Label Management

### Centroid Labels

- **Automatic Positioning**: Labels positioned at cluster centroids
- **Cell Type Identification**: Labels identify different cell types
- **Visibility Control**: Toggle individual labels on/off

### Interactive Label Features

- **Draggable Labels**: Click and drag labels to reposition
- **Collision Avoidance**: Smart positioning to prevent overlap
- **Annotation List**: Side panel showing all available labels

### Label Controls

- **Show/Hide All**: Toggle all labels simultaneously
- **Individual Toggle**: Control visibility of specific labels
- **Reset Positions**: Return labels to default positions

## Data Export

### Exporting Selected Points

1. Select points of interest on the plot
2. Click "Export Selected Points" button
3. Choose save location in the file dialog
4. CSV file is generated with:
   - UMAP coordinates (x, y)
   - Point indices
   - Expression scores for selected genes
   - Total expression scores

### Export Format

```csv
index,x,y,gene1,gene2,...,total_score
0,1.234,-0.567,0.89,1.23,...,45.67
1,0.987,0.654,1.11,0.98,...,32.10
```

### Export Options

- **Sorted Output**: Points sorted by total expression score
- **Comprehensive Data**: All selected gene values included
- **Native Dialogs**: Use system file dialogs for familiar experience

## Performance Tips

### Optimizing Large Datasets

- **Use Categories**: Filter genes by category to reduce computation
- **Limit Selection**: Select fewer genes for faster rendering
- **Adjust Point Size**: Smaller points render faster
- **Close Other Applications**: Free up system resources

### Memory Management

- **IndexedDB Cache**: 500MB automatic cache with LRU eviction
- **Web Worker Processing**: Background processing prevents UI freezing
- **Efficient Data Structures**: Memory-optimized for large datasets

### Rendering Optimization

- **Canvas vs SVG**: Automatic switching based on dataset size
- **WebGL Acceleration**: Hardware-accelerated rendering when available
- **Progressive Loading**: UMAP coordinates load first, expression computed on-demand

## Troubleshooting

### Common Issues

#### Application Won't Start

- **Check System Requirements**: Ensure your system meets minimum specs
- **Update Graphics Drivers**: Ensure WebGL-compatible drivers
- **Check Antivirus**: Some security software may block execution

#### Data Loading Problems

- **Verify File Formats**: Ensure files match expected formats
- **Check Directory Structure**: All required files should be in the same directory
- **File Permissions**: Ensure read access to data files

#### Performance Issues

- **Reduce Dataset Size**: Use category filtering
- **Close Background Apps**: Free up system resources
- **Check Memory Usage**: Monitor system memory consumption

#### Rendering Problems

- **Update Browser Engine**: Ensure latest Chromium/Electron version
- **Check GPU Support**: Verify WebGL compatibility
- **Try Software Rendering**: Some systems may need software fallback

### Error Messages

- **"Unable to load resources"**: Check directory path and file formats
- **"WebGL not supported"**: Update graphics drivers or use software rendering
- **"Memory limit exceeded"**: Reduce dataset size or close other applications

## Keyboard Shortcuts

### Navigation

- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan the plot
- **Double Click**: Reset view

### Selection

- **Click**: Select individual point
- **Shift + Click**: Add to selection
- **Ctrl + Click**: Remove from selection
- **Esc**: Clear selection

### General

- **Ctrl+O**: Open resource directory
- **Ctrl+E**: Export selected points
- **Ctrl+R**: Reset plot view

---

## Support and Resources

For additional help, documentation, or to report issues:
- Check the project repository for updates
- Review the technical documentation
- Contact the development team for support

---

*MatriViz User Manual v1.0 - Last updated: 2024*