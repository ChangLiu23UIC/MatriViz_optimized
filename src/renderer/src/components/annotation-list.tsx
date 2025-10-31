import { LabelPoint } from '../types'
import styles from '../assets/annotation-list.module.css'

interface AnnotationListProps {
  labels: LabelPoint[]
  onAnnotationHover: (label: LabelPoint | null) => void
  hoveredAnnotation: LabelPoint | null
  selectedAnnotation: LabelPoint | null
  onAnnotationSelect: (label: LabelPoint | null) => void
}

const AnnotationList = ({
  labels,
  onAnnotationHover,
  hoveredAnnotation,
  selectedAnnotation,
  onAnnotationSelect
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
      {uniqueLabels.map((label) => (
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
          {label.label}
        </div>
      ))}
    </div>
  )
}

export default AnnotationList