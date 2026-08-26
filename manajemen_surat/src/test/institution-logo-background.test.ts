import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { cleanInstitutionLogoWhiteCanvas } from "@/server/shared/institution-logo-background";

function setPixel(buffer: Buffer, width: number, x: number, y: number, red: number, green: number, blue: number) {
  const offset = (y * width + x) * 4;
  buffer[offset] = red;
  buffer[offset + 1] = green;
  buffer[offset + 2] = blue;
  buffer[offset + 3] = 255;
}

describe("institution logo background cleanup", () => {
  it("clears only white canvas connected to the image border", async () => {
    const width = 5;
    const height = 5;
    const pixels = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        setPixel(pixels, width, x, y, 255, 255, 255);
      }
    }

    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ]) {
      setPixel(pixels, width, x, y, 0, 128, 0);
    }

    const input = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const cleaned = await cleanInstitutionLogoWhiteCanvas(input, "image/png");
    const output = await sharp(cleaned.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const alphaAt = (x: number, y: number) => output.data[(y * width + x) * 4 + 3];
    const centerOffset = (2 * width + 2) * 4;

    expect(cleaned.cleaned).toBe(true);
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(4, 4)).toBe(0);
    expect(alphaAt(1, 1)).toBe(255);
    expect(alphaAt(2, 2)).toBe(255);
    expect(Array.from(output.data.subarray(centerOffset, centerOffset + 3))).toEqual([255, 255, 255]);
  });
});
