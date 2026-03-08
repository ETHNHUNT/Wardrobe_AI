import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shirt, Plus, Layers, ShoppingBag, User } from 'lucide-react'

const tabs = [
  { to: '/',        label: 'Wardrobe', Icon: Shirt       },
  { to: '/add',     label: 'Add',      Icon: Plus        },
  { to: '/outfits', label: 'Outfits',  Icon: Layers      },
  { to: '/shop',    label: 'Shop',     Icon: ShoppingBag },
  { to: '/profile', label: 'Profile',  Icon: User        },
]

export default function Navbar() {
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(8, 8, 8, 0.72)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div
        className="flex justify-around items-center h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ to, label, Icon }) => {
          const isActive =
            to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="relative flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium tracking-wider uppercase"
              style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <motion.div
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex flex-col items-center gap-0.5"
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 1.75 : 1.4}
                  className="transition-all duration-200"
                />
                <span className="transition-all duration-200">{label}</span>
              </motion.div>

              {/* Animated gold dot indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="nav-dot"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute -bottom-1 w-1 h-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent)' }}
                  />
                )}
              </AnimatePresence>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
