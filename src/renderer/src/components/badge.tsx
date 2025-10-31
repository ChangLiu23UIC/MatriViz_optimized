import styles from '../assets/badge.module.css'

interface BadgeProps {
  gene: string
  handleBadgeClick: (gene: string) => void
  removeGene: (gene: string) => void
  isHighlighted: boolean
}

const Badge = ({ gene, handleBadgeClick, removeGene, isHighlighted }: BadgeProps): JSX.Element => {
  return (
    <div key={gene} className={`${styles.geneBadge} ${isHighlighted ? styles.highlighted : ''}`}>
      <span onClick={(): void => handleBadgeClick(gene)}>{gene}</span>
      <button onClick={(): void => removeGene(gene)}>X</button>
    </div>
  )
}

export default Badge
