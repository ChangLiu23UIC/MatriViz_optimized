# MatriViz

<div align="center">

**MatriViz** is an Electron-based desktop application for visualizing gene expression data using UMAP projections. The application enables interactive exploration of gene expression patterns across different cell types through scatter plots with advanced performance optimizations.

</div>

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Data Format](#data-format)

## 📊 Overview

MatriViz is designed for bioinformatics researchers and data scientists working with single-cell RNA sequencing data. 

## ✨ Features

### 🎨 Visualization
- **Interactive Scatter Plots**: Zoom, pan, and select points in real-time
- **Gene Expression Overlay**: Color points by gene expression levels
- **Cell Type Categorization**: Group and visualize different cell populations


## 🏗️ Architecture



### Data Flow

```
Resource Directory → JSON Config → Parquet Files → Data Processing → Visualization
```

## 📥 Installation

### For End Users

1. **Download the latest release** for your platform from the [Releases](https://github.com/your-org/matriviz/releases) page
2. **Download the dataset** separately:
   ```
   https://uofi.box.com/s/mge2war2cnyzougteup2mga2uem7ylaj
   ```
3. **Unzip the dataset** to a local directory
4. **Launch MatriViz** and click "Select Resource Directory"
5. **Point to the unzipped dataset folder**

### For Developers

```bash
# Clone the repository
git clone https://github.com/your-org/matriviz.git
cd matriviz

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run the built application
npm run start
```

## 🚀 Usage

### Basic Workflow

1. **Select Resource Directory**: Choose a directory containing `.json` files with `fileType: "matriviz"` and corresponding parquet files
2. **Load Dataset**: The application automatically detects and loads available datasets
3. **Visualize**: Interact with the UMAP projection using mouse/touch controls
4. **Analyze**: Select points to view gene expression patterns and cell type distributions
5. **Export**: Save visualizations or export data as CSV

### Controls

- **Zoom**: Scroll wheel or pinch gesture
- **Pan Annotation**: Click and drag annotation
- **Select**: Draw Lasso or rectangle
- **Reset View**: Double-click or use reset button

## 🛠️ Development

### Prerequisites

- Node.js 18+ and npm
- Git


## 📁 Data Format

### Resource Files Structure

Application expects resource directories containing:

```
resource-directory/
├── dataset.json          # JSON with fileType: "matriviz"
├── data.parquet         # Gene expression data with UMAP coordinates
└── categories.json      # Gene groupings 
└── centroid.json        # Cell type annotations
```

### JSON Configuration Example

```json
{
  "fileType": "matriviz",
  "version": "1.1.0",
  "category_name": "test",
  "category_description": "test (RNA reference)",
  "parquet_file": "test_rna_v1.parquet",
  "category_file": "test_rna_v1_category.json",
  "centroid_file": "test_rna_centroid_v1.0.parquet"
}
```

