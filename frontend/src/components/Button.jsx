import React from 'react'
import { motion } from 'framer-motion'

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const variants = {
    primary: 'bg-[#6366f1] text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]',
    secondary: 'bg-white/5 text-white border border-white/10 hover:bg-white/10',
    ghost: 'bg-transparent text-white/70 hover:text-white hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
  }

  // Pre-defined styles since I'm not using Tailwind in this project (as per guidelines, vanilla CSS prioritized)
  const baseStyles = {
    padding: '0.75rem 1.5rem',
    borderRadius: '12px',
    fontWeight: '500',
    fontSize: '0.95rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    border: 'none',
    cursor: 'pointer',
    width: props.fullWidth ? '100%' : 'auto'
  }

  const getVariantStyles = () => {
    switch(variant) {
      case 'primary': return { 
        background: 'var(--primary)', 
        color: 'white', 
        boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)' 
      }
      case 'secondary': return { 
        background: 'rgba(255, 255, 255, 0.05)', 
        color: 'white', 
        border: '1px solid rgba(255, 255, 255, 0.1)' 
      }
      case 'ghost': return { 
        background: 'transparent', 
        color: 'var(--text-muted)' 
      }
      case 'danger': return {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }
      default: return {}
    }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, translateY: -1 }}
      whileTap={{ scale: 0.98 }}
      style={{ ...baseStyles, ...getVariantStyles() }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  )
}
