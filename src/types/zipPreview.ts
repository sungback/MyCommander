export interface ZipEntryPreview {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  compressedSize: number;
  modified?: string | null;
  comment?: string | null;
}

export interface ZipArchivePreview {
  fileName: string;
  fileSize: number;
  totalEntries: number;
  totalFiles: number;
  totalDirs: number;
  totalUncompressedSize: number;
  totalCompressedSize: number;
  entries: ZipEntryPreview[];
  comment?: string | null;
}
