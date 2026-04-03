import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '@/components/ui/error-state';

describe('ErrorState', () => {
  it('renders title and message', () => {
    render(<ErrorState title="Test Error" message="Something broke" />);

    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders default title and message when none provided', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('calls onRetry when Try Again button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="Error" message="Oops" onRetry={onRetry} />);

    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render Try Again button when onRetry is not provided', () => {
    render(<ErrorState title="Error" message="Oops" />);

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('has aria-live="assertive" for screen reader announcement', () => {
    render(<ErrorState title="Error" message="Oops" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('applies full-page variant styles', () => {
    render(<ErrorState variant="full-page" title="Error" message="Oops" />);

    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('min-h-[60vh]');
  });

  it('does not apply full-page styles for inline variant', () => {
    render(<ErrorState variant="inline" title="Error" message="Oops" />);

    const alert = screen.getByRole('alert');
    expect(alert.className).not.toContain('min-h-[60vh]');
  });

  it('renders custom icon', () => {
    const CustomIcon = ({ className }: { className?: string }) => (
      <svg data-testid="custom-icon" className={className} />
    );

    render(<ErrorState icon={CustomIcon as never} title="Error" message="Oops" />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
