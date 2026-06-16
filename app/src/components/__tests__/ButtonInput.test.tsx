import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { Input } from '../Input';

describe('<Button>', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('shows loading spinner when loading=true', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/loading/i);
  });

  it('does nothing when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByRole('button', { name: /disabled/i });
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: /go/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button', { name: /outline/i });
    expect(btn.className).toContain('btn-outline');
  });
});

describe('<Input>', () => {
  it('renders with label', () => {
    render(<Input label="Email" placeholder="you@x.io" />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('passes value through', () => {
    render(<Input label="Email" value="hi@x.io" onChange={() => {}} />);
    const input = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(input.value).toBe('hi@x.io');
  });

  it('fires onChange when typed into', async () => {
    const onChange = vi.fn();
    render(<Input label="Email" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('applies invalid styling when invalid=true', () => {
    render(<Input label="Email" invalid value="bad" onChange={() => {}} />);
    const input = screen.getByLabelText(/email/i);
    // The wrapper div has the .invalid class
    const wrapper = input.closest('.glass-input');
    expect(wrapper).toHaveClass('invalid');
  });

  it('forwards ref to the input element', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input label="Email" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
