import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navbar from './components/Navbar'
import Wardrobe from './pages/Wardrobe'
import AddItem from './pages/AddItem'
import Profile from './pages/Profile'
import OutfitBuilder from './pages/OutfitBuilder'
import Shop from './pages/Shop'

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
