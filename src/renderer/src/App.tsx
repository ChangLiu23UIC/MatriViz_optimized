import { useState, useEffect } from 'react'

/* Components */
import Plot from './components/plot-hybrid'
import Row from './components/row'
import PlotOptions from './components/plotOptions'
import GeneCheckboxList from './components/gene-checkbox-list'

/* Services */
import { datasetCache } from './services/dataset-cache'

/* Styles */
import styles from './assets/app.module.css'

/* Types */
import { DataPoint, LabelPoint, PlotState } from './types'
import { ResourceFile } from '../../types/types'

const App = (): JSX.Element => {
  const defaultMinColor = '#ffff00'
  const defaultMaxColor = '#ff0000'

  const [resourcesDir, setResourcesDir] = useState<string>('./')
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [lastResourcesDir, setLastResourcesDir] = useState<string>('./')
  const [resources, setResources] = useState<ResourceFile[]>([])
  const [currentResource, setCurrentResource] = useState<ResourceFile>()
  const [categories, setCategories] = useState<Record<string, string[]>>({})
  const [allGenes, setAllGenes] = useState([] as string[]) // Columns from parquet file
  const [geneListLoading, setGeneListLoading] = useState(false)
  const [geneCache, setGeneCache] = useState<Record<string, string[]>>({}) // Cache for gene lists by parquet file
  const [dataCache, setDataCache] = useState<Record<string, DataPoint[]>>({}) // Cache for processed data by parquet file + genes

  const [data, setData] = useState<DataPoint[]>([])
  const [labels, setLabels] = useState<LabelPoint[]>([])
  const [plotSelectedPoints, setPlotSelectedPoints] = useState<DataPoint[]>([]) // Lifted state from Plot

  // Update selectedData when plotSelectedPoints changes
  useEffect(() => {
    setSelectedData(plotSelectedPoints)
  }, [plotSelectedPoints])

  const [_loading, setLoading] = useState(true)
  const [_minorLoading, setMinorLoading] = useState(false) // Use only for non-blocking loading
  const [_dataLoading, setDataLoading] = useState(false)

  const [selectedGenes, setSelectedGenes] = useState([] as string[])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedData, setSelectedData] = useState<DataPoint[]>([])
  const [showPlotOptions, setShowPlotOptions] = useState(false)

  const [plotState, setPlotState] = useState<PlotState>({
    minScore: 0,
    maxScore: 10,
    autoMinScore: true,
    autoMaxScore: true,
    minColor: defaultMinColor,
    maxColor: defaultMaxColor,
    pointSize: 2,
    transformX: 0,
    transformY: 0,
    toggleLabels: true,
    toggleGridlines: true
  })

  const handleResourceDirectorySelection = (): void => {
    window.resources.setResourceDir().then((result) => {
      setResourcesDir(result)
    })
  }

  const populateResources = (): void => {
    if (resourcesLoading) return // Prevent multiple simultaneous calls

    setResourcesLoading(true)
    window.resources.getResourceList(resourcesDir).then((files) => {
      if (files.length == 0) {
        // No files found.
        setLoading(false)
        console.error('No files found in directory:', resourcesDir)
        setResourcesLoading(false)
        return
      }
      setResources(files as ResourceFile[])
      if (currentResource === undefined && files.length > 0)
        // If no resource is selected, select the first one
        setCurrentResource(files[0])
      setResourcesLoading(false)
    }).catch((error) => {
      console.error('Error loading resources:', error)
      setResourcesLoading(false)
    })
  }

  useEffect(() => {
    window.resources.getResourceDir().then((dir) => {
      setResourcesDir(dir)
    })

    // Canvas rendering only - WebGL disabled
    console.log('Canvas rendering only - WebGL disabled');
  }, [])

  useEffect(() => {
    if (resourcesDir !== lastResourcesDir) {
      setLastResourcesDir(resourcesDir)
      populateResources()
    }
  }, [resourcesDir, lastResourcesDir])

  useEffect(() => {
    if (!currentResource) return
    const categoryPath = resourcesDir + currentResource.category_file
    window.resources
      .getResourceCategories(categoryPath)
      .then((categories) => {
        setCategories(categories)
      })
      .catch((error) => {
        console.error('Error loading categories for', currentResource.category_name + ':', error)
        console.error('Category file path:', categoryPath)
        // Set empty categories as fallback
        setCategories({})
      })
  }, [currentResource])

  // Load centroid labels immediately when tissue changes
  useEffect(() => {
    if (!currentResource) return

    const loadCentroidData = async (): Promise<void> => {
      try {
        console.log('Loading centroid data for tissue:', currentResource.category_name)
        const centroidData = await window.parquet.queryParquetFile(
          resourcesDir + currentResource.centroid_file,
          ['cen_x', 'cen_y', 'Type']
        )

        const processedCentroidData = centroidData.map((d) => ({
          x: parseFloat(d.cen_x as string),
          y: parseFloat(d.cen_y as string),
          label: d.Type as string,
          color: null
        }))
        console.log('Loaded centroid data immediately:', processedCentroidData.length, 'labels')
        if (processedCentroidData.length > 0) {
          console.log('First centroid:', processedCentroidData[0])
        }
        setLabels(processedCentroidData)
      } catch (error) {
        console.error('Error loading centroid data:', error)
      }
    }

    loadCentroidData()
  }, [currentResource, resourcesDir])

  useEffect(() => {
    if (!currentResource) return

    const parquetFilePath = resourcesDir + currentResource.parquet_file

    // Check if gene list is already cached
    if (geneCache[parquetFilePath]) {
      setAllGenes(geneCache[parquetFilePath])
      return
    }

    // If not cached, fetch and cache it
    setGeneListLoading(true)

    // Try DuckDB first, fallback to native parquet service
    const fetchColumns = async (): Promise<void> => {
      try {
        const columns = await window.duckdb.getParquetColumns(parquetFilePath)
        setAllGenes(columns)
        setGeneCache((prev) => ({ ...prev, [parquetFilePath]: columns }))
      } catch (duckdbError) {
        console.error('DuckDB column fetch failed, falling back to native service:', duckdbError)
        // Fallback to native parquet service
        const columns = await window.parquet.getParquetColumns(parquetFilePath)
        setAllGenes(columns)
        setGeneCache((prev) => ({ ...prev, [parquetFilePath]: columns }))
      } finally {
        setGeneListLoading(false)
      }
    }

    fetchColumns()
  }, [currentResource, geneCache, resourcesDir])

  const handleResourceChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setLoading(true)
    const selectedResource = event.target.value
    const newResource = resources.find((resource) => resource.category_name === selectedResource)
    setCurrentResource(newResource)
    setSelectedCategory('default')
    setSelectedGenes([])
  }

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setMinorLoading(true)
    const selectedCategory = event.target.value
    if (selectedCategory === 'default' || selectedCategory === undefined) setSelectedGenes([])
    else setSelectedGenes(categories[selectedCategory])
    setSelectedCategory(selectedCategory)
  }



  // Phase 1: Load UMAP coordinates when tissue changes (fast)
  useEffect(() => {
    const loadUMAPCoordinates = async (): Promise<void> => {
      if (!currentResource) {
        console.log('No current resource selected');
        return
      }

      console.log('Loading UMAP coordinates for resource:', currentResource.category_name);

      // Create cache key for UMAP coordinates only
      const umapCacheKey = datasetCache.generateCacheKey(
        currentResource.parquet_file,
        [], // No genes - just UMAP coordinates
        ''  // No highlighted gene
      )

      // Check if UMAP coordinates are already cached in IndexedDB
      try {
        const cachedData = await datasetCache.get(umapCacheKey);
        if (cachedData) {
          console.log('Using cached UMAP coordinates for key:', umapCacheKey);
          setData(cachedData)
          setDataLoading(false)
          setLoading(false)
          setMinorLoading(false)
          return
        }
      } catch (cacheError) {
        console.log('IndexedDB cache check failed, falling back to memory cache:', cacheError);
      }

      // Check if UMAP coordinates are cached in memory
      const memoryCacheKey = `${currentResource.parquet_file}_umap_only`
      if (dataCache[memoryCacheKey]) {
        console.log('Using memory cached UMAP coordinates for key:', memoryCacheKey);
        setData(dataCache[memoryCacheKey])
        setDataLoading(false)
        setLoading(false)
        setMinorLoading(false)
        return
      }

      console.log('No cached UMAP coordinates found, fetching from DuckDB');
      setDataLoading(true)
      try {
        // Always fetch only UMAP coordinates initially
        const result = await window.duckdb.queryParquetFile(
          resourcesDir + currentResource.parquet_file,
          ['umap_1', 'umap_2', 'index']
        )

        console.log('UMAP data fetched via DuckDB, rows:', result.data.length);

        const processedData = result.data.map((row: any[]) => ({
          x: parseFloat(row[0] as string),
          y: parseFloat(row[1] as string),
          index: row[2] as string,
          score: 0,
          color: null,
          hasExpressionData: false  // Flag to indicate no gene expression data
        }))

        console.log('Processed UMAP points:', processedData.length);
        setData(processedData)

        // Cache UMAP coordinates in memory
        setDataCache((prev) => ({ ...prev, [memoryCacheKey]: processedData }))

        // Cache UMAP coordinates in IndexedDB
        try {
          const query = 'SELECT umap_1, umap_2, index FROM parquet_file';
          await datasetCache.set(umapCacheKey, processedData, query);
          console.log('UMAP coordinates cached in IndexedDB with key:', umapCacheKey);
        } catch (cacheError) {
          console.error('Failed to cache UMAP coordinates in IndexedDB:', cacheError);
        }
      } catch (duckdbError) {
        console.error('DuckDB query failed, falling back to native parquet service:', duckdbError);
        // Fallback to native parquet service
        const fetchedData = await window.parquet.queryParquetFile(
          resourcesDir + currentResource.parquet_file,
          ['umap_1', 'umap_2', 'index']
        )

        const processedData = fetchedData.map((row: any) => ({
          x: parseFloat(row.umap_1 as string),
          y: parseFloat(row.umap_2 as string),
          index: row.index as string,
          score: 0,
          color: null,
          hasExpressionData: false
        }))

        setData(processedData)
        setDataCache((prev) => ({ ...prev, [memoryCacheKey]: processedData }))
      } finally {
        setDataLoading(false)
        setLoading(false)
        setMinorLoading(false)
      }
    }

    loadUMAPCoordinates()
  }, [currentResource, resourcesDir])

  // Phase 2: Compute gene expression when genes are selected (on-demand)
  useEffect(() => {
    const computeGeneExpression = async (): Promise<void> => {
      // Only compute gene expression if genes are actually selected
      if (!currentResource || selectedGenes.length === 0) {
        return
      }

      console.log('Computing gene expression for resource:', currentResource.category_name);
      console.log('Selected genes:', selectedGenes);

      // Create cache key for this specific gene combination
      const cacheKey = datasetCache.generateCacheKey(
        currentResource.parquet_file,
        selectedGenes,
        ''
      )

      // Check if gene expression data is already cached in IndexedDB
      try {
        const cachedData = await datasetCache.get(cacheKey);
        if (cachedData) {
          console.log('Using cached gene expression data for key:', cacheKey);
          setData(cachedData)
          setMinorLoading(false)
          return
        }
      } catch (cacheError) {
        console.log('IndexedDB cache check failed, falling back to memory cache:', cacheError);
      }

      // Check if gene expression data is cached in memory
      const memoryCacheKey = `${currentResource.parquet_file}_${[...selectedGenes].sort().join('_')}`
      if (dataCache[memoryCacheKey]) {
        console.log('Using memory cached gene expression data for key:', memoryCacheKey);
        setData(dataCache[memoryCacheKey])
        setMinorLoading(false)
        return
      }

      console.log('No cached gene expression data found, computing with DuckDB');
      setMinorLoading(true)
      try {
        const selection = selectedGenes

        // Use DuckDB for gene expression calculations
        console.log('Using DuckDB for gene expression calculations');
        try {
          const result = await window.duckdb.queryParquetFileWithExpression(
            resourcesDir + currentResource.parquet_file,
            ['umap_1', 'umap_2', 'index'],
            selection
          )

          const processedData = result.data.map((row: any[]) => ({
            x: parseFloat(row[0] as string),
            y: parseFloat(row[1] as string),
            index: row[2] as string,
            score: parseFloat(row[3] as string),
            color: null,
            hasExpressionData: true  // Flag to indicate gene expression data is present
          }))

          // Sort by score for better visualization
          processedData.sort((a, b) => a.score - b.score)

          // Debug: log score range
          const scores = processedData.map(p => p.score)
          const minScore = Math.min(...scores)
          const maxScore = Math.max(...scores)
          console.log('Gene expression score range:', minScore, 'to', maxScore)

          setData(processedData)

          // Cache gene expression data in memory
          setDataCache((prev) => ({ ...prev, [memoryCacheKey]: processedData }))

          // Cache gene expression data in IndexedDB
          try {
            const query = `SELECT umap_1, umap_2, index, AVG(${selection.join(' + ')}) as avg_expression FROM parquet_file GROUP BY umap_1, umap_2, index`;
            await datasetCache.set(cacheKey, processedData, query);
            console.log('Gene expression data cached in IndexedDB with key:', cacheKey);
          } catch (cacheError) {
            console.error('Failed to cache gene expression data in IndexedDB:', cacheError);
          }
        } catch (duckdbError) {
          console.error('DuckDB query failed, falling back to native parquet service:', duckdbError);
          // Fallback to native parquet service
          const fetchedData = await window.parquet.queryParquetFile(
            resourcesDir + currentResource.parquet_file,
            [...selection, 'umap_1', 'umap_2', 'index']
          )

          const processedData = new Array(fetchedData.length)
          for (let i = 0; i < fetchedData.length; i++) {
            const d = fetchedData[i]
            let score = 0
            for (const gene of selection) {
              score += parseFloat(d[gene] as string)
            }
            processedData[i] = {
              x: parseFloat(d.umap_1 as string),
              y: parseFloat(d.umap_2 as string),
              index: d.index as string,
              score: score,
              color: null,
              hasExpressionData: true
            }
          }

          processedData.sort((a, b) => a.score - b.score)
          setData(processedData)
          setDataCache((prev) => ({ ...prev, [memoryCacheKey]: processedData }))
        }
      } catch (error) {
        console.error('Error computing gene expression:', error)
      } finally {
        setMinorLoading(false)
      }
    }

    computeGeneExpression()
  }, [selectedGenes, currentResource, resourcesDir])

  const handleSelectedData = (selectedData: DataPoint[]): void => {
    setSelectedData(selectedData)
  }

  const clearSelectedData = (): void => {
    // Only clear plotSelectedPoints - let the effect in plot.tsx handle updating selectedData
    setPlotSelectedPoints([])
  }

  // Recalculate selected points when data or selectedGenes change
  useEffect(() => {
    if (selectedData.length === 0 || data.length === 0) return

    // Create a map of current data for fast lookup
    const currentDataMap = new Map(data.map(point => [point.index, point]))

    // Update selected points with new scores from current data
    const updatedSelectedData = selectedData.map(selectedPoint => {
      const currentPoint = currentDataMap.get(selectedPoint.index)
      if (currentPoint) {
        // Return the selected point with updated score from current data
        return {
          ...selectedPoint,
          score: currentPoint.score,
          color: currentPoint.color
        }
      }
      // If point no longer exists in current data, keep it as is
      return selectedPoint
    })

    setSelectedData(updatedSelectedData)
  }, [data, selectedGenes])


  const clearDataCache = async (): Promise<void> => {
    // Clear memory cache
    setDataCache({})

    // Clear IndexedDB cache
    try {
      await datasetCache.clear();
      console.log('IndexedDB cache cleared');
    } catch (error) {
      console.error('Failed to clear IndexedDB cache:', error);
    }
  }


  return (
    <>
      <div className={styles.container}>
        <div className={styles.panel}>
          <h1>MatriViz</h1>
          <h2>Category</h2>
          <div className={styles.categoryContainer}>
            {resources.length === 0 ? (
              <div>
                <p>
                  No resources found in directory {resourcesDir} <br></br>Please select a resource
                  directory:
                </p>
                <button onClick={(): void => handleResourceDirectorySelection()}>
                  Select Resource Directory
                </button>
              </div>
            ) : (
              <>
                <select onClick={populateResources} onChange={handleResourceChange}>
                  {resources.map((resource) => (
                    <option key={resource.category_name} value={resource.category_name}>
                      {resource.category_description}
                    </option>
                  ))}
                </select>
                <select onChange={handleCategoryChange} value={selectedCategory}>
                  <option value="default">Category</option>
                  {Object.keys(categories).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <h2>Selected Genes</h2>
          <GeneCheckboxList
            allGenes={allGenes}
            selectedGenes={selectedGenes}
            onSelectionChange={setSelectedGenes}
            disabled={geneListLoading}
          />

          <div className={styles.cacheManagement}>
            <button onClick={clearDataCache}>
              Clear Cache ({Object.keys(dataCache).length} datasets cached)
            </button>
          </div>

          <div className={styles.selectedHeader}>
            <h2>Selected Points ({selectedData.length})</h2>
            <div className={styles.selectedActions}>
              <button onClick={clearSelectedData} disabled={selectedData.length === 0}>
                Clear
              </button>
              <button
                onClick={(): void => {
                  window.export.exportCSV(
                    selectedData as unknown as Record<string, unknown>[],
                    selectedGenes,
                    resourcesDir + currentResource?.parquet_file
                  )
                }}
                disabled={selectedData.length === 0}
              >
                Export...
              </button>
            </div>
          </div>

          {selectedData.length > 0 ? (
            <>
              <div className={styles.selectedHeaderRow}>
                <span>
                  <b>Index</b>
                </span>
                <span>
                  <b>Score</b>
                </span>
              </div>
              <div className={styles.selectedContainer}>
                {selectedData.map((point, i) => (
                  <Row
                    key={`selected-point-${i}`}
                    index={point.index}
                    score={point.score.toFixed(3)}
                    color={point.color || 'white'}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className={styles.selectedMessage}>Drag mouse over plot to select points.</p>
          )}
        </div>
        <div className={styles.plotArea}>
          {/* Plot Options Button - Top Right Corner */}
          <div className={styles.plotOptionsButtonContainer}>
            <button
              onClick={(): void => setShowPlotOptions(!showPlotOptions)}
              className={styles.plotOptionsButton}
            >
              {showPlotOptions ? 'Hide Plot Options' : 'Plot Options'}
            </button>
          </div>

          {/* Plot Options Panel - Centered Over Plot */}
          {showPlotOptions && (
            <div className={styles.plotOptionsOverlay}>
              <div className={styles.plotOptionsPanel}>
                <PlotOptions plotState={plotState} setPlotState={setPlotState} />
              </div>
            </div>
          )}

          {/* Temporarily disabled loading overlays for testing */}
          {/* {dataLoading && (
            <div className={styles.dataLoadingOverlay}>
              <Loading height={60} width={60} text={true} />
              <p>Loading data...</p>
            </div>
          )}
          {minorLoading && (
            <Loading className={styles.minorLoading} height={40} width={40} text={false} />
          )}
          {loading ? (
            <Loading className={styles.loading} height={80} width={80} text={true} />
          ) : ( */}
            <Plot
              data={data}
              labels={labels}
              plotState={plotState}
              onSelectedData={handleSelectedData}
              selectedPoints={plotSelectedPoints}
              setSelectedPoints={setPlotSelectedPoints}
              setPlotState={setPlotState}
            />
          {/* )} */}
        </div>
      </div>
    </>
  )
}

export default App
