import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WebEmbed from './WebEmbed.jsx';

describe('WebEmbed', () => {
  it('returns null for missing URL', () => {
    const { container } = render(<WebEmbed payload={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for null payload', () => {
    const { container } = render(<WebEmbed payload={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders iframe with correct src', () => {
    render(<WebEmbed payload={{ url: 'https://example.com' }} />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com');
  });

  it('shows title and "Open in new tab" link', () => {
    render(<WebEmbed payload={{ url: 'https://example.com', title: 'Example Site' }} />);
    expect(screen.getByText('Example Site')).toBeInTheDocument();
    const link = screen.getByText('Open in new tab ↗');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
