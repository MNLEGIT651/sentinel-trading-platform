import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentOrders } from '@/components/portfolio/recent-orders';
import type { OrderHistoryEntry } from '@/hooks/use-order-history';

const filledOrder: OrderHistoryEntry = {
  order_id: '1',
  symbol: 'AAPL',
  side: 'buy',
  order_type: 'market',
  qty: 10,
  filled_qty: 10,
  status: 'filled',
  fill_price: 150.5,
  submitted_at: '2026-03-19T12:00:00Z',
  filled_at: '2026-03-19T12:00:01Z',
  risk_note: null,
};

const rejectedOrder: OrderHistoryEntry = {
  ...filledOrder,
  order_id: '2',
  symbol: 'TSLA',
  status: 'rejected',
  fill_price: null,
  filled_qty: 0,
  filled_at: null,
};

describe('RecentOrders', () => {
  it('renders empty state when no orders', () => {
    render(<RecentOrders orders={[]} pollingOrderId={null} />);
    expect(screen.getByText('No recent orders')).toBeInTheDocument();
  });

  it('renders order rows with symbol and status', () => {
    render(<RecentOrders orders={[filledOrder, rejectedOrder]} pollingOrderId={null} />);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
    expect(screen.getByText('Filled')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows fill price for filled orders', () => {
    render(<RecentOrders orders={[filledOrder]} pollingOrderId={null} />);
    expect(screen.getByText('$150.50')).toBeInTheDocument();
  });

  it('shows dash for unfilled orders', () => {
    render(<RecentOrders orders={[rejectedOrder]} pollingOrderId={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
