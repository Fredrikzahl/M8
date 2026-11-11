import { createRoot } from 'react-dom/client'
import './styles.css'
import { initImages } from './lib/images'
import { syncAutoTasks } from './actions'
import { App } from './App'

// Bildene hentes fra nettleserens lager før appen tegnes, slik at de er klare med en gang.
initImages().finally(() => {
  syncAutoTasks()
  createRoot(document.getElementById('root')!).render(<App />)
})
