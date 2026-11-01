import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaudeHookStatus } from '../useClaudeHookStatus';
import * as client from '../../api/client';

jest.mock('../../api/client', () => ({
  getClaudeHooks: jest.fn(),
  installClaudeHooks: jest.fn(),
  removeClaudeHooks: jest.fn(),
}));

describe('useClaudeHookStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    client.getClaudeHooks.mockResolvedValue({ status: 'not-installed' });
  });

  it('fetches the status on mount', async () => {
    const { result } = renderHook(() => useClaudeHookStatus());
    await waitFor(() => expect(result.current.hookStatus).toEqual({ status: 'not-installed' }));
  });

  it('install updates the status and calls onChange', async () => {
    const onChange = jest.fn();
    client.installClaudeHooks.mockResolvedValue({ status: 'installed' });
    const { result } = renderHook(() => useClaudeHookStatus({ onChange }));
    await waitFor(() => expect(result.current.hookStatus).not.toBeNull());
    await act(async () => { await result.current.install(); });
    expect(result.current.hookStatus).toEqual({ status: 'installed' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('remove updates the status', async () => {
    client.removeClaudeHooks.mockResolvedValue({ status: 'not-installed' });
    client.getClaudeHooks.mockResolvedValue({ status: 'installed' });
    const { result } = renderHook(() => useClaudeHookStatus());
    await waitFor(() => expect(result.current.hookStatus).toEqual({ status: 'installed' }));
    await act(async () => { await result.current.remove(); });
    expect(result.current.hookStatus).toEqual({ status: 'not-installed' });
  });

  it('keeps the status and exposes the error when an action fails', async () => {
    const onChange = jest.fn();
    client.installClaudeHooks.mockRejectedValue(new Error('settings.json is not valid JSON'));
    const { result } = renderHook(() => useClaudeHookStatus({ onChange }));
    await waitFor(() => expect(result.current.hookStatus).not.toBeNull());
    await act(async () => { await result.current.install(); });
    expect(result.current.hookStatus).toEqual({ status: 'not-installed' });
    expect(result.current.error).toBe('settings.json is not valid JSON');
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });

  it('refreshes when the window regains focus', async () => {
    const { result } = renderHook(() => useClaudeHookStatus());
    await waitFor(() => expect(result.current.hookStatus).not.toBeNull());
    client.getClaudeHooks.mockResolvedValue({ status: 'needs-repair' });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(result.current.hookStatus).toEqual({ status: 'needs-repair' }));
  });
});
