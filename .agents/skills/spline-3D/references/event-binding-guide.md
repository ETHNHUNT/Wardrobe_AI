# Event Binding & State Management Guide

Comprehensive guide to Spline’s event system and state management from the code perspective.

-----

## Event System Overview

### Events Triggered in Spline Editor

**Where**: Right-click object → Events panel

**Event Types**:

1. **Input Events**: Mouse (Down, Up, Hover, Press), Keyboard (Down, Up, Press)
1. **Scene Events**: Start, Scroll, Resize
1. **Physics Events**: Collision, Trigger Area
1. **State Events**: State Change, Variable Change
1. **Data Events**: API Updated, Webhook Called
1. **Animation Events**: Trigger Timeline

-----

## React Event Listener Props

### Available Props on `<Spline>` Component

```jsx
<Spline
  // Mouse events
  onSplineMouseDown={(e) => {}}
  onSplineMouseUp={(e) => {}}
  onSplineMouseHover={(e) => {}}
  onSplineMousePress={(e) => {}}
  
  // Keyboard events
  onSplineKeyDown={(e) => {}}
  onSplineKeyUp={(e) => {}}
  onSplineKeyPress={(e) => {}}
  
  // Scene events
  onSplineScroll={(e) => {}}
  onSplineStart={(e) => {}}
/>
```

### Event Object Structure

```typescript
interface SplineEvent {
  type: string;           // 'mouseDown', 'mouseUp', etc.
  target: {
    name: string;         // Object name in Spline
    id: string;           // Object ID
    position: Vector3;
    rotation: Quaternion;
  };
  position?: {            // Mouse position
    x: number;
    y: number;
  };
}
```

-----

## Pattern 1: Object-Based Event Handling

### Filter Events by Object Name

```jsx
function InteractiveScene() {
  function onSplineMouseDown(e) {
    // Check which object was clicked
    switch(e.target.name) {
      case 'Button_Red':
        handleRedButtonClick();
        break;
      case 'Button_Blue':
        handleBlueButtonClick();
        break;
      case 'Model':
        handleModelClick();
        break;
    }
  }

  function handleRedButtonClick() {
    console.log('Red button clicked');
  }

  return (
    <Spline 
      scene="..." 
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

### Filter Events by Object ID

```jsx
const OBJECT_IDS = {
  redButton: '8E8C2DDD-18B6-4C54-861D-7ED2519DE20E',
  blueButton: '7AF5EBC0-09BB-4720-B045-F478F8053AA4',
};

function onSplineMouseDown(e) {
  if (e.target.id === OBJECT_IDS.redButton) {
    handleRedButtonClick();
  } else if (e.target.id === OBJECT_IDS.blueButton) {
    handleBlueButtonClick();
  }
}
```

-----

## Pattern 2: State-Based Event Handlers

### Using React State

```jsx
import { useState } from 'react';
import Spline from '@splinetool/react-spline';

export default function StatefulScene() {
  const [activeObject, setActiveObject] = useState(null);
  const [clickCount, setClickCount] = useState(0);

  function onSplineMouseDown(e) {
    setActiveObject(e.target.name);
    setClickCount(count => count + 1);
  }

  function onSplineMouseUp(e) {
    setActiveObject(null);
  }

  return (
    <div>
      <Spline 
        scene="..."
        onSplineMouseDown={onSplineMouseDown}
        onSplineMouseUp={onSplineMouseUp}
      />
      <div>
        Active: {activeObject}
        Clicks: {clickCount}
      </div>
    </div>
  );
}
```

-----

## Pattern 3: Combined Spline Editor Events + Code Events

### Setup in Spline Editor

```
Object "Cube" Events:
  - Mouse Down Event → Transition to "Scaled" state
```

### Combine with Code Events

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function Combined() {
  const splineRef = useRef();

  function onSplineMouseDown(e) {
    if (e.target.name === 'Cube') {
      // 1. Editor event already triggers animation
      // 2. Also trigger code logic
      console.log('Cube animation started');
      logAnalytics('cube_clicked');
    }
  }

  return (
    <Spline 
      scene="..."
      onLoad={(spline) => { splineRef.current = spline; }}
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

-----

## Pattern 4: Event Delegation (Event Bubbling)

### Filter Events at Container Level

```jsx
export default function EventDelegation() {
  const splineRef = useRef();

  const handleAllEvents = (eventType) => (e) => {
    // Log all events
    console.log(`${eventType}: ${e.target.name}`);

    // Route to handlers
    if (e.target.name.startsWith('Button_')) {
      handleButtonClick(e);
    } else if (e.target.name.startsWith('Model_')) {
      handleModelClick(e);
    }
  };

  const handleButtonClick = (e) => {
    const buttonType = e.target.name.replace('Button_', '');
    console.log('Button clicked:', buttonType);
  };

  const handleModelClick = (e) => {
    console.log('Model clicked');
  };

  return (
    <Spline 
      scene="..."
      onSplineMouseDown={handleAllEvents('mouseDown')}
      onSplineMouseUp={handleAllEvents('mouseUp')}
      onSplineMouseHover={handleAllEvents('hover')}
    />
  );
}
```

-----

## Pattern 5: Event + Animation Sequence

### Chain Events to Animations

```jsx
import { useRef } from 'react';
import Spline from '@splinetool/react-spline';

export default function AnimationSequence() {
  const splineRef = useRef();
  const [isAnimating, setIsAnimating] = useState(false);

  const onSplineMouseDown = (e) => {
    if (e.target.name === 'StartButton' && !isAnimating) {
      triggerAnimationSequence();
    }
  };

  const triggerAnimationSequence = async () => {
    setIsAnimating(true);

    // Step 1: Emit event (triggers Spline animation)
    splineRef.current.emitEvent('Cube', 'mouseDown');
    await wait(1000);

    // Step 2: Emit second event
    splineRef.current.emitEvent('Sphere', 'mouseDown');
    await wait(1000);

    // Step 3: Reset
    splineRef.current.emitEvent('AllObjects', 'reset');
    setIsAnimating(false);
  };

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <Spline 
      scene="..."
      onLoad={(spline) => { splineRef.current = spline; }}
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

-----

## Pattern 6: Hover Effects (Smooth State)

### Visual Feedback on Hover

```jsx
export default function HoverEffects() {
  const splineRef = useRef();
  const hoveredObjectRef = useRef(null);

  const onSplineMouseHover = (e) => {
    // Store hovered object
    hoveredObjectRef.current = e.target.name;
    
    // Visual feedback: highlight or scale
    const obj = splineRef.current.findObjectByName(e.target.name);
    if (obj) {
      obj.scale.set(1.2, 1.2, 1.2);
    }
  };

  const onSplineMouseDown = (e) => {
    // Use cached hover state
    if (hoveredObjectRef.current === 'InteractiveObject') {
      handleInteraction(hoveredObjectRef.current);
    }
  };

  const handleInteraction = (objectName) => {
    console.log('Interacted with:', objectName);
  };

  return (
    <Spline 
      scene="..."
      onLoad={(spline) => { splineRef.current = spline; }}
      onSplineMouseHover={onSplineMouseHover}
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

-----

## Pattern 7: Keyboard Navigation

### Use Keyboard Events

```jsx
export default function KeyboardNav() {
  const splineRef = useRef();
  const [direction, setDirection] = useState({ x: 0, y: 0 });

  const onSplineKeyDown = (e) => {
    // e.key might not be available; use event in Spline editor instead
    // This example assumes Spline Key Down event mapped to JavaScript
    console.log('Key pressed');
  };

  // Better: Use HTML keyboard events with Spline integration
  useEffect(() => {
    const handleKeyDown = (e) => {
      let newDir = { ...direction };
      
      if (e.key === 'ArrowUp' || e.key === 'w') newDir.y = 1;
      if (e.key === 'ArrowDown' || e.key === 's') newDir.y = -1;
      if (e.key === 'ArrowLeft' || e.key === 'a') newDir.x = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') newDir.x = 1;
      
      if (splineRef.current) {
        const camera = splineRef.current.getScene().getCamera();
        camera.position.x += newDir.x * 0.5;
        camera.position.z += newDir.y * 0.5;
      }
      
      setDirection(newDir);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction]);

  return <Spline scene="..." onLoad={(s) => { splineRef.current = s; }} />;
}
```

-----

## Variables in Code

### Reading Variables

```jsx
import { useEffect, useState, useRef } from 'react';

export default function VariableBinding() {
  const splineRef = useRef();
  const [varValue, setVarValue] = useState(null);

  const onLoad = (spline) => {
    splineRef.current = spline;
    
    const scene = spline.getScene();
    const variable = scene.getVariableByName('myVariable');
    
    if (variable) {
      // Read current value
      setVarValue(variable.value);
      
      // Listen for changes from Spline editor
      variable.onChange = (newValue) => {
        setVarValue(newValue);
        console.log('Variable changed:', newValue);
      };
    }
  };

  return (
    <>
      <Spline scene="..." onLoad={onLoad} />
      <div>Current value: {varValue}</div>
    </>
  );
}
```

### Writing Variables

```jsx
const updateVariable = (name, newValue) => {
  if (!splineRef.current) return;
  
  const scene = splineRef.current.getScene();
  const variable = scene.getVariableByName(name);
  
  if (variable) {
    variable.value = newValue;
    // onChange callback will fire
  }
};

// Usage
<button onClick={() => updateVariable('selectedColor', 'red')}>
  Red
</button>
```

-----

## Event + Variable Pattern

### Events Trigger Variable Updates

**Setup in Spline Editor**:

```
Scene → Start Event → Set Variable "counter" = 0
Button → Mouse Down Event → Variable Control "counter" += 1
```

**Read in Code**:

```jsx
export default function EventVariableSync() {
  const splineRef = useRef();
  const [counter, setCounter] = useState(0);

  const onLoad = (spline) => {
    splineRef.current = spline;
    
    const scene = spline.getScene();
    const counterVar = scene.getVariableByName('counter');
    
    if (counterVar) {
      counterVar.onChange = (newValue) => {
        setCounter(newValue);
      };
    }
  };

  return (
    <>
      <Spline scene="..." onLoad={onLoad} />
      <div>Count: {counter}</div>
    </>
  );
}
```

-----

## Debouncing High-Frequency Events

### Mouse Move / Scroll Events

```jsx
import { useRef, useEffect } from 'react';

export default function DebouncedEvents() {
  const splineRef = useRef();
  const debounceTimerRef = useRef(null);

  const onSplineMouseDown = (e) => {
    // Debounce rapid clicks
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('Handle click:', e.target.name);
    }, 100);
  };

  const onSplineScroll = (e) => {
    // Debounce scroll events
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('Handle scroll');
    }, 50);
  };

  return (
    <Spline 
      scene="..."
      onSplineMouseDown={onSplineMouseDown}
      onSplineScroll={onSplineScroll}
    />
  );
}
```

-----

## Event Logging & Analytics

### Track User Interactions

```jsx
export default function AnalyticsIntegration() {
  const onSplineMouseDown = (e) => {
    // Send to analytics
    if (window.gtag) {
      gtag('event', 'spline_click', {
        object_name: e.target.name,
        object_id: e.target.id,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <Spline 
      scene="..."
      onSplineMouseDown={onSplineMouseDown}
    />
  );
}
```

-----

## Troubleshooting Events

### Events Not Firing?

**Checklist**:

1. Object must exist in scene (verify in Spline editor)
1. Event listener prop name must match exactly (e.g., `onSplineMouseDown`)
1. Scene must be fully loaded before events fire
1. Object name/ID must be correct

**Debug**:

```jsx
const onSplineMouseDown = (e) => {
  console.log('Event fired!');
  console.log('Target name:', e.target.name);
  console.log('Target ID:', e.target.id);
  console.log('Event type:', e.type);
};
```

-----

**Last Updated**: March 2026 | Event System Reference