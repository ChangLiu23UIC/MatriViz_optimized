import React, { useState, useRef } from 'react'
import { PlotState } from '@renderer/types'
import styles from '../assets/plotOptions.module.css'

interface PlotOptionsProps {
  plotState: PlotState
  setPlotState: (plotState: PlotState) => void
  onClose?: () => void
}

const PlotOptions = ({ plotState, setPlotState, onClose }: PlotOptionsProps): JSX.Element => {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (dragRef.current) {
      setIsDragging(true)
      const rect = dragRef.current.getBoundingClientRect()
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  const handleMouseMove = (e: MouseEvent): void => {
    if (isDragging && dragRef.current) {
      const newX = e.clientX - dragOffset.current.x
      const newY = e.clientY - dragOffset.current.y
      setPosition({ x: newX, y: newY })
    }
  }

  const handleMouseUp = (): void => {
    setIsDragging(false)
  }

  // Add event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    return undefined
  }, [isDragging])

  return (
    <div
      ref={dragRef}
      className={`${styles.container} ${isDragging ? styles.dragging : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div
        className={styles.header}
        onMouseDown={handleMouseDown}
        style={{ cursor: 'grab' }}
      >
        <p className={styles.title}>Plot Options</p>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            Hide Plot Options
          </button>
        )}
      </div>
      <div className={styles.section}>
        <p className={styles.subtitle}>Minimum</p>
        <div className={styles.subsection}>
          <p className={styles.label}>Color:</p>
          <input
            type="color"
            value={plotState.minColor}
            onChange={(event): void => setPlotState({ ...plotState, minColor: event.target.value })}
          />
        </div>
        <div className={styles.subsection}>
          <p className={styles.label}>Score:</p>
          <input
            type="number"
            step={0.1}
            value={plotState.minScore}
            disabled={plotState.autoMinScore}
            onChange={(event): void =>
              setPlotState({ ...plotState, minScore: Number(event.target.value) })
            }
          />
          <p>Auto</p>
          <input
            type="checkbox"
            checked={plotState.autoMinScore}
            onChange={(event): void =>
              setPlotState({ ...plotState, autoMinScore: event.target.checked })
            }
          />
        </div>
      </div>
      <div className={styles.section}>
        <p className={styles.subtitle}>Maximum</p>
        <div className={styles.subsection}>
          <p className={styles.label}>Color:</p>
          <input
            type="color"
            value={plotState.maxColor}
            onChange={(event): void => setPlotState({ ...plotState, maxColor: event.target.value })}
          />
        </div>
        <div className={styles.subsection}>
          <p className={styles.label}>Score:</p>
          <input
            type="number"
            step={0.1}
            value={plotState.maxScore}
            disabled={plotState.autoMaxScore}
            onChange={(event): void =>
              setPlotState({ ...plotState, maxScore: Number(event.target.value) })
            }
          />
          <p>Auto</p>
          <input
            type="checkbox"
            checked={plotState.autoMaxScore}
            onChange={(event): void =>
              setPlotState({ ...plotState, autoMaxScore: event.target.checked })
            }
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.subsection}>
          <div className={styles.subsection}>
            <p className={styles.label}>Point size:</p>
            <input
              type="number"
              min={1}
              max={10}
              step={0.1}
              value={plotState.pointSize}
              onChange={(event): void =>
                setPlotState({ ...plotState, pointSize: Number(event.target.value) })
              }
            />
          </div>
          <div className={styles.subsection}>
            <p className={styles.label}>Labels:</p>
            <input
              type="checkbox"
              checked={plotState.toggleLabels}
              onChange={(event): void =>
                setPlotState({ ...plotState, toggleLabels: event.target.checked })
              }
            />
          </div>
          <div className={styles.subsection}>
            <p className={styles.label}>Gridlines:</p>
            <input
              type="checkbox"
              checked={plotState.toggleGridlines}
              onChange={(event): void =>
                setPlotState({ ...plotState, toggleGridlines: event.target.checked })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlotOptions
