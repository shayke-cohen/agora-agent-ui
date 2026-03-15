import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders zoom controls', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    expect(screen.getByTitle('Zoom in')).toBeTruthy();
    expect(screen.getByTitle('Zoom out')).toBeTruthy();
    expect(screen.getByTitle('Fit to canvas')).toBeTruthy();
    expect(screen.getByTitle('Reset zoom (100%)')).toBeTruthy();
  });

  it('shows initial zoom level as 100%', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('zoom in button increases zoom level', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    const zoomIn = screen.getByTitle('Zoom in');
    fireEvent.click(zoomIn);
    expect(screen.getByText('115%')).toBeTruthy();
  });

  it('zoom out button decreases zoom level', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    const zoomOut = screen.getByTitle('Zoom out');
    fireEvent.click(zoomOut);
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('reset button returns to 100%', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    const zoomIn = screen.getByTitle('Zoom in');
    const reset = screen.getByTitle('Reset zoom (100%)');
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.click(reset);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('zoom buttons have accessible aria-labels', () => {
    render(<Diagram payload={{ content: 'graph TD\n  A-->B' }} />);
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
    expect(screen.getByLabelText('Zoom out')).toBeTruthy();
    expect(screen.getByLabelText('Fit to canvas')).toBeTruthy();
    expect(screen.getByLabelText('Reset zoom')).toBeTruthy();
  });
});
