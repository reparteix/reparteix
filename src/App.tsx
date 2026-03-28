import { HashRouter, Routes, Route } from 'react-router-dom'
import { GroupList } from './features/groups/GroupList'
import { GroupDetail } from './features/groups/GroupDetail'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GroupList />} />
        <Route path="/group/:groupId" element={<GroupDetail />} />
      </Routes>
      <PWAUpdatePrompt />
    </HashRouter>
  )
}

export default App
