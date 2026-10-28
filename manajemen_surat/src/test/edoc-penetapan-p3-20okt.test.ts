// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createAletaDatabase } from "@/server/db/client";
import { pilihCap, tambahCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { capPerluDibersihkan, pastikanCapBening } from "@/server/shared/cap-latar-transparan";

/**
 * 20 OKT 2026 - e-Doc penetapan (agen P3), butir 5, 6, 7:
 *   5. Cap kantor tidak boleh hilang pada PMH: cadangan cap bila peruntukan Ketua/umum kosong; cap berlatar pekat
 *      dibersihkan supaya tidak tertutup tanda tangan berlatar pekat.
 *   6. Logo di kotak "Ditandatangani secara elektronik" (PPP/PJS) sepenuhnya DI DALAM kotak, tidak menimpa tulisan.
 *   7. Kata terpotong di PDF PMH/PHS: sebabnya \lang2052 (Mandarin) pada teks Latin - dipulangkan ke Indonesia sebelum PDF.
 */
const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));
type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
function muatSegar<T>(relatif: string): T {
  const jalur = jalurBot(relatif);
  delete (require_.cache as Record<string, unknown>)[jalur];
  const m = require_(jalur) as T;
  delete (require_.cache as Record<string, unknown>)[jalur];
  return m;
}
function lepasSemua() {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
}
type Logo = { rtf: string; dirapikan: number; rincian: Array<{ kotak: Geo; logoLama: Geo; logoBaru: Geo }> };
type Geo = { kiri: number; atas: number; kanan: number; bawah: number };
type Edoc = {
  rapikanLogoKotakElektronik: (r: string) => Logo;
  LOGO_KOTAK: { padTwip: number; celahTwip: number };
  bubuhkanPenetapan: (p: Record<string, unknown>) => Promise<any>;
  cariPenandaTangan: (r: string, o: Record<string, unknown>) => any;
};
function modulEdoc(): Edoc {
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  return muatSegar<Edoc>("services/penetapanEdocService.js");
}
type Cetak = { normalkanBahasaRtf: (b: Buffer) => Buffer; BAHASA_PEMENGGAL_HURUF: Set<number> };
const modulCetak = () => muatSegar<Cetak>("services/abtCetakService.js");
afterEach(() => lepasSemua());

const geoDari = (rtf: string): Geo[] =>
  [...rtf.matchAll(/\\shpleft(-?\d+)\s*\\shptop(-?\d+)\s*\\shpright(-?\d+)\s*\\shpbottom(-?\d+)/g)].map((m) => ({ kiri: +m[1], atas: +m[2], kanan: +m[3], bawah: +m[4] }));

/** Bentuk logo (gambar) + kotak teks, persis geometri blangko "@ 0a - PPP" Derry. */
function rtfKotak({ logo = "3108,174,4974,2040", kotak = "3284,334,8707,1975", logoSesudah = false, pw = 124, ph = 124 } = {}) {
  const [a1, a2, a3, a4] = logo.split(",");
  const [b1, b2, b3, b4] = kotak.split(",");
  const bentukLogo =
    String.raw`{\shp {\*\shpinst \shpleft${a1} \shptop${a2} \shpright${a3} \shpbottom${a4} \shpfhdr0 \shpbxcolumn \shpbypara \shpwr3 \shpz1 \shplid1026 {\sp {\sn shapeType}{\sv 75}}` +
    String.raw`{\sp {\sn pib}{\sv {\pict \picscalex100 \picscaley100 \picw${pw} \pich${ph} \picwgoal1866 \pichgoal1866 \pngblip ` +
    "89504e470d0a1a0a".repeat(3) +
    String.raw`}}}{\sp {\sn wzName}{\sv Picture 12}}}{\shprslt {\pict }}}`;
  const bentukKotak =
    String.raw`{\shp {\*\shpinst \shpleft${b1} \shptop${b2} \shpright${b3} \shpbottom${b4} \shpfhdr0 \shpbxcolumn \shpbypara \shpwr3 \shpz0 \shplid1027 {\sp {\sn shapeType}{\sv 1}}{\sp {\sn wzName}{\sv Rectangle 6}}` +
    String.raw`{\shptxt \pard \plain \ql \fi1276 \li0 \ri0 {\fs24 Ditandatangani secara elektronik oleh:}{\fs24 \par }` +
    String.raw`\pard \plain \ql \fi1276 \li0 {\fs24 Panitera Pengadilan Agama Donggala}{\fs24 \par }\pard \plain \qr \fi1559 {\b1 \par }` +
    String.raw`\pard \plain \ql \fi1276 {\b1 Sri Susilowati, S.H.}{\fs24 \par }}}{\shprslt {\pict }}}`;
  return (
    String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\paperw11906\margl1800\margr1800` +
    "\n" +
    String.raw`\pard\plain\qj Menunjuk X sebagai Panitera Sidang.\par` +
    "\n" +
    String.raw`\pard\plain\qj\li3600 {\fs24 ` +
    (logoSesudah ? bentukKotak + bentukLogo : bentukLogo + bentukKotak) +
    String.raw`Donggala, 20 Oktober 2026}{\fs24 \par }}`
  );
}

describe("6. logo di dalam kotak tanda tangan elektronik", () => {
  it("geometri asli blangko: logo lama keluar dari kotak (kiri 176, atas 160 twip) - sesudahnya sepenuhnya di dalam dengan bantalan", () => {
    const e = modulEdoc();
    const awal = geoDari(rtfKotak());
    expect(awal[0].kiri).toBeLessThan(awal[1].kiri); // bukti keluar garis kiri
    expect(awal[0].atas).toBeLessThan(awal[1].atas); // keluar garis atas
    const h = e.rapikanLogoKotakElektronik(rtfKotak());
    expect(h.dirapikan).toBe(1);
    const [logo, kotak] = geoDari(h.rtf);
    const pad = e.LOGO_KOTAK.padTwip;
    expect(logo.kiri).toBeGreaterThanOrEqual(kotak.kiri + pad);
    expect(logo.atas).toBeGreaterThanOrEqual(kotak.atas + pad);
    expect(logo.kanan).toBeLessThanOrEqual(kotak.kanan - pad);
    expect(logo.bawah).toBeLessThanOrEqual(kotak.bawah - pad);
    // Tidak menimpa tulisan: tepi kanan logo di kiri tepi teks (inset 144 + inden 1276) dikurangi celah.
    expect(logo.kanan).toBeLessThanOrEqual(kotak.kiri + 144 + 1276 - e.LOGO_KOTAK.celahTwip);
    // Dipusatkan vertikal dan tidak gepeng (gambar persegi tetap persegi).
    expect(Math.abs(logo.atas - kotak.atas - (kotak.bawah - logo.bawah))).toBeLessThanOrEqual(1);
    expect(logo.kanan - logo.kiri).toBe(logo.bawah - logo.atas);
    // Tujuan gambar (picwgoal/pichgoal) ikut bentuk barunya.
    expect(h.rtf).toContain(`\\picwgoal${logo.kanan - logo.kiri}`);
    expect(h.rtf).toContain(`\\pichgoal${logo.bawah - logo.atas}`);
  });

  it("perbandingan sisi gambar dipertahankan (logo lonjong tidak digepengkan) dan hasilnya idempoten", () => {
    const e = modulEdoc();
    const h = e.rapikanLogoKotakElektronik(rtfKotak({ pw: 90, ph: 118 }));
    const [logo] = geoDari(h.rtf);
    expect((logo.kanan - logo.kiri) / (logo.bawah - logo.atas)).toBeCloseTo(90 / 118, 1);
    const lagi = e.rapikanLogoKotakElektronik(h.rtf);
    expect(lagi.dirapikan).toBe(0);
    expect(lagi.rtf).toBe(h.rtf);
  });

  it("logo yang ditulis SESUDAH kotak juga dirapikan; bentuk gambar yang tidak berdekatan dengan kotak tidak disentuh", () => {
    const e = modulEdoc();
    const sesudah = e.rapikanLogoKotakElektronik(rtfKotak({ logoSesudah: true }));
    const [kotak, logo] = geoDari(sesudah.rtf);
    expect(sesudah.dirapikan).toBe(1);
    expect(logo.kiri).toBeGreaterThanOrEqual(kotak.kiri + 100);
    expect(logo.atas).toBeGreaterThanOrEqual(kotak.atas + 100);
    // Logo jauh di luar kotak (mis. gambar kop) bukan logo kotak.
    const jauh = e.rapikanLogoKotakElektronik(rtfKotak({ logo: "100,6000,900,6800" }));
    expect(jauh.dirapikan).toBe(0);
    // Tanpa kotak elektronik (PMH/PHS biasa) tidak ada yang berubah.
    const tanpa = String.raw`{\rtf1\ansi Teks biasa \par}`;
    expect(e.rapikanLogoKotakElektronik(tanpa)).toMatchObject({ rtf: tanpa, dirapikan: 0 });
  });

  it("bubuhkanPenetapan PPP: kotak tetap mode elektronik (tanpa ttd/cap), logo di dalam kotak, tanpa peringatan nama palsu", async () => {
    const e = modulEdoc();
    const hasil = await e.bubuhkanPenetapan({
      rtf: rtfKotak(),
      jenis: "ppp",
      atur: {},
      cap: null,
      daftarTtd: [],
      ambilGambar: async () => null,
      bakuNama: (n: string) => String(n).toLowerCase(),
    });
    expect(hasil.ok).toBe(true);
    expect(hasil.modeTtd).toBe("kotak_elektronik");
    expect(hasil.logoKotak).toHaveLength(1);
    const [logo, kotak] = geoDari(hasil.rtf);
    expect(logo.kiri).toBeGreaterThan(kotak.kiri);
    expect(logo.atas).toBeGreaterThan(kotak.atas);
    expect(logo.bawah).toBeLessThan(kotak.bawah);
  });

  it("label Panitera tidak lagi mencocok paragraf pembuka yang panjang (tanpa koma)", () => {
    const e = modulEdoc();
    const panjang = String.raw`{\rtf1\ansi\pard Panitera Pengadilan Agama Donggala telah membaca Penetapan Ketua Pengadilan Agama Donggala Nomor 1 Tanggal 2 Tentang Penetapan Majelis Hakim;\par\pard Menimbang bahwa perlu.\par}`;
    expect(e.cariPenandaTangan(panjang, { penandatangan: "panitera" }).ok).toBe(false);
    const sah = String.raw`{\rtf1\ansi\pard Ditetapkan di Donggala\par\pard Panitera Pengadilan Agama Donggala,\par\pard\b Sri Susilowati, S.H.\par}`;
    expect(e.cariPenandaTangan(sah, { penandatangan: "panitera" })).toMatchObject({ ok: true, nama: "Sri Susilowati, S.H." });
  });

  const BLANGKO = "D:/aleta-dev/kerja/batch-14okt-sore/i9-penetap-phs-sita/abt-penetap-phs-sita-derry/paket-satker/rtf/derry_briantono/99 PTSP";
  it.skipIf(!existsSync(BLANGKO))("blangko Derry sungguhan (@ 0a PPP, @ 0b PJS, @ 0 gabungan): logo di dalam kotak sesudah dirapikan", () => {
    const e = modulEdoc();
    for (const berkas of ["@ 0a - PPP.rtf", "@ 0b - PJS.rtf", "@ 0 - PMH - PHS.rtf"]) {
      const rtf = readFileSync(path.join(BLANGKO, berkas), "latin1");
      const h = e.rapikanLogoKotakElektronik(rtf);
      expect(h.dirapikan, berkas).toBeGreaterThanOrEqual(1);
      for (const r of h.rincian as Array<(typeof h.rincian)[number] & { koreksiJangkar: number }>) {
        expect(r.logoBaru.kiri, berkas).toBeGreaterThanOrEqual(r.kotak.kiri + e.LOGO_KOTAK.padTwip);
        // 28 Okt: letak yang TAMPIL di PDF = koordinat RTF dikurangi jarak baris jangkar (koreksiJangkarTwip; terukur 694/2026).
        expect(r.koreksiJangkar, berkas).toBe(360);
        expect(r.logoBaru.atas - r.koreksiJangkar, berkas).toBeGreaterThanOrEqual(r.kotak.atas + e.LOGO_KOTAK.padTwip);
        expect(r.logoBaru.kanan, berkas).toBeLessThanOrEqual(r.kotak.kanan - e.LOGO_KOTAK.padTwip);
        expect(r.logoBaru.bawah - r.koreksiJangkar, berkas).toBeLessThanOrEqual(r.kotak.bawah - e.LOGO_KOTAK.padTwip);
      }
      expect(e.rapikanLogoKotakElektronik(h.rtf).dirapikan, berkas).toBe(0);
    }
  });
});

describe("7. kata terpotong - bahasa CJK pada teks Latin", () => {
  it("\\lang/\\langnp/\\deflang CJK dipulangkan ke Indonesia; Inggris, Indonesia, Arab dan \\langfe tidak disentuh", () => {
    const { normalkanBahasaRtf } = modulCetak();
    const asal = String.raw`{\rtf1\ansi\deflang2052{\fs24 \lang2052 \langnp2052 \langfe2052 \langfenp2052 perlu}{\lang1033 \langnp1033 en}{\lang1057 id}{\lang1025 ar}{\lang2057 gb}{\lang1041 \langnp1041 jp}}`;
    const baru = normalkanBahasaRtf(Buffer.from(asal, "latin1")).toString("latin1");
    expect(baru).not.toMatch(/\\lang(?:np)?(?:2052|1041)(?!\d)/);
    expect(baru).not.toMatch(/\\deflang2052/);
    expect(baru).toContain("\\deflang1057");
    expect(baru).toContain("\\lang1033 \\langnp1033");
    expect(baru).toContain("\\lang1057 id");
    expect(baru).toContain("\\lang1025 ar");
    expect(baru).toContain("\\lang2057 gb");
    expect(baru).toContain("\\langfe2052 \\langfenp2052"); // bahasa aksara Asia asli: tidak diubah
  });

  it("bukan RTF atau RTF berdata biner mentah dikembalikan apa adanya; tanpa CJK tidak berubah", () => {
    const { normalkanBahasaRtf } = modulCetak();
    const pdf = Buffer.from("%PDF-1.4 \\lang2052", "latin1");
    expect(normalkanBahasaRtf(pdf)).toBe(pdf);
    const biner = Buffer.from(String.raw`{\rtf1 \bin4 abcd \lang2052 x}`, "latin1");
    expect(normalkanBahasaRtf(biner)).toBe(biner);
    const polos = Buffer.from(String.raw`{\rtf1 \lang1057 x}`, "latin1");
    expect(normalkanBahasaRtf(polos)).toBe(polos);
  });

  const BLANGKO = "D:/aleta-dev/kerja/batch-14okt-sore/i9-penetap-phs-sita/abt-penetap-phs-sita-derry/paket-satker/rtf/derry_briantono/99 PTSP";
  it.skipIf(!existsSync(BLANGKO))("semua blangko PTSP Derry (PMH, PPP, PJS, PHS, Ikrar): tak tersisa bahasa CJK sesudah dinormalkan; isi lain tidak berubah", () => {
    const { normalkanBahasaRtf, BAHASA_PEMENGGAL_HURUF } = modulCetak();
    const baruCjk = (s: string) => [...s.matchAll(/\\(?:lang|langnp|deflang)(\d+)(?!\d)/g)].filter((m) => BAHASA_PEMENGGAL_HURUF.has(Number(m[1]))).length;
    let totalLama = 0;
    for (const berkas of ["@ 1 - PMH.rtf", "@ 0 - PMH - PHS.rtf", "@ 2a - PHS - Sita Dikabulkan.rtf", "@ 2b - PHS - Sita Ditolak.rtf", "@ 3 - PMH - PHS Ikrar Talak.rtf", "@ 3a - PHS Ikrar Talak.rtf"]) {
      const isi = readFileSync(path.join(BLANGKO, berkas));
      const lama = isi.toString("latin1");
      totalLama += baruCjk(lama);
      const baru = normalkanBahasaRtf(isi).toString("latin1");
      expect(baruCjk(baru), berkas).toBe(0);
      // Panjang berkas tetap kecuali selisih angka bahasa; jumlah kelompok tidak berubah.
      expect(baru.split("{").length, berkas).toBe(lama.split("{").length);
    }
    expect(totalLama).toBeGreaterThan(0); // blangko memang memuat \lang2052 - penyebab kata terpotong
  });
});

describe("5. cap kantor pada PMH", () => {
  let CAP_PNG_BENING: Buffer;
  let CAP_JPG_PEKAT: Buffer;
  let CAP_PNG_PEKAT: Buffer;
  beforeAll(async () => {
    const svg = (latar: string) =>
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${latar}"/><circle cx="150" cy="150" r="120" fill="none" stroke="#6a1b9a" stroke-width="10"/><circle cx="150" cy="150" r="60" fill="none" stroke="#6a1b9a" stroke-width="8"/></svg>`
      );
    CAP_PNG_BENING = await sharp(svg("none")).png().toBuffer();
    CAP_JPG_PEKAT = await sharp(svg("#ffffff")).jpeg().toBuffer();
    CAP_PNG_PEKAT = await sharp(svg("#ffffff")).png().toBuffer();
  });
  afterAll(() => lepasSemua());

  it("cap bening dipakai apa adanya; JPG dan PNG berlatar putih pekat dibersihkan menjadi PNG bening", async () => {
    expect(await capPerluDibersihkan(CAP_PNG_BENING)).toBe(false);
    expect(await capPerluDibersihkan(CAP_JPG_PEKAT)).toBe(true);
    expect(await capPerluDibersihkan(CAP_PNG_PEKAT)).toBe(true);
    const apaAdanya = await pastikanCapBening(CAP_PNG_BENING);
    expect(apaAdanya).toMatchObject({ diolah: false, jenis: "png" });
    expect(apaAdanya.isi.equals(CAP_PNG_BENING)).toBe(true);
    for (const pekat of [CAP_JPG_PEKAT, CAP_PNG_PEKAT]) {
      const h = await pastikanCapBening(pekat);
      expect(h).toMatchObject({ diolah: true, jenis: "png" });
      expect(await capPerluDibersihkan(h.isi)).toBe(false); // sudah bening: pinggirannya alfa 0
    }
    // Bukan gambar = dipakai apa adanya (tanpa galat).
    expect((await pastikanCapBening(Buffer.from("bukan gambar"))).diolah).toBe(false);
  });

  it("pilihCap: PMH memakai cap Ketua; tanpa cap Ketua/umum jatuh ke cap aktif lain (cap kantor sama); cap nonaktif tidak; JPG pekat keluar PNG bening", async () => {
    const db = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      const aktor = { id: "usr-admin", nama: "Admin" };
      expect(await pilihCap(db, "pmh", null)).toBeNull();

      // Hanya cap Panitera (JPG berlatar pekat) - dulu PMH tanpa cap sama sekali.
      const t = await tambahCap(db, { nama: "Cap Panitera", peruntukan: "panitera", isi: new Uint8Array(CAP_JPG_PEKAT) }, aktor);
      expect(t.ok).toBe(true);
      const pmh = await pilihCap(db, "pmh", null);
      expect(pmh).not.toBeNull();
      expect(pmh!.nama).toBe("Cap Panitera");
      expect(pmh!.jenisBerkas).toBe("png");
      expect(await capPerluDibersihkan(pmh!.isi)).toBe(false);

      // Cap Ketua khusus didahulukan atas cap lain.
      await tambahCap(db, { nama: "Cap Ketua", peruntukan: "ketua", isi: new Uint8Array(CAP_PNG_BENING) }, aktor);
      expect((await pilihCap(db, "pmh", null))!.nama).toBe("Cap Ketua");
      expect((await pilihCap(db, "ppp", null))!.nama).toBe("Cap Panitera");

      // Cap yang dimatikan tidak pernah dipakai.
      await db.prepare("UPDATE aleta_ecourt_cap SET aktif = 0").run();
      expect(await pilihCap(db, "pmh", null)).toBeNull();
    } finally {
      await db.close();
    }
  });
});

describe("28 Okt: koreksi jangkar logo kotak TTD elektronik (PPP/PJS 694/2026 keluar kotak di PDF)", () => {
  it("jarak baris paragraf jangkar (\\sl) dibaca dari \\pard terakhir sebelum bentuk; tanpa \\sl = 0; nilai tak wajar = 0", () => {
    const e = modulEdoc() as any;
    const rtf = (sl: string) => String.raw`{\rtf1 \pard \plain ` + sl + String.raw` \intbl {\fs24 x}{\shp {\*\shpinst \shpleft0\shptop0\shpright10\shpbottom10}}}`;
    const di = (s: string) => s.indexOf(String.raw`{\shp`);
    expect(e.koreksiJangkarTwip(rtf(String.raw`\sl360 \slmult1`), di(rtf(String.raw`\sl360 \slmult1`)))).toBe(360);
    expect(e.koreksiJangkarTwip(rtf(String.raw`\sl-300`), di(rtf(String.raw`\sl-300`)))).toBe(300);
    expect(e.koreksiJangkarTwip(rtf(""), di(rtf("")))).toBe(0);
    expect(e.koreksiJangkarTwip(rtf(String.raw`\sl5000`), di(rtf(String.raw`\sl5000`)))).toBe(0);
  });
});
