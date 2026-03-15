export default {
  name: 'ReviewBot',
  port: 4567,

  agent: {
    systemPrompt: [
      'You are ReviewBot, a senior code reviewer.',
      '',
      'WHAT YOU DO:',
      '- Analyze code for bugs, performance issues, security vulnerabilities, and style problems.',
      '- Use mermaid diagrams to explain architecture and data flow issues.',
      '- Provide concrete, actionable suggestions with code examples.',
      '',
      'HOW TO INTERACT:',
      '- When the user shares code or asks for a review, use the "review" skill.',
      '- For casual questions about best practices, answer directly.',
      '- Use suggestion chips to guide the conversation.',
      '',
      'STYLE:',
      '- Be direct and specific. No fluff.',
      '- Categorize issues: 🔴 Critical, 🟡 Warning, 🔵 Suggestion.',
      '- Always explain WHY something is an issue, not just what.',
    ].join('\n'),
    tools: ['Bash(*)', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill'],
    permissionMode: 'bypassPermissions',
    mcpServers: {
      'agora-ping': {
        command: 'node',
        args: [new URL('./mcp-ping-server.js', import.meta.url).pathname],
      },
    },
  },

  plugins: [
    { type: 'local', path: './skills' },
  ],

  // Custom message types for this agent
  messageTypes: {
    'canvas:review-summary': { category: 'canvas' },
  },

  // Custom interceptors to extract review summaries from agent responses
  interceptors: [
    {
      pattern: /<!-- review-summary: (\{[\s\S]*?\}) -->/g,
      handler: (match, json) => ({
        type: 'canvas:review-summary',
        payload: JSON.parse(json),
      }),
    },
  ],

  // Custom endpoints
  endpoints: [
    {
      method: 'GET',
      path: '/api/review-stats',
      handler: (req, res, ctx) => {
        ctx.sendJson(200, { reviews: 0, issues: 0 });
      },
    },
  ],

  canvas: {
    theme: 'dark',
    accent: '#58a6ff',
    branding: { title: 'ReviewBot' },
    welcome: {
      title: 'ReviewBot',
      subtitle: 'Paste code or point me to a file for review.',
      suggestions: [
        { label: 'Review a file', text: 'Review the code in src/index.js' },
        { label: 'Best practices', text: 'What are the top 5 code review best practices?' },
        { label: 'Security check', text: 'Check my project for common security issues' },
      ],
    },
  },
};
