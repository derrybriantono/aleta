/**
 * Istilah tampilan: "Blangko tanya jawab" (bukan "Template tanya jawab").
 *
 * Diminta pengguna 17 Oktober 2026. Yang diganti hanya TULISAN yang tampil di
 * portal dan ekstensi. Nama kode, rute API, tabel ABT `tanyajawab_template`,
 * kunci penyimpanan, dan nama berkas sengaja tidak diganti. Catatan rilis
 * lama (catatan-ekstensi, patch-notes) adalah sejarah dan tidak diubah, dan
 * `Template Tanya Jawab Disimpan` di abt-klien.js adalah kalimat milik ABT
 * yang dicocokkan, bukan tulisan ALETA.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "../../..");
const POLA_LAMA = /templat[e]?[ -]tanya[- ]jawab/i;
const DIKECUALIKAN = new Set(["ekstensi-berkas.ts", "catatan-ekstensi.ts", "patch-notes.ts"]);

function berkasDari(dir: string, hasil: string[] = []): string[] {
  for (const b of readdirSync(dir, { withFileTypes: true })) {
    if (b.name === "node_modules" || b.name === ".next" || b.name.startsWith(".")) continue;
    if (DIKECUALIKAN.has(b.name)) continue;
    const p = path.join(dir, b.name);
    if (b.isDirectory()) {
      if (b.name === "test") continue;
      berkasDari(p, hasil);
    } else if (/\.(js|ts|tsx)$/.test(b.name) && !/\.d\.ts$/.test(b.name)) hasil.push(p);
  }
  return hasil;
}

describe("istilah layar: Blangko tanya jawab", () => {
  it("tidak ada lagi 'Template tanya jawab' di portal dan ekstensi", () => {
    const sisa: string[] = [];
    for (const dir of [path.join(REPO, "manajemen_surat/src"), path.join(REPO, "ekstensi-sipp")]) {
      for (const p of berkasDari(dir)) {
        readFileSync(p, "utf8")
          .split("\n")
          .forEach((baris, i) => {
            if (!POLA_LAMA.test(baris)) return;
            if (p.endsWith("abt-klien.js") && /Template Tanya Jawab Disimpan/.test(baris)) return;
            sisa.push(`${path.relative(REPO, p)}:${i + 1}`);
          });
      }
    }
    expect(sisa).toEqual([]);
  });

  it("layar Pengaturan SIPP & ABT dan panel ekstensi memakai istilah baru", () => {
    const pengaturan = readFileSync(path.join(REPO, "manajemen_surat/src/components/portal/pengaturan-sipp-abt.tsx"), "utf8");
    expect(pengaturan).toContain('["templat", "Blangko tanya jawab"]');
    expect(pengaturan).toContain("Pilih blangko tanya jawab...");
    const abt = readFileSync(path.join(REPO, "ekstensi-sipp/abt.js"), "utf8");
    expect(abt).toContain('"Blangko tanya jawab"');
    expect(abt).toContain("☆ Simpan sebagai blangko saya");
  });
});
