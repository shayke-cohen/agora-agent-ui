/**
 * Component registry — manages visual panel components.
 *
 * Default components are always available. Users can register additional
 * components for custom message types, or replace defaults.
 */

import defaultComponents from './defaultComponents.js';

const _registry = { ...defaultComponents };

/**
 * Register a React component for a message type.
 * Replaces any existing component for that type.
 * @param {string} type - Message type (e.g. 'canvas:dashboard')
 * @param {React.Component} component - React component to render
 */
export function registerComponent(type, component) {
  if (typeof type !== 'string' || !type) throw new Error('type must be a non-empty string');
  if (typeof component !== 'function') throw new Error('component must be a React component (function)');
  _registry[type] = component;
}

/**
 * Register multiple components at once.
 * @param {Object<string, React.Component>} map - Map of type -> component
 */
export function registerComponents(map) {
  for (const [type, component] of Object.entries(map)) {
    registerComponent(type, component);
  }
}

/**
 * Get the component registered for a message type.
 * @param {string} type
 * @returns {React.Component|null}
 */
export function getComponent(type) {
  return _registry[type] || null;
}

/**
 * Get all registered components.
 * @returns {Object<string, React.Component>}
 */
export function getComponents() {
  return { ..._registry };
}

/**
 * Check if a component is registered for a type.
 * @param {string} type
 * @returns {boolean}
 */
export function hasComponent(type) {
  return type in _registry;
}

/**
 * Get list of registered message types.
 * @returns {string[]}
 */
export function getRegisteredTypes() {
  return Object.keys(_registry);
}
