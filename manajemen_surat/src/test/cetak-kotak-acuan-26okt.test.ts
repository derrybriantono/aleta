// @vitest-environment node
/**
 * ============================================================================
 * KOTAK ACUAN VARIABEL TIDAK IKUT HASIL CETAK (26 Okt 2026, 322/Pdt.G/2026/PA.Dgl)
 * ============================================================================
 *
 * Blangko Derry menyimpan di BADAN naskah satu tabel kecil mengambang (\tphpg \tposx) berisi deretan penanda "#1214# #0222# ..." berhuruf
 * 1 pt, putih, superskrip - dipakai menyusun blangko supaya ABT menghitung variabel itu. Sesudah ABT mengisinya, sel itu memuat SELURUH
 * keluaran variabel (termasuk "..." untuk isian kosong) dan tampak sebagai kotak abu-abu di WPS; pemeriksa "sisa blangko" ikut membaca
 * titik-titik di dalamnya. Header serupa sudah dibuang (bersihkanHeaderPenanda); uji ini menjaga versi BADAN (abt-klien.js
 * abtKlienBuangKotakPenanda) yang dipakai klien ABT (SEMUA jalur cetak) dan jalur Tes putusan.
 *
 * Seluruh naskah di sini rekaan - tidak ada data perkara asli.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const req = createRequire(import.meta.url);
type Bersih = { rtf: string | ArrayBuffer; jumlah: number };
const K = req(path.join(AKAR, "ekstensi-sipp/abt-klien.js")) as {
  abtKlienBuangKotakPenanda: (r: string | ArrayBuffer | Uint8Array) => Bersih;
  abtKlienBuat: (o: { ambil: (u: string, i?: unknown) => Promise<unknown>; asal: string }) => { cetak: (o: Record<string, string>) => Promise<Record<string, unknown>> };
};
const D = req(path.join(AKAR, "ekstensi-sipp/deteksi-sisa-blangko.js")) as { periksaRtf: (r: string) => { temuan: Array<{ jenis: string; cocok: string }> } };
const SUMBER_ISIAN = readFileSync(path.join(AKAR, "ekstensi-sipp/blangko-derry-isian.js"), "utf8");

const bersih = (r: string): string => K.abtKlienBuangKotakPenanda(r).rtf as string;
const jumlah = (r: string): number => K.abtKlienBuangKotakPenanda(r).jumlah;
const kurung = (r: string): number => {
  const t = r.replace(/\\[\\{}]/g, "");
  return t.split("{").length - t.split("}").length;
};

// ---------------------------------------------------------------------------
// Bentuk nyata blangko (WPS): \trowd definisi, paragraf sel, \cell, lalu {\trowd ... \row } penutup baris
// ---------------------------------------------------------------------------
const DEF_MENGAMBANG = String.raw`\trql \trgaph0 \trrh402 \trleft-108 \tdfrmtxtLeft180 \tdfrmtxtRight180 \tpvpg \tphpg \tposx1488 \tposy1083 \tabsnoovrlp1 \trpaddl108 \trpaddr108 \clvertalt \clbrdrl \brdrnone \clbrdrr \brdrnone \clbrdrt \brdrnone \clbrdrb \brdrnone \cltxlrtb \clwWidth3580 \clftsWidth3 \cellx3472`;
const PARA_SEL = String.raw`\pard \plain \ql \li0 \ri0 \widctlpar \tql \tx2415 \phmrg \pvpara \posx1488 \posy1083 \intbl \itap1 \fs20 \trowd \trql \trgaph0 \trleft0`;
function tabelMengambang(isiSel: string): string {
  return String.raw`\trowd ${DEF_MENGAMBANG} ${PARA_SEL} ${isiSel}\pard \plain \qr \li0 \ri0 \widctlpar \intbl \itap1 {\trowd ${DEF_MENGAMBANG} \row }`;
}
const TEKS_KOTAK =
  "Penggugat, namun tidak berhasil AF alasan A dan F ... ... ... Bahwa pada sidang pertama tanggal 12 Oktober 2026, Penggugat hadir sendiri, sedangkan Tergugat tidak hadir; ... ... ... ... ... ...";
const KOTAK_ISI = String.raw`{\b1 \fs2 \lang14345 \cf16 \super1 ${TEKS_KOTAK}}{\b1 \fs2 \cf16 \super1 \cell }`;
const STEMPEL_SALINAN = tabelMengambang(String.raw`{\fs24 \cf16 SALINAN}{\fs24 \cf16 \par }{\fs24 \cf16 \cell }`);
const TABEL_AMAR = String.raw`\trowd \trql \trgaph0 \trleft0 \cellx3000 \cellx6000 \pard \plain \intbl {\fs24 Menetapkan biaya perkara}\cell {\fs24 Rp 30.000,00}\cell \row `;

function naskah(...bagian: string[]): string {
  return String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}{\colortbl;\red0\green0\blue0;\red255\green255\blue255;}\f0\fs24 ` + bagian.join("") + "}";
}
const PARAGRAF_ATAS = String.raw`\pard \plain \fs24 Menimbang, bahwa Penggugat telah dipanggil secara resmi dan patut; \par {\fs24 1.\tab Fotokopi KTP; \par }`;
const PARAGRAF_BAWAH = String.raw`\pard \plain \fs24 2.\tab Fotokopi Akta Nikah; \par `;

describe("kotak acuan variabel (tabel mengambang berhuruf 1 pt) di badan naskah", () => {
  it("dibuang dari hasil cetak; paragraf di atas dan di bawahnya tetap; kurung seimbang", () => {
    const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI), PARAGRAF_BAWAH);
    const h = K.abtKlienBuangKotakPenanda(sumber);
    expect(h.jumlah).toBe(1);
    const r = h.rtf as string;
    expect(r).not.toContain("tidak berhasil AF");
    expect(r).not.toContain("\\tposx");
    expect(r).toContain("Fotokopi KTP");
    expect(r).toContain("Fotokopi Akta Nikah");
    expect(kurung(r)).toBe(0);
    expect(kurung(sumber)).toBe(0);
  });

  it("gejala laporan: titik-titik di dalam kotak terbaca pemeriksa sisa blangko sebelum dibersihkan, tidak sesudahnya", () => {
    const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI), PARAGRAF_BAWAH);
    const sebelum = D.periksaRtf(sumber).temuan.filter((t) => t.jenis === "titik");
    expect(sebelum.length).toBeGreaterThan(0);
    expect(sebelum.some((t) => /\.\.\./.test(t.cocok))).toBe(true);
    expect(D.periksaRtf(bersih(sumber)).temuan).toEqual([]);
  });

  it("kotak berteks pertama 1 pt dengan superskrip tetap dibuang walau keluaran variabel memuat \\plain/\\fs normal di tengah sel", () => {
    const isi = String.raw`{\b1 \fs2 \cf16 \super1 #1214# awal }{\plain \fs24 teks normal dari keluaran variabel ...}{\b1 \fs2 \cf16 \super1 \cell }`;
    expect(jumlah(naskah(PARAGRAF_ATAS, tabelMengambang(isi), PARAGRAF_BAWAH))).toBe(1);
  });

  it("kotak tanpa teks sama sekali (semua variabel kosong) dibuang bila mengambang dan berhuruf kecil", () => {
    const isi = String.raw`{\b1 \fs2 \cf16 \super1 }{\b1 \fs2 \cf16 \super1 \cell }`;
    expect(jumlah(naskah(PARAGRAF_ATAS, tabelMengambang(isi), PARAGRAF_BAWAH))).toBe(1);
  });

  it("stempel SALINAN putih 12 pt (mengambang) tidak dibuang", () => {
    const sumber = naskah(PARAGRAF_ATAS, STEMPEL_SALINAN, PARAGRAF_BAWAH);
    expect(jumlah(sumber)).toBe(0);
    expect(bersih(sumber)).toBe(sumber);
  });

  it("tabel amar biasa dan kotak penanda dalam satu naskah: hanya kotak yang dibuang", () => {
    const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI), TABEL_AMAR, STEMPEL_SALINAN, PARAGRAF_BAWAH);
    const h = K.abtKlienBuangKotakPenanda(sumber);
    expect(h.jumlah).toBe(1);
    const r = h.rtf as string;
    expect(r).toContain("Menetapkan biaya perkara");
    expect(r).toContain("SALINAN");
    expect(r).not.toContain("tidak berhasil AF");
    expect(kurung(r)).toBe(0);
  });

  it("tabel berisi gambar, bidang, atau tabel bersarang tidak pernah dibuang walau huruf kecil", () => {
    for (const larangan of [String.raw`{\pict\jpegblip ffd8}`, String.raw`{\field{\*\fldinst PAGE}{\fldrslt 1}}`, String.raw`\nestcell`]) {
      const isi = String.raw`{\b1 \fs2 \cf16 \super1 kecil ${larangan}}{\b1 \fs2 \cf16 \super1 \cell }`;
      const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(isi), PARAGRAF_BAWAH);
      expect(jumlah(sumber), larangan).toBe(0);
    }
  });

  it("tabel biasa (tidak mengambang) berteks normal tanpa huruf kecil tidak disentuh", () => {
    const sumber = naskah(PARAGRAF_ATAS, TABEL_AMAR, PARAGRAF_BAWAH);
    expect(bersih(sumber)).toBe(sumber);
  });

  it("tabel tak mengambang yang SELURUH teksnya <= 3 pt ikut dibuang; tabel normal di sebelahnya tetap", () => {
    const tabelKecil = String.raw`\trowd \trql \trgaph0 \trleft0 \cellx3000 \pard \plain \intbl {\fs2 #0001# #0002#}\cell \row `;
    const sumber = naskah(PARAGRAF_ATAS, tabelKecil, TABEL_AMAR, PARAGRAF_BAWAH);
    const h = K.abtKlienBuangKotakPenanda(sumber);
    expect(h.jumlah).toBe(1);
    expect(h.rtf as string).toContain("Menetapkan biaya perkara");
    expect(h.rtf as string).not.toContain("#0001#");
  });

  it("tabel kecil di dalam header/footer tidak disentuh (itu urusan bersihkanHeaderPenanda)", () => {
    const tabelKecil = String.raw`\trowd \trql \trgaph0 \trleft0 \cellx3000 \pard \plain \intbl {\fs2 #0184# #0185#}\cell \row `;
    const sumber = naskah(String.raw`{\header \pard \plain ${tabelKecil}}{\footer \pard \plain ${tabelKecil}}`, PARAGRAF_ATAS);
    expect(bersih(sumber)).toBe(sumber);
    // di luar header, tabel yang sama dibuang
    expect(jumlah(naskah(PARAGRAF_ATAS, tabelKecil, PARAGRAF_BAWAH))).toBe(1);
  });

  it("idempoten dan tidak berubah bila tidak ada kotak", () => {
    const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI), PARAGRAF_BAWAH);
    const sekali = bersih(sumber);
    expect(K.abtKlienBuangKotakPenanda(sekali).jumlah).toBe(0);
    const polos = naskah(PARAGRAF_ATAS, PARAGRAF_BAWAH);
    expect(bersih(polos)).toBe(polos);
  });

  it("menerima ArrayBuffer dan Uint8Array (pulang ArrayBuffer), bita non-ASCII tidak rusak", () => {
    const sumber = naskah(PARAGRAF_ATAS, String.raw`\pard \plain \fs24 Pengadilan \'e9 \par `, tabelMengambang(KOTAK_ISI), PARAGRAF_BAWAH);
    const bita = new Uint8Array(sumber.length);
    for (let i = 0; i < sumber.length; i += 1) bita[i] = sumber.charCodeAt(i) & 0xff;
    bita[40] = 0xe9; // bita di luar ASCII harus kembali persis
    const dariBuffer = K.abtKlienBuangKotakPenanda(bita.buffer.slice(0));
    const dariBita = K.abtKlienBuangKotakPenanda(bita);
    for (const h of [dariBuffer, dariBita]) {
      expect(h.jumlah).toBe(1);
      expect(h.rtf).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(h.rtf as ArrayBuffer)[40]).toBe(0xe9);
    }
  });

  it("RTF yang kurungnya tidak seimbang dibiarkan apa adanya", () => {
    const rusak = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI).replace(String.raw`\row }`, String.raw`\row `), PARAGRAF_BAWAH);
    expect(jumlah(rusak)).toBe(0);
  });
});

describe("klien ABT cetak: kotak dibuang di pintu masuk, jadi semua jalur (RTF, PDF, salinan, anonim, e-Doc, cetak massal) bersih", () => {
  const sumber = naskah(PARAGRAF_ATAS, tabelMengambang(KOTAK_ISI), PARAGRAF_BAWAH);
  const bita = Uint8Array.from(Buffer.from(sumber, "latin1"));
  const tanggapan = (buf: Uint8Array) => ({
    status: 200,
    headers: { get: () => 'attachment; filename="322_Pdt.G_2026_PA.Dgl - [01].rtf"' },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    text: async () => Buffer.from(buf).toString("latin1"),
  });

  it("cetak() mengembalikan RTF tanpa kotak dan hitungan titik-titik dari naskah bersih", async () => {
    const klien = K.abtKlienBuat({ ambil: async () => tanggapan(bita), asal: "http://abt.test/aps_badilag/index.php/abt" });
    const h = (await klien.cetak({ a: "1", b: "2", perkaraId: "9824" })) as { ok: boolean; rtf: ArrayBuffer; ukuran: number; kotakDibuang: number; periksa: { jumlahTitikTiga: number } };
    expect(h.ok).toBe(true);
    expect(h.kotakDibuang).toBe(1);
    const teks = Buffer.from(h.rtf).toString("latin1");
    expect(teks).not.toContain("tidak berhasil AF");
    expect(teks).toContain("Fotokopi Akta Nikah");
    expect(h.ukuran).toBe(h.rtf.byteLength);
    expect(h.periksa.jumlahTitikTiga).toBe(0);
    expect(D.periksaRtf(teks).temuan).toEqual([]);
  });

  it("jalur Tes putusan (tidak lewat klien.cetak) memanggil pembersih yang sama di ambilRtf, sesudah pembersih header dan sebelum pembersih penutup", () => {
    const a = SUMBER_ISIAN.indexOf("async function ambilRtf(");
    const fungsi = SUMBER_ISIAN.slice(a, SUMBER_ISIAN.indexOf("async function muatPratinjau(", a));
    expect(fungsi).toContain("abtKlienBuangKotakPenanda(h.rtf)");
    expect(fungsi.indexOf("bersihkanHeaderPenanda")).toBeLessThan(fungsi.indexOf("abtKlienBuangKotakPenanda"));
    expect(fungsi.indexOf("abtKlienBuangKotakPenanda")).toBeLessThan(fungsi.indexOf("bersihkanPenutupSaksiRtf"));
  });
});
