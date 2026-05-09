import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, showTransientToast } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
  });

  describe('pushToast', () => {
    it('toasts에 추가되고 id 반환', () => {
      const id = useToastStore.getState().pushToast({ message: '안녕', tone: 'info' });
      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].id).toBe(id);
      expect(toasts[0].message).toBe('안녕');
      expect(toasts[0].tone).toBe('info');
    });

    it('여러 토스트 동시 존재 가능', () => {
      useToastStore.getState().pushToast({ message: 'A', tone: 'success' });
      useToastStore.getState().pushToast({ message: 'B', tone: 'warning' });
      useToastStore.getState().pushToast({ message: 'C', tone: 'error' });
      expect(useToastStore.getState().toasts).toHaveLength(3);
    });
  });

  describe('removeToast', () => {
    it('해당 id만 제거', () => {
      const id1 = useToastStore.getState().pushToast({ message: 'A', tone: 'info' });
      const id2 = useToastStore.getState().pushToast({ message: 'B', tone: 'success' });
      useToastStore.getState().removeToast(id1);
      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].id).toBe(id2);
    });
  });

  describe('clearToasts', () => {
    it('전체 제거', () => {
      useToastStore.getState().pushToast({ message: 'A', tone: 'info' });
      useToastStore.getState().pushToast({ message: 'B', tone: 'error' });
      useToastStore.getState().clearToasts();
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('showTransientToast', () => {
    it('setTimeout 후 자동 제거', () => {
      vi.useFakeTimers();
      showTransientToast('임시 메시지');
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.runAllTimers();
      expect(useToastStore.getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it('기본 durationMs는 1400ms', () => {
      vi.useFakeTimers();
      showTransientToast('기본 지속 시간');
      vi.advanceTimersByTime(1399);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(useToastStore.getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it('durationMs 커스텀', () => {
      vi.useFakeTimers();
      showTransientToast('커스텀', { durationMs: 3000 });
      vi.advanceTimersByTime(2999);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(useToastStore.getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it('tone 옵션 적용', () => {
      showTransientToast('경고', { tone: 'warning' });
      const { toasts } = useToastStore.getState();
      expect(toasts[0].tone).toBe('warning');
    });
  });
});
