import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGitStatusStore } from './gitStatusStore';
import type { GitStatus } from './gitStatusStore';

const mockStatus: GitStatus = {
  branch: 'main',
  modified: ['src/foo.ts'],
  added: [],
  deleted: [],
  untracked: ['src/bar.ts'],
};

describe('gitStatusStore', () => {
  beforeEach(() => {
    useGitStatusStore.getState().clear();
  });

  describe('setStatus + getCachedStatus', () => {
    it('TTL 내에 hit 반환', () => {
      useGitStatusStore.getState().setStatus('/repo', mockStatus);
      const result = useGitStatusStore.getState().getCachedStatus('/repo');
      expect(result).toEqual({ hit: true, data: mockStatus });
    });

    it('TTL 만료 후 miss 반환', () => {
      vi.useFakeTimers();
      useGitStatusStore.getState().setStatus('/repo', mockStatus);
      vi.advanceTimersByTime(31 * 1000);
      const result = useGitStatusStore.getState().getCachedStatus('/repo');
      expect(result).toEqual({ hit: false });
      vi.useRealTimers();
    });

    it('캐시가 없으면 miss 반환', () => {
      const result = useGitStatusStore.getState().getCachedStatus('/unknown');
      expect(result).toEqual({ hit: false });
    });

    it('null status도 캐시됨', () => {
      useGitStatusStore.getState().setStatus('/repo', null);
      const result = useGitStatusStore.getState().getCachedStatus('/repo');
      expect(result).toEqual({ hit: true, data: null });
    });
  });

  describe('getStatus', () => {
    it('hit 시 data 반환', () => {
      useGitStatusStore.getState().setStatus('/repo', mockStatus);
      expect(useGitStatusStore.getState().getStatus('/repo')).toEqual(mockStatus);
    });

    it('miss 시 null 반환', () => {
      expect(useGitStatusStore.getState().getStatus('/unknown')).toBeNull();
    });
  });

  describe('setStatus가 failures 삭제', () => {
    it('실패 기록이 있어도 setStatus 후 hasFreshFailure false', () => {
      useGitStatusStore.getState().setFailure('/repo');
      expect(useGitStatusStore.getState().hasFreshFailure('/repo')).toBe(true);
      useGitStatusStore.getState().setStatus('/repo', mockStatus);
      expect(useGitStatusStore.getState().hasFreshFailure('/repo')).toBe(false);
    });
  });

  describe('setFailure + hasFreshFailure', () => {
    it('TTL 내에 true', () => {
      useGitStatusStore.getState().setFailure('/repo');
      expect(useGitStatusStore.getState().hasFreshFailure('/repo')).toBe(true);
    });

    it('TTL 만료 후 false', () => {
      vi.useFakeTimers();
      useGitStatusStore.getState().setFailure('/repo');
      vi.advanceTimersByTime(31 * 1000);
      expect(useGitStatusStore.getState().hasFreshFailure('/repo')).toBe(false);
      vi.useRealTimers();
    });

    it('기록 없으면 false', () => {
      expect(useGitStatusStore.getState().hasFreshFailure('/unknown')).toBe(false);
    });
  });

  describe('inFlight', () => {
    it('setInFlight / getInFlight', () => {
      const promise = Promise.resolve(mockStatus);
      useGitStatusStore.getState().setInFlight('/repo', promise);
      expect(useGitStatusStore.getState().getInFlight('/repo')).toBe(promise);
    });

    it('getInFlight: 없으면 null', () => {
      expect(useGitStatusStore.getState().getInFlight('/unknown')).toBeNull();
    });

    it('clearInFlight: 해당 request 일치 시 삭제', () => {
      const promise = Promise.resolve(mockStatus);
      useGitStatusStore.getState().setInFlight('/repo', promise);
      useGitStatusStore.getState().clearInFlight('/repo', promise);
      expect(useGitStatusStore.getState().getInFlight('/repo')).toBeNull();
    });

    it('clearInFlight: request 불일치 시 삭제 안 함', () => {
      const promise1 = Promise.resolve(mockStatus);
      const promise2 = Promise.resolve(null);
      useGitStatusStore.getState().setInFlight('/repo', promise1);
      useGitStatusStore.getState().clearInFlight('/repo', promise2);
      expect(useGitStatusStore.getState().getInFlight('/repo')).toBe(promise1);
    });

    it('clearInFlight: request 인자 없으면 무조건 삭제', () => {
      const promise = Promise.resolve(mockStatus);
      useGitStatusStore.getState().setInFlight('/repo', promise);
      useGitStatusStore.getState().clearInFlight('/repo');
      expect(useGitStatusStore.getState().getInFlight('/repo')).toBeNull();
    });
  });

  describe('clear', () => {
    it('전체 초기화', () => {
      const promise = Promise.resolve(mockStatus);
      useGitStatusStore.getState().setStatus('/repo', mockStatus);
      useGitStatusStore.getState().setFailure('/repo');
      useGitStatusStore.getState().setInFlight('/repo', promise);
      useGitStatusStore.getState().clear();
      expect(useGitStatusStore.getState().getCachedStatus('/repo')).toEqual({ hit: false });
      expect(useGitStatusStore.getState().hasFreshFailure('/repo')).toBe(false);
      expect(useGitStatusStore.getState().getInFlight('/repo')).toBeNull();
    });
  });
});
