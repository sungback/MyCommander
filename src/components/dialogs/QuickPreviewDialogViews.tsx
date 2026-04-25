import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  Code2,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  VideoIcon,
  X,
} from "lucide-react";
import type { PreviewState } from "./quickPreviewLoader";
import type { PreviewStatusContent } from "./quickPreviewStatus";

const getStatusIcon = (status: PreviewStatusContent) => {
  if (status.kind === "loading") {
    return <Loader2 size={24} className="animate-spin" />;
  }

  if (status.kind === "unsupported") {
    return <FileText size={24} />;
  }

  return <AlertCircle size={24} className="text-red-500" />;
};

const getHeaderIcon = (preview: PreviewState, isRendered: boolean) => {
  if (preview.type === "image") {
    return <ImageIcon size={14} className="text-text-secondary shrink-0" />;
  }

  if (preview.type === "video") {
    return <VideoIcon size={14} className="text-text-secondary shrink-0" />;
  }

  if (isRendered) {
    return <Eye size={14} className="text-text-secondary shrink-0" />;
  }

  return <FileText size={14} className="text-text-secondary shrink-0" />;
};

interface QuickPreviewHeaderProps {
  preview: PreviewState;
  fileName: string;
  isRendered: boolean;
  canToggleSource: boolean;
  showSource: boolean;
  onToggleSource: () => void;
  onClose: () => void;
}

export const QuickPreviewHeader: React.FC<QuickPreviewHeaderProps> = ({
  preview,
  fileName,
  isRendered,
  canToggleSource,
  showSource,
  onToggleSource,
  onClose,
}) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-border-color shrink-0">
    <div className="flex items-center gap-2 min-w-0">
      {getHeaderIcon(preview, isRendered)}
      {preview.type === "pdf" && (
        <span className="shrink-0 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono">
          PDF
        </span>
      )}
      <Dialog.Title className="text-sm font-medium text-text-primary truncate">
        {fileName}
      </Dialog.Title>
      {preview.language && (
        <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
          {preview.language}
        </span>
      )}
      {preview.renderExt && (
        <span className="shrink-0 text-xs text-text-secondary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
          {preview.renderExt}
        </span>
      )}
    </div>
    <div className="flex items-center gap-1 ml-4 shrink-0">
      {canToggleSource && (
        <button
          onClick={onToggleSource}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          title={showSource ? "렌더링 보기" : "소스 보기"}
        >
          {showSource ? <Eye size={12} /> : <Code2 size={12} />}
          <span>{showSource ? "렌더링" : "소스"}</span>
        </button>
      )}
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Close preview"
      >
        <X size={14} />
      </button>
    </div>
  </div>
);

interface QuickPreviewStatusViewProps {
  status: PreviewStatusContent;
}

const QuickPreviewStatusView: React.FC<QuickPreviewStatusViewProps> = ({ status }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3 px-6 text-center text-text-secondary">
    {getStatusIcon(status)}
    <div className="space-y-1">
      <p className="text-sm font-medium text-text-primary">{status.title}</p>
      <p className="text-xs">{status.description}</p>
    </div>
    {status.detail && (
      <p className="max-w-xs break-all font-mono text-xs text-red-400">
        {status.detail}
      </p>
    )}
  </div>
);

interface QuickPreviewBodyProps {
  preview: PreviewState;
  previewStatus: PreviewStatusContent | null;
  fileName: string;
  showSource: boolean;
  sourceHighlightHtml: string | null;
}

export const QuickPreviewBody: React.FC<QuickPreviewBodyProps> = ({
  preview,
  previewStatus,
  fileName,
  showSource,
  sourceHighlightHtml,
}) => (
  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
    {previewStatus && <QuickPreviewStatusView status={previewStatus} />}

    {preview.type === "image" && preview.src && (
      <div className="flex items-center justify-center p-4 overflow-auto flex-1">
        <img
          src={preview.src}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded select-none"
          draggable={false}
        />
      </div>
    )}

    {preview.type === "video" && preview.src && (
      <div className="flex items-center justify-center flex-1 bg-black">
        <video
          src={preview.src}
          controls
          className="max-w-full max-h-full"
          style={{ maxHeight: "calc(100% - 0px)" }}
        >
          지원하지 않는 형식입니다.
        </video>
      </div>
    )}

    {preview.type === "pdf" && preview.src && (
      <iframe src={preview.src} className="w-full flex-1 border-none" title="PDF preview" />
    )}

    {preview.type === "rendered" && !showSource && preview.renderedHtml && (
      <iframe
        srcDoc={preview.renderedHtml}
        className="w-full flex-1 border-none"
        sandbox="allow-same-origin"
        title="rendered preview"
      />
    )}

    {preview.type === "rendered" && showSource && (
      sourceHighlightHtml ? (
        <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
          <code
            className="hljs block p-4 min-h-full"
            dangerouslySetInnerHTML={{ __html: sourceHighlightHtml }}
          />
        </pre>
      ) : (
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
          {preview.content}
        </pre>
      )
    )}

    {preview.type === "text" && (
      preview.highlightedHtml ? (
        <pre className="flex-1 overflow-auto text-xs font-mono leading-relaxed m-0">
          <code
            className="hljs block p-4 min-h-full"
            dangerouslySetInnerHTML={{ __html: preview.highlightedHtml }}
          />
        </pre>
      ) : (
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-text-primary whitespace-pre-wrap break-words leading-relaxed">
          {preview.content}
        </pre>
      )
    )}
  </div>
);

interface QuickPreviewFooterProps {
  filePath: string;
}

export const QuickPreviewFooter: React.FC<QuickPreviewFooterProps> = ({ filePath }) => (
  <div className="px-4 py-2 border-t border-border-color shrink-0 flex justify-between items-center">
    <span className="text-xs text-text-secondary font-mono truncate">{filePath}</span>
    <span className="text-xs text-text-secondary shrink-0 ml-4">
      Press{" "}
      <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">
        Space
      </kbd>
      {" "}or{" "}
      <kbd className="px-1 py-0.5 bg-bg-secondary border border-border-color rounded text-xs">
        Esc
      </kbd>
      {" "}to close
    </span>
  </div>
);
