import { LabelPoint } from '../types'
import styles from '../assets/annotation-list.module.css'
import { useState, useMemo } from 'react'

interface AnnotationListProps {
  labels: LabelPoint[]
  onAnnotationHover: (label: LabelPoint | null) => void
  hoveredAnnotation: LabelPoint | null
  selectedAnnotation: LabelPoint | null
  onAnnotationSelect: (label: LabelPoint | null) => void
  visibleLabels: Set<string>
  onToggleVisibility: (labelName: string) => void
}

const AnnotationList = ({
  labels,
  onAnnotationHover,
  hoveredAnnotation,
  selectedAnnotation,
  onAnnotationSelect,
  visibleLabels,
  onToggleVisibility
}: AnnotationListProps): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState('')

  const handleMouseEnter = (label: LabelPoint) => {
    onAnnotationHover(label)
  }

  const handleMouseLeave = () => {
    onAnnotationHover(null)
  }

  const handleClick = (label: LabelPoint) => {
    onAnnotationSelect(label)
  }

  // Remove duplicates and sort alphabetically, then filter by search term
  const filteredLabels = useMemo(() => {
    const uniqueLabels = Array.from(
      new Map(labels.map(label => [label.label, label])).values()
    ).sort((a, b) => a.label.localeCompare(b.label))

    if (!searchTerm.trim()) {
      return uniqueLabels
    }

    const searchLower = searchTerm.toLowerCase()
    return uniqueLabels.filter(label =>
      label.label.toLowerCase().includes(searchLower)
    )
  }, [labels, searchTerm])

  return (
    <div className={styles.annotationList}>
      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search labels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Filtered Labels List */}
      {filteredLabels.map((label) => {
        const isVisible = visibleLabels.size === 0 || visibleLabels.has(label.label)
        return (
          <div
            key={label.label}
            className={`${styles.annotationItem} ${
              hoveredAnnotation?.label === label.label ||
              selectedAnnotation?.label === label.label
                ? styles.highlighted
                : ''
            }`}
            onMouseEnter={() => handleMouseEnter(label)}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleClick(label)}
          >
            <input
              type="checkbox"
              className={styles.visibilityCheckbox}
              checked={isVisible}
              onChange={(e) => {
                e.stopPropagation() // Prevent triggering the parent click
                onToggleVisibility(label.label)
              }}
              title={isVisible ? 'Hide label' : 'Show label'}
            />
            <span className={styles.labelText}>{label.label}</span>
          </div>
        )
      })}

      {/* No results message */}
      {filteredLabels.length === 0 && (
        <div className={styles.noResults}>
          No labels found matching "{searchTerm}"
        </div>
      )}
    </div>
  )
}

export default AnnotationList