/**
 * Visual interceptor — scans assistant messages for structured content
 * (mermaid diagrams, buttons, inline blocks, suggestions, media URLs)
 * and routes them as visual envelopes to connected canvas clients.
 */

import { createEnvelope, MSG_CHAT_SUGGESTIONS } from '@agora-agent/protocol';

const MERMAID_FENCE_RE = /```mermaid\s*\n([\s\S]*?)```/g;
const SUGGESTIONS_RE = /<!--\s*suggestions:\s*(\[[\s\S]*?\])\s*-->/;
const BUTTONS_RE = /<!--\s*buttons:\s*(\{[\s\S]*?\})\s*-->/g;
const VALID_BUTTON_TYPES = ['single', 'multi', 'rating'];

const LIST_RE = /<!--\s*list:\s*(\{[\s\S]*?\})\s*-->/g;
const PROGRESS_RE = /<!--\s*progress:\s*(\{[\s\S]*?\})\s*-->/g;
const CARD_RE = /<!--\s*card:\s*(\{[\s\S]*?\})\s*-->/g;
const CODE_BLOCK_RE = /<!--\s*code:\s*(\{[\s\S]*?\})\s*-->/g;
const STEPS_RE = /<!--\s*steps:\s*(\{[\s\S]*?\})\s*-->/g;
const VALID_LIST_STYLES = ['cards', 'numbered', 'checklist', 'compact'];
const VALID_PROGRESS_STYLES = ['bar', 'steps', 'ring'];
const VALID_CARD_TYPES = ['tip', 'warning', 'error', 'success', 'concept'];

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp|avif)(\?[^#\s]*)?$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov)(\?[^#\s]*)?$/i;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const URL_RE = /https?:\/\/[^\s)<>"]+/g;
const MAX_AUTO_MEDIA = 3;

/**
 * Extract mermaid code blocks and route as canvas:diagram envelopes.
 */
export function extractAndRouteVisuals(text, tierManager, router) {
  if (!text || typeof text !== 'string') return;

  const blocks = [];
  let match;
  while ((match = MERMAID_FENCE_RE.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) blocks.push(content);
  }

  for (const content of blocks) {
    const envelope = createEnvelope('canvas:diagram', {
      format: 'mermaid',
      content,
      autoRouted: true,
    }, 'bridge');
    router.routeVisualCommand(envelope);
  }
}

/**
 * Extract suggestion chips from assistant message.
 */
export function extractAndRouteSuggestions(text, tierManager) {
  if (!text || typeof text !== 'string') return;

  const match = SUGGESTIONS_RE.exec(text);
  if (!match) return;

  let suggestions;
  try { suggestions = JSON.parse(match[1]); } catch { return; }
  if (!Array.isArray(suggestions) || suggestions.length === 0) return;

  const valid = suggestions.filter(s =>
    s && typeof s.label === 'string' && typeof s.text === 'string'
  );
  if (valid.length === 0) return;

  const envelope = createEnvelope(MSG_CHAT_SUGGESTIONS, { suggestions: valid }, 'bridge');
  const data = JSON.stringify(envelope);
  tierManager.broadcastWs(data);
  tierManager.broadcastSse(data);
}

/**
 * Extract inline smart button blocks from assistant message.
 * @returns {{ cleanText: string, buttons: object[] }}
 */
export function extractButtons(text) {
  if (!text || typeof text !== 'string') return { cleanText: '', buttons: [] };

  const buttons = [];
  let cleanText = text;

  BUTTONS_RE.lastIndex = 0;
  const matches = [...text.matchAll(BUTTONS_RE)];

  for (const match of matches) {
    let parsed;
    try { parsed = JSON.parse(match[1]); } catch { continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    if (typeof parsed.id !== 'string' || !parsed.id) continue;
    if (!VALID_BUTTON_TYPES.includes(parsed.type)) continue;
    if (!Array.isArray(parsed.options) || parsed.options.length === 0) continue;

    const validOptions = parsed.options.filter(o =>
      o && typeof o.label === 'string' && typeof o.value === 'string'
    );
    if (validOptions.length === 0) continue;

    buttons.push({
      id: parsed.id,
      type: parsed.type,
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : undefined,
      options: validOptions,
    });
    cleanText = cleanText.replace(match[0], '');
  }

  return { cleanText: cleanText.trim(), buttons };
}

/**
 * Extract inline block controls (list, progress, card, code, steps).
 * @returns {{ cleanText: string, blocks: object[] }}
 */
export function extractInlineBlocks(text) {
  if (!text || typeof text !== 'string') return { cleanText: '', blocks: [] };

  const blocks = [];
  let cleanText = text;

  const extractors = [
    { re: LIST_RE, type: 'list', validate: validateList },
    { re: PROGRESS_RE, type: 'progress', validate: validateProgress },
    { re: CARD_RE, type: 'card', validate: validateCard },
    { re: CODE_BLOCK_RE, type: 'code', validate: validateCode },
    { re: STEPS_RE, type: 'steps', validate: validateSteps },
  ];

  for (const { re, type, validate } of extractors) {
    re.lastIndex = 0;
    for (const match of [...text.matchAll(re)]) {
      let parsed;
      try { parsed = JSON.parse(match[1]); } catch { continue; }
      if (!parsed || typeof parsed !== 'object') continue;
      if (typeof parsed.id !== 'string' || !parsed.id) continue;

      const block = validate(parsed);
      if (!block) continue;

      blocks.push({ blockType: type, ...block });
      cleanText = cleanText.replace(match[0], '');
    }
  }

  return { cleanText: cleanText.trim(), blocks };
}

function validateList(p) {
  if (!Array.isArray(p.items) || p.items.length === 0) return null;
  const items = p.items.filter(i => i && typeof i.title === 'string');
  if (items.length === 0) return null;
  return {
    id: p.id,
    style: VALID_LIST_STYLES.includes(p.style) ? p.style : 'cards',
    items: items.map(i => ({
      icon: typeof i.icon === 'string' ? i.icon : undefined,
      title: i.title,
      description: typeof i.description === 'string' ? i.description : undefined,
      action: typeof i.action === 'string' ? i.action : undefined,
    })),
  };
}

function validateProgress(p) {
  if (typeof p.current !== 'number' || typeof p.total !== 'number') return null;
  if (p.total <= 0) return null;
  return {
    id: p.id,
    label: typeof p.label === 'string' ? p.label : undefined,
    current: p.current,
    total: p.total,
    style: VALID_PROGRESS_STYLES.includes(p.style) ? p.style : 'bar',
  };
}

function validateCard(p) {
  if (typeof p.content !== 'string' || !p.content) return null;
  return {
    id: p.id,
    type: VALID_CARD_TYPES.includes(p.type) ? p.type : 'tip',
    title: typeof p.title === 'string' ? p.title : undefined,
    content: p.content,
  };
}

function validateCode(p) {
  if (typeof p.code !== 'string' || !p.code) return null;
  return {
    id: p.id,
    language: typeof p.language === 'string' ? p.language : 'text',
    filename: typeof p.filename === 'string' ? p.filename : undefined,
    code: p.code,
    highlight: Array.isArray(p.highlight) ? p.highlight.filter(n => typeof n === 'number') : [],
  };
}

function validateSteps(p) {
  if (!Array.isArray(p.steps) || p.steps.length === 0) return null;
  const validStatuses = ['done', 'active', 'pending'];
  const steps = p.steps.filter(s => s && typeof s.label === 'string');
  if (steps.length === 0) return null;
  return {
    id: p.id,
    current: typeof p.current === 'number' ? p.current : undefined,
    steps: steps.map(s => ({
      label: s.label,
      status: validStatuses.includes(s.status) ? s.status : 'pending',
    })),
  };
}

export function detectMediaUrl(url) {
  if (YOUTUBE_RE.test(url)) return 'youtube';
  if (VIMEO_RE.test(url)) return 'vimeo';
  if (IMAGE_EXT_RE.test(url)) return 'image';
  if (VIDEO_EXT_RE.test(url)) return 'video';
  return 'link';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildMediaHtml(url, type) {
  const safe = escapeHtml(url);
  switch (type) {
    case 'youtube': {
      const m = url.match(YOUTUBE_RE);
      if (!m) return null;
      return {
        html: `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;"><iframe src="https://www.youtube.com/embed/${m[1]}?rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`,
        title: 'YouTube Video',
        subtype: 'youtube',
      };
    }
    case 'vimeo': {
      const m = url.match(VIMEO_RE);
      if (!m) return null;
      return {
        html: `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;"><iframe src="https://player.vimeo.com/video/${m[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px;" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen></iframe></div>`,
        title: 'Vimeo Video',
        subtype: 'vimeo',
      };
    }
    case 'image':
      return {
        html: `<div style="text-align:center;padding:16px 0;"><img src="${safe}" style="max-width:100%;max-height:80vh;border-radius:8px;" /></div>`,
        title: 'Image',
        subtype: 'image',
      };
    case 'video':
      return {
        html: `<div style="text-align:center;"><video controls style="max-width:100%;border-radius:8px;"><source src="${safe}" /></video></div>`,
        title: 'Video',
        subtype: 'video',
      };
    default:
      return null;
  }
}

/**
 * Scan assistant text for media URLs and route as canvas:html envelopes.
 */
export function extractAndRouteMedia(text, router, seenUrls) {
  if (!text || typeof text !== 'string') return;

  const cleaned = text.replace(CODE_FENCE_RE, '');
  const urls = cleaned.match(URL_RE);
  if (!urls) return;

  let count = 0;
  for (const url of urls) {
    if (count >= MAX_AUTO_MEDIA) break;
    if (seenUrls.has(url)) continue;

    const type = detectMediaUrl(url);
    if (type === 'link') continue;

    const media = buildMediaHtml(url, type);
    if (!media) continue;

    seenUrls.add(url);
    count++;

    const envelope = createEnvelope('canvas:html', {
      html: media.html,
      title: media.title,
      subtype: media.subtype,
      autoRouted: true,
    }, 'bridge');
    router.routeVisualCommand(envelope);
  }
}

/**
 * Run custom interceptors from user config.
 * Each interceptor has { pattern: RegExp, handler: (match, json) => envelope|null }.
 */
export function runCustomInterceptors(text, interceptors, router) {
  if (!text || !interceptors || interceptors.length === 0) return;

  for (const { pattern, handler } of interceptors) {
    pattern.lastIndex = 0;
    for (const match of [...text.matchAll(pattern)]) {
      try {
        const result = handler(match[0], match[1]);
        if (result && result.type && result.payload) {
          const envelope = createEnvelope(result.type, result.payload, 'bridge');
          router.routeVisualCommand(envelope);
        }
      } catch { /* skip invalid interceptor results */ }
    }
  }
}
