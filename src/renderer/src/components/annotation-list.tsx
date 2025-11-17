import { LabelPoint } from '../types'
import styles from '../assets/annotation-list.module.css'

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
  const handleMouseEnter = (label: LabelPoint) => {
    onAnnotationHover(label)
  }

  const handleMouseLeave = () => {
    onAnnotationHover(null)
  }

  const handleClick = (label: LabelPoint) => {
    onAnnotationSelect(label)
  }

  // Remove duplicates and sort alphabetically
  const uniqueLabels = Array.from(
    new Map(labels.map(label => [label.label, label])).values()
  ).sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div className={styles.annotationList}>
      {uniqueLabels.map((label) => {
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
            <button
              className={`${styles.visibilityToggle} ${isVisible ? styles.visible : styles.hidden}`}
              onClick={(e) => {
                e.stopPropagation() // Prevent triggering the parent click
                onToggleVisibility(label.label)
              }}
              title={isVisible ? 'Hide label' : 'Show label'}
            >
              {isVisible ? '👁️' : '🙈'}
            </button>
            <span className={styles.labelText}>{label.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default AnnotationList