# Advanced Code Patterns for Spline

Production-grade patterns and advanced techniques for Spline integration in web applications.

-----

## Table of Contents

1. [Advanced State Management](#advanced-state-management)
1. [Real-Time Synchronization](#real-time-synchronization)
1. [TypeScript Integration](#typescript-integration)
1. [Performance Monitoring](#performance-monitoring)
1. [Error Handling & Resilience](#error-handling--resilience)
1. [Complex Animation Sequences](#complex-animation-sequences)
1. [Multi-Scene Architectures](#multi-scene-architectures)
1. [Custom Input Handling](#custom-input-handling)

-----

## Advanced State Management

### Pattern: useSpline Hook (React)

```typescript
// useSpline.ts
import { useRef, useCallback, useState, useEffect } from 'react';

interface SplineScene {
  getScene: () => any;
  findObjectByName: (name: string) => any;
  findObjectById: (id: string) => any;
  emitEvent: (id: string, event: string) => void;
  addEventListener: (event: string, callback: Function) => void;
}

export const useSpline = (url: string) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const splineRef = useRef<SplineScene | null>(null);
  const [scene, setScene] = useState<any>(null);

  const onLoad = useCallback((spline: SplineScene) => {
    splineRef.current = spline;
    setScene(spline.getScene());
    setIsLoaded(true);
  }, []);

  const getObject = useCallback((nameOrId: string) => {
    if (!splineRef.current) return null;
    
    try {
      // Try ID first (more reliable)
      return splineRef.current.findObjectById(nameOrId) 
        || splineRef.current.findObjectByName(nameOrId);
    } catch (err) {
      console.error(`Failed to find object: ${nameOrId}`, err);
      return null;
    }
  }, []);

  const updateObject = useCallback((
    nameOrId: string,
    updates: Record<string, any>
  ) => {
    const obj = getObject(nameOrId);
    if (!obj) return;

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'position' || key === 'rotation' || key === 'scale') {
        obj[key].set(...Object.values(value));
      } else if (key === 'color') {
        obj.material?.color?.set(value);
      } else if (key === 'text') {
        obj.textValue = value;
      } else {
        obj[key] = value;
      }
    });
  }, [getObject]);

  const triggerAnimation = useCallback((
    objectId: string,
    eventType: string
  ) => {
    if (!splineRef.current) return;
    splineRef.current.emitEvent(objectId, eventType);
  }, []);

  const onSceneEvent = useCallback((
    eventType: string,
    callback: (e: any) => void
  ) => {
    if (!splineRef.current) return;
    splineRef.current.addEventListener(eventType, callback);
  }, []);

  return {
    isLoaded,
    error,
    onLoad,
    spline: splineRef.current,
    scene,
    getObject,
    updateObject,
    triggerAnimation,
    onSceneEvent,
  };
};
```

**Usage**:

```jsx
function MyComponent() {
  const { isLoaded, getObject, updateObject, triggerAnimation } = 
    useSpline('https://prod.spline.design/.../scene.splinecode');

  const handleClick = () => {
    updateObject('Cube', { position: { x: 5, y: 0, z: 0 } });
    triggerAnimation('Cube', 'mouseDown');
  };

  return (
    <>
      {!isLoaded && <div>Loading...</div>}
      <button onClick={handleClick} disabled={!isLoaded}>
        Animate
      </button>
    </>
  );
}
```

-----

### Pattern: Zustand State Store (React)

```typescript
// splineStore.ts
import { create } from 'zustand';

interface SplineState {
  scene: any;
  objects: Map<string, any>;
  variables: Record<string, any>;
  isLoaded: boolean;
  setScene: (scene: any) => void;
  addObject: (id: string, obj: any) => void;
  updateVariable: (name: string, value: any) => void;
  getVariable: (name: string) => any;
}

export const useSplineStore = create<SplineState>((set, get) => ({
  scene: null,
  objects: new Map(),
  variables: {},
  isLoaded: false,

  setScene: (scene) => set({ scene, isLoaded: !!scene }),

  addObject: (id, obj) => 
    set(state => new Map(state.objects).set(id, obj)),

  updateVariable: (name, value) =>
    set(state => ({
      variables: { ...state.variables, [name]: value }
    })),

  getVariable: (name) => get().variables[name],
}));

// Usage
function Component() {
  const scene = useSplineStore(state => state.scene);
  const updateVar = useSplineStore(state => state.updateVariable);

  return null;
}
```

-----

## Real-Time Synchronization

### WebSocket Sync Pattern

```typescript
// splineSync.ts
import { useEffect, useRef } from 'react';

export function useSplineSync(
  splineRef: React.RefObject<any>,
  wsUrl: string
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!splineRef.current) return;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle different message types
      switch (message.type) {
        case 'updateObject':
          const obj = splineRef.current.findObjectById(message.objectId);
          if (obj) {
            obj.position.set(...message.position);
            obj.rotation.set(...message.rotation);
          }
          break;

        case 'triggerAnimation':
          splineRef.current.emitEvent(message.objectId, message.eventType);
          break;

        case 'updateVariable':
          const scene = splineRef.current.getScene();
          const variable = scene.getVariableByName(message.varName);
          if (variable) variable.value = message.value;
          break;
      }
    };

    return () => {
      wsRef.current?.close();
    };
  }, [splineRef, wsUrl]);

  const send = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { send };
}
```

**Usage**: Sync Spline scenes across multiple clients in real-time.

-----

## TypeScript Integration

### Strongly-Typed Spline API

```typescript
// splineTypes.ts
export interface SplineObject {
  id: string;
  name: string;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  material?: {
    color: { set: (color: string | number) => void };
  };
  textValue?: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
  set: (x: number, y: number, z: number) => void;
  lerp: (target: Vector3, alpha: number) => void;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  set: (x: number, y: number, z: number, w: number) => void;
}

export interface SplineScene {
  getScene: () => Scene;
  findObjectById: (id: string) => SplineObject | null;
  findObjectByName: (name: string) => SplineObject | null;
  emitEvent: (objectId: string, eventType: string) => void;
  addEventListener: (eventType: string, handler: EventHandler) => void;
  load: (url: string) => Promise<void>;
}

export type EventHandler = (event: SplineEvent) => void;

export interface SplineEvent {
  type: string;
  target: SplineObject;
  position?: { x: number; y: number };
}

export interface Scene {
  getObjectById: (id: string) => SplineObject | null;
  getVariableByName: (name: string) => Variable | null;
  getCamera: () => Camera;
}

export interface Variable {
  value: any;
  onChange: (newValue: any) => void;
}

export interface Camera {
  position: Vector3;
  rotation: Quaternion;
  lookAt: (target: Vector3) => void;
}
```

**Typed Hook**:

```typescript
// useSplineTyped.ts
export const useSplineTyped = (
  url: string
): {
  spline: SplineScene | null;
  getObject: (id: string) => SplineObject | null;
  trigger: (id: string, event: 'mouseDown' | 'mouseUp' | 'mouseHover') => void;
} => {
  // Implementation with full TypeScript support
  const splineRef = useRef<SplineScene | null>(null);

  // ... rest of implementation
};
```

-----

## Performance Monitoring

### Render Performance Tracking

```typescript
// performanceMonitor.ts
export class SplinePerformanceMonitor {
  private frameCount = 0;
  private frameTime = 0;
  private fps = 60;
  private metrics: {
    avgFrameTime: number;
    maxFrameTime: number;
    minFrameTime: number;
  } = { avgFrameTime: 0, maxFrameTime: 0, minFrameTime: Infinity };

  constructor(private onMetrics?: (metrics: any) => void) {}

  startFrame() {
    return performance.now();
  }

  endFrame(startTime: number) {
    const frameTime = performance.now() - startTime;
    this.frameCount++;
    this.frameTime += frameTime;

    // Update metrics every 60 frames (1 second at 60fps)
    if (this.frameCount >= 60) {
      this.metrics.avgFrameTime = this.frameTime / this.frameCount;
      this.metrics.maxFrameTime = Math.max(
        this.metrics.maxFrameTime,
        frameTime
      );
      this.metrics.minFrameTime = Math.min(
        this.metrics.minFrameTime,
        frameTime
      );
      this.fps = 1000 / this.metrics.avgFrameTime;

      this.onMetrics?.(this.metrics);

      this.frameCount = 0;
      this.frameTime = 0;
    }
  }

  getMetrics() {
    return { ...this.metrics, fps: this.fps };
  }
}
```

**Usage**:

```typescript
const monitor = new SplinePerformanceMonitor((metrics) => {
  console.log(`FPS: ${metrics.fps.toFixed(0)}, Avg Frame: ${metrics.avgFrameTime.toFixed(2)}ms`);
});

const animate = () => {
  const start = monitor.startFrame();
  
  // Update Spline scene
  
  monitor.endFrame(start);
  requestAnimationFrame(animate);
};
```

-----

## Error Handling & Resilience

### Robust Scene Loading

```typescript
export async function loadSplineWithRetry(
  url: string,
  maxRetries = 3,
  timeout = 10000
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Promise.race([
        loadSpline(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error);

      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}

async function loadSpline(url: string): Promise<any> {
  const { Application } = await import('@splinetool/runtime');
  const canvas = document.createElement('canvas');
  const app = new Application(canvas);
  await app.load(url);
  return app;
}
```

-----

## Complex Animation Sequences

### Multi-Step Animation Chain

```typescript
export class AnimationSequence {
  private steps: Array<{
    objectId: string;
    duration: number;
    easing: (t: number) => number;
    update: (progress: number) => void;
  }> = [];

  add(
    objectId: string,
    duration: number,
    easing: (t: number) => number,
    update: (progress: number) => void
  ) {
    this.steps.push({ objectId, duration, easing, update });
    return this;
  }

  async play(spline: any) {
    for (const step of this.steps) {
      await this.playStep(step);
    }
  }

  private playStep(step: any): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / step.duration, 1);
        const eased = step.easing(progress);

        step.update(eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }
}

// Easing functions
export const easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => 
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

// Usage
const sequence = new AnimationSequence();
sequence
  .add('Cube', 1000, easing.easeOutQuad, (progress) => {
    cube.position.x = progress * 10;
  })
  .add('Sphere', 800, easing.easeInQuad, (progress) => {
    sphere.rotation.z = progress * Math.PI;
  });

await sequence.play(spline);
```

-----

## Multi-Scene Architectures

### Scene Manager

```typescript
export class SceneManager {
  private scenes: Map<string, any> = new Map();
  private currentScene: string | null = null;

  async registerScene(
    name: string,
    url: string,
    canvas: HTMLCanvasElement
  ) {
    const { Application } = await import('@splinetool/runtime');
    const app = new Application(canvas);
    await app.load(url);
    this.scenes.set(name, app);
  }

  switchScene(name: string) {
    if (!this.scenes.has(name)) {
      throw new Error(`Scene '${name}' not found`);
    }
    this.currentScene = name;
    // Hide other scenes, show current
  }

  getCurrentScene() {
    if (!this.currentScene) return null;
    return this.scenes.get(this.currentScene);
  }

  getCurrentSpline() {
    const scene = this.getCurrentScene();
    return scene?.getScene();
  }
}
```

-----

## Custom Input Handling

### Gesture-Based Control

```typescript
export function useSplineGestures(
  containerRef: React.RefObject<HTMLDivElement>,
  splineRef: React.RefObject<any>
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let isPressed = false;
    let startX = 0;
    let startY = 0;

    container.addEventListener('mousedown', (e) => {
      isPressed = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    container.addEventListener('mousemove', (e) => {
      if (!isPressed || !splineRef.current) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const camera = splineRef.current.getScene().getCamera();
      camera.rotation.y += deltaX * 0.005;
      camera.rotation.x += deltaY * 0.005;
    });

    container.addEventListener('mouseup', () => {
      isPressed = false;
    });
  }, [containerRef, splineRef]);
}
```

-----

**Last Updated**: March 2026 | Production-Ready Patterns