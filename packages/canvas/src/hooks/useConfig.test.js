import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConfig } from './useConfig.js';

describe('useConfig', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('starts with loading=true and config=null', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ name: 'Test' }),
    });
    const { result } = renderHook(() => useConfig());
    expect(result.current.loading).toBe(true);
    expect(result.current.config).toBeNull();
  });

  it('loads config from /api/config', async () => {
    const mockConfig = {
      name: 'My Agent',
      theme: 'dark',
      accent: '#ff0000',
      branding: { title: 'My Agent' },
      welcome: { title: 'Hi', suggestions: [] },
      components: [],
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockConfig),
    });

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.config).toEqual(mockConfig);
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/config'));
  });

  it('handles fetch error gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConfig());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.config).toBeNull();
  });
});
