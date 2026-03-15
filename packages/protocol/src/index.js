/**
 * Agora Agent UI — Message Protocol
 *
 * Defines the envelope format, built-in message types, tier constants,
 * and an extensible type registry for custom message types.
 */

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------
// Built-in message types
// ---------------------------------------------------------------------------

/** Visual commands (Agent -> Canvas) */
export const MSG_CANVAS_DIAGRAM = 'canvas:diagram';
export const MSG_CANVAS_HTML = 'canvas:html';
export const MSG_CANVAS_CELEBRATE = 'canvas:celebrate';
export const MSG_CANVAS_TERMINAL = 'canvas:terminal';
export const MSG_CANVAS_WORKSHOP = 'canvas:workshop';
export const MSG_CANVAS_WORKSHOP_UPDATE = 'canvas:workshop-update';
export const MSG_CANVAS_CODE = 'canvas:code';
export const MSG_CANVAS_CODE_RESULT = 'canvas:code-result';
export const MSG_CANVAS_QUIZ = 'canvas:quiz';
export const MSG_CANVAS_GAME = 'canvas:game';
export const MSG_CANVAS_SETTINGS = 'canvas:settings';
export const MSG_CANVAS_WEB_EMBED = 'canvas:web-embed';

/** User events (Canvas -> Agent) */
export const MSG_EVENT_QUIZ_ANSWER = 'event:quiz-answer';
export const MSG_EVENT_CODE_RUN = 'event:code-run';
export const MSG_EVENT_CLICK = 'event:click';
export const MSG_EVENT_DRAG_COMPLETE = 'event:drag-complete';
export const MSG_EVENT_TERMINAL_COMMAND = 'event:terminal-command';
export const MSG_EVENT_GAME_RESULT = 'event:game-result';
export const MSG_EVENT_PTY_OUTPUT = 'event:pty-output';
export const MSG_EVENT_FILE_SAVE = 'event:file-save';
export const MSG_EVENT_WORKSHOP_DONE = 'event:workshop-done';
export const MSG_EVENT_TERMINAL_SHARE = 'event:terminal-share';

/** Chat messages (Browser <-> Bridge <-> Claude SDK) */
export const MSG_CHAT_SEND = 'chat:send';
export const MSG_CHAT_ASSISTANT = 'chat:assistant';
export const MSG_CHAT_STREAM = 'chat:stream';
export const MSG_CHAT_TOOL_USE = 'chat:tool-use';
export const MSG_CHAT_TOOL_RESULT = 'chat:tool-result';
export const MSG_CHAT_STATUS = 'chat:status';
export const MSG_CHAT_STOP = 'chat:stop';
export const MSG_CHAT_SUGGESTIONS = 'chat:suggestions';

/** Session management (Canvas <-> Bridge) */
export const MSG_SESSION_LIST = 'session:list';
export const MSG_SESSION_UPDATE = 'session:update';

/** System messages */
export const MSG_SYS_CONNECT = 'sys:connect';
export const MSG_SYS_DISCONNECT = 'sys:disconnect';
export const MSG_SYS_TIER_CHANGE = 'sys:tier-change';
export const MSG_SYS_HEARTBEAT = 'sys:heartbeat';

// ---------------------------------------------------------------------------
// Type registry (extensible)
// ---------------------------------------------------------------------------

const _typeRegistry = {
  canvas: [
    MSG_CANVAS_DIAGRAM, MSG_CANVAS_HTML, MSG_CANVAS_CELEBRATE,
    MSG_CANVAS_TERMINAL, MSG_CANVAS_WORKSHOP, MSG_CANVAS_WORKSHOP_UPDATE,
    MSG_CANVAS_CODE, MSG_CANVAS_CODE_RESULT, MSG_CANVAS_QUIZ,
    MSG_CANVAS_GAME, MSG_CANVAS_SETTINGS, MSG_CANVAS_WEB_EMBED,
  ],
  event: [
    MSG_EVENT_QUIZ_ANSWER, MSG_EVENT_CODE_RUN, MSG_EVENT_CLICK,
    MSG_EVENT_DRAG_COMPLETE, MSG_EVENT_TERMINAL_COMMAND, MSG_EVENT_GAME_RESULT,
    MSG_EVENT_PTY_OUTPUT, MSG_EVENT_FILE_SAVE, MSG_EVENT_WORKSHOP_DONE,
    MSG_EVENT_TERMINAL_SHARE,
  ],
  chat: [
    MSG_CHAT_SEND, MSG_CHAT_ASSISTANT, MSG_CHAT_STREAM,
    MSG_CHAT_TOOL_USE, MSG_CHAT_TOOL_RESULT, MSG_CHAT_STATUS,
    MSG_CHAT_STOP, MSG_CHAT_SUGGESTIONS,
  ],
  session: [MSG_SESSION_LIST, MSG_SESSION_UPDATE],
  system: [MSG_SYS_CONNECT, MSG_SYS_DISCONNECT, MSG_SYS_TIER_CHANGE, MSG_SYS_HEARTBEAT],
};

/** Read-only view of the current type registry */
export function getMessageTypes() {
  return { ..._typeRegistry };
}

/** Flat set of all known message types */
let _allTypes = new Set(Object.values(_typeRegistry).flat());

/**
 * Register custom message types. Merges into existing categories or creates new ones.
 * @param {Object<string, { category: string }>} types - Map of type string to { category }
 */
export function registerTypes(types) {
  for (const [type, { category }] of Object.entries(types)) {
    if (!_typeRegistry[category]) {
      _typeRegistry[category] = [];
    }
    if (!_typeRegistry[category].includes(type)) {
      _typeRegistry[category].push(type);
    }
    _allTypes.add(type);
  }
}

export function isKnownType(type) {
  return _allTypes.has(type);
}

export function isTypeInCategory(type, category) {
  return _typeRegistry[category]?.includes(type) || false;
}

// ---------------------------------------------------------------------------
// Tier constants
// ---------------------------------------------------------------------------

export const TIER_FULL = 1;
export const TIER_CANVAS = 2;
export const TIER_TERMINAL = 3;

export const TIERS = { FULL: TIER_FULL, CANVAS: TIER_CANVAS, TERMINAL: TIER_TERMINAL };

export const TIER_LABELS = {
  [TIER_FULL]: 'Full (Extension + Canvas)',
  [TIER_CANVAS]: 'Canvas Only',
  [TIER_TERMINAL]: 'Terminal Only',
};

export const CLIENT_EXTENSION = 'extension';
export const CLIENT_CANVAS = 'canvas';

// ---------------------------------------------------------------------------
// Server constants
// ---------------------------------------------------------------------------

export const DEFAULT_PORT = 3456;
export const HEARTBEAT_INTERVAL_MS = 30000;
export const DEFAULT_LONG_POLL_TIMEOUT_MS = 30000;
export const MAX_LONG_POLL_TIMEOUT_MS = 120000;

// Terminal / PTY / Playground limits
export const TERMINAL_CMD_TIMEOUT_MS = 10000;
export const TERMINAL_MAX_COMMANDS = 50;
export const TERMINAL_MAX_OUTPUT_BYTES = 10240;
export const TERMINAL_SESSION_IDLE_MS = 300000;
export const TERMINAL_BLOCKED_COMMANDS = ['sudo', 'shutdown', 'reboot', 'halt', 'poweroff', 'mkfs', 'dd', ':(){'];
export const PTY_MAX_SESSIONS = 5;
export const PTY_SESSION_IDLE_MS = 600000;
export const PTY_MAX_OUTPUT_BUFFER = 524288;
export const PTY_DEFAULT_COLS = 120;
export const PTY_DEFAULT_ROWS = 30;
export const PLAYGROUND_EXEC_TIMEOUT_MS = 15000;
export const PLAYGROUND_MAX_OUTPUT_BYTES = 51200;
export const WORKSHOP_MAX_SESSIONS = 3;
export const WORKSHOP_MAX_SETUP_COMMANDS = 50;
export const TERMINAL_SHARE_MAX_LINES = 50;

// Diagram formats
export const DIAGRAM_MERMAID = 'mermaid';
export const DIAGRAM_SVG = 'svg';

// Code playground languages
export const LANG_BASH = 'bash';
export const LANG_JAVASCRIPT = 'javascript';
export const LANG_PYTHON = 'python';

// Celebrate types
export const CELEBRATE_XP = 'xp';
export const CELEBRATE_LEVEL_UP = 'level-up';
export const CELEBRATE_PERFECT = 'perfect-score';

// Quiz types
export const QUIZ_DRAG_ORDER = 'drag-order';
export const QUIZ_MATCHING = 'matching';
export const QUIZ_FILL_BLANK = 'fill-blank';
export const QUIZ_TIMED_CHOICE = 'timed-choice';
export const QUIZ_TYPES = [QUIZ_DRAG_ORDER, QUIZ_MATCHING, QUIZ_FILL_BLANK, QUIZ_TIMED_CHOICE];

// Game types
export const GAME_SPEED_ROUND = 'speed-round';
export const GAME_BUG_HUNT = 'bug-hunt';
export const GAME_CLASSIFY = 'classify';
export const GAME_SCENARIO = 'scenario';
export const GAME_COMMAND_SPRINT = 'command-sprint';
export const GAME_MEMORY_MATCH = 'memory-match';
export const GAME_TYPES = [GAME_SPEED_ROUND, GAME_BUG_HUNT, GAME_CLASSIFY, GAME_SCENARIO, GAME_COMMAND_SPRINT, GAME_MEMORY_MATCH];

// ---------------------------------------------------------------------------
// Envelope creator / validator
// ---------------------------------------------------------------------------

/**
 * Create a protocol-compliant JSON envelope.
 * @param {string} type - Message type
 * @param {object} payload - Message payload
 * @param {string} source - Source identifier ('plugin', 'canvas', 'extension', 'bridge')
 * @param {object} [options] - Optional fields
 * @param {object} [options.await] - Hold response until matching event
 * @returns {object} Envelope object
 */
export function createEnvelope(type, payload, source, options = {}) {
  const envelope = {
    v: PROTOCOL_VERSION,
    type,
    payload: payload || {},
    source: source || 'bridge',
    timestamp: Date.now(),
  };
  if (options.await) {
    envelope.await = {
      event: options.await.event,
      timeout: options.await.timeout || 30,
    };
  }
  return envelope;
}

export function serializeEnvelope(type, payload, source) {
  return JSON.stringify(createEnvelope(type, payload, source));
}

/**
 * Validate and parse a JSON envelope.
 * @param {string|object} data
 * @returns {{ valid: boolean, envelope: object|null, error: string|null }}
 */
export function parseEnvelope(data) {
  let envelope;
  if (typeof data === 'string') {
    try { envelope = JSON.parse(data); } catch { return { valid: false, envelope: null, error: 'Invalid JSON' }; }
  } else {
    envelope = data;
  }

  if (!envelope || typeof envelope !== 'object') return { valid: false, envelope: null, error: 'Envelope must be an object' };
  if (typeof envelope.v !== 'number') return { valid: false, envelope: null, error: 'Missing or invalid protocol version (v)' };
  if (envelope.v > PROTOCOL_VERSION) return { valid: false, envelope: null, error: `Unsupported protocol version: ${envelope.v} (max: ${PROTOCOL_VERSION})` };
  if (typeof envelope.type !== 'string') return { valid: false, envelope: null, error: 'Missing or invalid message type' };
  if (!envelope.payload || typeof envelope.payload !== 'object') return { valid: false, envelope: null, error: 'Missing or invalid payload' };

  return { valid: true, envelope, error: null };
}
