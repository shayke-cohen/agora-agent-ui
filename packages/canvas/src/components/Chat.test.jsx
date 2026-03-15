import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Chat from './Chat.jsx';

describe('Chat', () => {
  const defaultProps = {
    messages: [],
    onSend: vi.fn(),
    onStop: vi.fn(),
    isStreaming: false,
    suggestions: [],
  };

  it('renders user messages', () => {
    const messages = [{ role: 'user', text: 'Hello there' }];
    render(<Chat {...defaultProps} messages={messages} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('renders assistant messages with markdown', () => {
    const messages = [{ role: 'assistant', text: 'This is **bold**' }];
    render(<Chat {...defaultProps} messages={messages} />);
    const bold = document.querySelector('strong');
    expect(bold).toBeInTheDocument();
    expect(bold.textContent).toBe('bold');
  });

  it('renders tool-use messages', () => {
    const messages = [{ role: 'tool-use', data: { toolName: 'Read' } }];
    render(<Chat {...defaultProps} messages={messages} />);
    expect(screen.getByText(/Using Read/)).toBeInTheDocument();
  });

  it('renders inline buttons and clicking sends value', () => {
    const onSend = vi.fn();
    const messages = [{
      role: 'assistant',
      text: 'Choose:',
      buttons: [{
        id: 'q1',
        type: 'single',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
      }],
    }];
    render(<Chat {...defaultProps} messages={messages} onSend={onSend} />);
    const yesBtn = screen.getByText('Yes');
    expect(yesBtn).toBeInTheDocument();
    fireEvent.click(yesBtn);
    expect(onSend).toHaveBeenCalledWith('yes');
  });

  it('renders inline blocks (card)', () => {
    const messages = [{
      role: 'assistant',
      text: 'Info:',
      blocks: [{ blockType: 'card', id: 'c1', type: 'tip', title: 'Pro Tip', content: 'Use const' }],
    }];
    render(<Chat {...defaultProps} messages={messages} />);
    expect(screen.getByText('Pro Tip')).toBeInTheDocument();
  });

  it('renders inline blocks (progress)', () => {
    const messages = [{
      role: 'assistant',
      text: 'Progress:',
      blocks: [{ blockType: 'progress', id: 'p1', current: 3, total: 10, label: 'Step progress' }],
    }];
    render(<Chat {...defaultProps} messages={messages} />);
    expect(screen.getByText('Step progress')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('renders suggestion chips and clicking sends text', () => {
    const onSend = vi.fn();
    const suggestions = [
      { label: 'Get started', text: 'Help me get started' },
      { label: 'Features', text: 'What can you do?' },
    ];
    render(<Chat {...defaultProps} onSend={onSend} suggestions={suggestions} />);
    const chip = screen.getByText('Get started');
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);
    expect(onSend).toHaveBeenCalledWith('Help me get started');
  });

  it('sends message on Enter key', () => {
    const onSend = vi.fn();
    render(<Chat {...defaultProps} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('shows Stop button during streaming', () => {
    const onStop = vi.fn();
    render(<Chat {...defaultProps} isStreaming={true} onStop={onStop} />);
    const stopBtn = screen.getByText('Stop');
    expect(stopBtn).toBeInTheDocument();
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });

  it('shows Send button when not streaming', () => {
    render(<Chat {...defaultProps} isStreaming={false} />);
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('does not send empty messages', () => {
    const onSend = vi.fn();
    render(<Chat {...defaultProps} onSend={onSend} />);
    const sendBtn = screen.getByText('Send');
    fireEvent.click(sendBtn);
    expect(onSend).not.toHaveBeenCalled();
  });
});
