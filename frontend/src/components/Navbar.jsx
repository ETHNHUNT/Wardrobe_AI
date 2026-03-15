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
        background: 'rgba(7, 7, 7, 0.80)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div
        className="flex justify-around items-center h-16"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
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
              style={{ color: isActive ? 'var(--accent)' : 'rgba(107,101,96,0.7)' }}
            >
              {/* Gold line indicator above icon (luxury pattern) */}
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="nav-line"
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={{ opacity: 0, scaleX: 0 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                    className="absolute -top-0 rounded-full"
                    style={{
                      width: 20,
                      height: 1.5,
                      backgroundColor: 'var(--accent)',
                      boxShadow: '0 0 6px rgba(200,169,126,0.55)',
                    }}
                  />
                )}
              </AnimatePresence>

              <motion.div
                whileTap={{ scale: 0.86 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex flex-col items-center gap-0.5"
              >
                <Icon
                  size={21}
                  strokeWidth={isActive ? 1.75 : 1.35}
                  className="transition-all duration-250"
                />
                <span
                  className="transition-all duration-250"
                  style={{ fontSize: '9px', letterSpacing: '0.1em' }}
                >
                  {label}
                </span>
              </motion.div>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
