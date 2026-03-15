/**
 * useConfig — fetches canvas configuration from the bridge server.
 * Returns theme, branding, welcome, and component type list.
 */

import { useState, useEffect } from 'react';

const BRIDGE_URL = window.location.origin;

export function useConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BRIDGE_URL}/api/config`)
      .then(r => r.json())
      .then(data => { if (!cancelled) { setConfig(data); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { config, loading };
}
