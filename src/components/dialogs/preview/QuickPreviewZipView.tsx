import React, { useMemo, useState, useCallback } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  List,
  ListTree,
  Search,
  X,
} from "lucide-react";
import type { ZipArchivePreview, ZipEntryPreview } from "../../../types/zipPreview";
import { formatSize } from "../../../utils/format";

interface QuickPreviewZipViewProps {
  archive: ZipArchivePreview;
}

type ViewMode = "tree" | "table";
type SortField = "path" | "size" | "compressedSize" | "modified";
type SortDirection = "asc" | "desc";

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  modified?: string | null;
  children: Map<string, TreeNode>;
}

const getFileIcon = (fileName: string, isDir: boolean, isExpanded?: boolean) => {
  if (isDir) {
    return isExpanded ? (
      <FolderOpen size={15} className="text-amber-400 shrink-0" />
    ) : (
      <Folder size={15} className="text-amber-400 shrink-0" />
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
    case "bmp":
    case "ico":
      return <FileImage size={15} className="text-emerald-400 shrink-0" />;

    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "html":
    case "css":
    case "json":
    case "py":
    case "rs":
    case "go":
    case "c":
    case "cpp":
    case "h":
    case "sh":
      return <FileCode size={15} className="text-sky-400 shrink-0" />;

    case "txt":
    case "md":
    case "log":
    case "pdf":
    case "doc":
    case "docx":
      return <FileText size={15} className="text-blue-300 shrink-0" />;

    case "zip":
    case "tar":
    case "gz":
    case "rar":
    case "7z":
      return <FileArchive size={15} className="text-purple-400 shrink-0" />;

    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
      return <FileVideo size={15} className="text-rose-400 shrink-0" />;

    case "mp3":
    case "wav":
    case "flac":
    case "ogg":
    case "m4a":
      return <FileAudio size={15} className="text-pink-400 shrink-0" />;

    default:
      return <File size={15} className="text-text-secondary shrink-0" />;
  }
};

const buildTree = (entries: ZipEntryPreview[]): TreeNode => {
  const root: TreeNode = {
    name: "root",
    fullPath: "",
    isDir: true,
    size: 0,
    compressedSize: 0,
    children: new Map(),
  };

  for (const entry of entries) {
    const parts = entry.path.replace(/\/$/, "").split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const isDir = !isLast || entry.isDir;

      let child = current.children.get(part);
      if (!child) {
        child = {
          name: part,
          fullPath: parts.slice(0, i + 1).join("/"),
          isDir,
          size: isLast ? entry.size : 0,
          compressedSize: isLast ? entry.compressedSize : 0,
          modified: isLast ? entry.modified : undefined,
          children: new Map(),
        };
        current.children.set(part, child);
      } else if (isLast && !entry.isDir) {
        child.isDir = false;
        child.size = entry.size;
        child.compressedSize = entry.compressedSize;
        child.modified = entry.modified;
      }
      current = child;
    }
  }

  // Calculate cumulative sizes for directory nodes
  const calcSizes = (node: TreeNode): { size: number; compressedSize: number } => {
    let size = node.size;
    let compressedSize = node.compressedSize;
    for (const child of node.children.values()) {
      const childRes = calcSizes(child);
      if (node.isDir) {
        size += childRes.size;
        compressedSize += childRes.compressedSize;
      }
    }
    node.size = size;
    node.compressedSize = compressedSize;
    return { size, compressedSize };
  };

  calcSizes(root);
  return root;
};

interface ZipTreeNodeProps {
  node: TreeNode;
  depth: number;
  searchQuery: string;
  expandAllSignal: { expanded: boolean; id: number } | null;
}

const ZipTreeNodeItem: React.FC<ZipTreeNodeProps> = ({
  node,
  depth,
  searchQuery,
  expandAllSignal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  React.useEffect(() => {
    if (expandAllSignal !== null) {
      setIsExpanded(expandAllSignal.expanded);
    }
  }, [expandAllSignal]);

  React.useEffect(() => {
    if (searchQuery.trim()) {
      setIsExpanded(true);
    }
  }, [searchQuery]);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const sortedChildren = useMemo(() => {
    return Array.from(node.children.values()).sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [node.children]);

  // Filter check
  const matchesSearch = !searchQuery.trim() || node.name.toLowerCase().includes(searchQuery.toLowerCase());
  const hasMatchingChild = sortedChildren.some(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.children.size > 0
  );

  if (searchQuery.trim() && !matchesSearch && !hasMatchingChild) {
    return null;
  }

  return (
    <div className="font-mono text-xs select-text">
      <div
        onClick={node.isDir ? toggleExpand : undefined}
        className={`flex items-center justify-between py-1 px-2 rounded hover:bg-bg-hover/70 transition-colors group ${
          node.isDir ? "cursor-pointer" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {node.isDir ? (
            <span className="text-text-secondary group-hover:text-text-primary p-0.5">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="w-4" />
          )}

          {getFileIcon(node.name, node.isDir, isExpanded)}

          <span
            className={`truncate ${
              node.isDir
                ? "font-semibold text-text-primary"
                : "text-text-primary font-normal"
            }`}
          >
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-4 text-text-secondary shrink-0 text-[11px] font-sans">
          <span className="w-16 text-right tabular-nums">
            {node.isDir ? (
              <span className="text-text-secondary/50 text-[10px]">
                {node.children.size}개
              </span>
            ) : (
              formatSize(node.size)
            )}
          </span>
          <span className="w-32 text-right hidden sm:inline tabular-nums text-text-secondary/60 text-[10px]">
            {node.modified ?? "-"}
          </span>
        </div>
      </div>

      {node.isDir && isExpanded && (
        <div className="border-l border-border-color/30 ml-3">
          {sortedChildren.map((child) => (
            <ZipTreeNodeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              expandAllSignal={expandAllSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const QuickPreviewZipView: React.FC<QuickPreviewZipViewProps> = ({
  archive,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("path");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandAllSignal, setExpandAllSignal] = useState<{
    expanded: boolean;
    id: number;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Compression savings percentage
  const compressionRatio = useMemo(() => {
    if (archive.totalUncompressedSize <= 0) return 0;
    return Math.max(
      0,
      Math.round(
        (1 - archive.totalCompressedSize / archive.totalUncompressedSize) * 100
      )
    );
  }, [archive.totalUncompressedSize, archive.totalCompressedSize]);

  // Root tree construction
  const treeRoot = useMemo(() => {
    return buildTree(archive.entries);
  }, [archive.entries]);

  // Filtered & sorted flat list for Table view
  const filteredAndSortedEntries = useMemo(() => {
    let list = archive.entries;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.path.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      if (sortField === "path") {
        comparison = a.path.localeCompare(b.path, undefined, { numeric: true });
      } else if (sortField === "size") {
        comparison = a.size - b.size;
      } else if (sortField === "compressedSize") {
        comparison = a.compressedSize - b.compressedSize;
      } else if (sortField === "modified") {
        comparison = (a.modified ?? "").localeCompare(b.modified ?? "");
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [archive.entries, searchQuery, sortField, sortDirection]);

  // Copy file list
  const handleCopyList = useCallback(async () => {
    try {
      const text = archive.entries.map((e) => `${e.path} (${e.isDir ? "폴더" : formatSize(e.size)})`).join("\n");
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [archive.entries]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} className="opacity-30 ml-1" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={11} className="text-accent-color ml-1" />
    ) : (
      <ArrowDown size={11} className="text-accent-color ml-1" />
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-panel overflow-hidden">
      {/* Top Summary Banner */}
      <div className="px-4 py-2.5 bg-bg-secondary/40 border-b border-border-color flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium text-xs">
            <Archive size={12} />
            <span>ZIP 아카이브</span>
          </div>
          <span className="text-xs text-text-secondary font-medium">
            {archive.totalFiles} 파일{archive.totalDirs > 0 ? `, ${archive.totalDirs} 폴더` : ""}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="text-text-secondary">
            원본: <span className="text-text-primary font-medium">{formatSize(archive.totalUncompressedSize)}</span>
          </div>
          <div className="text-text-secondary">
            압축: <span className="text-text-primary font-medium">{formatSize(archive.totalCompressedSize)}</span>
          </div>
          {compressionRatio > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
              {compressionRatio}% 절약
            </span>
          )}
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-color bg-bg-secondary/20 shrink-0 gap-2">
        {/* Search Input */}
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
              placeholder="압축 파일 내 파일/폴더 검색..."
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

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {viewMode === "tree" && (
            <div className="flex items-center gap-1 mr-1">
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

          {/* Copy list */}
          <button
            onClick={handleCopyList}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="목록 텍스트 복사"
          >
            {isCopied ? (
              <>
                <Check size={12} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">복사됨</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>목록 복사</span>
              </>
            )}
          </button>

          {/* View mode toggle */}
          <div className="flex items-center rounded border border-border-color p-0.5 bg-bg-secondary">
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                viewMode === "tree"
                  ? "bg-bg-panel text-text-primary shadow-xs font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="트리 형식으로 보기"
            >
              <ListTree size={12} />
              <span>트리</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                viewMode === "table"
                  ? "bg-bg-panel text-text-primary shadow-xs font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="목록 형식으로 보기"
            >
              <List size={12} />
              <span>목록</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {archive.entries.length === 0 ? (
          <div className="p-8 text-center text-text-secondary text-xs italic">
            압축 파일 내에 파일이나 폴더가 없습니다.
          </div>
        ) : viewMode === "tree" ? (
          <div className="p-3">
            {Array.from(treeRoot.children.values())
              .sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name, undefined, { numeric: true });
              })
              .map((child) => (
                <ZipTreeNodeItem
                  key={child.fullPath}
                  node={child}
                  depth={0}
                  searchQuery={searchQuery}
                  expandAllSignal={expandAllSignal}
                />
              ))}
          </div>
        ) : (
          /* Table View */
          <div className="min-w-full">
            <table className="w-full text-xs font-mono border-collapse select-text">
              <thead className="bg-bg-secondary/70 sticky top-0 border-b border-border-color z-1 font-sans">
                <tr>
                  <th
                    onClick={() => handleSort("path")}
                    className="text-left py-2 px-4 cursor-pointer hover:bg-bg-hover transition-colors font-semibold text-text-secondary"
                  >
                    <div className="flex items-center">
                      <span>경로 / 파일명</span>
                      {renderSortIndicator("path")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("size")}
                    className="text-right py-2 px-3 cursor-pointer hover:bg-bg-hover transition-colors font-semibold text-text-secondary w-24"
                  >
                    <div className="flex items-center justify-end">
                      <span>크기</span>
                      {renderSortIndicator("size")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("compressedSize")}
                    className="text-right py-2 px-3 cursor-pointer hover:bg-bg-hover transition-colors font-semibold text-text-secondary w-24 hidden md:table-cell"
                  >
                    <div className="flex items-center justify-end">
                      <span>압축 크기</span>
                      {renderSortIndicator("compressedSize")}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("modified")}
                    className="text-right py-2 px-4 cursor-pointer hover:bg-bg-hover transition-colors font-semibold text-text-secondary w-36 hidden sm:table-cell"
                  >
                    <div className="flex items-center justify-end">
                      <span>수정일시</span>
                      {renderSortIndicator("modified")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/30">
                {filteredAndSortedEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-text-secondary italic font-sans"
                    >
                      검색어와 일치하는 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedEntries.map((entry) => (
                    <tr
                      key={entry.path}
                      className="hover:bg-bg-hover/60 transition-colors"
                    >
                      <td className="py-1.5 px-4 truncate max-w-xs md:max-w-md">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {getFileIcon(entry.name, entry.isDir)}
                          <span
                            className={
                              entry.isDir
                                ? "font-semibold text-text-primary"
                                : "text-text-primary"
                            }
                          >
                            {entry.path}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right text-text-secondary tabular-nums font-sans">
                        {entry.isDir ? "-" : formatSize(entry.size)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-text-secondary tabular-nums font-sans hidden md:table-cell">
                        {entry.isDir ? "-" : formatSize(entry.compressedSize)}
                      </td>
                      <td className="py-1.5 px-4 text-right text-text-secondary text-[11px] tabular-nums font-sans hidden sm:table-cell">
                        {entry.modified ?? "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
