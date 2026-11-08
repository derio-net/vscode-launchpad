import { render, screen, fireEvent, within } from '@testing-library/react';
import ClaudeSessionSummary from '../ClaudeSessionSummary';
import { openVSCodeUri } from '../../utils/workspaceUtils';

jest.mock('../../utils/workspaceUtils', () => ({
  ...jest.requireActual('../../utils/workspaceUtils'),
  openVSCodeUri: jest.fn().mockResolvedValue(undefined),
}));

const group = (name, state, counts = {}) => ({
  cwd: `/Users/dev/${name}`,
  name,
  state,
  counts: { working: 0, waiting: 0, idle: 0, ...counts },
  sessions: [],
});
const summary = { total: 3, working: 1, waiting: 0, idle: 2, zombies: 0 };

const renderSummary = (props = {}) => render(
  <ClaudeSessionSummary summary={summary} zombies={[]} claudeFilter={null} onFilterChange={jest.fn()} {...props} />,
);

describe('ClaudeSessionSummary: Other sessions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is not rendered when every session matched a workspace', () => {
    renderSummary({ unmatched: [] });
    expect(screen.queryByRole('region', { name: /other sessions/i })).toBeNull();
  });

  it('lists each unmatched folder with name, full-path tooltip and counts', () => {
    renderSummary({ unmatched: [group('super-fr', 'working', { working: 1, idle: 2 })] });
    const section = screen.getByRole('region', { name: /other sessions/i });
    const entry = within(section).getByText('super-fr');
    expect(entry).toHaveAttribute('title', '/Users/dev/super-fr');
    expect(section).toHaveTextContent('1 working');
    expect(section).toHaveTextContent('2 idle');
    expect(section).toHaveTextContent(/not in VS Code's workspace list/i);
  });

  it('Open in VS Code opens the folder URI and notifies the dashboard', async () => {
    const onOpenFolder = jest.fn();
    renderSummary({ unmatched: [group('my project', 'idle', { idle: 1 })], onOpenFolder });
    fireEvent.click(screen.getByRole('button', { name: /open my project in vs code/i }));
    expect(openVSCodeUri).toHaveBeenCalledWith('vscode://file/Users/dev/my%20project');
    expect(onOpenFolder).toHaveBeenCalledWith('/Users/dev/my project');
  });

  it('shows 5 folders, then "Show all (N)" reveals the rest', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(n => group(n, 'idle', { idle: 1 }));
    renderSummary({ unmatched: many });
    const section = screen.getByRole('region', { name: /other sessions/i });
    expect(within(section).getAllByRole('listitem')).toHaveLength(5);
    fireEvent.click(within(section).getByRole('button', { name: 'Show all (7)' }));
    expect(within(section).getAllByRole('listitem')).toHaveLength(7);
  });

  it('keeps the zombie section separate', () => {
    renderSummary({
      unmatched: [group('tools', 'idle', { idle: 1 })],
      zombies: [{ pid: 9, cwd: '/Users/dev/old', startedAt: Date.now() }],
    });
    expect(screen.getByText('1 zombie')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /other sessions/i })).queryByText('old')).toBeNull();
  });
});
