import styles from '../assets/row.module.css'

interface RowProps {
  score: string | number
  color: string
  index: string | number
}

const Row = ({ score, color, index }: RowProps): JSX.Element => {
  return (
    <div className={styles.selectedPoint}>
      <span>{index}</span>
      <div>
        <span>{score}</span>
        <div className={styles.colorCircle} style={{ backgroundColor: color || 'white' }}></div>
      </div>
    </div>
  )
}

export default Row
