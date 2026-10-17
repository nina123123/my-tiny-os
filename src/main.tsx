import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/os.css'
import App from './App.tsx'
import { Harness } from './dev/Harness.tsx'

const harness = import.meta.env.DEV && new URLSearchParams(location.search).has('app')

createRoot(document.getElementById('root')!).render(<StrictMode>{harness ? <Harness /> : <App />}</StrictMode>)
