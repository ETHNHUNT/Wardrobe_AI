import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Wardrobe from './pages/Wardrobe'
import AddItem from './pages/AddItem'
import Profile from './pages/Profile'
import OutfitBuilder from './pages/OutfitBuilder'

function ShopStub() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center pb-20 px-4 text-center">
      <div className="text-5xl mb-4">🛍️</div>
      <h2 className="text-lg font-semibold text-gray-700 mb-1">Shop — Phase 3</h2>
      <p className="text-sm text-gray-400">Wardrobe gap analysis and shopping suggestions coming soon.</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Wardrobe />} />
        <Route path="/add" element={<AddItem />} />
        <Route path="/outfits" element={<OutfitBuilder />} />
        <Route path="/shop" element={<ShopStub />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <Navbar />
    </div>
  )
}
