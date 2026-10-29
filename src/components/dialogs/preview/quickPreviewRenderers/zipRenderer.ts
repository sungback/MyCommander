import { useFileSystem } from "../../../../hooks/useFileSystem";
import type {
  ZipArchivePreview,
  ZipEntryPreview,
} from "../../../../types/zipPreview";
import { formatSize } from "../../../../utils/format";
import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  type ZipRendererModule,
  type ZipRendererResult,
} from "./shared";

export interface ZipRendererOptions {
  previewZipArchive?: (filePath: string) => Promise<ZipArchivePreview>;
}

export const buildZipPreviewHtml = (archive: ZipArchivePreview): string => {
  const theme = getPreviewTheme();

  const compressionRatio =
    archive.totalUncompressedSize > 0
      ? Math.max(
          0,
          Math.round(
            (1 - archive.totalCompressedSize / archive.totalUncompressedSize) *
              100
          )
        )
      : 0;

  const stats = [
    `${archive.totalFiles} 파일`,
    archive.totalDirs > 0 ? `${archive.totalDirs} 폴더` : "",
    `비압축 ${formatSize(archive.totalUncompressedSize)}`,
    `압축 ${formatSize(archive.totalCompressedSize)}`,
    `절약 ${compressionRatio}%`,
  ].filter(Boolean);

  const rowsHtml = archive.entries
    .slice(0, 1000)
    .map((entry: ZipEntryPreview, index: number) => {
      const icon = entry.isDir ? "📁" : "📄";
      const sizeText = entry.isDir ? "-" : formatSize(entry.size);
      const compressedText = entry.isDir ? "-" : formatSize(entry.compressedSize);
      return `<tr class="${index % 2 === 1 ? "even" : ""}">
        <td class="name"><span class="icon">${icon}</span> ${escapeHtml(entry.path)}</td>
        <td class="num">${sizeText}</td>
        <td class="num">${compressedText}</td>
        <td class="date">${escapeHtml(entry.modified ?? "-")}</td>
      </tr>`;
    })
    .join("");

  const truncationNote =
    archive.entries.length > 1000
      ? `<div class="truncate-note">항목이 많아 처음 1,000개 파일만 표시됩니다. (총 ${archive.entries.length}개)</div>`
      : "";

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 13px; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 16px 20px; }
  .summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
  .zip-badge { font-size: 11px; font-weight: 700; color: #0284c7; background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.25); padding: 2px 8px; border-radius: 999px; }
  .stat { color: ${theme.muted}; font-size: 12px; }
  .truncate-note { padding: 6px 14px; font-size: 11px; color: ${theme.muted}; background: ${theme.codeBackground}; border-bottom: 1px solid ${theme.divider}; margin-bottom: 10px; border-radius: 4px; }
  .table-wrap { overflow: auto; border: 1px solid ${theme.border}; border-radius: 8px; max-height: calc(100vh - 120px); }
  table { border-collapse: collapse; width: 100%; min-width: 600px; }
  th { background: ${theme.codeBackground}; font-weight: 600; text-align: left; padding: 7px 12px; border-bottom: 1px solid ${theme.border}; white-space: nowrap; position: sticky; top: 0; z-index: 1; font-size: 12px; }
  td { padding: 5px 12px; border-bottom: 1px solid ${theme.divider}; white-space: nowrap; font-size: 12px; }
  td.name { font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace; }
  td.num { text-align: right; color: ${theme.muted}; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  td.date { color: ${theme.muted}; font-size: 11px; }
  tr.even td { background: ${theme.alternateBackground}; }
  .icon { margin-right: 4px; }
`,
    body: `<div class="summary"><span class="zip-badge">ZIP</span>${stats
      .map((stat) => `<span class="stat">${escapeHtml(stat)}</span>`)
      .join("")}</div>
${truncationNote}
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>이름</th>
        <th class="num">크기</th>
        <th class="num">압축 크기</th>
        <th>수정일</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>`,
  });
};

export const defaultLoadZipRenderer = async (
  options: ZipRendererOptions = {}
): Promise<ZipRendererModule> => ({
  renderZip: async (filePath: string): Promise<ZipRendererResult> => {
    const previewFn =
      options.previewZipArchive ?? useFileSystem().previewZipArchive;
    const archive = await previewFn(filePath);
    return {
      archive,
      renderedHtml: buildZipPreviewHtml(archive),
    };
  },
});
