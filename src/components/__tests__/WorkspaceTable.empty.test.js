import { render, screen } from '@testing-library/react';
import WorkspaceTable from '../WorkspaceTable';

const baseProps = {
  workspaces: [],
  sortConfig: { key: 'lastAccessed', direction: 'desc' },
  onSort: jest.fn(),
  validationStatus: {},
  selectedWorkspaces: new Set(),
  onSelectWorkspace: jest.fn(),
  onSelectAll: jest.fn(),
  sessionMap: new Map(),
  hookConfigured: true,
};

describe('WorkspaceTable empty state', () => {
  it('shows the default message', () => {
    render(<WorkspaceTable {...baseProps} />);
    expect(screen.getByText('No workspaces found')).toBeInTheDocument();
  });

  it('shows a custom emptyMessage when given', () => {
    render(<WorkspaceTable {...baseProps} emptyMessage="No workspace rows have working sessions." />);
    expect(screen.getByText('No workspace rows have working sessions.')).toBeInTheDocument();
    expect(screen.queryByText('No workspaces found')).toBeNull();
  });
});
