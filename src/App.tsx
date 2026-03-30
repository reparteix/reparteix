import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { GroupList } from './features/groups/GroupList'
import { GroupDetail } from './features/groups/GroupDetail'
import { GroupSettings } from './features/groups/GroupSettings'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { Footer } from './components/Footer'
import { useFileHandler } from './hooks/useFileHandler'

function FileHandlerBridge() {
  const navigate = useNavigate()
  const { status, groupId, error } = useFileHandler()

  useEffect(() => {
    if (status === 'ok' && groupId) {
      navigate(`/group/${groupId}`)
    }
  }, [status, groupId, navigate])

  if (status === 'importing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
        <p className="text-lg font-medium">S'està important el fitxer…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-destructive px-4 py-2 text-destructive-foreground shadow-lg">
        Error en obrir fitxer: {error}
      </div>
    )
  }

  return null
}

function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col">
        <Routes>
          <Route path="/" element={<GroupList />} />
          <Route path="/group/:groupId" element={<GroupDetail />} />
          <Route path="/group/:groupId/settings" element={<GroupSettings />} />
        </Routes>
        <Footer />
      </div>
      <FileHandlerBridge />
      <PWAUpdatePrompt />
    </HashRouter>
  )
}

export default App
