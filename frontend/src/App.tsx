import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FavoritesProvider } from './context/FavoritesContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import SearchPage from './pages/SearchPage'
import CoursePage from './pages/CoursePage'
import Profile from './pages/Profile'
import DegreePlanner from './pages/DegreePlanner'
import FavoritesPage from './pages/FavoritesPage'
import SharedPlan from './pages/SharedPlan'

function App() {
  return (
    <BrowserRouter>
      <FavoritesProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/course/:id" element={<CoursePage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/degree" element={<DegreePlanner />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/shared/:token" element={<SharedPlan />} />
          </Route>
        </Routes>
      </FavoritesProvider>
    </BrowserRouter>
  )
}

export default App