import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Spinner } from '@/components/ui/spinner';
import { LoadingButton } from '@/components/ui/loading-button';
import { ProgressBar } from '@/components/ui/progress-bar';

describe('Spinner', () => {
  it('renders with default (md) size', () => {
    render(<Spinner />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    const svg = status.querySelector('svg');
    expect(svg).toHaveClass('size-5');
  });

  it('renders with sm size', () => {
    render(<Spinner size="sm" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('size-4');
  });

  it('renders with lg size', () => {
    render(<Spinner size="lg" />);
    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toHaveClass('size-6');
  });

  it('has aria-label for accessibility', () => {
    render(<Spinner />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('includes sr-only loading text', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toHaveClass('sr-only');
  });
});

describe('LoadingButton', () => {
  it('renders children text', () => {
    render(<LoadingButton>Submit</LoadingButton>);
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    render(<LoadingButton loading>Submit</LoadingButton>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not show spinner when not loading', () => {
    render(<LoadingButton>Submit</LoadingButton>);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<LoadingButton loading>Submit</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is not disabled by default', () => {
    render(<LoadingButton>Submit</LoadingButton>);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('preserves variant class', () => {
    render(<LoadingButton variant="destructive">Delete</LoadingButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive/10');
  });

  it('preserves explicit disabled prop', () => {
    render(<LoadingButton disabled>Submit</LoadingButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('ProgressBar', () => {
  it('renders with correct width percentage', () => {
    const { container } = render(<ProgressBar value={75} />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveStyle({ width: '75%' });
  });

  it('has correct aria attributes', () => {
    render(<ProgressBar value={42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps value to 0-100 range', () => {
    const { container, rerender } = render(<ProgressBar value={150} />);
    let fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveStyle({ width: '100%' });

    rerender(<ProgressBar value={-10} />);
    fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveStyle({ width: '0%' });
  });

  it('renders default variant with primary color', () => {
    const { container } = render(<ProgressBar value={50} />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveClass('bg-primary');
  });

  it('renders success variant with profit color', () => {
    const { container } = render(<ProgressBar value={50} variant="success" />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveClass('bg-profit');
  });

  it('renders warning variant with amber color', () => {
    const { container } = render(<ProgressBar value={50} variant="warning" />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveClass('bg-amber');
  });

  it('renders error variant with loss color', () => {
    const { container } = render(<ProgressBar value={50} variant="error" />);
    const fill = container.querySelector('[role="progressbar"] > div');
    expect(fill).toHaveClass('bg-loss');
  });

  it('renders sm height variant', () => {
    render(<ProgressBar value={50} height="sm" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-0.5');
  });

  it('renders lg height variant', () => {
    render(<ProgressBar value={50} height="lg" />);
    expect(screen.getByRole('progressbar')).toHaveClass('h-2');
  });
});
