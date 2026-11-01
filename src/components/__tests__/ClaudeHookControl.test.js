import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ask } from '@tauri-apps/plugin-dialog';
import ClaudeHookControl from '../ClaudeHookControl';

const setup = (status, props = {}) => {
  const onInstall = jest.fn();
  const onRemove = jest.fn();
  const utils = render(
    <ClaudeHookControl
      hookStatus={status ? { status } : null}
      busy={false}
      error={null}
      onInstall={onInstall}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { ...utils, onInstall, onRemove };
};

describe('ClaudeHookControl', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers Enable when not installed', () => {
    const { onInstall } = setup('not-installed');
    fireEvent.click(screen.getByRole('button', { name: /enable claude code status/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('offers Repair when the install needs repair', () => {
    const { onInstall } = setup('needs-repair');
    fireEvent.click(screen.getByRole('button', { name: /repair claude code status/i }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it('asks for confirmation before Disable', async () => {
    ask.mockResolvedValueOnce(true);
    const { onRemove } = setup('installed');
    fireEvent.click(screen.getByRole('button', { name: /disable claude code status/i }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('does not disable when the confirmation is declined', async () => {
    ask.mockResolvedValueOnce(false);
    const { onRemove } = setup('installed');
    fireEvent.click(screen.getByRole('button', { name: /disable claude code status/i }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(onRemove).not.toHaveBeenCalled();
  });

  it.each(['unsupported', null])('renders nothing for status %s', (status) => {
    const { container } = setup(status);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the server error', () => {
    setup('not-installed', { error: 'settings.json is not valid JSON' });
    expect(screen.getByRole('alert')).toHaveTextContent('settings.json is not valid JSON');
  });

  it('disables the button while busy', () => {
    setup('not-installed', { busy: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
