import { ColorRing } from 'react-loader-spinner'

interface LoadingProps {
  height: number | string
  width: number | string
  className?: string
  text: boolean
}

const Loading = ({ height, width, className, text }: LoadingProps): JSX.Element => {
  return (
    <div className={className}>
      <ColorRing
        height={height}
        width={width}
        colors={['#5bb9e1', '#5bb9e1', '#5bb9e1', '#5bb9e1', '#5bb9e1']}
      />
      {text && <p>Loading...</p>}
    </div>
  )
}

export default Loading
