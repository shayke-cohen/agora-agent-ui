import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Diagram from './Diagram.jsx';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockRejectedValue(new Error('Invalid mermaid syntax')),
  },
}));

describe('Diagram', () => {
  it('returns null when payload is null', () => {
    const { container } = render(<Diagram payload={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when payload has no content', () => {
    const { container } = render(<Diagram payload={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders container when content is provided', () => {
    const { container } = render(<Diagram payload={{ content: 'flowchart TD\n  A --> B' }} />);
    expect(container.firstChild).not.toBeNull();
  });
});
