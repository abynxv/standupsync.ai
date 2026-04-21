import React from 'react'

export const Input = ({ label, icon: Icon, error, type = 'text', ...props }) => {
  return (
    <div style={{ marginBottom: '1.25rem', width: '100%' }}>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: '0.5rem', 
          fontSize: '0.9rem', 
          fontWeight: '500', 
          color: 'var(--text-muted)' 
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {Icon && (
          <div style={{ 
            position: 'absolute', 
            left: '1rem', 
            top: '50%', 
            transform: 'translateY(-50%)', 
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Icon size={18} />
          </div>
        )}
        <input
          type={type}
          style={{
            width: '100%',
            padding: Icon ? '0.75rem 1rem 0.75rem 2.8rem' : '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box'
          }}
          className="input-focus-effect"
          {...props}
        />
      </div>
      {error && (
        <span style={{ 
          color: '#ef4444', 
          fontSize: '0.8rem', 
          marginTop: '0.3rem', 
          display: 'block' 
        }}>
          {error}
        </span>
      )}
      <style>{`
        .input-focus-effect:focus {
          border-color: var(--primary);
          background: rgba(0, 0, 0, 0.3);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
      `}</style>
    </div>
  )
}

export const TextArea = ({ label, ...props }) => {
  return (
    <div style={{ marginBottom: '1.25rem', width: '100%' }}>
      {label && (
        <label style={{ 
          display: 'block', 
          marginBottom: '0.5rem', 
          fontSize: '0.9rem', 
          fontWeight: '500', 
          color: 'var(--text-muted)' 
        }}>
          {label}
        </label>
      )}
      <textarea
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          color: 'white',
          fontSize: '0.95rem',
          transition: 'all 0.2s ease',
          minHeight: '100px',
          resize: 'vertical',
          boxSizing: 'border-box'
        }}
        className="input-focus-effect"
        {...props}
      />
    </div>
  )
}
