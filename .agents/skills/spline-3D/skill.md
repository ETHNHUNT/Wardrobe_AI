-----

## name: spline-for-claude-code
description: Build Spline 3D web components in React/Next.js/vanilla JavaScript. Use this skill whenever Claude Code needs to export Spline scenes, create interactive 3D web components, set up Code API integrations, handle real-time data binding, manage variables and events, optimize scene performance, or implement 3D interactivity via JavaScript/TypeScript. This skill covers the complete workflow from scene export through production deployment in web frameworks.

# Spline for Claude Code

Complete developer guide for integrating Spline 3D scenes into web applications using Claude Code.

**Scope**: Code API patterns (React, Next.js, Vanilla JS), real-time integration, event handling, variable binding, performance optimization, and production deployment.

-----

## Table of Contents

1. [Quick Start Workflows](#quick-start-workflows)
1. [Export Strategy](#export-strategy)
1. [React Integration](#react-integration)
1. [Next.js Integration](#nextjs-integration)
1. [Vanilla JavaScript](#vanilla-javascript)
1. [Event & Variable System](#event--variable-system)
1. [Real-Time Data Integration](#real-time-data-integration)
1. [Performance & Optimization](#performance--optimization)
1. [Common Patterns](#common-patterns)
1. [Troubleshooting](#troubleshooting)

-----

## Quick Start Workflows

### Workflow 1: Basic React Component (< 5 minutes)

**Goal**: Embed a Spline scene in a React app

```bash
npm install @splinetool/react-spline
```

```jsx
import Spline from '@splinetool/react-spline';

export default function App() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Spline scene="https://prod.spline.design/YOUR_SCENE_ID/scene.splinecode" />
    </div>
  );
}
```

**When to use**: Static 3D backgrounds, showcases, hero sections.

-----

### Workflow 2: Interactive Component with Event Handlers (10 minutes)

**Goal**: Click 3D objects, trigger animations, update state

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function Interactive() {
  const splineRef = useRef();

  const onLoad = (spline) => {
    splineRef.current = spline;
  };

  const handleClick = () => {
    // Emit event on Spline object
    splineRef.current?.emitEvent('objectId', 'mouseDown');
  };

  return (
    <>
      <Spline scene="https://prod.spline.design/..." onLoad={onLoad} />
      <button onClick={handleClick}>Trigger Animation</button>
    </>
  );
}
```

**When to use**: Interactive UI, product configurators, game-like experiences.

-----

### Workflow 3: Dynamic Data Binding (15 minutes)

**Goal**: Update Spline scene based on external data

```jsx
import { useEffect, useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function DynamicScene({ productColor }) {
  const splineRef = useRef();

  useEffect(() => {
    if (!splineRef.current) return;

    const scene = splineRef.current.getScene();
    const colorObj = scene.getObjectById('colorSwatch');
    if (colorObj && colorObj.material) {
      colorObj.material.color.set(productColor);
    }
  }, [productColor]);

  const onLoad = (spline) => {
    splineRef.current = spline;
  };

  return <Spline scene="https://prod.spline.design/..." onLoad={onLoad} />;
}
```

**When to use**: Live color pickers, conditional 3D rendering, data-driven visualizations.

-----

## Export Strategy

### Step 1: Prepare Scene in Spline Editor

1. Open Spline editor → Your scene
1. Click **Export** (top toolbar)
1. Performance check:
- Review **Performance Panel**
- Aim for: < 5MB, < 2000 objects, < 500K polygons
- Optimize if needed (see Performance section below)

### Step 2: Choose Export Type

|Export Type          |Size   |Interactivity|Use Case                                    |
|---------------------|-------|-------------|--------------------------------------------|
|**Public URL**       |N/A    |Full         |Prototyping, sharing, simple embeds         |
|**Spline Viewer**    |~2-10MB|Full         |Embeds (Webflow, Notion, etc.)              |
|**Code (React)**     |Bundle |Full         |React/Next.js apps                          |
|**Code (Vanilla JS)**|Bundle |Full         |Custom JavaScript                           |
|**Image/Video**      |< 500KB|None         |Static backgrounds, if no interaction needed|

### Step 3: Export for React/Next.js

1. Click **Export** → Select **Code**
1. Dropdown → **React** (or **Next.js**)
1. Wait for URL generation
1. **Copy code** or **Download as ZIP**

**Output**: JavaScript module with scene data + Code API ready.

-----

## React Integration

### Installation

```bash
npm install @splinetool/react-spline
# or
yarn add @splinetool/react-spline
```

### Basic Usage

```jsx
import Spline from '@splinetool/react-spline';

export default function Scene() {
  return (
    <Spline 
      scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" 
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
```

### Working with Scene Objects

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function ObjectManipulation() {
  const splineRef = useRef();

  const onLoad = (spline) => {
    // Get object by name
    const cube = spline.findObjectByName('Cube');

    // Or by ID (right-click object → Copy Development Object ID)
    const ball = spline.findObjectById('8E8C2DDD-18B6-4C54-861D-7ED2519DE20E');

    // Access properties
    console.log(cube.position); // { x: 0, y: 0, z: 0 }
    console.log(cube.rotation);
    console.log(cube.scale);

    // Modify properties
    cube.position.x += 10;
    ball.scale.set(2, 2, 2);

    splineRef.current = spline;
  };

  return (
    <Spline 
      scene="https://prod.spline.design/..." 
      onLoad={onLoad} 
    />
  );
}
```

### Event Listeners

#### Mouse Events

```jsx
export default function MouseEvents() {
  const onLoad = (spline) => {
    // onSplineMouseDown
    // onSplineMouseUp
    // onSplineMouseHover
    // onSplineMousePress
  };

  function onSplineMouseDown(e) {
    // e.target = the clicked object
    if (e.target.name === 'Cube') {
      console.log('Cube clicked!');
    }
  }

  return (
    <Spline 
      scene="https://prod.spline.design/..." 
      onLoad={onLoad}
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

#### All Available Event Props

```jsx
<Spline
  onSplineMouseDown={handleMouseDown}
  onSplineMouseUp={handleMouseUp}
  onSplineMouseHover={handleMouseHover}
  onSplineMousePress={handleMousePress}
  onSplineKeyDown={handleKeyDown}
  onSplineKeyUp={handleKeyUp}
  onSplineKeyPress={handleKeyPress}
  onSplineScroll={handleScroll}
  onSplineStart={handleStart}
/>
```

### Triggering Animations

```jsx
const splineRef = useRef();

// Emit event on object (must be set up in Spline editor)
const triggerAnimation = () => {
  splineRef.current?.emitEvent('objectId', 'mouseDown');
};

// Common event types:
// - 'mouseDown', 'mouseUp', 'mouseHover', 'mousePress'
// - 'keyDown', 'keyUp', 'keyPress'
```

-----

## Next.js Integration

### Installation

```bash
npm install @splinetool/react-spline
```

### App Router (Recommended)

```jsx
// app/page.js
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Spline = dynamic(() => import('@splinetool/react-spline'), { 
  ssr: false,
  loading: () => <div>Loading 3D scene...</div>
});

export default function Home() {
  return (
    <main style={{ width: '100%', height: '100vh' }}>
      <Suspense fallback={<div>Loading...</div>}>
        <Spline scene="https://prod.spline.design/..." />
      </Suspense>
    </main>
  );
}
```

### With SSR Placeholder (Next.js Import)

```jsx
// Import from next-specific entry point
import Spline from '@splinetool/react-spline/next';

export default function Home() {
  return (
    <Spline scene="https://prod.spline.design/YOUR_SCENE/scene.splinecode" />
  );
}
```

**Note**: This auto-generates a blurred placeholder for better UX during load.

### Pages Router (Legacy)

```jsx
// pages/index.js
import dynamic from 'next/dynamic';

const Spline = dynamic(() => import('@splinetool/react-spline'), { 
  ssr: false 
});

export default function Home() {
  return <Spline scene="https://prod.spline.design/..." />;
}
```

### Performance: Lazy Load Scenes

```jsx
const Spline = dynamic(
  () => import('@splinetool/react-spline'),
  { 
    ssr: false,
    loading: () => <SkeletonLoader /> // Custom fallback
  }
);
```

-----

## Vanilla JavaScript

### Installation

```bash
npm install @splinetool/runtime
```

### Basic Setup

```javascript
import { Application } from '@splinetool/runtime';

const canvas = document.getElementById('canvas3d');
const spline = new Application(canvas);

spline.load('https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode')
  .then(() => {
    console.log('Scene loaded!');
  });
```

### HTML Template

```html
<html>
<head>
  <style>
    #canvas { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="canvas3d"></canvas>
  
  <script type="module">
    import { Application } from '@splinetool/runtime';
    
    const canvas = document.getElementById('canvas3d');
    const spline = new Application(canvas);
    spline.load('https://prod.spline.design/.../scene.splinecode');
  </script>
</body>
</html>
```

### Working with Objects

```javascript
spline.load('https://prod.spline.design/...').then(() => {
  const scene = spline.getScene();
  
  // Find object
  const cube = scene.getObjectByName('Cube');
  const ball = scene.getObjectById('OBJECT_ID');
  
  // Modify
  cube.position.x = 5;
  ball.rotation.y += Math.PI / 4;
  ball.scale.multiplyScalar(2);
});
```

### Event Listeners

```javascript
spline.load('https://prod.spline.design/...').then(() => {
  // Mouse events
  spline.addEventListener('mouseDown', (e) => {
    if (e.target.name === 'Cube') {
      console.log('Cube clicked');
    }
  });

  spline.addEventListener('mouseHover', (e) => {
    console.log('Hovering over:', e.target.name);
  });

  // Other events: mouseUp, mousePress, keyDown, keyUp, keyPress, scroll
});
```

### Animation Loop

```javascript
const animate = () => {
  const cube = scene.getObjectByName('Cube');
  cube.rotation.z += 0.01; // Rotate continuously
  
  requestAnimationFrame(animate);
};

spline.load('...').then(() => {
  animate();
});
```

-----

## Event & Variable System

### Variables in Spline

Variables store state that can be modified and observed:

**Types**: Number, String, Boolean

### Setting Variables Programmatically

```javascript
const scene = spline.getScene();

// Get variable
const colorVar = scene.getVariableByName('selectedColor');

// Set value
colorVar.value = 'blue';

// Listen for changes
colorVar.onChange = (newValue) => {
  console.log('Color changed to:', newValue);
  updateUI(newValue);
};
```

### React Example: Variable Binding

```jsx
import { useEffect, useRef, useState } from 'react';
import Spline from '@splinetool/react-spline';

export default function VariableBinding() {
  const splineRef = useRef();
  const [colorVar, setColorVar] = useState(null);

  const onLoad = (spline) => {
    const scene = spline.getScene();
    const varObj = scene.getVariableByName('selectedColor');
    
    varObj.onChange = (newValue) => {
      setColorVar(newValue);
    };
    
    splineRef.current = spline;
  };

  const updateColor = (newColor) => {
    const scene = splineRef.current.getScene();
    const varObj = scene.getVariableByName('selectedColor');
    varObj.value = newColor;
  };

  return (
    <>
      <Spline scene="..." onLoad={onLoad} />
      <div>Current color: {colorVar}</div>
      <button onClick={() => updateColor('red')}>Red</button>
      <button onClick={() => updateColor('blue')}>Blue</button>
    </>
  );
}
```

### State-Based Events

Events set up in Spline editor trigger actions:

```
Spline Editor:
  Object "Cube" → Event "Mouse Down" → Action "Transition to State_Scaled"
```

**From code**, trigger these events:

```javascript
spline.emitEvent('Cube', 'mouseDown'); // Triggers the animation
```

-----

## Real-Time Data Integration

### Fetching External Data

```javascript
// Fetch from API
fetch('/api/product')
  .then(r => r.json())
  .then(data => {
    const scene = spline.getScene();
    
    // Update Spline text
    const priceText = scene.getObjectByName('Price');
    priceText.textValue = `$${data.price}`;
    
    // Update variable
    const stockVar = scene.getVariableByName('inStock');
    stockVar.value = data.inStock;
  });
```

### React Hook Pattern

```jsx
import { useEffect, useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function LiveData() {
  const splineRef = useRef();

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await fetch('/api/stats').then(r => r.json());
      
      if (!splineRef.current) return;
      const scene = splineRef.current.getScene();
      
      // Update multiple objects
      scene.getObjectByName('MetricA').textValue = data.metricA;
      scene.getObjectByName('MetricB').textValue = data.metricB;
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Spline 
      scene="https://prod.spline.design/..." 
      onLoad={(spline) => { splineRef.current = spline; }}
    />
  );
}
```

-----

## Performance & Optimization

### Scene Optimization Checklist

**Before Export** (in Spline editor):

- [ ] Run Performance Panel check (Export → Performance)
- [ ] Target < 5MB export size
- [ ] < 2000 objects, < 500K polygons total
- [ ] Reduce polygon count on parametric objects (fewer “sides”)
- [ ] Limit subdivision to 1-2 levels max
- [ ] Compress images (max 1024px unless necessary)
- [ ] Use < 3 lights
- [ ] Delete invisible/hidden objects

### Export Settings

```javascript
// When exporting from Spline:
// Export → Play Settings → Compression
// - Geometry Quality: "Performance" (not "Quality")
// - Image Quality: "Medium" or lower for textures
```

### React Component Optimization

```jsx
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load Spline
const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false
});

// Memoize component
export default function Scene({ data }) {
  return <Spline scene="..." />;
}
```

### Performance Monitor

```javascript
// Log render frame time
let frameStart = performance.now();

const animate = () => {
  const frameEnd = performance.now();
  const frameTime = frameEnd - frameStart;
  
  if (frameTime > 16.67) { // > 60fps threshold
    console.warn(`Frame took ${frameTime.toFixed(2)}ms`);
  }
  
  frameStart = performance.now();
  requestAnimationFrame(animate);
};
```

### Mobile Optimization

```jsx
// Detect mobile and use lower complexity scene
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

<Spline 
  scene={isMobile 
    ? "https://prod.spline.design/.../scene-mobile.splinecode"
    : "https://prod.spline.design/.../scene-desktop.splinecode"
  }
/>
```

-----

## Common Patterns

### Pattern 1: Product Configurator

```jsx
export default function Configurator() {
  const splineRef = useRef();
  const [color, setColor] = useState('red');

  const onLoad = (spline) => {
    splineRef.current = spline;
  };

  const handleColorChange = (newColor) => {
    setColor(newColor);
    const obj = splineRef.current.findObjectByName('ProductModel');
    if (obj.material) {
      obj.material.color.set(newColor);
    }
  };

  return (
    <>
      <Spline scene="..." onLoad={onLoad} />
      <div className="controls">
        {['red', 'blue', 'green'].map(c => (
          <button key={c} onClick={() => handleColorChange(c)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}
```

### Pattern 2: Click-to-Zoom (Smooth Animation)

```jsx
export default function Zoomable() {
  const splineRef = useRef();

  const zoomTo = (objectName) => {
    const obj = splineRef.current.findObjectByName(objectName);
    const camera = splineRef.current.getScene().getCamera();

    // Animate camera to object
    camera.position.lerp(obj.position, 0.05);
    camera.lookAt(obj.position);
  };

  return (
    <>
      <Spline scene="..." onLoad={(s) => { splineRef.current = s; }} />
      <button onClick={() => zoomTo('Detail1')}>View Detail 1</button>
      <button onClick={() => zoomTo('Detail2')}>View Detail 2</button>
    </>
  );
}
```

### Pattern 3: Multi-Scene Navigation

In Spline, create multiple **Scenes**. Then switch:

```javascript
// Scene Transition Action in Spline
spline.emitEvent('NavigationButton', 'mouseDown');
// Triggers scene change defined in editor
```

Or programmatically (if supported):

```javascript
const scene1 = spline.getScene('Scene1');
const scene2 = spline.getScene('Scene2');
// Switch scenes (depends on Spline version)
```

### Pattern 4: State Machine (Vanilla JS)

```javascript
let currentState = 'idle';

function setState(newState) {
  currentState = newState;
  
  switch(newState) {
    case 'idle':
      spline.emitEvent('Object', 'resetPosition');
      break;
    case 'active':
      spline.emitEvent('Object', 'animate');
      break;
    case 'completed':
      spline.emitEvent('Object', 'celebrate');
      break;
  }
}

// Usage
setState('active');
```

-----

## Troubleshooting

### Issue: CORS Errors

**Symptom**: `Access to XMLHttpRequest... blocked by CORS policy`

**Solution 1**: Use public Spline URL (default)

```javascript
// This works (public)
spline.load('https://prod.spline.design/...')
```

**Solution 2**: Download & self-host .splinecode file

```javascript
// Download from Spline → Export → Code
// Place file locally
spline.load('/models/scene.splinecode')
```

-----

### Issue: Objects Not Responding to Events

**Symptom**: `emitEvent()` doesn’t trigger animation

**Checklist**:

- [ ] Object ID/name is correct (right-click → Copy Development Object ID)
- [ ] Event exists in Spline editor (Events panel)
- [ ] Scene is fully loaded before emitting
- [ ] Event name matches (mouseDown vs mouseUp)

**Fix**:

```javascript
spline.load('...').then(() => {
  // Event after load
  setTimeout(() => spline.emitEvent('Cube', 'mouseDown'), 500);
});
```

-----

### Issue: High Memory Usage / Slow Performance

**Check**:

1. Number of objects (should be < 2000)
1. Polygon count (should be < 500K)
1. Texture sizes (should be <= 1024px)
1. Number of lights (should be < 3)

**Fix** (in Spline editor):

```
Export → Performance Panel → Review "Opportunities"
→ Follow recommendations
```

-----

### Issue: Scene Won’t Load in Next.js

**Symptom**: Blank screen, no errors

**Solution**:

```jsx
import dynamic from 'next/dynamic';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false // ← Critical for Next.js
});
```

-----

### Issue: Variable Changes Not Detected

**Symptom**: `onChange` callback not firing

**Fix**:

```javascript
const variable = scene.getVariableByName('myVar');
variable.onChange = (newVal) => console.log(newVal);

// Must actually change the value for onChange to fire
variable.value = 'new value';
```

-----

## Best Practices

### 1. Always Check for Scene Readiness

```javascript
spline.load('...').then(() => {
  // Safe to query objects here
  const obj = scene.getObjectByName('Cube');
});
```

### 2. Use Object IDs Instead of Names (More Reliable)

```javascript
// Better
const obj = spline.findObjectById('8E8C2DDD-18B6-4C54-861D-7ED2519DE20E');

// Okay
const obj = spline.findObjectByName('Cube');
```

### 3. Cache References

```javascript
const splineRef = useRef();
const objectRef = useRef();

onLoad = (spline) => {
  splineRef.current = spline;
  objectRef.current = spline.findObjectByName('Cube');
};

// Reuse
objectRef.current.position.x += 5;
```

### 4. Debounce Frequent Updates

```javascript
import { debounce } from 'lodash';

const updateScene = debounce((value) => {
  const obj = splineRef.current.findObjectByName('Obj');
  obj.position.x = value;
}, 100);

window.addEventListener('mousemove', (e) => {
  updateScene(e.clientX);
});
```

### 5. Handle Errors Gracefully

```javascript
spline.load('...')
  .then(() => {
    console.log('Loaded');
  })
  .catch((err) => {
    console.error('Failed to load Spline scene:', err);
    // Show fallback UI
  });
```

-----

## API Reference Summary

### Spline Object Methods

|Method                                 |Returns|Notes                           |
|---------------------------------------|-------|--------------------------------|
|`findObjectByName(name)`               |Object |Get object by name              |
|`findObjectById(id)`                   |Object |Get object by ID (more reliable)|
|`getScene()`                           |Scene  |Access scene properties         |
|`emitEvent(objectId, eventType)`       |void   |Trigger animation event         |
|`addEventListener(eventType, callback)`|void   |Listen for global events        |

### Object Properties

|Property        |Type      |Mutable|
|----------------|----------|-------|
|`position`      |Vector3   |✓      |
|`rotation`      |Quaternion|✓      |
|`scale`         |Vector3   |✓      |
|`material.color`|Color     |✓      |
|`textValue`     |String    |✓      |

-----

## Next Steps

- **See `/references/code-api-advanced.md`** for complex patterns
- **See `/references/event-binding-guide.md`** for state management
- **See `/references/performance-deep-dive.md`** for optimization

-----

**Last Updated**: March 2026 | Covers Spline v1.9+ | Optimized for Claude Code