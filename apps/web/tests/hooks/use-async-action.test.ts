import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncAction } from '@/hooks/use-async-action';

describe('useAsyncAction', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useAsyncAction(async () => 'value'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets loading true while fn is running', async () => {
    let resolve!: (v: string) => void;
    const fn = () =>
      new Promise<string>((r) => {
        resolve = r;
      });
    const { result } = renderHook(() => useAsyncAction(fn));
    act(() => {
      result.current.execute();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolve('done');
    });
    expect(result.current.loading).toBe(false);
  });

  it('stores data on success', async () => {
    const { result } = renderHook(() => useAsyncAction(async () => 42));
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('stores error on failure', async () => {
    const fn = async () => {
      throw new Error('boom');
    };
    const { result } = renderHook(() => useAsyncAction(fn));
    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('reset clears all state', async () => {
    const { result } = renderHook(() => useAsyncAction(async () => 'x'));
    await act(async () => {
      await result.current.execute();
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('execute reference is stable across renders', () => {
    const { result, rerender } = renderHook(() => useAsyncAction(async () => 'value'));
    const firstExecute = result.current.execute;
    rerender();
    expect(result.current.execute).toBe(firstExecute);
  });
});
