export const getNameStem = (name: string) => {
  const lowerName = name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");
  return dotIndex > 0 ? lowerName.slice(0, dotIndex) : lowerName;
};

export const getFileExtension = (name: string): string | null => {
  const lowerName = name.toLowerCase();
  const dotIndex = lowerName.lastIndexOf(".");

  if (
    dotIndex === -1 ||
    dotIndex === lowerName.length - 1 ||
    (dotIndex === 0 && lowerName.indexOf(".", 1) === -1 && lowerName.length <= 1)
  ) {
    return null;
  }

  return lowerName.slice(dotIndex + 1);
};
