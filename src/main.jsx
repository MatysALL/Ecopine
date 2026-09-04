import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { DbProvider } from './db'
import { EncounterProvider } from './context/EncounterContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <DbProvider>
        <EncounterProvider>
          <App />
        </EncounterProvider>
      </DbProvider>
    </ErrorBoundary>
  </StrictMode>,
)

