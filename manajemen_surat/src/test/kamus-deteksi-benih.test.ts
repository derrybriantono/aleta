// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AMBANG_PASTI, ketepatan, kompilasiPola, periksaBerkasBenih, rapikanPola, rapikanTemplat, type BenihKelompok } from "@/lib/kamus-deteksi";

/**
 * ============================================================================
 * UJI BENIH UMUM - SETIAP BERKAS aleta_bot/kamus-deteksi/awal/*.json
 * ============================================================================
 *
 * Kontrak bersama 10 Okt 2026 (aleta_bot/kamus-deteksi/README.md). Empat agen
 * menambah berkas benih secara paralel; uji ini menjaga SEMUANYA dengan aturan
 * yang sama, termasuk berkas yang belum ada saat uji ini ditulis:
 *
 *   - JSON sah, kelompok = nama berkas;
 *   - kode unik di dalam berkas DAN lintas berkas (tabel lapis database
 *     berindeks unik atas kode, jadi dua benih berkode sama tidak dapat
 *     ditimpa satu per satu dari layar Admin);
 *   - regex terkompilasi (bendera i/m/s/u saja - g/y membuat test berkeadaan);
 *   - contohBenar SEMUA cocok, contohSalah TIDAK ada yang cocok (apa pun
 *     statusnya - benih adalah janji, bukan draf);
 *   - "pasti" wajib ukur.n > 0 dan ketepatan >= 95%;
 *   - pemuat bot (services/kamusDeteksi.js) membaca berkas yang sama.
 *
 * Folder kosong = lulus. Berkas contoh HANYA di src/test/fixtures/kamus-deteksi
 * (membuktikan pemeriksanya bekerja), tidak pernah di folder awal/.
 */

const akar = path.resolve(process.cwd(), "..");
const FOLDER = path.join(akar, "aleta_bot", "kamus-deteksi", "awal");
const FIXTURE = path.join(process.cwd(), "src", "test", "fixtures", "kamus-deteksi");

type Temuan = { galat: string[]; benih: BenihKelompok[] };

/** Pemeriksaan ketat satu folder benih - dipakai untuk awal/ dan fixture. */
function periksaFolder(folder: string): Temuan {
  const galat: string[] = [];
  const benih: BenihKelompok[] = [];
  const kodeLintas = new Map<string, string>();
  const berkas = existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith(".json")).sort() : [];
  for (const nama of berkas) {
    let isi: unknown;
    try {
      isi = JSON.parse(readFileSync(path.join(folder, nama), "utf8"));
    } catch (e) {
      galat.push(`${nama}: JSON tidak sah - ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const hasil = periksaBerkasBenih(isi, nama);
    galat.push(...hasil.galat);
    if (!hasil.benih) continue;
    benih.push(hasil.benih);
    for (const p of hasil.benih.pola) {
      const k = kompilasiPola(p.regex, p.flags);
      if (!k.ok) continue; // sudah dilaporkan periksaBerkasBenih
      // Ketat untuk SEMUA status (periksaPola hanya ketat untuk aktif).
      for (const c of p.contohBenar) if (!k.re.test(c)) galat.push(`${nama} ${p.kode}: contohBenar tidak cocok: "${c}"`);
      for (const c of p.contohSalah) if (k.re.test(c)) galat.push(`${nama} ${p.kode}: contohSalah ikut cocok: "${c}"`);
      if (p.yakin === "pasti" && !(p.ukur.n > 0 && ketepatan(p.ukur) >= AMBANG_PASTI))
        galat.push(`${nama} ${p.kode}: "pasti" tanpa ukur n>0 & ketepatan>=95%`);
    }
    for (const x of [...hasil.benih.pola, ...hasil.benih.templat]) {
      const lain = kodeLintas.get(x.kode);
      if (lain && lain !== nama) galat.push(`kode "${x.kode}" ganda di ${lain} dan ${nama}`);
      kodeLintas.set(x.kode, nama);
    }
  }
  // Pesan ganda dari dua lapis pemeriksaan disatukan.
  return { galat: Array.from(new Set(galat)), benih };
}

describe("kamus deteksi - benih umum (aleta_bot/kamus-deteksi/awal)", () => {
  it("folder benih ada (boleh kosong) dan setiap berkasnya sah menurut kontrak", () => {
    expect(existsSync(FOLDER)).toBe(true);
    const t = periksaFolder(FOLDER);
    expect(t.galat).toEqual([]);
  });

  it("pemuat bot membaca kelompok yang sama dengan berkasnya, dan tiap pola aktif punya RegExp siap pakai", () => {
    const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
    const kamus = require_(path.join(akar, "aleta_bot", "services", "kamusDeteksi.js")) as {
      lupakan: () => void;
      daftarKelompok: () => string[];
      polaKelompok: (k: string) => Array<{ kode: string; re: RegExp; status?: string }>;
      FOLDER_BENIH: string;
    };
    kamus.lupakan();
    expect(path.resolve(kamus.FOLDER_BENIH)).toBe(path.resolve(FOLDER));
    const t = periksaFolder(FOLDER);
    expect(kamus.daftarKelompok().sort()).toEqual(t.benih.map((b) => b.kelompok).sort());
    for (const b of t.benih) {
      const aktif = b.pola.filter((p) => p.status !== "nonaktif");
      const dimuat = kamus.polaKelompok(b.kelompok);
      expect(dimuat.map((p) => p.kode).sort()).toEqual(aktif.map((p) => p.kode).sort());
      for (const p of dimuat) expect(p.re).toBeInstanceOf(RegExp);
    }
    kamus.lupakan();
  });
});

describe("kamus deteksi - pemeriksa benih bekerja (fixture, bukan benih sungguhan)", () => {
  it("berkas contoh di fixture lulus semua aturan", () => {
    const t = periksaFolder(FIXTURE);
    expect(t.galat).toEqual([]);
    expect(t.benih).toHaveLength(1);
    expect(t.benih[0].pola.map((p) => p.kode)).toEqual(["contoh-nafkah-tidak-memberi", "contoh-pisah-rumah"]);
    expect(t.benih[0].templat.map((x) => x.kode)).toEqual(["contoh-saksi-pembuka"]);
  });

  it("setiap pelanggaran kontrak tertangkap", () => {
    const fixture = JSON.parse(readFileSync(path.join(FIXTURE, "contoh.json"), "utf8")) as { pola: unknown[]; templat: unknown[] };
    const dasar = fixture.pola[0] as Record<string, unknown>;
    const salah = periksaBerkasBenih(
      {
        kelompok: "contoh",
        pola: [
          dasar,
          { ...dasar }, // kode ganda
          { ...dasar, kode: "contoh-regex-rusak", regex: "(tidak" },
          { ...dasar, kode: "contoh-bendera-g", flags: "gi" },
          { ...dasar, kode: "contoh-benar-meleset", contohBenar: ["kalimat lain sama sekali"] },
          { ...dasar, kode: "contoh-salah-cocok", contohSalah: ["Tergugat tidak memberi nafkah"] },
          { ...dasar, kode: "contoh-pasti-tanpa-ukur", ukur: { n: 0, tepat: 0, salahTangkap: 0 } },
          { ...dasar, kode: "contoh-pasti-kurang", ukur: { n: 100, tepat: 90, salahTangkap: 10 } },
        ],
        templat: [{ ...(fixture.templat[0] as Record<string, unknown>), kode: "contoh-templat-rusak", teks: "Bahwa {nama" }],
      },
      "contoh.json"
    );
    const g = salah.galat.join("\n");
    expect(g).toMatch(/kode ganda "contoh-nafkah-tidak-memberi"/);
    expect(g).toMatch(/contoh-regex-rusak: regex tidak terkompilasi/);
    expect(g).toMatch(/contoh-bendera-g: bendera "gi" tidak boleh/);
    expect(g).toMatch(/contoh-benar-meleset: contohBenar tidak cocok/);
    expect(g).toMatch(/contoh-salah-cocok: contohSalah ikut cocok/);
    expect(g).toMatch(/contoh-pasti-tanpa-ukur: "pasti" wajib punya ukur.n > 0/);
    expect(g).toMatch(/contoh-pasti-kurang: "pasti" wajib ketepatan >= 95% \(terukur 90.0%\)/);
    expect(g).toMatch(/contoh-templat-rusak: kurung kurawal/);
    // Nama berkas lain dari kelompoknya juga ditolak.
    expect(periksaBerkasBenih({ kelompok: "alasan", pola: [] }, "waktu.json").galat).toEqual([
      'waktu.json: kelompok "alasan" berbeda dengan nama berkas',
    ]);
    expect(periksaBerkasBenih("bukan objek", "x.json").galat).toEqual(["x.json: bukan objek JSON"]);
  });

  it("bawaan benih: status kosong = aktif, flags kosong = i (sama dengan pemuat bot)", () => {
    expect(rapikanPola({ kode: "x-1", regex: "a" }, "alasan")).toMatchObject({ status: "aktif", flags: "i", kelompok: "alasan", yakin: "ragu" });
    expect(rapikanTemplat({ kode: "t-1", teks: "a" }, "kalimat-saksi")).toMatchObject({ status: "aktif", kelompok: "kalimat-saksi" });
  });
});
