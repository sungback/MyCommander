type FileWithPath = File & { path?: unknown };

export const getExternalDropPaths = (files: ArrayLike<File>) =>
  Array.from({ length: files.length }, (_value, index) => files[index])
    .map((file) => (file as FileWithPath).path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
