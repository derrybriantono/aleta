/**
 * ============================================================================
 * EDOC PUTUSAN TIDAK TERTAHAN ANONIMISASI (14 Okt 2026)
 * ============================================================================
 *
 * Diukur di server (baca saja): perkara 564 (12 Okt) - unggah-sipp 400 lalu
 * 409 dua kali (slot anonimisasi ditolak pemeriksa isi) sehingga edoc PUTUSAN
 * ikut tidak masuk; perkara 473 (13 Okt) - anonimisasi ABT 500 tiga kali
 * ("Maximum execution time of 30 seconds exceeded" di Anonimisasi.php:277
 * atas RTF hasil DOCX) dan unggah-sipp TIDAK PERNAH dipanggil. Keduanya
 * akhirnya diunggah tangan lewat SIPP.
 *
 * Penjaga ini menjalankan a30UnggahEdoc + kirimUnggahSippTetap +
 * kirimBadanUnggahSipp SUNGGUHAN dengan rute tiruan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const konten = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  return nama
    .map((n) => {
      const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
      if (i < 0) throw new Error(`fungsi ${n} tidak ditemukan`);
      let j = i;
      while (j < baris.length && baris[j] !== "}") j += 1;
      return baris.slice(i, j + 1).join("\n");
    })
    .join("\n\n");
}

type Kiriman = { kunci: string[]; putusan: string; anonimisasi: string };

function muat(jawaban: Array<{ status: number; badan: unknown }>) {
  const kiriman: Kiriman[] = [];
  const hapus: string[] = [];
  let ke = 0;
  const alatAmbil = async (_url: string, opsi: { body: FormData }) => {
    const b = opsi.body;
    const put = b.get("putusan") as File | null;
    const anon = b.get("anonimisasi") as File | null;
    kiriman.push({ kunci: [...b.keys()], putusan: put ? put.name : "", anonimisasi: anon ? anon.name : "" });
    const j = jawaban[Math.min(ke, jawaban.length - 1)];
    ke += 1;
    return new Response(JSON.stringify(j.badan), { status: j.status, headers: { "content-type": "application/json" } });
  };
  const sumber = potongFungsi(konten, ["kirimBadanUnggahSipp", "kirimUnggahSippTetap", "a30UnggahEdoc"]);
  const fn = new Function(
    "alatAmbil",
    "ALETA_API_UNGGAH_SIPP",
    "BATAS_UNGGAH_SIPP_MS",
    "perkaraIdDariHalaman",
    "namaPenggunaSipp",
    "pesanGagalUnggah",
    "alatPesanGagal",
    "alatCatat",
    "a30Tanya",
    "a30HapusNaskahEdoc",
    `${sumber}\nreturn a30UnggahEdoc;`
  )(
    alatAmbil,
    "/aleta/api/aleta-ecourt/putusan/unggah-sipp",
    1000,
    () => "4242",
    () => "hakim1",
    (b: { sebab?: string }) => b.sebab || "gagal",
    (_x: unknown, s: number) => `status ${s}`,
    () => undefined,
    async () => false,
    async (n: string) => void hapus.push(n)
  ) as (p: Record<string, unknown>) => Promise<{ ok: boolean; bunyi: string }>;
  return { fn, kiriman, hapus };
}

const NOMOR = "564/Pdt.G/2026/PA.Dgl";
const putusan = new File(["{\\rtf1 putusan}"], "564 putusan.rtf", { type: "application/rtf" });
const anonim = new File(["{\\rtf1 anonim}"], "564 anonimisasi.rtf", { type: "application/rtf" });
const BERHASIL_DUA = { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true }, { jenis: "anonimisasi", ok: true }] } };
const BERHASIL_PUTUSAN = { ok: true, data: { ok: true, berkas: [{ jenis: "putusan", ok: true }] } };
const TOLAK_ANON = {
  ok: false,
  data: { ok: false, slot: "anonimisasi", alasan: "slot_anonim_memuat_nama", sebab: "Berkas anonimisasi masih memuat nama pihak.", bolehTetapUnggah: false },
};

describe("a30UnggahEdoc - putusan & anonimisasi ke SIPP", () => {
  it("jalur biasa: SATU kiriman berisi putusan LALU anonimisasi; naskah dibuang sesudah keduanya masuk", async () => {
    const { fn, kiriman, hapus } = muat([{ status: 200, badan: BERHASIL_DUA }]);
    const h = await fn({ nomorPerkara: NOMOR, putusan, anonimisasi: anonim });
    expect(h.ok).toBe(true);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].kunci).toEqual(["perkaraId", "nomorPerkara", "olehUsername", "putusan", "anonimisasi"]);
    expect(hapus).toEqual([NOMOR]);
  });

  it("409 pada slot ANONIMISASI: putusan dikirim ulang SENDIRIAN dan terunggah (perkara 564)", async () => {
    const { fn, kiriman, hapus } = muat([
      { status: 409, badan: TOLAK_ANON },
      { status: 200, badan: BERHASIL_PUTUSAN },
    ]);
    const h = await fn({ nomorPerkara: NOMOR, putusan, anonimisasi: anonim });
    expect(kiriman.map((k) => [k.putusan, k.anonimisasi])).toEqual([
      ["564 putusan.rtf", "564 anonimisasi.rtf"],
      ["564 putusan.rtf", ""],
    ]);
    expect(kiriman[1].kunci).not.toContain("tetapUnggah");
    expect(h.ok).toBe(false);
    expect(h.bunyi).toMatch(/^Edoc putusan terunggah; edoc anonimisasi TIDAK diunggah: Berkas anonimisasi masih memuat nama pihak/);
    // Naskah tetap disimpan - anonimisasi yang menyusul masih memerlukannya.
    expect(hapus).toEqual([]);
  });

  it("409 pada slot PUTUSAN: tidak ada kirim ulang", async () => {
    const { fn, kiriman } = muat([
      { status: 409, badan: { ok: false, data: { ok: false, slot: "putusan", alasan: "nomor_isi_berbeda", sebab: "Putusan menyebut nomor lain." } } },
    ]);
    const h = await fn({ nomorPerkara: NOMOR, putusan, anonimisasi: anonim });
    expect(kiriman).toHaveLength(1);
    expect(h.ok).toBe(false);
    expect(h.bunyi).toBe("Edoc tidak terunggah: Putusan menyebut nomor lain.");
  });

  it("putusan saja (anonimisasi gagal di ABT): satu kiriman tanpa anonimisasi, naskah TIDAK dibuang", async () => {
    const { fn, kiriman, hapus } = muat([{ status: 200, badan: BERHASIL_PUTUSAN }]);
    const h = await fn({ nomorPerkara: NOMOR, putusan, anonimisasi: null });
    expect(h.ok).toBe(true);
    expect(kiriman.map((k) => k.anonimisasi)).toEqual([""]);
    expect(hapus).toEqual([]);
  });
});

describe("a30OpsiSimpanPutusan - anonimisasi gagal tidak menahan edoc putusan (perkara 473)", () => {
  it("cabang lama 'Edoc TIDAK diunggah' tanpa kiriman sudah tidak ada", () => {
    const f = potongFungsi(konten, ["a30OpsiSimpanPutusan"]);
    expect(f).toContain("if (anon && (anon.dilewati || !anon.ok))");
    expect(f).not.toContain("bunyi: `Edoc TIDAK diunggah");
    expect(f).toContain("anonimisasi: null");
  });
});
