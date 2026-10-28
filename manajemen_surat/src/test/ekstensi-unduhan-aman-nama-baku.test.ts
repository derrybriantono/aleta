/**
 * ============================================================================
 * UNDUHAN EKSTENSI TIDAK DITAHAN CHROME, DAN NAMANYA POLA BAKU BLANGKO (14 Okt)
 * ============================================================================
 *
 * Riwayat unduhan Chrome petugas: unduhan blob:http://192.168.10.10/... yang
 * dibuat skrip konten (tautan <a download>) berakhir FILE_BLOCKED - "site isn't
 * using a secure connection" - sedangkan unduhan data: yang diterbitkan pekerja
 * latar (chrome-extension://) tidak pernah. Penjaga ini memastikan:
 *
 *   1. tidak ada jalur panel yang mengunduh lewat tautan halaman atau alamat
 *      http, kecuali cadangan bernama (alatUnduhLewatTautan / unduhLewatTautan);
 *   2. nama unduhan blangko = "<nomor, / jadi _> - <blangko>.<ekstensi asli>";
 *   3. cetak tiga berkas (namaBerkas) TIDAK diubah - pengecualian pengguna;
 *   4. CETAK satu berkas ABT diambil lalu diterbitkan ekstensi.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const alat = baca("ekstensi-sipp/panel-alat.js");
const abt = baca("ekstensi-sipp/abt.js");
const latar = baca("ekstensi-sipp/latar.js");

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(isi: string, nama: string[]): string {
  const baris = isi.split("\n");
  const hasil: string[] = [];
  for (const n of nama) {
    const i = baris.findIndex((b) => new RegExp(`^(?:async )?function ${n}\\(`).test(b));
    if (i < 0) throw new Error(`fungsi ${n} tidak ditemukan`);
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
  }
  return hasil.join("\n\n");
}

const namaBaku = new Function(`${potongFungsi(alat, ["alatNamaUnduhanBlangko"])}\nreturn alatNamaUnduhanBlangko;`)() as (
  nomor: string,
  blangko: string,
  akhiran?: string
) => string;

describe("nama baku unduhan blangko", () => {
  it("contoh keluhan: BAS .doc tetap .doc, nomor tidak diulang", () => {
    expect(
      namaBaku("630/Pdt.G/2026/PA.Dgl", "630_Pdt.G_2026_PA.Dgl - [01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir.doc", "rtf")
    ).toBe("630_Pdt.G_2026_PA.Dgl - [01a] (E-Court) BAS 1 P Hadir & T Tidak Hadir.doc");
  });

  it("nama blangko polos mendapat nomor di depannya", () => {
    expect(namaBaku("395/Pdt.G/2026/PA.Dgl", "[01] [Kabul Verstek] Cerai (Format Lengkap).rtf")).toBe(
      "395_Pdt.G_2026_PA.Dgl - [01] [Kabul Verstek] Cerai (Format Lengkap).rtf"
    );
  });

  it("header ABT bergaris miring (nomor mentah) disamakan, tanpa nomor ganda", () => {
    expect(namaBaku("395/Pdt.G/2026/PA.Dgl", "395/Pdt.G/2026/PA.Dgl - [02] [Kabul] CT - F.rtf")).toBe(
      "395_Pdt.G_2026_PA.Dgl - [02] [Kabul] CT - F.rtf"
    );
  });

  it("tanpa ekstensi -> ekstensi bawaan; karakter terlarang dibersihkan", () => {
    expect(namaBaku("1/Pdt.P/2026/PA.Dgl", 'BAS: "Saksi" <1>', "rtf")).toBe('1_Pdt.P_2026_PA.Dgl - BAS_ _Saksi_ _1_.rtf');
    // "PA.Dgl" di tengah bukan ekstensi; titik di nama blangko tidak dipotong.
    expect(namaBaku("2/Pdt.G/2026/PA.Dgl", "Putusan Verstek PERMA 7 2022.DOCX")).toBe(
      "2_Pdt.G_2026_PA.Dgl - Putusan Verstek PERMA 7 2022.docx"
    );
  });
});

describe("tidak pernah bernama generik (penegasan pengguna 14 Okt)", () => {
  const layak = new Function(
    `${alat.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0]}\n${alat.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0]}\n${potongFungsi(alat, ["alatNamaUnduhanLayak"])}\nreturn alatNamaUnduhanLayak;`
  )() as (nama: string, tipe?: string) => string;

  it("nama generik / kosong / tanpa ekstensi yang tak dapat ditebak -> ditolak", () => {
    for (const n of ["download.rtf", "download (3).pdf", "Download.doc", "berkas.rtf", "", "   ", "unduhan.pdf", "blob"]) {
      expect(layak(n, "application/octet-stream")).toBe("");
    }
    expect(layak("download", "application/rtf")).toBe("");
  });

  it("karakter terlarang Windows diganti, ekstensi menurut jenis isi, panjang dibatasi", () => {
    expect(layak('630/Pdt.G/2026/PA.Dgl - BAS: "1"?', "application/rtf")).toBe("630_Pdt.G_2026_PA.Dgl - BAS_ _1_.rtf");
    expect(layak("Rekap kasir harian 2026-10-14", "application/pdf")).toBe("Rekap kasir harian 2026-10-14.pdf");
    const panjang = layak(`${"x".repeat(400)}.doc`, "application/rtf");
    expect(panjang.length).toBe(180);
    expect(panjang.endsWith(".doc")).toBe(true);
  });

  it("nama baku blangko tanpa nomor dan tanpa blangko -> kosong, bukan 'berkas.rtf'", () => {
    expect(namaBaku("", "", "rtf")).toBe("");
  });

  it("alatUnduh menolak nama generik: TIDAK ada pesan unduh dan TIDAK ada tautan", async () => {
    const pesan: unknown[] = [];
    const tautan: string[] = [];
    const sumber = [
      alat.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0],
      alat.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0],
      potongFungsi(alat, ["alatNamaUnduhanLayak", "alatBlobKeData", "alatUnduhLewatTautan", "alatUnduh"]),
    ].join("\n");
    const unduh = new Function("chrome", "document", "URL", "alatCatat", `${sumber}\nreturn alatUnduh;`)(
      { runtime: { sendMessage: (m: unknown, balik: (x: unknown) => void) => (pesan.push(m), balik({ ok: true })) } },
      { createElement: () => ({ click: () => tautan.push("klik"), remove: () => undefined, style: {} }), body: { appendChild: () => undefined } },
      { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined },
      () => undefined
    ) as (b: Blob, n: string) => Promise<{ ok: boolean }>;
    const hasil = await unduh(new Blob(["x"], { type: "application/rtf" }), "download.rtf");
    expect(hasil.ok).toBe(false);
    expect(pesan).toEqual([]);
    expect(tautan).toEqual([]);
  });

  it("latar menolak pesan unduh bernama generik sebelum chrome.downloads", () => {
    const i = latar.indexOf('if (pesan.jenis === "unduh")');
    const potong = latar.slice(i, i + 1600);
    expect(potong).toContain("nama berkas generik ditolak");
    expect(potong.indexOf("generik ditolak")).toBeLessThan(potong.indexOf("terbitkanUnduhan(pesan.alamat, nama)"));
  });

  it("terbitkanUnduhan selalu mengirim filename eksplisit dan mengantrikan namanya", () => {
    const f = potongFungsi(latar, ["terbitkanUnduhan"]);
    expect(f).toContain("antrikanNama(nama);");
    expect(f).toContain("filename: nama");
  });
});

describe("tidak ada unduhan langsung dari halaman http", () => {
  const BERKAS = ["abt.js", "basmassal.js", "konten.js", "jurusita.js", "panel-alat.js", "aleta.js", "checklist.js", "saksiscan.js"];

  it("<a download> hanya di fungsi cadangan bernama", () => {
    for (const nama of BERKAS) {
      const isi = baca(`ekstensi-sipp/${nama}`);
      const baris = isi.split("\n");
      baris.forEach((b, i) => {
        if (!/\.download\s*=/.test(b)) return;
        // Cari fungsi puncak yang memuat baris ini.
        let j = i;
        while (j >= 0 && !/^(?:async )?function /.test(baris[j])) j -= 1;
        const fungsi = j >= 0 ? (baris[j].match(/function ([\w$]+)/) || [])[1] : "";
        expect([`${nama}:${fungsi}`]).toContain(
          ["panel-alat.js:alatUnduhLewatTautan", "abt.js:unduhLewatTautan"].includes(`${nama}:${fungsi}`) ? `${nama}:${fungsi}` : "DILARANG"
        );
      });
    }
  });

  it("BAS massal, rekap kasir, dan berkas e-Court lewat alatUnduh", () => {
    const bas = baca("ekstensi-sipp/basmassal.js");
    expect(potongFungsi(bas, ["basmassalUnduh"])).toContain("await alatUnduh(blob, nama)");
    expect(bas).toContain("await alatUnduh(berkas, `Rekap kasir");
    // 28 Okt: nama dihitung sekali (dipakai juga oleh pratinjau berkas e-Court), lalu tetap lewat alatUnduh.
    expect(baca("ekstensi-sipp/konten.js")).toContain("const namaBerkas = String(namaBerkasDari(respons, dokumen, format));");
    expect(baca("ekstensi-sipp/konten.js")).toContain("await alatUnduh(blob, namaBerkas);");
    expect(bas).not.toContain("URL.createObjectURL");
  });

  it("alatUnduh mengirim data: ke pekerja latar; latar menolak selain data:", () => {
    const f = potongFungsi(alat, ["alatUnduh", "alatBlobKeData"]);
    expect(f).toContain('jenis: "unduh"');
    expect(f).toContain("data:${tipe};base64,");
    expect(potongFungsi(latar, ["terbitkanUnduhan"])).toContain('if (!alamat.startsWith("data:"))');
    // Satu-satunya chrome.downloads.download ada di terbitkanUnduhan.
    expect(latar.match(/chrome\.downloads\.download\(/g)?.length).toBe(1);
  });

  it("alatUnduh: jalur ekstensi berhasil -> tanpa tautan halaman", async () => {
    const pesan: Array<{ jenis: string; nama: string; alamat: string }> = [];
    const tautan: string[] = [];
    const catatan: string[] = [];
    const chrome = {
      runtime: {
        lastError: undefined,
        sendMessage: (m: { jenis: string; nama: string; alamat: string }, balik: (x: unknown) => void) => {
          pesan.push(m);
          balik({ ok: true, id: 7 });
        },
      },
    };
    const sumber = [
      alat.match(/const ALAT_AKHIRAN_TIPE = \{[\s\S]*?\n\};/)![0],
      alat.match(/const ALAT_POLA_NAMA_GENERIK = .*;/)![0],
      potongFungsi(alat, ["alatNamaUnduhanLayak", "alatBlobKeData", "alatUnduhLewatTautan", "alatUnduh"]),
    ].join("\n");
    const buat = new Function("chrome", "document", "URL", "alatCatat", `${sumber}\nreturn alatUnduh;`);
    const unduh = buat(
      chrome,
      { createElement: () => ({ click: () => tautan.push("klik"), remove: () => undefined, style: {} }), body: { appendChild: () => undefined } },
      { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined },
      (_j: string, ringkas: string) => catatan.push(ringkas)
    ) as (b: Blob, n: string) => Promise<{ ok: boolean; lewat: string }>;
    const hasil = await unduh(new Blob(["{\\rtf1 x}"], { type: "application/rtf" }), "1_Pdt.G_2026_PA.Dgl - BAS.rtf");
    expect(catatan).toEqual([]);
    expect(hasil.lewat).toBe("ekstensi");
    expect(tautan).toEqual([]);
    expect(pesan[0].alamat.startsWith("data:application/rtf;base64,")).toBe(true);
    expect(Buffer.from(pesan[0].alamat.split(",")[1], "base64").toString()).toBe("{\\rtf1 x}");
  });
});

describe("CETAK ABT", () => {
  it("cetak tiga berkas: nama TIDAK berubah (pengecualian pengguna)", () => {
    const tiga = potongFungsi(abt, ["terbitkanTigaBerkas"]);
    expect(tiga).toContain('namaBerkas(nomor, "rtf", "putusan")');
    expect(tiga).toContain('namaBerkas(nomor, "pdf", "putusan")');
    expect(tiga).toContain('namaBerkas(nomor, "rtf", "anonimisasi")');
    expect(tiga).not.toContain("alatNamaUnduhanBlangko");
  });

  function muatCetakSatu(jawaban: Response) {
    const diunduh: Array<{ nama: string; ukuran: number }> = [];
    const sumber = `${potongFungsi(alat, ["alatNamaUnduhanBlangko"])}\n${potongFungsi(abt, ["cetakSatuLewatEkstensi"])}`;
    const buat = new Function("fetch", "unduhBlob", "nomorPerkaraAbt", `${sumber}\nreturn cetakSatuLewatEkstensi;`);
    const fn = buat(
      async () => jawaban,
      async (b: Blob, nama: string) => diunduh.push({ nama, ukuran: b.size }),
      () => "630/Pdt.G/2026/PA.Dgl"
    ) as (alamat: string) => Promise<boolean>;
    return { fn, diunduh };
  }

  it("satu berkas diambil lalu diterbitkan ekstensi dengan nama baku dari header ABT", async () => {
    const { fn, diunduh } = muatCetakSatu(
      new Response("{\\rtf1 isi}", {
        headers: { "content-disposition": 'attachment; filename="630/Pdt.G/2026/PA.Dgl - [01a] (E-Court) BAS 1 P Hadir.rtf"' },
      })
    );
    expect(await fn("http://192.168.10.10/aps_badilag/abt/preview?c=1")).toBe(true);
    expect(diunduh).toEqual([{ nama: "630_Pdt.G_2026_PA.Dgl - [01a] (E-Court) BAS 1 P Hadir.rtf", ukuran: 11 }]);
  });

  it("jawaban bukan RTF (halaman masuk/galat ABT) -> false, tautan ABT asli yang berjalan", async () => {
    const { fn, diunduh } = muatCetakSatu(new Response("<html>login</html>", { headers: { "content-disposition": 'attachment; filename="x.rtf"' } }));
    expect(await fn("http://x/abt/preview")).toBe(false);
    expect(diunduh).toEqual([]);
  });

  it("pendengar CETAK menahan klik dan mencoba jalur ekstensi sebelum tautan asli", () => {
    const i = abt.indexOf("if (await cetakSatuLewatEkstensi(tautan.href)) return;");
    const j = abt.indexOf("const pengganti = document.createElement(\"a\");");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
  });
});
