import { useState, useEffect } from 'react'

/* Components */
import Plot from './components/plot-hybrid'
import Row from './components/row'
import PlotOptions from './components/plotOptions'
import GeneCheckboxList from './components/gene-checkbox-list'

/* Services */

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
  const [resources, setResources] = useState<ResourceFile[]>([])
  const [currentResource, setCurrentResource] = useState<ResourceFile>()
  const [categories, setCategories] = useState<Record<string, string[]>>({})
  const [allGenes, setAllGenes] = useState([] as string[]) // Columns from parquet file
  const [geneListLoading, setGeneListLoading] = useState(false)

  const [baseData, setBaseData] = useState<DataPoint[]>([]) // Base UMAP coordinates without expression
  const [data, setData] = useState<DataPoint[]>([]) // Current data with expression scores
  const [labels, setLabels] = useState<LabelPoint[]>([])
  const [plotSelectedPoints, setPlotSelectedPoints] = useState<DataPoint[]>([]) // Lifted state from Plot

  // Update selectedData when plotSelectedPoints changes
  useEffect(() => {
    setSelectedData(plotSelectedPoints)
  }, [plotSelectedPoints])

  const [_loading, setLoading] = useState(true)
  const [_minorLoading, setMinorLoading] = useState(false) // Use only for non-blocking loading
  const [_dataLoading, setDataLoading] = useState(false)

  const [selectedGenes, setSelectedGenes] = useState(['All_Genes'] as string[])
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
    console.log('Starting directory change process...')
    window.resources.setResourceDir().then((result) => {
      if (result) {
        console.log('Directory changed to:', result)
        // Reset all state when directory changes
        setResourcesDir(result)
        setResources([])
        setCurrentResource(undefined)
        setCategories({})
        setAllGenes([])
        setBaseData([])
        setData([])
        setLabels([])
        setSelectedGenes(['All_Genes'])
        setSelectedCategory('')
        setSelectedData([])

        // Use the new directory directly for resource loading
        console.log('Loading resources from new directory...')
        // Use setTimeout to ensure state is reset before loading resources
        setTimeout(() => {
          populateResourcesWithDir(result)
        }, 0)
      }
    })
  }

  const populateResourcesWithDir = (dir: string): void => {
    if (resourcesLoading) {
      console.log('Resource loading already in progress, skipping...')
      return // Prevent multiple simultaneous calls
    }

    console.log('Starting resource loading from directory:', dir)
    setResourcesLoading(true)
    window.resources.getResourceList(dir).then((files) => {
      console.log('Resource files found:', files.length)
      if (files.length == 0) {
        // No files found.
        setLoading(false)
        console.error('No files found in directory:', dir)
        setResourcesLoading(false)
        return
      }
      setResources(files as ResourceFile[])

      // Always set the first resource when loading from a new directory
      console.log('Setting current resource to first file:', files[0].category_name)
      setCurrentResource(files[0])

      setResourcesLoading(false)
    }).catch((error) => {
      console.error('Error loading resources:', error)
      setResourcesLoading(false)
    })
  }

  const populateResources = (): void => {
    populateResourcesWithDir(resourcesDir)
  }

  useEffect(() => {
    window.resources.getResourceDir().then((dir) => {
      // Only set the directory if it exists and is valid
      if (dir && dir !== './') {
        setResourcesDir(dir)
        // Automatically load resources when directory is set from storage
        populateResourcesWithDir(dir)
      } else {
        // No valid directory stored, prompt user to select one
        handleResourceDirectorySelection()
      }
    })

    // Canvas rendering only - WebGL disabled
    console.log('Canvas rendering only - WebGL disabled');
  }, [])

  // Manual resource loading - only populate when explicitly triggered
  // Removed automatic population on directory change

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
        console.log('=== CENTROID DEBUG START ===')
        console.log('Loading centroid data for tissue:', currentResource.category_name)
        console.log('Centroid file path:', resourcesDir + currentResource.centroid_file)

        // First, let's check what columns are available in the centroid file
        try {
          console.log('Attempting to get columns via native parquet...')
          const availableColumns = await window.parquet.getParquetColumns(
            resourcesDir + currentResource.centroid_file
          )
          console.log('✅ Available columns in centroid file (native):', availableColumns)
          console.log('✅ Required columns found:',
            availableColumns.includes('cen_x') &&
            availableColumns.includes('cen_y') &&
            availableColumns.includes('Type'))
        } catch (columnError) {
          console.error('❌ Error getting centroid file columns (native):', columnError)
          console.error('❌ Error message:', columnError.message)
          console.error('❌ Error stack:', columnError.stack)
        }

        // Also try DuckDB to check columns
        try {
          console.log('Attempting to get columns via DuckDB...')
          const duckdbColumns = await window.duckdb.getParquetColumns(
            resourcesDir + currentResource.centroid_file
          )
          console.log('✅ Available columns in centroid file (DuckDB):', duckdbColumns)
          console.log('✅ Required columns found:',
            duckdbColumns.includes('cen_x') &&
            duckdbColumns.includes('cen_y') &&
            duckdbColumns.includes('Type'))
        } catch (duckdbColumnError) {
          console.error('❌ Error getting centroid file columns (DuckDB):', duckdbColumnError)
          console.error('❌ Error message:', duckdbColumnError.message)
          console.error('❌ Error stack:', duckdbColumnError.stack)
        }

        let centroidData

        // Try native parquet first
        try {
          console.log('Attempting native parquet query...')
          centroidData = await window.parquet.queryParquetFile(
            resourcesDir + currentResource.centroid_file,
            ['cen_x', 'cen_y', 'Type']
          )
          console.log('✅ Native parquet query completed')

          // Check if we got an error message instead of data
          if (typeof centroidData === 'string' && centroidData.includes('invalid parquet version')) {
            console.log('⚠️ Native parquet returned error message, triggering DuckDB fallback')
            console.log('⚠️ Error content:', centroidData)
            throw new Error(`Native parquet version error: ${centroidData}`)
          }

          console.log('✅ Centroid data loaded via native parquet')
        } catch (nativeError) {
          console.error('❌ Native parquet query failed:', nativeError)
          console.error('❌ Native error message:', nativeError.message)
          console.error('❌ Native error stack:', nativeError.stack)

          // Fallback to DuckDB
          try {
            console.log('🔄 Falling back to DuckDB for centroid data')
            console.log('🔄 DuckDB file path:', resourcesDir + currentResource.centroid_file)

            // Check if DuckDB is available
            if (!window.duckdb || !window.duckdb.queryParquetFile) {
              throw new Error('DuckDB API not available')
            }
            console.log('✅ DuckDB API is available')

            console.log('🔄 Starting DuckDB query...')
            const fullCentroidPath = resourcesDir + currentResource.centroid_file
            console.log('🔄 Full centroid file path for DuckDB:', fullCentroidPath)
            console.log('🔄 Expected columns:', ['cen_x', 'cen_y', 'Type'])
            const duckdbResult = await window.duckdb.queryParquetFile(
              fullCentroidPath,
              ['cen_x', 'cen_y', 'Type']
            )
            console.log('✅ DuckDB query completed successfully')
            console.log('✅ DuckDB result structure:', duckdbResult)
            console.log('✅ DuckDB columns:', duckdbResult.columns)
            console.log('✅ DuckDB data length:', duckdbResult.data?.length)

            // Convert DuckDB array format to object format
            if (duckdbResult.data && duckdbResult.data.length > 0) {
              console.log('🔄 Converting DuckDB array format to object format...')
              centroidData = duckdbResult.data.map((row: any[]) => {
                const obj: Record<string, unknown> = {}
                duckdbResult.columns.forEach((col: string, index: number) => {
                  obj[col] = row[index]
                })
                return obj
              })
              console.log('✅ DuckDB data converted to object format')
              console.log('✅ First converted record:', centroidData[0])
            } else {
              centroidData = duckdbResult.data
              console.log('⚠️ DuckDB returned empty data array')
            }

            console.log('✅ Centroid data loaded via DuckDB fallback')
          } catch (duckdbError) {
            console.error('❌ DuckDB fallback also failed:', duckdbError)
            console.error('❌ DuckDB error details:', {
              message: duckdbError.message,
              stack: duckdbError.stack
            })
            throw new Error(`Both native parquet and DuckDB failed to load centroid data: ${nativeError.message}, ${duckdbError.message}`)
          }
        }

        console.log('📊 Raw centroid data received:', centroidData)
        console.log('📊 Type of centroidData:', typeof centroidData)
        console.log('📊 Is centroidData an array?', Array.isArray(centroidData))
        if (centroidData && typeof centroidData === 'object') {
          console.log('📊 centroidData keys:', Object.keys(centroidData))
        }

        // Check if we actually got an array of data
        if (!Array.isArray(centroidData)) {
          console.error('❌ Expected array but got:', typeof centroidData)
          console.error('❌ Data content:', JSON.stringify(centroidData))
          throw new Error(`Expected array but got: ${typeof centroidData}. Data: ${JSON.stringify(centroidData)}`)
        }

        console.log('📊 Number of centroid records:', centroidData.length)

        if (centroidData.length > 0) {
          console.log('📊 First centroid record:', centroidData[0])
          console.log('📊 First record cen_x type:', typeof centroidData[0].cen_x)
          console.log('📊 First record cen_y type:', typeof centroidData[0].cen_y)
          console.log('📊 First record Type type:', typeof centroidData[0].Type)
        }

        const processedCentroidData = centroidData.map((d) => ({
          x: parseFloat(d.cen_x as string),
          y: parseFloat(d.cen_y as string),
          label: d.Type as string,
          color: null
        }))
        console.log('✅ Loaded centroid data immediately:', processedCentroidData.length, 'labels')
        if (processedCentroidData.length > 0) {
          console.log('✅ First processed centroid:', processedCentroidData[0])
        }
        setLabels(processedCentroidData)
        console.log('=== CENTROID DEBUG END ===')
      } catch (error) {
        console.error('❌ FINAL ERROR loading centroid data:', error)
        console.error('❌ Error details:', {
          directory: resourcesDir,
          centroidFile: currentResource.centroid_file,
          fullPath: resourcesDir + currentResource.centroid_file
        })
        console.error('❌ Error stack:', error.stack)
        // Set empty labels as fallback - the application should still work without centroids
        setLabels([])
        console.log('=== CENTROID DEBUG END WITH ERROR ===')
      }
    }

    loadCentroidData()
  }, [currentResource, resourcesDir])

  useEffect(() => {
    if (!currentResource) return

    const parquetFilePath = resourcesDir + currentResource.parquet_file

    // Fetch gene list
    setGeneListLoading(true)

    // Try DuckDB first, fallback to native parquet service
    const fetchColumns = async (): Promise<void> => {
      try {
        const columns = await window.duckdb.getParquetColumns(parquetFilePath)
        setAllGenes(columns)
      } catch (duckdbError) {
        console.error('DuckDB column fetch failed, falling back to native service:', duckdbError)
        // Fallback to native parquet service
        const columns = await window.parquet.getParquetColumns(parquetFilePath)
        setAllGenes(columns)
      } finally {
        setGeneListLoading(false)
      }
    }

    fetchColumns()
  }, [currentResource, resourcesDir])

  const handleResourceChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setLoading(true)
    const selectedResource = event.target.value
    const newResource = resources.find((resource) => resource.category_name === selectedResource)
    setCurrentResource(newResource)
    setSelectedCategory('default')
    // Automatically select All_Genes when switching tissues
    setSelectedGenes(['All_Genes'])
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

      console.log('Fetching UMAP coordinates from DuckDB');
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
        setBaseData(processedData)
        setData(processedData)
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

        setBaseData(processedData)
        setData(processedData)
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
      if (!currentResource || selectedGenes.length === 0 || baseData.length === 0) {
        return
      }

      console.log('Computing gene expression for resource:', currentResource.category_name);
      console.log('Selected genes:', selectedGenes);
      console.log('Selected points count:', selectedData.length);

      // Determine if we should compute for subset or all points
      const computeForSubset = selectedData.length > 0;
      const targetIndices = computeForSubset ? selectedData.map(p => p.index) : baseData.map(p => p.index);

      console.log('Computing expression for:', computeForSubset ? 'subset' : 'all points');

      console.log('Computing gene expression data with DuckDB');
      setMinorLoading(true)
      try {
        const selection = selectedGenes

        // Use DuckDB for gene expression calculations
        console.log('Using DuckDB for gene expression calculations');
        try {
          // Build WHERE clause for subset computation if needed
          const whereClause = computeForSubset ? `WHERE index IN (${targetIndices.map(idx => `'${idx}'`).join(', ')})` : '';

          const result = await window.duckdb.queryParquetFileWithExpression(
            resourcesDir + currentResource.parquet_file,
            ['umap_1', 'umap_2', 'index'],
            selection,
            whereClause
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
        }
      } catch (error) {
        console.error('Error computing gene expression:', error)
      } finally {
        setMinorLoading(false)
      }
    }

    computeGeneExpression()
  }, [selectedGenes, currentResource, resourcesDir, baseData, selectedData])

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




  return (
    <>
      <div className={styles.container}>
        <div className={styles.panel}>
          <h1>MatriViz</h1>
          <h2>Category</h2>
          <div className={styles.categoryContainer}>
            <div>
              <p>
                Current directory: {resourcesDir}
              </p>
              <div className={styles.directoryActions}>
                <button onClick={(): void => handleResourceDirectorySelection()}>
                  Change Directory
                </button>
                {resources.length === 0 && (
                  <button onClick={(): void => populateResources()}>
                    Load Resources
                  </button>
                )}
              </div>
            </div>
            {resources.length > 0 && (
              <>
                <select onChange={handleResourceChange}>
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
              <PlotOptions
                plotState={plotState}
                setPlotState={setPlotState}
                onClose={() => setShowPlotOptions(false)}
              />
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
