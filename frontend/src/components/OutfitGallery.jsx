import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { Trash2, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'

const API_URL = import.meta.env.VITE_API_URL

const VERTEX_SHADER = `
uniform float u_progress;
uniform float u_direction;
uniform float u_offset;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;

  float maxDist = length(vec2(0.5));
  float normalizedDist = length(uv - 0.5) / maxDist;

  // direction 0 = press (corners push forward)
  // direction 1 = release (corners pull back)
  float stickOut = normalizedDist;
  float stickIn  = -normalizedDist;
  float stickEffect = mix(stickOut, stickIn, u_direction);

  float progress = smoothstep(0.0, 1.0, u_progress);
  pos.z += stickEffect * u_offset * progress;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const FRAGMENT_SHADER = `
uniform sampler2D u_texture;
uniform float u_smoothVelocity;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  float shift = u_smoothVelocity * 0.0015;
  uv.x -= sin(uv.y) / 100.0 * u_smoothVelocity;

  vec4 color;
  color.r = texture2D(u_texture, uv + vec2(shift, 0.0)).r;
  color.g = texture2D(u_texture, uv).g;
  color.b = texture2D(u_texture, uv - vec2(shift, 0.0)).b;
  color.a = 1.0;

  gl_FragColor = color;
}
`

const wrap = (i, total) => ((i % total) + total) % total

function makePlane(x) {
  const geometry = new THREE.PlaneGeometry(1.2, 1.5, 60, 60)
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      u_texture:        { value: null },
      u_progress:       { value: 0.0 },
      u_direction:      { value: 0.0 },
      u_offset:         { value: 0.4 },
      u_smoothVelocity: { value: 0.0 },
    },
    transparent: true,
  })
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.position.x = x
  return { mesh, mat, uniforms_proxy: { progress: 0 } }
}

export default function OutfitGallery({ outfits, onRate, onDelete, onMarkWorn }) {
  const containerRef = useRef(null)
  const stateRef     = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!outfits || outfits.length === 0) return
    const el = containerRef.current
    if (!el) return

    const w = el.clientWidth
    const h = el.clientHeight

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    // ── Scene + Camera ──
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 1.5

    // ── 3 Planes ──
    const planes = [
      makePlane(-1.5), // prev
      makePlane(0),    // center
      makePlane(1.5),  // next
    ]
    planes.forEach(p => scene.add(p.mesh))

    // ── Texture loader ──
    const loader = new THREE.TextureLoader()
    function loadTexture(plane, url) {
      if (!url) return
      loader.load(url, (tex) => {
        tex.minFilter = THREE.LinearFilter
        tex.generateMipmaps = false
        plane.mat.uniforms.u_texture.value = tex
      })
    }

    function refreshTextures(ci) {
      const total = outfits.length
      const indices = [wrap(ci - 1, total), wrap(ci, total), wrap(ci + 1, total)]
      planes.forEach((plane, i) => {
        const outfit = outfits[indices[i]]
        const photoPath = outfit?.items?.[0]?.photo_path
        if (photoPath) {
          loadTexture(plane, `${API_URL}/images/${photoPath}`)
        } else {
          plane.mat.uniforms.u_texture.value = null
        }
      })
    }

    // Initial texture load
    refreshTextures(0)

    // ── State ref ──
    const s = {
      isDragging:      false,
      dragStartX:      0,
      dragDeltaX:      0,
      currentIndex:    0,
      smoothVelocity:  0,
      prevProgress:    0,
      progress:        0,
      renderer, scene, camera, planes,
      rafId: null,
    }
    stateRef.current = s

    // ── RAF loop ──
    function animate() {
      s.rafId = requestAnimationFrame(animate)

      const rawVelocity  = Math.abs(s.progress - s.prevProgress) * 60
      s.smoothVelocity   = s.smoothVelocity + (rawVelocity - s.smoothVelocity) * 0.15
      s.prevProgress     = s.progress

      planes.forEach(p => {
        p.mat.uniforms.u_smoothVelocity.value = s.smoothVelocity
      })

      renderer.render(scene, camera)
    }
    animate()

    // ── Pointer events ──
    function getClientX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX
    }

    function onPointerDown(e) {
      s.isDragging  = true
      s.dragStartX  = getClientX(e)
      s.dragDeltaX  = 0

      // Press deform on center plane
      const cp = planes[1]
      cp.mat.uniforms.u_direction.value = 0
      gsap.killTweensOf(cp.uniforms_proxy)
      gsap.to(cp.uniforms_proxy, {
        progress: 1,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)',
        onUpdate: () => {
          cp.mat.uniforms.u_progress.value = cp.uniforms_proxy.progress
        },
      })
    }

    function onPointerMove(e) {
      if (!s.isDragging) return
      s.dragDeltaX = getClientX(e) - s.dragStartX
      s.progress   = s.dragDeltaX / el.clientWidth

      const offset = (s.dragDeltaX / el.clientWidth) * 1.5
      planes.forEach((p, i) => {
        gsap.to(p.mesh.position, {
          x: (i - 1) * 1.5 + offset,
          duration: 0.1,
          ease: 'none',
        })
      })
    }

    function onPointerUp() {
      if (!s.isDragging) return
      s.isDragging = false

      const threshold = el.clientWidth * 0.25
      const navigated = Math.abs(s.dragDeltaX) > threshold
      const direction = s.dragDeltaX < 0 ? 1 : -1  // left drag = next (+1), right = prev (-1)

      // Release deform on center plane
      const cp = planes[1]
      cp.mat.uniforms.u_direction.value = 1
      gsap.killTweensOf(cp.uniforms_proxy)
      gsap.to(cp.uniforms_proxy, {
        progress: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.3)',
        onUpdate: () => {
          cp.mat.uniforms.u_progress.value = cp.uniforms_proxy.progress
        },
      })

      if (navigated) {
        s.currentIndex = wrap(s.currentIndex + direction, outfits.length)
        refreshTextures(s.currentIndex)
        setActiveIndex(s.currentIndex)
      }

      // Snap all planes back to base positions
      planes.forEach((p, i) => {
        gsap.killTweensOf(p.mesh.position)
        gsap.to(p.mesh.position, {
          x: (i - 1) * 1.5,
          duration: 0.5,
          ease: 'power3.out',
        })
      })

      s.dragDeltaX = 0
      s.progress   = 0
    }

    el.addEventListener('mousedown',  onPointerDown)
    el.addEventListener('mousemove',  onPointerMove)
    el.addEventListener('mouseup',    onPointerUp)
    el.addEventListener('touchstart', onPointerDown, { passive: true })
    el.addEventListener('touchmove',  onPointerMove,  { passive: true })
    el.addEventListener('touchend',   onPointerUp)

    // ── Resize observer ──
    const resizeObserver = new ResizeObserver(() => {
      const nw = el.clientWidth
      const nh = el.clientHeight
      renderer.setSize(nw, nh)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(el)

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(s.rafId)
      resizeObserver.disconnect()

      planes.forEach(p => {
        gsap.killTweensOf(p.mesh.position)
        gsap.killTweensOf(p.uniforms_proxy)
        p.mat.dispose()
        p.mesh.geometry.dispose()
        if (p.mat.uniforms.u_texture.value) {
          p.mat.uniforms.u_texture.value.dispose()
        }
      })

      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)

      el.removeEventListener('mousedown',  onPointerDown)
      el.removeEventListener('mousemove',  onPointerMove)
      el.removeEventListener('mouseup',    onPointerUp)
      el.removeEventListener('touchstart', onPointerDown)
      el.removeEventListener('touchmove',  onPointerMove)
      el.removeEventListener('touchend',   onPointerUp)
    }
  }, [outfits]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = outfits?.[activeIndex]

  return (
    <div className="w-full relative" style={{ height: '60vh' }}>
      {/* WebGL canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: 'grab', touchAction: 'none' }}
        onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
        onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
        onMouseLeave={(e) => e.currentTarget.style.cursor = 'grab'}
      />

      {/* Metadata overlay — outer is pointer-events-none; interactive children opt back in */}
      <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
        <p className="font-display text-[var(--accent)] tracking-widest uppercase text-sm">
          {current?.occasion ?? 'Saved Outfit'}
        </p>
        <p className="text-[var(--text-muted)] text-xs mt-1">
          {current?.season ?? ''}
        </p>

        {/* Interactive star rating */}
        <div className="flex justify-center gap-1 mt-2 pointer-events-auto">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRate?.(current?.id, star)}
              className="text-base transition-transform active:scale-125 px-0.5"
              style={{ color: star <= (current?.rating ?? 0) ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}
            >
              ★
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3 mt-2 pointer-events-auto">
          <button
            onClick={() => onMarkWorn?.(current?.id)}
            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <CheckCircle2 size={11} strokeWidth={2} />
            Mark Worn
          </button>
          <button
            onClick={() => onDelete?.(current?.id)}
            className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            <Trash2 size={11} strokeWidth={2} />
            Delete
          </button>
        </div>

        {/* Slide dots */}
        <div className="flex justify-center gap-2 mt-3">
          {outfits.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i === activeIndex ? 'w-4 bg-[var(--accent)]' : 'w-1 bg-[var(--text-muted)]'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
