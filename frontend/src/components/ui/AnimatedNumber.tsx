import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

interface Props {
  value: number
  decimals?: number
  duration?: number
  suffix?: string
  className?: string
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1,
  suffix = '',
  className = '',
}: Props) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    prev.current = value
    return () => controls.stop()
  }, [value, duration])

  const formatted = new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(display)

  return (
    <span className={className}>
      {formatted}
      {suffix}
    </span>
  )
}
