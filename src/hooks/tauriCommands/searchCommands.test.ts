import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.hoisted(() => vi.fn());
const mockChannelInstances = vi.hoisted(() => [] as Array<{ onmessage: unknown }>);

vi.mock('@tauri-apps/api/core', () => {
  class MockChannel {
    onmessage: unknown = null;
    constructor() {
      mockChannelInstances.push(this);
    }
  }
  return {
    invoke: mockInvoke,
    Channel: MockChannel,
  };
});

import { searchCommands } from './searchCommands';
import { SearchOptions, DEFAULT_SEARCH_MAX_RESULTS } from '../../types/search';

describe('searchCommands', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    mockChannelInstances.length = 0;
  });

  describe('searchFiles — string overload', () => {
    it('calls invoke with correct snake_case fields and default options', async () => {
      const handler = vi.fn();
      await searchCommands.searchFiles('/start', 'query', false, handler);

      expect(mockChannelInstances).toHaveLength(1);
      const channel = mockChannelInstances[0];
      expect(channel.onmessage).toBe(handler);

      expect(mockInvoke).toHaveBeenCalledWith('search_files', {
        start_path: '/start',
        query: 'query',
        use_regex: false,
        case_sensitive: true,
        include_hidden: true,
        scope: 'name',
        entry_kind: 'all',
        extensions: [],
        min_size_bytes: null,
        max_size_bytes: null,
        modified_after_ms: null,
        modified_before_ms: null,
        max_results: DEFAULT_SEARCH_MAX_RESULTS,
        on_event: channel,
      });
    });

    it('sets use_regex: true when passed true', async () => {
      const handler = vi.fn();
      await searchCommands.searchFiles('/start', 'pattern.*', true, handler);
      expect(mockInvoke).toHaveBeenCalledWith(
        'search_files',
        expect.objectContaining({ use_regex: true, query: 'pattern.*' }),
      );
    });
  });

  describe('searchFiles — SearchOptions overload', () => {
    it('calls invoke with all mapped fields from options', async () => {
      const opts: SearchOptions = {
        query: 'foo',
        useRegex: true,
        caseSensitive: false,
        includeHidden: false,
        scope: 'path',
        entryKind: 'files',
        extensions: ['.ts'],
        minSizeBytes: 100,
        maxSizeBytes: 500,
        modifiedAfterMs: 1000,
        modifiedBeforeMs: 2000,
        maxResults: 50,
      };
      const handler = vi.fn();
      await searchCommands.searchFiles('/start', opts, handler);

      expect(mockChannelInstances).toHaveLength(1);
      const channel = mockChannelInstances[0];
      expect(channel.onmessage).toBe(handler);

      expect(mockInvoke).toHaveBeenCalledWith('search_files', {
        start_path: '/start',
        query: 'foo',
        use_regex: true,
        case_sensitive: false,
        include_hidden: false,
        scope: 'path',
        entry_kind: 'files',
        extensions: ['.ts'],
        min_size_bytes: 100,
        max_size_bytes: 500,
        modified_after_ms: 1000,
        modified_before_ms: 2000,
        max_results: 50,
        on_event: channel,
      });
    });
  });

  describe('searchFiles — no onEvent handler', () => {
    it('sets channel.onmessage to a no-op function when handler is omitted', async () => {
      await searchCommands.searchFiles('/start', 'query', false);

      expect(mockChannelInstances).toHaveLength(1);
      const channel = mockChannelInstances[0];
      expect(typeof channel.onmessage).toBe('function');
      expect(() => (channel.onmessage as () => void)()).not.toThrow();
    });
  });

  describe('Channel construction', () => {
    it('constructs exactly one Channel per searchFiles call', async () => {
      await searchCommands.searchFiles('/a', 'q1', false);
      await searchCommands.searchFiles('/b', 'q2', true);
      expect(mockChannelInstances).toHaveLength(2);
    });
  });
});
