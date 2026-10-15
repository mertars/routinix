// Fiş fotoğrafını yüklemeden önce küçült (uzun kenar 1280px, JPEG %80):
// telefon fotoğrafları 5-10 MB olur, yerel depoyu şişirmesin.
export async function downscaleImage(file, max = 1280, quality = 0.8) {
  const bmp = await loadBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Görsel işlenemedi");
  return blob;
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* eski tarayıcı — <img> yedeği */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
