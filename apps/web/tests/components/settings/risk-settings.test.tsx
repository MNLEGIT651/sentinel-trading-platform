import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskSettings } from '@/components/settings/risk-settings';

const defaultProps = {
  maxPosition: '10',
  onMaxPosition: vi.fn(),
  maxSector: '25',
  onMaxSector: vi.fn(),
  dailyLossLimit: '5',
  onDailyLossLimit: vi.fn(),
  softDrawdown: '10',
  onSoftDrawdown: vi.fn(),
  hardDrawdown: '20',
  onHardDrawdown: vi.fn(),
  maxPositions: '10',
  onMaxPositions: vi.fn(),
};

describe('RiskSettings', () => {
  it('renders without crashing', () => {
    const { container } = render(<RiskSettings {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it('renders Position Limits and Circuit Breakers sections', () => {
    render(<RiskSettings {...defaultProps} />);
    expect(screen.getByText('Position Limits')).toBeInTheDocument();
    expect(screen.getByText('Circuit Breakers')).toBeInTheDocument();
  });
});
