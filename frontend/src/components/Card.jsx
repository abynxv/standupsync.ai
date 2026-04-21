import React from 'react'
import { motion } from 'framer-motion'

export const Card = ({ children, className = '', interactive = false, ...props }) => {
  const Component = interactive ? motion.div : 'div'
  const hoverProps = interactive ? {
    whileHover: { translateY: -4, scale: 1.01 },
    transition: { type: 'spring', stiffness: 300, damping: 20 }
  } : {}

  return (
    <Component
      className={`glass ${interactive ? 'glass-interactive' : ''} ${className}`}
      {...hoverProps}
      style={{
        padding: '2rem',
        ...props.style
      }}
      {...props}
    >
      {children}
    </Component>
  )
}
