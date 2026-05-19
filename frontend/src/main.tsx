import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './styles/index.css'
import './i18n/config'
import App from './App.tsx'

const root = (
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);

createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV
    ? <StrictMode>{root}</StrictMode>
    : root,
)
