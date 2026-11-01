import { render, screen, fireEvent } from '@testing-library/react';
import ClaudeHookRepairBanner from '../ClaudeHookRepairBanner';

const needsRepair = { status: 'needs-repair', reason: 'Hooks point at a script from a repository checkout.' };

describe('ClaudeHookRepairBanner', () => {
  beforeEach(() => window.localStorage.clear());

  it('is shown for needs-repair with the reason and a Repair button', () => {
    const onRepair = jest.fn();
    render(<ClaudeHookRepairBanner hookStatus={needsRepair} busy={false} onRepair={onRepair} />);
    expect(screen.getByRole('status')).toHaveTextContent(/repository checkout/);
    fireEvent.click(screen.getByRole('button', { name: /^repair$/i }));
    expect(onRepair).toHaveBeenCalledTimes(1);
  });

  it.each(['not-installed', 'installed', 'unsupported'])('is not shown for %s', (status) => {
    const { container } = render(<ClaudeHookRepairBanner hookStatus={{ status }} busy={false} onRepair={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays dismissed across remounts until the status changes', () => {
    const { unmount } = render(<ClaudeHookRepairBanner hookStatus={needsRepair} busy={false} onRepair={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
    unmount();

    const { rerender } = render(<ClaudeHookRepairBanner hookStatus={needsRepair} busy={false} onRepair={jest.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<ClaudeHookRepairBanner hookStatus={{ status: 'needs-repair', reason: 'The hook script is missing' }} busy={false} onRepair={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/missing/);
  });

  it('still renders when localStorage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ClaudeHookRepairBanner hookStatus={needsRepair} busy={false} onRepair={jest.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    spy.mockRestore();
  });
});
