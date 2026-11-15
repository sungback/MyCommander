import React, { useEffect, useRef, useState } from "react";
import { BaseDialog } from "./BaseDialog";
import { DialogTextInput } from "./DialogTextInput";
import type { WildcardSelectMode } from "../../store/dialogStore";

export interface WildcardSelectDialogProps {
  isOpen: boolean;
  mode: WildcardSelectMode;
  initialPattern?: string;
  onClose: () => void;
  onSubmit: (pattern: string, mode: WildcardSelectMode) => void;
  onInvert: () => void;
}

const PRESET_PATTERNS = [
  { label: "전체 (*.*)", pattern: "*.*" },
  { label: "이미지", pattern: "*.png; *.jpg; *.jpeg; *.gif; *.webp" },
  { label: "문서", pattern: "*.pdf; *.docx; *.xlsx; *.pptx; *.txt" },
  { label: "압축파일", pattern: "*.zip; *.tar; *.gz; *.7z" },
  { label: "코드", pattern: "*.ts; *.tsx; *.js; *.json" },
];

export const WildcardSelectDialog: React.FC<WildcardSelectDialogProps> = ({
  isOpen,
  mode: initialMode,
  initialPattern = "*.*",
  onClose,
  onSubmit,
  onInvert,
}) => {
  const [pattern, setPattern] = useState(initialPattern);
  const [currentMode, setCurrentMode] = useState<WildcardSelectMode>(initialMode);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPattern(initialPattern);
      setCurrentMode(initialMode);
      const timeoutId = window.setTimeout(() => {
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [isOpen, initialPattern, initialMode]);

  const handleSubmit = () => {
    if (!pattern.trim()) return;
    onSubmit(pattern.trim(), currentMode);
  };

  const handleInvert = () => {
    onInvert();
    onClose();
  };

  const isSelect = currentMode === "select";
  const title = isSelect ? "패턴으로 파일 선택" : "패턴으로 파일 선택 해제";
  const submitLabel = isSelect ? "선택" : "선택 해제";

  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={title}
      submitLabel={submitLabel}
      submitAutoFocus={false}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>와일드카드 패턴 (*, ? 지원, 세미콜론 구분)</span>
          <div className="flex rounded border border-border-color overflow-hidden">
            <button
              type="button"
              aria-label="선택 모드로 전환"
              onClick={() => setCurrentMode("select")}
              className={`px-2 py-0.5 text-xs transition-colors ${
                isSelect
                  ? "bg-accent-color text-white font-medium"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
              }`}
            >
              선택
            </button>
            <button
              type="button"
              aria-label="선택 해제 모드로 전환"
              onClick={() => setCurrentMode("unselect")}
              className={`px-2 py-0.5 text-xs transition-colors ${
                !isSelect
                  ? "bg-accent-color text-white font-medium"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-hover"
              }`}
            >
              선택 해제
            </button>
          </div>
        </div>

        <DialogTextInput
          inputRef={inputRef}
          value={pattern}
          onValueChange={setPattern}
          onFocus={(input) => input.select()}
        />

        {/* Quick preset chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {PRESET_PATTERNS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setPattern(preset.pattern);
                inputRef.current?.focus();
              }}
              className="text-xs px-2 py-0.5 rounded bg-bg-secondary hover:bg-bg-hover text-text-secondary border border-border-color transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Extra actions */}
        <div className="flex justify-between items-center pt-2 border-t border-border-color text-xs">
          <button
            type="button"
            onClick={handleInvert}
            className="text-text-secondary hover:text-text-primary underline transition-colors cursor-pointer"
          >
            현재 선택 반전 (Invert)
          </button>
          <span className="text-text-muted text-[11px]">예: *.log, img_???.*</span>
        </div>
      </div>
    </BaseDialog>
  );
};
