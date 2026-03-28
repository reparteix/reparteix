import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GroupList } from './features/groups/GroupList'
import { GroupDetail } from './features/groups/GroupDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GroupList />} />
        <Route path="/group/:groupId" element={<GroupDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
