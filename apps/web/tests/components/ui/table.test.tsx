import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  SortableTableHead,
} from '@/components/ui/table';
import type { SortState } from '@/components/ui/table';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderBasicTable() {
  return render(
    <Table>
      <TableCaption>A list of items</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Alpha</TableCell>
          <TableCell numeric>100</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('Table', () => {
  it('renders with header and body', () => {
    renderBasicTable();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders a semantic <table> element', () => {
    renderBasicTable();
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(table.tagName).toBe('TABLE');
  });

  it('is accessible with a caption', () => {
    renderBasicTable();
    expect(screen.getByText('A list of items')).toBeInTheDocument();
    const caption = screen.getByText('A list of items');
    expect(caption.tagName).toBe('CAPTION');
  });
});

describe('TableHead', () => {
  it('applies correct base classes', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead>Heading</TableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Heading');
    expect(th).toHaveClass('font-medium');
    expect(th).toHaveClass('text-muted-foreground');
    expect(th).toHaveClass('px-3');
    expect(th).toHaveClass('h-10');
  });

  it('merges custom className', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead className="w-40">Heading</TableHead>
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByText('Heading')).toHaveClass('w-40');
  });
});

describe('TableCell', () => {
  it('applies base padding classes', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const td = screen.getByText('Cell');
    expect(td).toHaveClass('px-3');
    expect(td).toHaveClass('py-3');
  });

  it('adds tabular-nums when numeric prop is set', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell numeric>42</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText('42')).toHaveClass('tabular-nums');
  });

  it('does not add tabular-nums when numeric is absent', () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>text</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText('text')).not.toHaveClass('tabular-nums');
  });
});

describe('TableRow', () => {
  it('has hover styling class', () => {
    render(
      <table>
        <tbody>
          <TableRow data-testid="row">
            <td>cell</td>
          </TableRow>
        </tbody>
      </table>,
    );
    const row = screen.getByTestId('row');
    expect(row).toHaveClass('hover:bg-muted/50');
    expect(row).toHaveClass('transition-colors');
    expect(row).toHaveClass('border-b');
  });
});

describe('SortableTableHead', () => {
  const baseSortState: SortState = { column: 'name', direction: 'asc' };

  it('shows ChevronUp icon when sort direction is asc', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="name" sortState={baseSortState} onSort={vi.fn()}>
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Name').closest('th')!;
    // ChevronUp renders an SVG — lucide uses a class or the element is present
    const svg = th.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows ChevronDown icon when sort direction is desc', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead
              column="name"
              sortState={{ column: 'name', direction: 'desc' }}
              onSort={vi.fn()}
            >
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Name').closest('th')!;
    const svg = th.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows ChevronsUpDown icon when column is not active', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="value" sortState={baseSortState} onSort={vi.fn()}>
              Value
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Value').closest('th')!;
    const svg = th.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // Inactive icon should have reduced opacity
    expect(svg).toHaveClass('opacity-40');
  });

  it('active sort icon has full opacity', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="name" sortState={baseSortState} onSort={vi.fn()}>
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Name').closest('th')!;
    const svg = th.querySelector('svg');
    expect(svg).toHaveClass('opacity-100');
  });

  it('calls onSort with the column key when clicked', () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="name" sortState={baseSortState} onSort={onSort}>
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    fireEvent.click(screen.getByText('Name').closest('th')!);
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('has aria-sort attribute set to ascending', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="name" sortState={baseSortState} onSort={vi.fn()}>
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Name').closest('th')!;
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  it('has aria-sort attribute set to descending', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead
              column="name"
              sortState={{ column: 'name', direction: 'desc' }}
              onSort={vi.fn()}
            >
              Name
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Name').closest('th')!;
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('has aria-sort attribute set to none for inactive column', () => {
    render(
      <table>
        <thead>
          <tr>
            <SortableTableHead column="other" sortState={baseSortState} onSort={vi.fn()}>
              Other
            </SortableTableHead>
          </tr>
        </thead>
      </table>,
    );
    const th = screen.getByText('Other').closest('th')!;
    expect(th).toHaveAttribute('aria-sort', 'none');
  });
});
