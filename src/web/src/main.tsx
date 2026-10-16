import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import Home from './routes/Home.tsx'
import Juan from './routes/Juan.tsx'
import Maria from './routes/Maria.tsx'
import Tendero from './routes/Tendero.tsx'
import Celular from './routes/Celular.tsx'
import Demo from './routes/Demo.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/juan" element={<Juan />} />
        <Route path="/maria" element={<Maria />} />
        <Route path="/tendero" element={<Tendero />} />
        <Route path="/celular" element={<Celular />} />
        <Route path="/demo" element={<Demo />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
