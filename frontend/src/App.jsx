import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Wardrobe from './pages/Wardrobe'
import AddItem from './pages/AddItem'
import Profile from './pages/Profile'
import OutfitBuilder from './pages/OutfitBuilder'
import Shop from './pages/Shop'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Wardrobe />} />
        <Route path="/add" element={<AddItem />} />
        <Route path="/outfits" element={<OutfitBuilder />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <Navbar />
    </div>
  )
}
