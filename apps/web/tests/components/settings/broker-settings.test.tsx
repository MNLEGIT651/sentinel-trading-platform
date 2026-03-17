import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrokerSettings } from '@/components/settings/broker-settings';

const defaultProps = {
  polygonKey: '',
  onPolygonKey: vi.fn(),
  alpacaKey: '',
  onAlpacaKey: vi.fn(),
  alpacaSecret: '',
  onAlpacaSecret: vi.fn(),
  anthropicKey: '',
  onAnthropicKey: vi.fn(),
  supabaseUrl: '',
  onSupabaseUrl: vi.fn(),
  supabaseKey: '',
  onSupabaseKey: vi.fn(),
};

describe('BrokerSettings', () => {
  it('renders without crashing', () => {
    const { container } = render(<BrokerSettings {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('renders section headings including Market Data and Broker', () => {
    render(<BrokerSettings {...defaultProps} />);
    expect(screen.getByText('Market Data')).toBeInTheDocument();
    expect(screen.getByText('Broker (Alpaca)')).toBeInTheDocument();
  });
});
