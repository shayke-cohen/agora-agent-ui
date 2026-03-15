export default {
  name: 'OpsConsole',
  port: 4569,

  agent: {
    systemPrompt: [
      'You are OpsConsole, a DevOps monitoring and incident response assistant.',
      '',
      'WHAT YOU DO:',
      '- Monitor service health, analyze logs, and help debug incidents.',
      '- Visualize system architecture and service dependencies.',
      '- Guide incident response with runbooks and escalation procedures.',
      '',
      'HOW TO INTERACT:',
      '- When asked about service status, show health dashboards.',
      '- Use mermaid diagrams for architecture and dependency visualization.',
      '- Show alerts and incidents using color-coded inline cards.',
      '- Guide troubleshooting with step-by-step procedures.',
      '',
      'OUTPUT FORMAT:',
      '- Use <!-- status-panel: {...} --> for service status dashboards.',
      '- Categorize alerts: 🔴 Critical, 🟠 Warning, 🟢 Healthy, ⚪ Unknown.',
      '- Include timestamps and duration for all incidents.',
    ].join('\n'),
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: 'bypassPermissions',
    mcpServers: {
      'filesystem': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/var/log'],
      },
    },
  },

  plugins: [
    { type: 'local', path: './skills' },
  ],

  messageTypes: {
    'canvas:status-panel': { category: 'canvas' },
    'canvas:log-viewer': { category: 'canvas' },
  },

  interceptors: [
    {
      pattern: /<!-- status-panel: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:status-panel',
        payload: JSON.parse(json),
      }),
    },
    {
      pattern: /<!-- log-viewer: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:log-viewer',
        payload: JSON.parse(json),
      }),
    },
  ],

  endpoints: [
    {
      method: 'GET',
      path: '/api/service-health',
      handler: (req, res, ctx) => {
        ctx.sendJson(200, {
          services: [
            { name: 'api-gateway', status: 'healthy', latency: 45, uptime: 99.98 },
            { name: 'auth-service', status: 'healthy', latency: 23, uptime: 99.99 },
            { name: 'database', status: 'healthy', latency: 12, uptime: 99.95 },
            { name: 'cache', status: 'degraded', latency: 150, uptime: 98.5 },
            { name: 'worker-queue', status: 'healthy', latency: 8, uptime: 99.97 },
          ],
          incidents: { active: 1, resolved_today: 3 },
          timestamp: new Date().toISOString(),
        });
      },
    },
    {
      method: 'GET',
      path: '/api/incidents',
      handler: (req, res, ctx) => {
        ctx.sendJson(200, {
          active: [
            {
              id: 'INC-2024-042',
              title: 'Cache latency spike',
              severity: 'warning',
              service: 'cache',
              started: '2024-03-15T08:30:00Z',
              assignee: 'oncall-team',
            },
          ],
          recent: [],
        });
      },
    },
  ],

  canvas: {
    theme: 'dark',
    accent: '#f0883e',
    branding: { title: 'OpsConsole' },
    welcome: {
      title: 'OpsConsole',
      subtitle: 'Monitor services, investigate incidents, and keep systems running.',
      suggestions: [
        { label: 'Service status', text: 'Show me the current service health dashboard' },
        { label: 'Active incidents', text: 'What incidents are currently active?' },
        { label: 'Check logs', text: 'Show me recent error logs from the API gateway' },
      ],
    },
  },
};
