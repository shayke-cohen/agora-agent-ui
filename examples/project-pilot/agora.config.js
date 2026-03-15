export default {
  name: 'ProjectPilot',
  port: 4568,

  agent: {
    systemPrompt: [
      'You are ProjectPilot, an AI project management assistant.',
      '',
      'WHAT YOU DO:',
      '- Help teams plan sprints, break down features into tasks, and track progress.',
      '- Visualize project status with kanban boards and burndown charts.',
      '- Suggest task priorities and identify blockers.',
      '',
      'HOW TO INTERACT:',
      '- When the user describes a feature, break it into tasks with estimates.',
      '- Use mermaid diagrams for timelines and dependency graphs.',
      '- Show project status using inline progress bars and card blocks.',
      '- Use suggestion chips to guide planning workflows.',
      '',
      'OUTPUT FORMAT:',
      '- Use <!-- kanban: {...} --> to show task boards.',
      '- Use inline blocks for task cards with status indicators.',
      '- Categorize tasks: 📋 To Do, 🔄 In Progress, ✅ Done, 🚫 Blocked.',
    ].join('\n'),
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: 'bypassPermissions',
    mcpServers: {
      'memory': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
    },
  },

  plugins: [
    { type: 'local', path: './skills' },
  ],

  messageTypes: {
    'canvas:kanban': { category: 'canvas' },
    'canvas:burndown': { category: 'canvas' },
  },

  interceptors: [
    {
      pattern: /<!-- kanban: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:kanban',
        payload: JSON.parse(json),
      }),
    },
    {
      pattern: /<!-- burndown: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:burndown',
        payload: JSON.parse(json),
      }),
    },
  ],

  endpoints: [
    {
      method: 'GET',
      path: '/api/project-stats',
      handler: (req, res, ctx) => {
        ctx.sendJson(200, {
          sprints: 0,
          tasks: { todo: 0, inProgress: 0, done: 0, blocked: 0 },
          velocity: 0,
        });
      },
    },
  ],

  canvas: {
    theme: 'dark',
    accent: '#3fb950',
    branding: { title: 'ProjectPilot' },
    welcome: {
      title: 'ProjectPilot',
      subtitle: 'Plan sprints, track tasks, and ship on time.',
      suggestions: [
        { label: 'Plan a sprint', text: 'Help me plan a 2-week sprint for our team' },
        { label: 'Break down a feature', text: 'Break down a user authentication feature into tasks' },
        { label: 'Show project status', text: 'Show me the current project status and blockers' },
      ],
    },
  },
};
