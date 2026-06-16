import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentsPanel, extractUrls } from '../AttachmentsPanel';
import type { Attachment } from '../../lib/types';

describe('extractUrls', () => {
  it('finds http and https URLs in text', () => {
    expect(extractUrls('check out https://x.io/a and http://y.io/b')).toEqual([
      'https://x.io/a',
      'http://y.io/b',
    ]);
  });

  it('deduplicates repeated URLs', () => {
    expect(extractUrls('https://x.io https://x.io https://y.io')).toEqual([
      'https://x.io',
      'https://y.io',
    ]);
  });

  it('returns empty array when no URLs', () => {
    expect(extractUrls('just some text here')).toEqual([]);
  });

  it('strips trailing punctuation', () => {
    expect(extractUrls('see https://x.io.')).toEqual(['https://x.io']);
  });
});

describe('<AttachmentsPanel>', () => {
  it('renders the Attachments label', () => {
    render(<AttachmentsPanel attachments={[]} onChange={() => {}} />);
    expect(screen.getByText(/attachments/i)).toBeInTheDocument();
  });

  it('shows existing attachments as removable chips', () => {
    const initial: Attachment[] = [
      { id: '1', kind: 'link', name: 'https://x.io', value: 'https://x.io' },
      { id: '2', kind: 'image', name: 'pic.png', value: 'data:...' },
    ];
    render(<AttachmentsPanel attachments={initial} onChange={() => {}} />);
    expect(screen.getByText('https://x.io')).toBeInTheDocument();
    expect(screen.getByText('pic.png')).toBeInTheDocument();
  });

  it('clicking ✕ removes the attachment', async () => {
    const user = userEvent.setup();
    let current: Attachment[] = [
      { id: '1', kind: 'link', name: 'https://x.io', value: 'https://x.io' },
    ];
    const onChange = vi.fn((next: Attachment[]) => {
      current = next;
    });
    const { rerender } = render(
      <AttachmentsPanel attachments={current} onChange={onChange} />,
    );
    await user.click(screen.getByLabelText(/remove https:\/\/x\.io/i));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toEqual([]);

    // Rerender with updated state to confirm the chip is gone
    rerender(<AttachmentsPanel attachments={current} onChange={onChange} />);
    expect(screen.queryByText('https://x.io')).not.toBeInTheDocument();
  });

  it('Clicking "Clear all" empties the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AttachmentsPanel
        attachments={[
          { id: '1', kind: 'link', name: 'a', value: 'a' },
          { id: '2', kind: 'file', name: 'b', value: 'b' },
        ]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('"Add link" reveals a URL input that adds an attachment on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttachmentsPanel attachments={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add link/i }));

    const input = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(input, 'github.com/winxit');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalled();
    const added = onChange.mock.calls[0][0][0];
    expect(added.kind).toBe('link');
    expect(added.value).toBe('https://github.com/winxit');
  });

  it('"Add link" prepends https:// if missing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttachmentsPanel attachments={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add link/i }));
    const input = screen.getByPlaceholderText(/https:\/\/example\.com/);
    await user.type(input, 'example.com');
    await user.keyboard('{Enter}');
    expect(onChange.mock.calls[0][0][0].value).toBe('https://example.com');
  });
});
