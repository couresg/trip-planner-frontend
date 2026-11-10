import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** 개발 서버에서만 켠다. public/mockServiceWorker.js가 필요하다 (`npx msw init public`). */
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MSW !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

enableMocking()
  // 목업을 못 켜도 화면은 띄운다 (빈 화면 방지)
  .catch((error: unknown) => console.warn('MSW를 시작하지 못했습니다.', error))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
