import React, { useMemo, useState, useCallback } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  ListTree,
  Search,
  X,
} from "lucide-react";

interface QuickPreviewJsonViewProps {
  content: string;
  highlightedHtml?: string;
}

type ViewMode = "tree" | "code";

interface TreeNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  searchQuery: string;
  expandAllSignal: { expanded: boolean; id: number } | null;
}

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-amber-400/30 text-amber-200 rounded px-0.5">{match}</mark>
      {highlightMatch(after, query)}
    </>
  );
};

const JsonTreeNode: React.FC<TreeNodeProps> = ({
  keyName,
  value,
  depth,
  searchQuery,
  expandAllSignal,
}) => {
  // Default: first 2 levels expanded
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  // Sync with expand/collapse all triggers
  React.useEffect(() => {
    if (expandAllSignal !== null) {
      setIsExpanded(expandAllSignal.expanded);
    }
  }, [expandAllSignal]);

  // If search matches within this node or its key, expand it
  React.useEffect(() => {
    if (searchQuery.trim()) {
      setIsExpanded(true);
    }
  }, [searchQuery]);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const isObject = value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);

  const renderKey = () => {
    if (keyName === undefined) return null;
    return (
      <span className="text-sky-400 font-medium select-text">
        "{highlightMatch(keyName, searchQuery)}":
      </span>
    );
  };

  if (value === null) {
    return (
      <div className="flex items-center gap-1.5 py-0.5 leading-relaxed font-mono text-xs select-text">
        {renderKey()}
        <span className="text-rose-400 font-semibold italic">null</span>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 leading-relaxed font-mono text-xs select-text">
        {renderKey()}
        <span className="text-purple-400 font-semibold">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="flex items-center gap-1.5 py-0.5 leading-relaxed font-mono text-xs select-text">
        {renderKey()}
        <span className="text-amber-400">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === "string") {
    const isUrl = /^https?:\/\//i.test(value);
    return (
      <div className="flex items-baseline gap-1.5 py-0.5 leading-relaxed font-mono text-xs select-text break-all">
        {renderKey()}
        <span className="text-emerald-400">
          "{isUrl ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-emerald-300"
            >
              {highlightMatch(value, searchQuery)}
            </a>
          ) : (
            highlightMatch(value, searchQuery)
          )}"
        </span>
      </div>
    );
  }

  if (isArray) {
    const items = value as unknown[];
    const count = items.length;

    return (
      <div className="py-0.5 font-mono text-xs">
        <div
          onClick={toggleExpand}
          className="flex items-center gap-1 cursor-pointer hover:bg-bg-hover/60 rounded px-1 -mx-1 py-0.5 transition-colors select-none group w-fit"
        >
          <span className="text-text-secondary group-hover:text-text-primary">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {renderKey()}
          <span className="text-text-secondary font-semibold">[</span>
          {!isExpanded && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-secondary text-text-secondary font-sans font-medium">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
          {!isExpanded && <span className="text-text-secondary font-semibold">]</span>}
        </div>

        {isExpanded && (
          <div className="pl-4 border-l border-border-color/50 ml-1.5 my-0.5">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="text-text-secondary/60 text-[10px] select-none pt-0.5 min-w-[1.2rem]">
                  {idx}:
                </span>
                <div className="flex-1 min-w-0">
                  <JsonTreeNode
                    value={item}
                    depth={depth + 1}
                    searchQuery={searchQuery}
                    expandAllSignal={expandAllSignal}
                  />
                </div>
              </div>
            ))}
            <div className="text-text-secondary font-semibold select-none">]</div>
          </div>
        )}
      </div>
    );
  }

  if (isObject) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const count = keys.length;

    return (
      <div className="py-0.5 font-mono text-xs">
        <div
          onClick={toggleExpand}
          className="flex items-center gap-1 cursor-pointer hover:bg-bg-hover/60 rounded px-1 -mx-1 py-0.5 transition-colors select-none group w-fit"
        >
          <span className="text-text-secondary group-hover:text-text-primary">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {renderKey()}
          <span className="text-text-secondary font-semibold">&#123;</span>
          {!isExpanded && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-bg-secondary text-text-secondary font-sans font-medium">
              {count} {count === 1 ? "key" : "keys"}
            </span>
          )}
          {!isExpanded && <span className="text-text-secondary font-semibold">&#125;</span>}
        </div>

        {isExpanded && (
          <div className="pl-4 border-l border-border-color/50 ml-1.5 my-0.5">
            {keys.map((k) => (
              <JsonTreeNode
                key={k}
                keyName={k}
                value={obj[k]}
                depth={depth + 1}
                searchQuery={searchQuery}
                expandAllSignal={expandAllSignal}
              />
            ))}
            <div className="text-text-secondary font-semibold select-none">&#125;</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 py-0.5 leading-relaxed font-mono text-xs select-text">
      {renderKey()}
      <span className="text-text-primary">{String(value)}</span>
    </div>
  );
};

export const QuickPreviewJsonView: React.FC<QuickPreviewJsonViewProps> = ({
  content,
  highlightedHtml,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandAllSignal, setExpandAllSignal] = useState<{
    expanded: boolean;
    id: number;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Parse JSON data
  const { parsedJson, parseError, formattedJson } = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      const formatted = JSON.stringify(parsed, null, 2);
      return { parsedJson: parsed, parseError: null, formattedJson: formatted };
    } catch (err) {
      return {
        parsedJson: null,
        parseError: err instanceof Error ? err.message : String(err),
        formattedJson: content,
      };
    }
  }, [content]);

  // Copy handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formattedJson);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  }, [formattedJson]);

  // Code line numbers calculation
  const codeLines = useMemo(() => {
    return formattedJson.split("\n");
  }, [formattedJson]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-panel overflow-hidden">
      {/* Sub-toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-color bg-bg-secondary/40 shrink-0 gap-2">
        {/* Search Input (Tree mode) */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex items-center w-full">
            <Search
              size={13}
              className="absolute left-2.5 text-text-secondary pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="키 또는 값 검색..."
              className="w-full bg-bg-panel border border-border-color rounded pl-8 pr-7 py-1 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-color"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 text-text-secondary hover:text-text-primary"
                title="검색어 지우기"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tree Mode Expand/Collapse buttons */}
          {viewMode === "tree" && !parseError && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() =>
                  setExpandAllSignal((prev) => ({
                    expanded: true,
                    id: (prev?.id ?? 0) + 1,
                  }))
                }
                className="px-2 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="모두 펼치기"
              >
                모두 펼치기
              </button>
              <button
                onClick={() =>
                  setExpandAllSignal((prev) => ({
                    expanded: false,
                    id: (prev?.id ?? 0) + 1,
                  }))
                }
                className="px-2 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                title="모두 접기"
              >
                모두 접기
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="포맷된 JSON 복사"
          >
            {isCopied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">복사됨</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>복사</span>
              </>
            )}
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded border border-border-color p-0.5 bg-bg-secondary">
            <button
              onClick={() => setViewMode("tree")}
              disabled={Boolean(parseError)}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                viewMode === "tree" && !parseError
                  ? "bg-bg-panel text-text-primary shadow-xs font-medium"
                  : "text-text-secondary hover:text-text-primary disabled:opacity-40"
              }`}
              title="트리 형식으로 보기"
            >
              <ListTree size={12} />
              <span>트리</span>
            </button>
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                viewMode === "code" || parseError
                  ? "bg-bg-panel text-text-primary shadow-xs font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="코드 형식으로 보기"
            >
              <Code2 size={12} />
              <span>코드</span>
            </button>
          </div>
        </div>
      </div>

      {/* Parse error warning banner */}
      {parseError && (
        <div
          role="status"
          className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-100 flex items-center justify-between"
        >
          <span>유효하지 않은 JSON 구문이 포함되어 있어 원본 코드로 표시합니다: {parseError}</span>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {viewMode === "tree" && !parseError ? (
          <div className="p-4">
            <JsonTreeNode
              value={parsedJson}
              depth={0}
              searchQuery={searchQuery}
              expandAllSignal={expandAllSignal}
            />
          </div>
        ) : (
          /* Code View with line numbers */
          <div className="flex min-h-full font-mono text-xs select-text leading-relaxed">
            {/* Line numbers */}
            <div className="select-none py-4 px-3 text-right text-text-secondary/40 border-r border-border-color/40 bg-bg-secondary/20 shrink-0 font-mono text-xs">
              {codeLines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Highlighted or raw code */}
            <div className="flex-1 overflow-x-auto p-4">
              {highlightedHtml ? (
                <code
                  className="hljs block min-h-full select-text whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                />
              ) : (
                <pre className="m-0 text-text-primary whitespace-pre select-text">
                  {formattedJson}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
