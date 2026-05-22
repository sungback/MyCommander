let cachedDragIcon: string | null = null;

export const getDragIcon = (): string => {
  if (cachedDragIcon) return cachedDragIcon;

  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(8, 4, 28, 40, 4);
  else ctx.rect(8, 4, 28, 40);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(14, 14, 16, 2);
  ctx.fillRect(14, 20, 16, 2);
  ctx.fillRect(14, 26, 10, 2);

  cachedDragIcon = canvas.toDataURL("image/png");
  return cachedDragIcon;
};
