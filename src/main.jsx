import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { DbProvider } from './db'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DbProvider>
        <App />
      </DbProvider>
    </ErrorBoundary>
  </StrictMode>,
)

