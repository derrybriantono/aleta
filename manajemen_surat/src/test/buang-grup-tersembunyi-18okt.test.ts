// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buangGrupTersembunyiRtf as buangPortal, buangGrupTersembunyiRtfTeks } from "@/lib/buang-grup-tersembunyi-rtf";

/**
 * Keputusan 18 Okt 2026 (butir 18): grup RTF tersembunyi {\*\isianasal ...} dan {\*\aletaasal ...}
 * dibuang BESERTA ISINYA di SEMUA jalur unggah ke SIPP: ekstensi (alatAmbil), portal (rute), bot
 * (penjagaTandaSipp.siapkanBerkasSipp). Berkas yang masih menyebut kata itu di grup tujuan-tersembunyi
 * lain ditahan.
 */
const AKAR = path.resolve(process.cwd(), "..");
const botReq = createRequire(path.join(AKAR, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Apa = any;
const penjaga: Apa = botReq("./services/penjagaTandaSipp.js");
const meta: Apa = botReq("./services/metadataTanpaAletaService.js");

const rtf = (badan: string) => `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\pard ${badan}\\par}`;
const GRUP_ISIAN = "{\\*\\isianasal {\\b Penggugat}\\{x\\} sisa \\\\ ujung}";
const GRUP_ALETA = "{\\*\\aletaasal Teks ALETA di sini}";
const bita = (s: string) => Buffer.from(s, "latin1");

describe("butir 18: buang grup RTF tersembunyi", () => {
  it("portal: kedua penanda dibuang beserta isinya (bersarang & kurung lolos)", () => {
    const hasil = buangGrupTersembunyiRtfTeks(rtf(`Hadir ${GRUP_ISIAN} dan ${GRUP_ALETA} selesai`));
    expect(hasil).toBe(rtf("Hadir  dan  selesai"));
    expect(hasil.toLowerCase()).not.toContain("aleta");
  });

  it("portal: berkas tanpa grup itu dikembalikan apa adanya (objek sama); bukan RTF dilewati", () => {
    const polos = new Uint8Array(bita(rtf("Biasa")));
    expect(buangPortal(polos)).toBe(polos);
    const pdf = new Uint8Array(Buffer.from("%PDF-1.4 {\\*\\isianasal x}", "latin1"));
    expect(buangPortal(pdf)).toBe(pdf);
    const dibuang = buangPortal(new Uint8Array(bita(rtf(`A ${GRUP_ISIAN}`))));
    expect(Buffer.from(dibuang).toString("latin1")).toBe(rtf("A "));
  });

  it("bot: buangGrupTersembunyiRtf sama dengan portal untuk Buffer dan string", () => {
    const s = rtf(`X ${GRUP_ALETA}${GRUP_ISIAN} Y`);
    expect(meta.buangGrupTersembunyiRtf(s)).toBe(rtf("X  Y"));
    const b = bita(s);
    expect(meta.buangGrupTersembunyiRtf(b).toString("latin1")).toBe(rtf("X  Y"));
    const polos = bita(rtf("Biasa"));
    expect(meta.buangGrupTersembunyiRtf(polos)).toBe(polos);
    expect(meta.buangGrupTersembunyiRtf(Buffer.from("%PDF-1.4"))).toEqual(Buffer.from("%PDF-1.4"));
  });

  it("bot: siapkanBerkasSipp membuang grup yang memuat kata itu, lalu LOLOS (tidak ditahan)", () => {
    const h = penjaga.siapkanBerkasSipp(bita(rtf(`Putusan ${GRUP_ALETA} ${GRUP_ISIAN}`)), { nama: "Putusan akhir" });
    expect(h.ok).toBe(true);
    expect(h.dibersihkan).toBe(true);
    expect(h.isi.toString("latin1")).toBe(rtf("Putusan  "));
    expect(h.isi.toString("latin1").toLowerCase()).not.toContain("aleta");
  });

  it("bot: grup tujuan-tersembunyi LAIN yang menyebut kata itu ditahan, bukan diubah", () => {
    const h = penjaga.siapkanBerkasSipp(bita(rtf("Putusan {\\*\\kodeinternal ALETA 123}")), { nama: "BAS sidang ke-2" });
    expect(h).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(String(h.pesan)).toContain("BAS sidang ke-2");
  });

  it("bot: tanpa kata itu di grup tersembunyi lain tetap lolos; font bernama Aleta tetap lolos", () => {
    expect(penjaga.siapkanBerkasSipp(bita(rtf("Putusan {\\*\\kodeinternal 123}")), { nama: "x" }).ok).toBe(true);
    expect(penjaga.periksaIsiBerkas(Buffer.from("{\\rtf1{\\fonttbl{\\f0 Aleta;}}\\pard Hadir\\par}", "latin1"), { nama: "x" })).toEqual({ ok: true });
  });

  it("bot: grup tersembunyi lain yang menyebut nama pihak dari SIPP tidak dihitung", () => {
    const h = penjaga.periksaIsiBerkas(bita(rtf("{\\*\\bkmkstart ALETA SARI binti Hasan}x")), { nama: "x", dariSipp: ["ALETA SARI binti Hasan"] });
    expect(h.ok).toBe(true);
  });

  it("ekstensi: alatAmbil membuang grup dari semua berkas RTF dalam FormData ke rute unggah SIPP, sisanya utuh", async () => {
    const sumber = readFileSync(path.join(AKAR, "ekstensi-sipp/panel-alat.js"), "utf8");
    const potong = (mulai: string, akhir: string) => {
      const a = sumber.indexOf(mulai);
      const b = sumber.indexOf(akhir, a);
      expect(a).toBeGreaterThan(-1);
      return sumber.slice(a, b);
    };
    const kode = potong("const ALAT_ALAMAT_UNGGAH_SIPP", "async function alatAmbil(");
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const { alamat, buang } = new Function(`${kode}; return { alamat: ALAT_ALAMAT_UNGGAH_SIPP, buang: alatBuangGrupTersembunyiBadan };`)() as Apa;
    expect(alamat.test("/aleta/api/aleta-ecourt/putusan/unggah-sipp")).toBe(true);
    expect(alamat.test("/aleta/api/aleta-ecourt/bas/unggah-sipp")).toBe(true);
    expect(alamat.test("/aleta/api/aleta-ecourt/penetapan-edoc/unggah")).toBe(true);
    expect(alamat.test("/aleta/api/aleta-ecourt/putusan/unggah-naskah")).toBe(false);

    const badan = new FormData();
    badan.append("perkaraId", "7");
    badan.append("putusan", new Blob([bita(rtf(`Isi ${GRUP_ISIAN}`))], { type: "application/rtf" }), "p.rtf");
    badan.append("anonimisasi", new Blob([bita(rtf(`Anon ${GRUP_ALETA}`))], { type: "application/rtf" }), "p - anonim.rtf");
    badan.append("bas", new Blob([bita(rtf("Tanpa grup"))], { type: "application/rtf" }), "b.rtf");
    badan.append("pdf", new Blob([Buffer.from("%PDF-1.4 x")], { type: "application/pdf" }), "x.pdf");
    const baru = (await buang(badan)) as FormData;
    expect(baru).not.toBe(badan);
    expect(baru.get("perkaraId")).toBe("7");
    expect(await (baru.get("putusan") as File).text()).toBe(rtf("Isi "));
    expect(await (baru.get("anonimisasi") as File).text()).toBe(rtf("Anon "));
    expect((baru.get("putusan") as File).name).toBe("p.rtf");
    expect(await (baru.get("bas") as File).text()).toBe(rtf("Tanpa grup"));
    expect(await (baru.get("pdf") as File).text()).toBe("%PDF-1.4 x");

    const bersih = new FormData();
    bersih.append("bas", new Blob([bita(rtf("Tanpa grup"))]), "b.rtf");
    expect(await buang(bersih)).toBe(bersih);
  });

  it("jalur: setiap pintu unggah ke SIPP membuang grup (portal, bot, ekstensi)", () => {
    const b = (p: string) => readFileSync(path.join(AKAR, p), "utf8");
    for (const p of [
      "manajemen_surat/src/app/api/aleta-ecourt/putusan/unggah-sipp/route.ts",
      "manajemen_surat/src/app/api/aleta-ecourt/bas/unggah-sipp/route.ts",
      "manajemen_surat/src/app/api/aleta-ecourt/penetapan-edoc/unggah/route.ts",
    ]) {
      expect(b(p), p).toContain("buangGrupTersembunyiRtf(");
    }
    expect(b("aleta_bot/services/penjagaTandaSipp.js")).toContain("buangGrupTersembunyiRtf(isi)");
    expect(b("aleta_bot/services/penetapanEdocService.js")).toContain("penjagaTandaSipp.buangGrupTersembunyiRtf(rtf)");
    expect(b("ekstensi-sipp/panel-alat.js")).toContain("alatBuangGrupTersembunyiBadan(opsi.body)");
  });
});
