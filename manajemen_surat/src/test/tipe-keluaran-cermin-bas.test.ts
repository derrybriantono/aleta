// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CABANG_JAWABAN_MODUS, CERMIN_BAS_SAKSI } from "@/lib/tipe-keluaran/bawaan/bawaan-bas-saksi";
import type { EntriCermin, KunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { validasiEntri } from "@/lib/tipe-keluaran/validasi";

/**
 * ============================================================================
 * CERMIN BAS SAKSI = ragamBasBawaan.js, DAN BOT YANG MENERIMA CERMIN TIDAK BERUBAH
 * ============================================================================
 *
 * Menggantikan tipe-keluaran-cermin-bas-awal.test.ts (potret bank SEBELUM
 * t2-ragam-bas-bot). Data ragam kini tinggal di aleta_bot/services/
 * ragamBasBawaan.js - berkas data murni tanpa require - dan berkas itulah
 * yang di-require di sini, bukan disalin. Yang dijaga:
 *
 *   1. CERMIN_BAS_SAKSI deep-equal dengan data bot, kelima daftarnya;
 *   2. tiap entri lolos validasiEntri portal DAN penyaring bot (bacaBankBas)
 *      tanpa satu pun ditolak;
 *   3. susunKeteranganSaksiSdg dengan tipeKeluaran = cermin menghasilkan
 *      berita acara yang SAMA PERSIS dengan tanpa tipeKeluaran;
 *   4. tiap kunci jawaban-modus DIJALANKAN lewat jawabMenurutModus bot dan
 *      menghasilkan bank cermin, urut demi urut;
 *   5. tipeKeluaran sungguh dipakai, dan entri rusak disebut, tidak ditelan.
 */

type Entri = { kunci: string; nilai: string; data?: Record<string, unknown>; urutan: number };
type Butir = { no: string; tanya: string; jawab: string; perluDiisi: boolean; pilihan?: string[]; varian: { indeks: number; n: number; habis: boolean } };
type Hasil = {
  ok: boolean;
  versiBank: string;
  asalBank: string;
  saksi1: { no: string; tanya: string; jawab: string }[];
  saksi2: { no: string; tanya: string; jawab: string }[];
  saksi: { ke: number; pihak: string; jawaban: Butir[] }[];
  tipeKeluaranDitolak?: { daftar: string; kunci: string; alasan: string }[];
} & Record<string, unknown>;
type Layanan = {
  susunKeteranganSaksiSdg: (opsi: Record<string, unknown>) => Hasil;
  bacaBankBas: (opsi: Record<string, unknown>) => { asal: string; ditolak: unknown[]; bentuk: Map<string, unknown[]>; pembuka: unknown[] };
  jawabMenurutModus: (a: Record<string, unknown>) => string | null;
};
type Data = {
  PEMBUKA: { nilai: string; bobot: number }[];
  RAGAM_KATA: { kata: string; ganti: string; abaikanBesarKecil?: boolean }[];
  JAWABAN_MODUS: Record<string, string[]>;
  BENTUK: { kunci: string; nilai: string; data: Record<string, unknown> }[];
  PROFIL: { kunci: string; data: Record<string, unknown> }[];
};

const require_ = createRequire(import.meta.url);
const bot = (nama: string) => path.resolve(process.cwd(), "../aleta_bot/services", nama);
const layanan = require_(bot("abtUsulanService.js")) as Layanan;
const data = require_(bot("ragamBasBawaan.js")) as Data;

const DAFTAR = [
  "bas.saksi.pembuka",
  "bas.saksi.ragam-kata",
  "bas.saksi.jawaban-modus",
  "bas.saksi.bentuk",
  "bas.saksi.profil",
] as const;
const cermin = CERMIN_BAS_SAKSI as Partial<Record<KunciDaftar, EntriCermin[]>>;

/** Cermin yang DIHARAPKAN, dibangun dari data bot dengan aturan bentuk K2. */
function cerminDariBot(): Record<string, Entri[]> {
  let u = 0;
  return {
    "bas.saksi.pembuka": data.PEMBUKA.map((p, urutan) => ({ kunci: "", nilai: p.nilai, data: { bobot: p.bobot }, urutan })),
    "bas.saksi.ragam-kata": data.RAGAM_KATA.map((r, urutan) => ({
      kunci: "",
      nilai: r.kata,
      data: r.abaikanBesarKecil ? { ganti: r.ganti, abaikanBesarKecil: true } : { ganti: r.ganti },
      urutan,
    })),
    "bas.saksi.jawaban-modus": Object.entries(data.JAWABAN_MODUS).flatMap(([kunci, isi]) =>
      isi.map((nilai) => ({ kunci, nilai, urutan: u++ }))
    ),
    "bas.saksi.bentuk": data.BENTUK.map((b, urutan) => ({ kunci: b.kunci, nilai: b.nilai, data: b.data, urutan })),
    "bas.saksi.profil": data.PROFIL.map((p, urutan) => ({ kunci: p.kunci, nilai: "", data: p.data, urutan })),
  };
}

const tipeDariCermin = () => ({
  versi: "uji-cermin",
  daftar: Object.fromEntries(DAFTAR.map((d) => [d, (cermin[d] ?? []).map((e) => ({ ...e, asal: "bawaan" }))])),
});

/** Templat berbentuk 04 (cerai gugat) - sebutan saja, tanpa nama. */
const TEMPLAT = [
  { no: "1", tanya: "Apakah saksi kenal dengan Penggugat dan Tergugat?", jawab: "Ya, saya kenal dengan Penggugat dan Tergugat karena saya adalah ibu kandung Penggugat / tetangga Penggugat;" },
  { no: "2", tanya: "Apakah saksi tahu hubungan Penggugat dan Tergugat?", jawab: "Antara Penggugat dan Tergugat adalah suami istri yang sah;" },
  { no: "3", tanya: "Dimana Penggugat dan Tergugat bertempat tinggal setelah menikah?", jawab: "Setelah menikah Penggugat dan Tergugat membina rumah tangga di rumah orang tua Penggugat;" },
  { no: "4", tanya: "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?", jawab: "Pada awalnya kehidupan rumah tangga Penggugat dan Tergugat rukun dan harmonis, namun sekarang ini rumah tangga mereka tidak harmonis lagi karena sering terjadi perselisihan dan pertengkaran yang terus menerus;" },
  { no: "5", tanya: "Apakah saksi tahu penyebab perselisihan dan pertengkaran Penggugat dan Tergugat?", jawab: "Ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu xxx;" },
  { no: "6", tanya: "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?", jawab: "Saya mengetahui karena saya pernah/sering melihat dan mendengar pertengkaran;" },
  { no: "7", tanya: "Apakah saat ini Penggugat dan Tergugat masih tinggal serumah?", jawab: "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Januari 2025;" },
  { no: "8", tanya: "Apakah Penggugat dan Tergugat masih sering berkomunikasi selama berpisah?", jawab: "Selama pisah Penggugat dan Tergugat tidak ada komunikasi lagi;" },
  { no: "9", tanya: "Apakah masih ada keterangan yang saksi akan sampaikan?", jawab: "Sudah cukup;" },
];
const opsiDasar = {
  templat: TEMPLAT,
  alasan: ["tidak memberi nafkah", "judi"],
  pelaku: "Tergugat",
  lawan: "Penggugat",
  nomorPerkara: "12/Pdt.G/2025/PA.Dgl",
  kodeKumpulan: "04",
};

describe("CERMIN_BAS_SAKSI = ragamBasBawaan.js bot", () => {
  it("sama persis, kelima daftar", () => {
    expect(cermin).toEqual(cerminDariBot());
    expect(Object.keys(cermin).sort()).toEqual([...DAFTAR].sort());
  });

  it("isinya sungguh ada: 4 pembuka manusia, 280 kalimat modus (butir 27 + butir 9 13 Okt), bentuk dan profil tidak kosong", () => {
    expect((cermin["bas.saksi.pembuka"] ?? []).map((e) => e.nilai)).toEqual(["Ya, ", "Setahu saya, ", "Sepengetahuan saya, ", "Yang saya ketahui, "]);
    expect(cermin["bas.saksi.jawaban-modus"]).toHaveLength(280);
    expect((cermin["bas.saksi.bentuk"] ?? []).length).toBeGreaterThanOrEqual(20);
    expect((cermin["bas.saksi.profil"] ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it.each(DAFTAR)("tiap entri %s lolos penyaring portal", (daftar) => {
    for (const e of cermin[daftar] ?? []) {
      const hasil = validasiEntri(daftar, { kunci: e.kunci, nilai: e.nilai, data: e.data ?? {} });
      expect(hasil, `${daftar} ${e.kunci}: ${e.nilai}`).toMatchObject({ ok: true });
    }
  });

  it("penyaring bot menerima seluruh cermin, tidak satu pun ditolak", () => {
    const bank = layanan.bacaBankBas({ tipeKeluaran: tipeDariCermin() });
    expect(bank.asal).toBe("portal");
    expect(bank.ditolak).toEqual([]);
  });
});

describe("tanpa tipeKeluaran vs tipeKeluaran = cermin: berita acara sama persis", () => {
  it.each([["sama"], ["sebagian"], ["tidak-tahu"], ["tidak-melihat"], ["dari-cerita"], ["tahu-pisah"]])("modus %s", (modus) => {
    const m = { modus, sumberNama: "Penggugat", alasan: ["judi"] };
    const tanpa = layanan.susunKeteranganSaksiSdg({ ...opsiDasar, modus: { saksi1: m, saksi2: m } });
    const dengan = layanan.susunKeteranganSaksiSdg({ ...opsiDasar, modus: { saksi1: m, saksi2: m }, tipeKeluaran: tipeDariCermin() });
    expect(dengan.asalBank).toBe("portal");
    expect(dengan.tipeKeluaranDitolak).toBeUndefined();
    const buang = ({ versiBank: _v, asalBank: _a, ...sisa }: Hasil) => sisa;
    expect(buang(dengan)).toEqual(buang(tanpa));
  });
});

describe("bas.saksi.jawaban-modus = bank yang DIJALANKAN jawabMenurutModus", () => {
  const TANYA: Record<string, string> = {
    "cara-tahu": "Bagaimana saksi bisa mengetahui penyebab perselisihan dan pertengkaran tersebut?",
    penyebab: "Apa penyebab perselisihan dan pertengkaran tersebut?",
    menyaksikan: "Apakah saudara pernah melihat atau mendengar mereka bertengkar?",
    rukun: "Apakah saudara sanggup merukunkan mereka kembali?",
    // Butir 27 - kapan mulai/puncak perselisihan dan keadaan rumah tangga.
    waktu: "Kapan mulai terjadi perselisihan dan pertengkaran antara Penggugat dan Tergugat?",
    kehidupan: "Bagaimana kehidupan rumah tangga Penggugat dan Tergugat?",
  };
  const ISI = { sumber: "PENCERITA-UJI", daftar: "Tergugat bermain judi", jawab: "perselisihan terjadi sejak tahun 2020" };
  const isiPenanda = (s: string) =>
    s.replaceAll("{sumber}", ISI.sumber).replaceAll("{daftar}", ISI.daftar).replaceAll("{isi}", ISI.daftar).replaceAll("{jawab}", ISI.jawab);
  const modusCermin = cermin["bas.saksi.jawaban-modus"] ?? [];

  it("tiap kunci: setiap modus yang dilayaninya menghasilkan bank cermin, urut demi urut", () => {
    for (const [kunci, cabang] of Object.entries(CABANG_JAWABAN_MODUS)) {
      const harapan = modusCermin.filter((e) => e.kunci === kunci).map((e) => isiPenanda(e.nilai));
      expect(harapan.length, kunci).toBeGreaterThan(0);
      for (const modus of cabang.modus) {
        const keluar = harapan.map((_, urutan) =>
          layanan.jawabMenurutModus({
            tanya: TANYA[cabang.kelompok],
            modus,
            alasan: [],
            daftar: ISI.daftar,
            sumber: ISI.sumber,
            jawab: `${ISI.jawab};`,
            nomorSaksi: 1,
            urutan,
          })
        );
        expect(keluar, `${kunci} / ${modus}`).toEqual(harapan);
      }
    }
  });

  it("tidak ada cabang tanpa kunci cermin, dan pertanyaan bukan perselisihan tidak dijawab modus", () => {
    const berkunci = new Set(Object.values(CABANG_JAWABAN_MODUS).flatMap((c) => c.modus.map((m) => `${c.kelompok}|${m}`)));
    for (const kelompok of Object.keys(TANYA)) {
      for (const modus of ["sama", "sebagian", "tidak-tahu", "tidak-melihat", "dari-cerita", "tahu-pisah"]) {
        const jawab = layanan.jawabMenurutModus({ tanya: TANYA[kelompok], modus, alasan: [], daftar: "x", sumber: "y", nomorSaksi: 1, urutan: 0 });
        expect(jawab !== null, `${kelompok}|${modus}`).toBe(berkunci.has(`${kelompok}|${modus}`));
      }
    }
    // "alasan berpoligami", "sebab ia meninggal", "keberatan atas pernikahan":
    // kata pemicunya sama, tetapi bukan pertanyaan perselisihan.
    for (const tanya of [
      "Apakah saudara mengetahui alasan Pemohon mau berpoligami?",
      "Dimana suami Pemohon meninggal dunia dan apa sebab ia meninggal?",
      "Pernahkah Saudara mendengar ada pihak lain yang keberatan atas pernikahan Pemohon?",
    ]) {
      for (const modus of ["sama", "tidak-melihat", "dari-cerita"]) {
        expect(layanan.jawabMenurutModus({ tanya, modus, alasan: ["judi"], sumber: "y", nomorSaksi: 1, urutan: 0 }), tanya).toBeNull();
      }
    }
  });
});

describe("tipeKeluaran sungguh dipakai, dan yang rusak disebut", () => {
  it("pembuka dimatikan semua -> tidak satu jawaban pun berpembuka", () => {
    const tipe = tipeDariCermin();
    tipe.daftar["bas.saksi.pembuka"] = [];
    for (let i = 0; i < 40; i++) {
      const h = layanan.susunKeteranganSaksiSdg({ ...opsiDasar, nomorPerkara: `${i}/Pdt.G/2025/PA.Dgl`, tipeKeluaran: tipe });
      for (const s of h.saksi) for (const b of s.jawaban) expect(b.jawab).not.toMatch(/^(Ya|Setahu saya|Sepengetahuan saya|Yang saya ketahui), /);
    }
  });

  it("entri rusak ditolak beserta sebabnya; yang sah tetap dipakai", () => {
    const tipe = tipeDariCermin();
    tipe.daftar["bas.saksi.pembuka"] = [
      { kunci: "", nilai: "Iya, ", data: { bobot: 50 }, urutan: 1, asal: "tambahan" },
      { kunci: "", nilai: "Hanya, ", data: { bobot: 50 }, urutan: 2, asal: "tambahan" },
      { kunci: "", nilai: "Ya, ", data: { bobot: 100 }, urutan: 3, asal: "tambahan" },
    ];
    tipe.daftar["bas.saksi.bentuk"] = [
      ...tipe.daftar["bas.saksi.bentuk"],
      { kunci: "kenal hubungan", nilai: "saya kenal #1234# karena saya adalah {slot}", urutan: 99, asal: "tambahan" },
      { kunci: "kenal hubungan", nilai: "saya kenal ${x}", urutan: 100, asal: "tambahan" },
    ];
    const h = layanan.susunKeteranganSaksiSdg({ ...opsiDasar, tipeKeluaran: tipe });
    const alasan = (h.tipeKeluaranDitolak ?? []).map((d) => `${d.daftar}|${d.alasan}`);
    expect(alasan).toContain("bas.saksi.pembuka|pembuka_dirusak_replace_ket_saksi");
    expect(alasan.filter((a) => a === "bas.saksi.pembuka|pembuka_dirusak_replace_ket_saksi")).toHaveLength(2);
    expect(alasan).toContain("bas.saksi.bentuk|penanda_tidak_sah:#1234#");
    expect(alasan.some((a) => a.startsWith("bas.saksi.bentuk|nilai_memuat_"))).toBe(true);
    // Bobot 100 untuk 'Ya, ' - setiap jawaban yang boleh berpembuka memakainya.
    const berpembuka = h.saksi.flatMap((s) => s.jawaban).filter((b) => b.jawab.startsWith("Ya, "));
    expect(berpembuka.length).toBeGreaterThan(0);
    expect(h.saksi.flatMap((s) => s.jawaban).some((b) => /^Iya|^Hanya/.test(b.jawab))).toBe(false);
  });
});
