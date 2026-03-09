import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import SplashScreen from './components/SplashScreen'
import Wardrobe from './pages/Wardrobe'
import AddItem from './pages/AddItem'
import Profile from './pages/Profile'
import OutfitBuilder from './pages/OutfitBuilder'
import Shop from './pages/Shop'
import { SPLASH_SEEN_KEY } from './lib/scenes'

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.16, ease: [0.25, 0.1, 0.25, 1] },
  },
}

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()
  // Show splash once per browser session (cleared when tab is closed)
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem(SPLASH_SEEN_KEY)
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Splash screen — renders above everything, dismisses after 2 s */}
      <AnimatePresence>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

      {/* Page routes */}
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageWrapper><Wardrobe /></PageWrapper>} />
          <Route path="/add" element={<PageWrapper><AddItem /></PageWrapper>} />
          <Route path="/outfits" element={<PageWrapper><OutfitBuilder /></PageWrapper>} />
          <Route path="/shop" element={<PageWrapper><Shop /></PageWrapper>} />
          <Route path="/profile" element={<PageWrapper><Profile /></PageWrapper>} />
        </Routes>
      </AnimatePresence>
      <Navbar />
    </div>
  )
}
