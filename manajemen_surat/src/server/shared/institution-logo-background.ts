const WHITE_CANVAS_MINIMUM_RATIO = 0.02;
const MAX_LOGO_PIXELS_FOR_BACKGROUND_CLEANUP = 2_500_000;

type CleanedInstitutionLogo = {
  buffer: Buffer;
  contentType: string;
  cleaned: boolean;
};

function isWhiteCanvasCandidate(data: Buffer, offset: number) {
  const alpha = data[offset + 3];
  if (alpha === 0) return true;

  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);

  return alpha > 0 && min >= 214 && max - min <= 34;
}

export async function cleanInstitutionLogoWhiteCanvas(
  buffer: Buffer,
  contentType: string
): Promise<CleanedInstitutionLogo> {
  if (contentType !== "image/png") {
    return { buffer, contentType, cleaned: false };
  }

  try {
    const sharp = (await import("sharp")).default;
    const image = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = image.info;
    const totalPixels = width * height;

    if (channels !== 4 || totalPixels <= 0 || totalPixels > MAX_LOGO_PIXELS_FOR_BACKGROUND_CLEANUP) {
      return { buffer, contentType, cleaned: false };
    }

    const pixels = image.data;
    const visited = new Uint8Array(totalPixels);
    const queue: number[] = [];

    const enqueue = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;

      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) return;

      const offset = pixelIndex * 4;
      if (!isWhiteCanvasCandidate(pixels, offset)) return;

      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }

    for (let y = 0; y < height; y += 1) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const pixelIndex = queue[head];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }

    if (queue.length / totalPixels < WHITE_CANVAS_MINIMUM_RATIO) {
      return { buffer, contentType, cleaned: false };
    }

    for (const pixelIndex of queue) {
      pixels[pixelIndex * 4 + 3] = 0;
    }

    const cleanedBuffer = await sharp(pixels, {
      raw: {
        width,
        height,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();

    return { buffer: cleanedBuffer, contentType: "image/png", cleaned: true };
  } catch {
    return { buffer, contentType, cleaned: false };
  }
}
