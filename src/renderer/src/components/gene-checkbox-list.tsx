import { useState, useMemo } from 'react'
import styles from '../assets/gene-checkbox-list.module.css'

interface GeneCheckboxListProps {
  allGenes: string[]
  selectedGenes: string[]
  onSelectionChange: (selectedGenes: string[]) => void
  disabled?: boolean
}

const GeneCheckboxList = ({
  allGenes,
  selectedGenes,
  onSelectionChange,
  disabled = false
}: GeneCheckboxListProps): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllGenes, setShowAllGenes] = useState(false)

  // Filter genes based on search term
  const filteredGenes = useMemo(() => {
    if (!searchTerm) return allGenes
    const lowerSearch = searchTerm.toLowerCase()
    return allGenes.filter(gene =>
      gene.toLowerCase().includes(lowerSearch)
    )
  }, [allGenes, searchTerm])

  // Separate selected and unselected genes
  const { selectedGeneList, unselectedGeneList } = useMemo(() => {
    const selected = filteredGenes.filter(gene => selectedGenes.includes(gene))
    const unselected = filteredGenes.filter(gene => !selectedGenes.includes(gene))

    // Limit unselected genes if not showing all
    const limitedUnselected = showAllGenes ? unselected : unselected.slice(0, 50)

    return {
      selectedGeneList: selected,
      unselectedGeneList: limitedUnselected
    }
  }, [filteredGenes, selectedGenes, showAllGenes])

  const handleGeneToggle = (gene: string, checked: boolean) => {
    let newSelectedGenes: string[]

    if (gene === 'All_Genes') {
      // All_Genes is mutually exclusive with other genes
      if (checked) {
        newSelectedGenes = ['All_Genes']
      } else {
        newSelectedGenes = []
      }
    } else {
      // Individual gene selection
      if (checked) {
        // Add gene, but remove All_Genes if present
        newSelectedGenes = [...selectedGenes.filter(g => g !== 'All_Genes'), gene]
      } else {
        // Remove gene
        newSelectedGenes = selectedGenes.filter(g => g !== gene)
      }
    }

    onSelectionChange(newSelectedGenes)
  }

  const handleSelectAll = () => {
    onSelectionChange(['All_Genes'])
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const totalSelected = selectedGenes.includes('All_Genes')
    ? 'All Genes'
    : `${selectedGenes.length} selected out of ${allGenes.length} genes`

  return (
    <div className={styles.container}>
      {/* Selection Summary */}
      <div className={styles.summary}>
        <span className={styles.summaryText}>{totalSelected}</span>
        <div className={styles.summaryActions}>
          <button
            onClick={handleSelectAll}
            disabled={disabled || selectedGenes.includes('All_Genes')}
            className={styles.actionButton}
          >
            Select All
          </button>
          <button
            onClick={handleClearAll}
            disabled={disabled || selectedGenes.length === 0}
            className={styles.actionButton}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search for a gene..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
          className={styles.searchInput}
        />
      </div>

      {/* Selected Genes Section */}
      {selectedGeneList.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Selected Genes</div>
          <div className={styles.geneList}>
            {selectedGeneList.map(gene => (
              <label key={gene} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={true}
                  onChange={(e) => handleGeneToggle(gene, !e.target.checked)}
                  disabled={disabled}
                />
                <span className={styles.checkboxLabel}>{gene}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Available Genes Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          Available Genes
          {unselectedGeneList.length < filteredGenes.length && (
            <span className={styles.count}>
              (showing {unselectedGeneList.length} of {filteredGenes.length})
            </span>
          )}
        </div>
        <div className={styles.geneList}>
          {unselectedGeneList.map(gene => (
            <label key={gene} className={styles.checkboxItem}>
              <input
                type="checkbox"
                checked={false}
                onChange={(e) => handleGeneToggle(gene, e.target.checked)}
                disabled={disabled}
              />
              <span className={styles.checkboxLabel}>{gene}</span>
            </label>
          ))}
        </div>

        {/* Show More/Less Toggle */}
        {filteredGenes.length > 50 && (
          <button
            onClick={() => setShowAllGenes(!showAllGenes)}
            className={styles.toggleButton}
          >
            {showAllGenes ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
    </div>
  )
}

export default GeneCheckboxList