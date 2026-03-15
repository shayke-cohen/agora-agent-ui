import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractAndRouteVisuals,
  extractAndRouteSuggestions,
  extractButtons,
  extractInlineBlocks,
  extractAndRouteMedia,
  detectMediaUrl,
  runCustomInterceptors,
} from './visual-interceptor.js';

const mockTierManager = { broadcastWs: vi.fn(), broadcastSse: vi.fn() };
const mockRouter = { routeVisualCommand: vi.fn() };

describe('visual-interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractAndRouteVisuals', () => {
    it('extracts mermaid blocks and routes as canvas:diagram', () => {
      const text = 'Here is a diagram:\n```mermaid\nflowchart TD\n  A --> B\n```\nDone.';
      extractAndRouteVisuals(text, mockTierManager, mockRouter);
      expect(mockRouter.routeVisualCommand).toHaveBeenCalledTimes(1);
      const envelope = mockRouter.routeVisualCommand.mock.calls[0][0];
      expect(envelope.type).toBe('canvas:diagram');
      expect(envelope.payload.format).toBe('mermaid');
      expect(envelope.payload.content).toContain('A --> B');
    });

    it('handles no mermaid blocks gracefully', () => {
      extractAndRouteVisuals('Just text, no diagrams.', mockTierManager, mockRouter);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });

    it('handles null/empty input', () => {
      extractAndRouteVisuals(null, mockTierManager, mockRouter);
      extractAndRouteVisuals('', mockTierManager, mockRouter);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });
  });

  describe('extractButtons', () => {
    it('extracts valid button blocks', () => {
      const text = 'Choose:\n<!-- buttons: {"id":"q1","type":"single","options":[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}]} -->';
      const { cleanText, buttons } = extractButtons(text);
      expect(buttons).toHaveLength(1);
      expect(buttons[0].id).toBe('q1');
      expect(buttons[0].type).toBe('single');
      expect(buttons[0].options).toHaveLength(2);
      expect(cleanText).toBe('Choose:');
    });

    it('rejects invalid button types', () => {
      const text = '<!-- buttons: {"id":"q1","type":"invalid","options":[{"label":"A","value":"a"}]} -->';
      const { buttons } = extractButtons(text);
      expect(buttons).toHaveLength(0);
    });

    it('handles empty input', () => {
      const { cleanText, buttons } = extractButtons('');
      expect(cleanText).toBe('');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('extractInlineBlocks', () => {
    it('extracts card blocks', () => {
      const text = '<!-- card: {"id":"c1","type":"tip","title":"Pro Tip","content":"Use const"} -->';
      const { blocks } = extractInlineBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockType).toBe('card');
      expect(blocks[0].type).toBe('tip');
    });

    it('extracts progress blocks', () => {
      const text = '<!-- progress: {"id":"p1","current":3,"total":10,"style":"bar"} -->';
      const { blocks } = extractInlineBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockType).toBe('progress');
      expect(blocks[0].current).toBe(3);
    });

    it('extracts list blocks', () => {
      const text = '<!-- list: {"id":"l1","style":"cards","items":[{"title":"Item 1"},{"title":"Item 2"}]} -->';
      const { blocks } = extractInlineBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockType).toBe('list');
      expect(blocks[0].items).toHaveLength(2);
    });

    it('extracts steps blocks', () => {
      const text = '<!-- steps: {"id":"s1","steps":[{"label":"Step 1","status":"done"},{"label":"Step 2","status":"active"}]} -->';
      const { blocks } = extractInlineBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockType).toBe('steps');
    });

    it('rejects invalid blocks', () => {
      const text = '<!-- card: {"id":"c1"} -->';
      const { blocks } = extractInlineBlocks(text);
      expect(blocks).toHaveLength(0);
    });
  });

  describe('extractAndRouteSuggestions', () => {
    it('extracts and broadcasts suggestions', () => {
      const text = '<!-- suggestions: [{"label":"Quiz me","text":"/quiz"}] -->';
      extractAndRouteSuggestions(text, mockTierManager);
      expect(mockTierManager.broadcastWs).toHaveBeenCalledTimes(1);
      expect(mockTierManager.broadcastSse).toHaveBeenCalledTimes(1);
    });

    it('ignores invalid suggestions', () => {
      extractAndRouteSuggestions('<!-- suggestions: not-json -->', mockTierManager);
      expect(mockTierManager.broadcastWs).not.toHaveBeenCalled();
    });
  });

  describe('detectMediaUrl', () => {
    it('detects YouTube URLs', () => {
      expect(detectMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube');
      expect(detectMediaUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    });

    it('detects image URLs', () => {
      expect(detectMediaUrl('https://example.com/photo.png')).toBe('image');
      expect(detectMediaUrl('https://example.com/photo.jpg')).toBe('image');
    });

    it('returns link for unknown URLs', () => {
      expect(detectMediaUrl('https://example.com/page')).toBe('link');
    });
  });

  describe('extractAndRouteMedia', () => {
    it('routes YouTube URL as canvas:html', () => {
      const seenUrls = new Set();
      const text = 'Check this out: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).toHaveBeenCalledTimes(1);
      const envelope = mockRouter.routeVisualCommand.mock.calls[0][0];
      expect(envelope.type).toBe('canvas:html');
      expect(envelope.payload.subtype).toBe('youtube');
      expect(envelope.payload.html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    });

    it('routes image URL as canvas:html', () => {
      const seenUrls = new Set();
      const text = 'Look at https://example.com/photo.png';
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).toHaveBeenCalledTimes(1);
      const envelope = mockRouter.routeVisualCommand.mock.calls[0][0];
      expect(envelope.payload.subtype).toBe('image');
      expect(envelope.payload.html).toContain('photo.png');
    });

    it('skips URLs inside code fences', () => {
      const seenUrls = new Set();
      const text = '```\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n```';
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });

    it('respects seenUrls deduplication', () => {
      const seenUrls = new Set(['https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
      const text = 'Watch: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });

    it('stops at MAX_AUTO_MEDIA (3)', () => {
      const seenUrls = new Set();
      const text = [
        'https://example.com/a.png',
        'https://example.com/b.jpg',
        'https://example.com/c.gif',
        'https://example.com/d.webp',
      ].join(' ');
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).toHaveBeenCalledTimes(3);
    });

    it('skips generic link URLs', () => {
      const seenUrls = new Set();
      const text = 'Visit https://example.com/docs for more info';
      extractAndRouteMedia(text, mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });

    it('handles null/empty input', () => {
      const seenUrls = new Set();
      extractAndRouteMedia(null, mockRouter, seenUrls);
      extractAndRouteMedia('', mockRouter, seenUrls);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });
  });

  describe('runCustomInterceptors', () => {
    it('runs custom interceptors and routes results', () => {
      const interceptors = [{
        pattern: /<!-- dashboard: (\{.*?\}) -->/g,
        handler: (match, json) => ({ type: 'canvas:dashboard', payload: JSON.parse(json) }),
      }];
      const text = '<!-- dashboard: {"title":"My Dashboard"} -->';
      runCustomInterceptors(text, interceptors, mockRouter);
      expect(mockRouter.routeVisualCommand).toHaveBeenCalledTimes(1);
      const envelope = mockRouter.routeVisualCommand.mock.calls[0][0];
      expect(envelope.type).toBe('canvas:dashboard');
    });

    it('handles no interceptors', () => {
      runCustomInterceptors('text', [], mockRouter);
      expect(mockRouter.routeVisualCommand).not.toHaveBeenCalled();
    });
  });
});
