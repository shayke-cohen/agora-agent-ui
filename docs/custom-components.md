# Custom Components

Agora's visual panel is fully composable. You can register React components for any message type, replacing defaults or adding entirely new visualizations.

## How the Visual Panel Works

```
Agent Response → Visual Interceptor → Message { type, payload }
                                            ↓
                              Component Registry lookup
                                            ↓
                              Render component in visual panel
```

1. The agent writes text containing structured data (Mermaid, HTML comments, etc.)
2. The visual interceptor on the server extracts structured messages
3. Each message has a `type` (e.g., `canvas:diagram`) and a `payload`
4. The canvas looks up the registered component for that type
5. The component renders in the visual panel (right side of split view)

## Default Components

| Type | Component | Payload |
|------|-----------|---------|
| `canvas:diagram` | Diagram | `{ content: "graph TD; A-->B" }` |
| `canvas:html` | HtmlContent | `{ html: "<h1>Hello</h1>", title: "..." }` |
| `canvas:web-embed` | WebEmbed | `{ url: "https://...", title: "..." }` |

## Registering a Custom Component

### Step 1: Define the message type in config

```javascript
// agora.config.js
messageTypes: {
  'canvas:kanban': { category: 'canvas' },
},
```

### Step 2: Add an interceptor to extract the data

```javascript
// agora.config.js
interceptors: [
  {
    pattern: /<!-- kanban: (\{[\s\S]*?\}) -->/g,
    handler: (match, json) => ({
      type: 'canvas:kanban',
      payload: JSON.parse(json),
    }),
  },
],
```

### Step 3: Create the React component

```jsx
// components/Kanban.jsx
function Kanban({ payload, sendChat, sendEvent, theme }) {
  const columns = payload.columns || [];

  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, height: '100%', overflow: 'auto' }}>
      {columns.map(col => (
        <div key={col.name} style={{
          flex: 1, background: theme.surface, borderRadius: 8,
          border: `1px solid ${theme.border}`, padding: 12,
        }}>
          <h3 style={{ color: theme.text, fontSize: 14, marginBottom: 12 }}>
            {col.name} ({col.tasks.length})
          </h3>
          {col.tasks.map(task => (
            <div key={task.id} style={{
              background: theme.background, border: `1px solid ${theme.border}`,
              borderRadius: 6, padding: 10, marginBottom: 8, cursor: 'pointer',
            }}
            onClick={() => sendChat(`Tell me more about task: ${task.title}`)}
            >
              <div style={{ color: theme.text, fontSize: 13 }}>{task.title}</div>
              <div style={{ color: theme.accent, fontSize: 11, marginTop: 4 }}>
                {task.estimate}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Step 4: Register the component

```javascript
import { registerComponent } from '@agora-agent/canvas/registry';
import Kanban from './components/Kanban.jsx';

registerComponent('canvas:kanban', Kanban);
```

## Component Props

Every visual panel component receives these props:

| Prop | Type | Description |
|------|------|-------------|
| `payload` | `object` | The message payload data |
| `sendEvent` | `function(envelope)` | Send a protocol event to the server |
| `sendChat` | `function(text)` | Send a chat message as the user |
| `theme` | `object` | Current theme colors |

### Theme Object

```javascript
{
  background: '#0d1117',  // Page background
  surface: '#161b22',     // Card/panel background
  border: '#21262d',      // Border color
  text: '#c9d1d9',        // Primary text
  accent: '#58a6ff',      // Accent (from config)
  success: '#3fb950',     // Success green
  error: '#f85149',       // Error red
}
```

## Component Registry API

```javascript
import {
  registerComponent,
  registerComponents,
  getComponent,
  hasComponent,
  getRegisteredTypes,
} from '@agora-agent/canvas/registry';

// Register one component
registerComponent('canvas:kanban', KanbanComponent);

// Register multiple at once
registerComponents({
  'canvas:kanban': KanbanComponent,
  'canvas:burndown': BurndownComponent,
});

// Check if a type has a component
hasComponent('canvas:kanban'); // true

// Get the component for a type
const Component = getComponent('canvas:kanban');

// List all registered types
getRegisteredTypes(); // ['canvas:diagram', 'canvas:html', ...]
```

## Replacing Default Components

You can replace any built-in component:

```javascript
import { registerComponent } from '@agora-agent/canvas/registry';

function MyCustomDiagram({ payload, theme }) {
  // Your custom diagram renderer
  return <div>...</div>;
}

registerComponent('canvas:diagram', MyCustomDiagram);
```

## Tips

- **Keep components focused** — One component per message type. If you need multiple views, use different message types.
- **Use the theme** — Always use `theme` colors instead of hardcoding. This ensures consistency.
- **Interact via sendChat** — When the user clicks something in your component, use `sendChat()` to send a message that the agent can respond to.
- **Handle missing data** — Always check `payload` fields exist before rendering. Return `null` if data is missing.
