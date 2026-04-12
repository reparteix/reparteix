import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { Footer } from './components/Footer'
import { useFileHandler } from './hooks/useFileHandler'

const GroupList = lazy(() => import('./features/groups/GroupList').then((m) => ({ default: m.GroupList })))
const GroupDetail = lazy(() => import('./features/groups/GroupDetail').then((m) => ({ default: m.GroupDetail })))
const GroupSettings = lazy(() => import('./features/groups/GroupSettings').then((m) => ({ default: m.GroupSettings })))
const ImportFromUrl = lazy(() => import('./features/groups/ImportFromUrl').then((m) => ({ default: m.ImportFromUrl })))
const OnboardingWizard = lazy(() => import('./features/groups/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard })))
const SyncFromUrl = lazy(() => import('./features/groups/SyncFromUrl').then((m) => ({ default: m.SyncFromUrl })))

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
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<GroupList />} />
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route path="/group/:groupId" element={<GroupDetail />} />
            <Route path="/group/:groupId/settings" element={<GroupSettings />} />
            <Route path="/import" element={<ImportFromUrl />} />
            <Route path="/sync" element={<SyncFromUrl />} />
          </Routes>
        </Suspense>
        <Footer />
      </div>
      <FileHandlerBridge />
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
    </HashRouter>
  )
}

function RouteLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Carregant…
    </div>
  )
}

export default App
