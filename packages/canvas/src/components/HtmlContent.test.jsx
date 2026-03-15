import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HtmlContent from './HtmlContent.jsx';

describe('HtmlContent', () => {
  it('returns null when payload has no html', () => {
    const { container } = render(<HtmlContent payload={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when payload is null', () => {
    const { container } = render(<HtmlContent payload={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders iframe when html is provided', () => {
    render(<HtmlContent payload={{ html: '<p>Hello</p>' }} />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin');
  });

  it('shows title when provided', () => {
    render(<HtmlContent payload={{ html: '<p>Hello</p>', title: 'My Content' }} />);
    expect(screen.getByText('My Content')).toBeInTheDocument();
  });
});
