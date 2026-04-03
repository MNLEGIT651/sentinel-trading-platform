import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

describe('Input', () => {
  it('renders with proper attributes', () => {
    render(<Input placeholder="Enter email" name="email" type="email" />);
    const input = screen.getByPlaceholderText('Enter email');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('data-slot', 'input');
  });

  it('applies custom className', () => {
    render(<Input placeholder="test" className="mt-4" />);
    const input = screen.getByPlaceholderText('test');
    expect(input.className).toContain('mt-4');
  });

  it('error variant adds aria-invalid and error styling', () => {
    render(<Input placeholder="bad" aria-invalid="true" />);
    const input = screen.getByPlaceholderText('bad');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-loss');
  });

  it('error variant via variant prop', () => {
    render(<Input placeholder="err" variant="error" />);
    const input = screen.getByPlaceholderText('err');
    expect(input.className).toContain('border-loss');
  });

  it('supports aria-describedby for validation messages', () => {
    render(<Input placeholder="pw" aria-describedby="pw-error" />);
    expect(screen.getByPlaceholderText('pw')).toHaveAttribute('aria-describedby', 'pw-error');
  });

  it('disabled state applies opacity', () => {
    render(<Input placeholder="off" disabled />);
    const input = screen.getByPlaceholderText('off');
    expect(input).toBeDisabled();
    expect(input.className).toContain('disabled:opacity-50');
  });

  it('defaults type to text', () => {
    render(<Input placeholder="def" />);
    expect(screen.getByPlaceholderText('def')).toHaveAttribute('type', 'text');
  });
});

describe('Textarea', () => {
  it('renders with proper attributes', () => {
    render(<Textarea placeholder="Enter notes" name="notes" rows={5} />);
    const textarea = screen.getByPlaceholderText('Enter notes');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('name', 'notes');
    expect(textarea).toHaveAttribute('rows', '5');
    expect(textarea).toHaveAttribute('data-slot', 'textarea');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('error state via aria-invalid', () => {
    render(<Textarea placeholder="bad" aria-invalid="true" />);
    const textarea = screen.getByPlaceholderText('bad');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea.className).toContain('border-loss');
  });

  it('disabled state', () => {
    render(<Textarea placeholder="off" disabled />);
    expect(screen.getByPlaceholderText('off')).toBeDisabled();
  });
});

describe('Select', () => {
  it('renders with options', () => {
    render(
      <Select aria-label="Color" name="color">
        <option value="red">Red</option>
        <option value="blue">Blue</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveAttribute('name', 'color');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Red');
    expect(options[1]).toHaveTextContent('Blue');
  });

  it('renders chevron icon', () => {
    const { container } = render(
      <Select aria-label="Pick">
        <option>A</option>
      </Select>,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('error state via aria-invalid', () => {
    render(
      <Select aria-label="Err" aria-invalid="true">
        <option>X</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select.className).toContain('border-loss');
  });

  it('disabled state', () => {
    render(
      <Select aria-label="Off" disabled>
        <option>Z</option>
      </Select>,
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('has data-slot on wrapper', () => {
    const { container } = render(
      <Select aria-label="Slot">
        <option>S</option>
      </Select>,
    );
    expect(container.querySelector('[data-slot="select"]')).toBeInTheDocument();
  });
});

describe('Label', () => {
  it('renders text and links to input via htmlFor', () => {
    render(<Label htmlFor="email-input">Email</Label>);
    const label = screen.getByText('Email');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'email-input');
    expect(label).toHaveAttribute('data-slot', 'label');
  });

  it('renders required indicator when required is true', () => {
    const { container } = render(<Label required>Username</Label>);
    expect(screen.getByText('Username')).toBeInTheDocument();
    const asterisk = container.querySelector('.text-loss');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveTextContent('*');
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
  });

  it('does not render asterisk when required is false', () => {
    const { container } = render(<Label>Optional</Label>);
    expect(container.querySelector('.text-loss')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Label className="mb-2">Custom</Label>);
    expect(screen.getByText('Custom').className).toContain('mb-2');
  });
});
