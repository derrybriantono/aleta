// @vitest-environment node
/**
 * ============================================================================
 * HASIL MEDIASI - TEMUAN UJI NYATA U5 (9 Okt 2026)
 * ============================================================================
 *
 * Diukur atas sepuluh perkara bermediasi di sipp_donggala lokal (cerai talak,
 * cerai gugat, harta bersama, kewarisan, wasiat, izin poligami; berkuasa dan
 * tidak; dua mediator; mediator non-hakim), naskahnya dibuka di Word 16:
 *
 *   1. Kuasa SIPP tidak pernah terbaca - isian kuasa selalu kosong, sehingga
 *      persetujuan tertulis pihak berkuasa (PERMA 1/2016 Pasal 27 ayat (3))
 *      tidak tersusun pada 132 perkara bermediasi yang berkuasa.
 *   2. Para pihak diurut ABJAD, bukan urutan SIPP: pada 490/Pdt.G/2026 yang
 *      tertulis "Tergugat I" adalah Tergugat II menurut SIPP.
 *   3. "Perwalian" tergolong perceraian (pola li'an tanpa batas kata).
 *   4. Tanda kosong SIPP tercetak ("pendidikan -").
 *   5. Cerai talak (permohonan) menulis "pokok gugatan".
 *
 * Nama orang di sini karangan.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bacaRtfDariBita } from "@/lib/baca-rtf";
import {
  drafAwal,
  hasilDariSipp,
  keteranganIdentitas,
  kelompokPerkara,
  namaKuasa,
  paduDraf,
  romawi,
  susunNaskah,
  susunPasal,
  type BahanHasilMediasi,
  type DrafHasilMediasi,
} from "@/lib/hasil-mediasi";
import { naskahKeRtf, rtfKeBita } from "@/lib/hasil-mediasi-rtf";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));

function bahan(lain: Partial<BahanHasilMediasi> = {}): BahanHasilMediasi {
  return {
    nomorPerkara: "506/Pdt.G/2026/PA.Dgl",
    perkaraId: "10025",
    mediasiId: "900",
    jenisPerkara: "Harta Bersama",
    alurPerkaraId: 15,
    jenisPerkaraId: 348,
    mediator: "Contoh Mediator, S.H.I., M.H.",
    penetapanMediator: "2026-08-26",
    pertemuan: [{ tanggal: "2026-09-02", jam: "09:00", tempat: "Ruang Mediasi" }],
    pihak: [
      { pihakKe: 1, nama: "Ani Contoh", kelamin: "Perempuan", pendidikan: "-", agama: "Islam", alamat: "Desa A" },
      { pihakKe: 2, nama: "Budi Contoh", kelamin: "Laki-laki", pendidikan: "Strata I", alamat: "Desa B" },
    ],
    kuasa: [
      { nama: "Kuasa Satu, S.H.", pihakKe: 1 },
      { nama: "Kuasa Dua, S.H.", pihakKe: 1 },
      { nama: "Kuasa Tiga, S.H.", pihakKe: 2 },
    ],
    anak: [],
    majelis: [],
    namaPengadilan: "Pengadilan Agama Donggala Kelas II",
    ...lain,
  };
}

function sebagian(draf: DrafHasilMediasi): DrafHasilMediasi {
  return {
    ...draf,
    hasil: "berhasil-sebagian",
    butir: {
      ...draf.butir,
      "harta-bersama": { ...draf.butir["harta-bersama"], aktif: true, objek: "Sebidang tanah" },
      "tidak-disepakati": { ...draf.butir["tidak-disepakati"], aktif: true, teks: "tuntutan lain" },
    },
  };
}

describe("kuasa dari SIPP", () => {
  it("drafAwal mengisi kuasa tiap sisi, dan naskah memuat persetujuan Pasal 27 ayat (3) bagi keduanya", () => {
    const b = bahan();
    const draf = sebagian(drafAwal(b, "2026-10-09"));
    expect(draf.dokumen.kuasaSatu).toBe("Kuasa Satu, S.H. dan Kuasa Dua, S.H.");
    expect(draf.dokumen.kuasaDua).toBe("Kuasa Tiga, S.H.");
    const teks = bacaRtfDariBita(rtfKeBita(naskahKeRtf(susunNaskah(draf, b))));
    expect(teks).toContain("dalam hal ini diwakili oleh kuasanya, Kuasa Satu, S.H. dan Kuasa Dua, S.H.;");
    expect(teks.split("PERNYATAAN PARA PIHAK YANG DIWAKILI OLEH KUASA HUKUM").length - 1).toBe(2);
  });

  it("tanpa kuasa dari bot (bot lama / tidak terbaca) isiannya kosong seperti dulu", () => {
    const draf = drafAwal(bahan({ kuasa: undefined }), "2026-10-09");
    expect(draf.dokumen.kuasaSatu).toBe("");
    expect(draf.dokumen.kuasaDua).toBe("");
    expect(namaKuasa({ kuasa: [{ nama: " ", pihakKe: 1 }] }, 1)).toBe("");
  });
});

describe("golongan, identitas, kata permohonan", () => {
  it("Perwalian bukan perceraian; li'an tetap perceraian", () => {
    expect(kelompokPerkara({ jenisPerkara: "Perwalian" })).toBe("anak");
    expect(kelompokPerkara({ jenisPerkara: "Li'an" })).toBe("cerai");
    expect(kelompokPerkara({ jenisPerkara: "Cerai Gugat" })).toBe("cerai");
  });

  it("tanda kosong SIPP tidak tercetak sebagai isi", () => {
    const ket = keteranganIdentitas({ pihakKe: 1, nama: "Ani", pendidikan: "-", pekerjaan: ".", agama: "Islam", alamat: "Desa A" });
    expect(ket).toBe("agama Islam, bertempat tinggal di Desa A");
  });

  it("cerai talak berhasil sebagian menulis 'pokok permohonan', cerai gugat 'pokok gugatan'", () => {
    const talak = bahan({ jenisPerkara: "Cerai Talak", jenisPerkaraId: 346, kuasa: [] });
    const p = susunPasal(sebagian(drafAwal(talak, "2026-10-09")), talak).map((x) => x.isi.join(" ")).join("\n");
    expect(p).toContain("Tentang pokok permohonan yang tidak tertuang");
    expect(p).not.toContain("pokok gugatan");
    const gugat = bahan({ jenisPerkara: "Cerai Gugat", jenisPerkaraId: 347, kuasa: [] });
    const q = susunPasal(sebagian(drafAwal(gugat, "2026-10-09")), gugat).map((x) => x.isi.join(" ")).join("\n");
    expect(q).toContain("Tentang pokok gugatan yang tidak tertuang");
  });
});

describe("hasil yang sudah tercatat di SIPP dan mediator penandatangan", () => {
  it("sandi SIPP memilih hasil awal; kosong tetap berhasil sebagian dengan butir 'tidak disepakati' menyala", () => {
    const awal = (hasilSipp: string, lain: Partial<BahanHasilMediasi> = {}) => drafAwal(bahan({ hasilSipp, ...lain }), "2026-10-09");
    expect(awal("T").hasil).toBe("tidak-berhasil");
    expect(awal("D").hasil).toBe("tidak-dapat-dilaksanakan");
    expect(awal("S").hasil).toBe("berhasil-sebagian");
    expect(awal("Y1").hasil).toBe("berhasil-seluruhnya");
    expect(awal("Y1").penutup).toBe("akta");
    expect(awal("Y2").penutup).toBe("cabut");
    const kosong = awal("");
    expect(kosong.hasil).toBe("berhasil-sebagian");
    expect(kosong.butir["tidak-disepakati"].aktif).toBe(true);
    const cerai = awal("Y2", { jenisPerkara: "Cerai Gugat", jenisPerkaraId: 347 });
    expect(cerai.butir["rukun-kembali"].aktif).toBe(true);
    expect(hasilDariSipp("x")).toBeNull();
  });

  it("dua mediator (H,H): yang menandatangani adalah mediator akun yang menyusun", () => {
    const b = bahan({ mediator: "Contoh Satu, S.H.I.<br/>Contoh Dua, S.H.I.", mediatorAkun: "Contoh Dua, S.H.I." });
    expect(drafAwal(b, "2026-10-09").dokumen.mediator).toBe("Contoh Dua, S.H.I.");
    expect(drafAwal({ ...b, mediatorAkun: "" }, "2026-10-09").dokumen.mediator).toBe("Contoh Satu, S.H.I.; Contoh Dua, S.H.I.");
  });
});

describe("banyak pihak dan turut tergugat (273/Pdt.G/2026: 14 penggugat, 7 turut tergugat)", () => {
  it("penomoran romawi tidak berhenti di VI, dan turut tergugat tertulis di identitas serta tanda tangan", () => {
    expect(romawi(4)).toBe("IV");
    expect(romawi(14)).toBe("XIV");
    const penggugat = Array.from({ length: 8 }, (_, i) => ({ pihakKe: 1, nama: `Penggugat Contoh ${i + 1}` }));
    const b = bahan({
      jenisPerkara: "Kewarisan",
      jenisPerkaraId: 364,
      kuasa: [],
      pihak: [
        ...penggugat,
        { pihakKe: 2, nama: "Tergugat Contoh" },
        { pihakKe: 4, nama: "Turut Satu" },
        { pihakKe: 4, nama: "Turut Dua" },
        { pihakKe: 4, nama: "Turut Tiga" },
      ],
    });
    const draf = drafAwal(b, "2026-10-09");
    expect(draf.dokumen.pihakTurut.map((o) => o.nama)).toEqual(["Turut Satu", "Turut Dua", "Turut Tiga"]);
    const blok = susunNaskah({ ...draf, hasil: "tidak-berhasil" }, b);
    const teks = bacaRtfDariBita(rtfKeBita(naskahKeRtf(blok)));
    expect(teks).toContain("Penggugat Contoh 8, sebagai Penggugat VIII;");
    expect(teks).not.toMatch(/Penggugat [0-9]+[,;]/);
    expect(teks).toContain("Turut Satu, sebagai Turut Tergugat I;");
    expect(teks).toContain("Turut Tiga, sebagai Turut Tergugat III;");
    const ttd = blok.filter((x) => x.jenis === "ttd").map((x) => (x.jenis === "ttd" ? [...x.kiri, ...x.kanan].join("|") : ""));
    expect(ttd.some((x) => x.includes("Turut Tergugat II,") && x.includes("Turut Dua"))).toBe(true);
  });

  it("draf tersimpan versi lama (tanpa pihakTurut) tetap memakai turut tergugat dari SIPP", () => {
    const b = bahan({ kuasa: [], pihak: [{ pihakKe: 1, nama: "A" }, { pihakKe: 2, nama: "B" }, { pihakKe: 4, nama: "C" }] });
    const lama = drafAwal(b, "2026-10-09") as unknown as { dokumen: Record<string, unknown> };
    const dokumenLama = { ...lama.dokumen };
    delete dokumenLama.pihakTurut;
    const padu = paduDraf(drafAwal(b, "2026-10-09"), { ...lama, dokumen: dokumenLama });
    expect(padu.dokumen.pihakTurut.map((o) => o.nama)).toEqual(["C"]);
  });
});

describe("bot identitasPihakService: urutan SIPP dan kuasa", () => {
  function muatDenganTiruan(jawab: (sql: string) => unknown[] | Error) {
    const jalurDb = require_.resolve(path.join(AKAR, "aleta_bot/db_config"));
    const Module = require_("module");
    const jalurLayanan = path.join(AKAR, "aleta_bot/services/identitasPihakService.js");
    delete require_.cache[jalurLayanan];
    const sql: string[] = [];
    const tiruan = new Module(jalurDb, null);
    tiruan.filename = jalurDb;
    tiruan.loaded = true;
    tiruan.exports = {
      query: (q: string, _p: unknown[], cb: (e: unknown, r: unknown) => void) => {
        sql.push(q);
        const r = jawab(q);
        if (r instanceof Error) cb(r, null);
        else cb(null, r);
      },
    };
    require_.cache[jalurDb] = tiruan;
    const layanan = require_(jalurLayanan) as {
      identitasPihak: (n: string) => Promise<{ ok: boolean; pihak?: Array<{ nama: string }>; kuasa?: unknown }>;
    };
    return { layanan, sql };
  }

  it("pihak diurut menurut urutan SIPP, kuasa ikut dikirim", async () => {
    const { layanan, sql } = muatDenganTiruan((q) =>
      q.includes("perkara_pengacara")
        ? [{ nama: "Kuasa Satu, S.H.", pihakKe: 1 }]
        : [{ pihakKe: 2, pihakId: 9, nama: "Zaitun Contoh", kelamin: "P" }]
    );
    const hasil = await layanan.identitasPihak("490/Pdt.G/2026/PA.Dgl");
    expect(hasil.ok).toBe(true);
    expect(hasil.kuasa).toEqual([{ nama: "Kuasa Satu, S.H.", pihakKe: 1 }]);
    const utama = sql.find((q) => q.includes("FROM perkara_pihak1")) ?? "";
    expect(utama).toMatch(/perkara_pihak2/);
    expect(utama).toMatch(/AS pihak_ke, urutan FROM perkara_pihak2/);
    expect(utama).toMatch(/ORDER BY a\.pihak_ke, a\.urutan IS NULL, a\.urutan, b\.nama/);
  });

  it("kuasa yang gagal dibaca dikirim null (belum terbaca), identitas tetap terkirim", async () => {
    const { layanan } = muatDenganTiruan((q) =>
      q.includes("perkara_pengacara") ? new Error("tabel hilang") : [{ pihakKe: 1, pihakId: 1, nama: "Ani Contoh", kelamin: "P" }]
    );
    const hasil = await layanan.identitasPihak("1/Pdt.G/2026/PA.Dgl");
    expect(hasil.ok).toBe(true);
    expect(hasil.pihak?.map((p) => p.nama)).toEqual(["Ani Contoh"]);
    expect(hasil.kuasa).toBeNull();
  });
});
