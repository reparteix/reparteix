import { HashRouter, Routes, Route } from 'react-router-dom'
import { GroupList } from './features/groups/GroupList'
import { GroupDetail } from './features/groups/GroupDetail'
import { GroupSettings } from './features/groups/GroupSettings'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { Footer } from './components/Footer'

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
      <PWAUpdatePrompt />
    </HashRouter>
  )
}

export default App
