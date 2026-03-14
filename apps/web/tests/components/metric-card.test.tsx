import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '@/components/dashboard/metric-card';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Equity" value="$100,000" />);
    expect(screen.getByText('Total Equity')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
  });

  it('renders positive change with green color', () => {
    render(<MetricCard label="P&L" value="$500" change={2.5} />);
    const changeEl = screen.getByText('+2.50%');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl).toHaveClass('text-profit');
  });

  it('renders negative change with red color', () => {
    render(<MetricCard label="P&L" value="-$200" change={-1.25} />);
    const changeEl = screen.getByText('-1.25%');
    expect(changeEl).toBeInTheDocument();
    expect(changeEl).toHaveClass('text-loss');
  });

  it('does not render change when not provided', () => {
    const { container } = render(
      <MetricCard label="Sharpe" value="--" />,
    );
    expect(container.querySelector('.text-profit')).toBeNull();
    expect(container.querySelector('.text-loss')).toBeNull();
  });

  it('renders icon when provided', () => {
    render(
      <MetricCard
        label="Test"
        value="123"
        icon={<span data-testid="icon">Icon</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });
});
