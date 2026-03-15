import { describe, it, expect, beforeEach } from 'vitest';

let registry;

describe('componentRegistry', () => {
  beforeEach(async () => {
    registry = await import('./componentRegistry.js');
  });

  it('has default components registered', () => {
    expect(registry.hasComponent('canvas:diagram')).toBe(true);
    expect(registry.hasComponent('canvas:html')).toBe(true);
    expect(registry.hasComponent('canvas:web-embed')).toBe(true);
  });

  it('getComponents returns all registered components', () => {
    const components = registry.getComponents();
    expect(Object.keys(components)).toContain('canvas:diagram');
    expect(Object.keys(components)).toContain('canvas:html');
    expect(Object.keys(components)).toContain('canvas:web-embed');
  });

  it('registerComponent adds a new component', () => {
    const MockComponent = () => null;
    registry.registerComponent('canvas:custom', MockComponent);
    expect(registry.hasComponent('canvas:custom')).toBe(true);
    expect(registry.getComponent('canvas:custom')).toBe(MockComponent);
  });

  it('registerComponent replaces existing component', () => {
    const NewDiagram = () => null;
    registry.registerComponent('canvas:diagram', NewDiagram);
    expect(registry.getComponent('canvas:diagram')).toBe(NewDiagram);
  });

  it('registerComponent throws for invalid type', () => {
    expect(() => registry.registerComponent('', () => null)).toThrow('non-empty string');
    expect(() => registry.registerComponent(null, () => null)).toThrow('non-empty string');
  });

  it('registerComponent throws for non-function component', () => {
    expect(() => registry.registerComponent('canvas:x', 'not-a-function')).toThrow('React component');
    expect(() => registry.registerComponent('canvas:x', {})).toThrow('React component');
  });

  it('registerComponents adds multiple at once', () => {
    const A = () => null;
    const B = () => null;
    registry.registerComponents({ 'canvas:a': A, 'canvas:b': B });
    expect(registry.hasComponent('canvas:a')).toBe(true);
    expect(registry.hasComponent('canvas:b')).toBe(true);
  });

  it('getComponent returns null for unknown type', () => {
    expect(registry.getComponent('canvas:nonexistent')).toBeNull();
  });

  it('hasComponent returns false for unknown type', () => {
    expect(registry.hasComponent('canvas:nonexistent')).toBe(false);
  });

  it('getRegisteredTypes returns all type strings', () => {
    const types = registry.getRegisteredTypes();
    expect(types).toContain('canvas:diagram');
    expect(types).toContain('canvas:html');
    expect(types).toContain('canvas:web-embed');
    expect(Array.isArray(types)).toBe(true);
  });
});
