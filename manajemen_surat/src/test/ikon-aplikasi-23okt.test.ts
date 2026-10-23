// @vitest-environment node
import { describe, expect, it } from "vitest";

import { GET, generateStaticParams } from "@/app/ikon-aplikasi/[ukuran]/route";

/** 23 Okt 2026 - ikon layar utama HP: PNG persegi sesuai ukuran, ukuran lain ditolak. */
describe("ikon aplikasi", () => {
  it("ukuran 180 (iPhone), 192 dan 512 (Android) dibuat statis", () => {
    expect(generateStaticParams()).toEqual([{ ukuran: "180" }, { ukuran: "192" }, { ukuran: "512" }]);
  });

  it("menghasilkan PNG dengan lebar dan tinggi yang diminta", async () => {
    for (const sisi of [180, 192, 512]) {
      const r = await GET(new Request("http://x/"), { params: Promise.resolve({ ukuran: String(sisi) }) });
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toBe("image/png");
      const b = new Uint8Array(await r.arrayBuffer());
      expect(Array.from(b.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]); // "PNG"
      const v = new DataView(b.buffer);
      expect([v.getUint32(16), v.getUint32(20)]).toEqual([sisi, sisi]); // IHDR lebar x tinggi
    }
  }, 60_000);

  it("ukuran yang tidak dikenal: 404", async () => {
    const r = await GET(new Request("http://x/"), { params: Promise.resolve({ ukuran: "999" }) });
    expect(r.status).toBe(404);
  });
});
