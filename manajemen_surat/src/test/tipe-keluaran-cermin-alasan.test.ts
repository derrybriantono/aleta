// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CERMIN_ALASAN } from "@/lib/tipe-keluaran/bawaan/bawaan-alasan";
import type { EntriCermin, KunciDaftar } from "@/lib/tipe-keluaran/kontrak";
import { validasiEntri } from "@/lib/tipe-keluaran/validasi";

/**
 * ============================================================================
 * CERMIN_ALASAN = KONSTANTA BOT, DAN BOT YANG MENERIMA CERMIN TIDAK BERUBAH
 * ============================================================================
 *
 * Tiga daftar (K2 nomor 8, 9, 10) dipakai bot: putusan.alasan.ciri,
 * bersama.alasan.frasa, dan putusan.upaya-damai.bunyi. Berkas ini
 * me-require modul bot SUNGGUHAN dan menjaga tiga hal:
 *
 *   1. cermin portal sama persis dengan cerminAlasan() bot;
 *   2. tiap entri cermin lolos penyaring portal (validasiEntri) DAN
 *      penyaring bot (bacaDaftarTipe) - benih yang ditolak salah satunya
 *      akan hilang tanpa suara;
 *   3. dariKeteranganSaksi dengan opsi.tipeKeluaran = cermin menghasilkan
 *      keluaran yang deep-equal dengan tanpa opsi - atas contoh yang
 *      menyentuh ketiga daftar.
 *
 * Ditambah bukti bahwa opsinya SUNGGUH dipakai (daftar yang berbeda mengubah
 * keluaran), dan entri yang ditolak penyaring disebut, bukan ditelan.
 */

type Entri = { kunci: string; nilai: string; data?: Record<string, unknown>; urutan: number };
type TipeKeluaran = { versi?: string; daftar: Record<string, unknown> };
type Opsi = { tipeKeluaran?: TipeKeluaran };
type Pihak = { pelaku?: string; lawan?: string };
type Hasil = {
  usulan: { kode: string; nilai: string; keyakinan: string; catatan: string }[];
  tipeKeluaranDitolak?: { daftar: string; kunci: string; alasan: string }[];
} & Record<string, unknown>;
type Layanan = {
  cerminAlasan: () => Record<string, Entri[]>;
  dariKeteranganSaksi: (a: string, b: string, sidang: string, pihak: Pihak, posita: string, opsi?: Opsi) => Hasil;
};
type Pustaka = {
  bacaDaftarTipe: (opsi: Opsi, daftar: string) => { ada: boolean; entri: unknown[]; ditolak: { alasan: string }[] };
};

const require_ = createRequire(import.meta.url);
const bot = (nama: string) => path.resolve(process.cwd(), "../aleta_bot/services", nama);
const layanan = require_(bot("abtUsulanService.js")) as Layanan;
const pustaka = require_(bot("abtKalimatBaku.js")) as Pustaka;

const DAFTAR = ["putusan.alasan.ciri", "bersama.alasan.frasa", "putusan.upaya-damai.bunyi"] as const;
const cermin = CERMIN_ALASAN as Partial<Record<KunciDaftar, EntriCermin[]>>;
const tipeDariCermin = (): TipeKeluaran => ({
  versi: "uji",
  daftar: Object.fromEntries(DAFTAR.map((d) => [d, (cermin[d] ?? []).map((e) => ({ ...e, asal: "bawaan" }))])),
});

const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b};`).join("\n");
const GUGAT: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const TALAK: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };

/** Contoh yang menyentuh ciri, frasa (termasuk akibat), tanpa-frasa, dan ketiga keadaan upaya damai. */
const CONTOH: { judul: string; s1: string; s2: string; pihak: Pihak; posita: string }[] = [
  {
    judul: "nafkah + cemburu + perselisihan, gagal didamaikan",
    s1: bas(
      "antara Penggugat dan Tergugat sering terjadi perselisihan sejak bulan Maret 2021",
      "penyebabnya Tergugat tidak memberi nafkah dan sering cemburu",
      "sudah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil"
    ),
    s2: bas(
      "Penggugat dan Tergugat sering bertengkar sejak bulan Maret 2021",
      "Tergugat tidak memberi nafkah dan cemburu buta",
      "keluarga sudah menasihati keduanya namun tidak berhasil"
    ),
    pihak: GUGAT,
    posita: "Bahwa Tergugat tidak memberi nafkah dan cemburu;",
  },
  {
    judul: "talak: shabu + temperamental + judi sepihak, belum ada upaya",
    s1: bas("Termohon sering mengonsumsi shabu dan bersikap temperamental", "belum pernah ada upaya untuk merukunkan Pemohon dan Termohon"),
    s2: bas("Termohon memakai obat-obatan terlarang, tempramen, dan suka judi", "tidak tahu apakah ada upaya damai"),
    pihak: TALAK,
    posita: "",
  },
  {
    judul: "zina tanpa frasa, berhasil dirukunkan",
    s1: bas("Tergugat berzina dengan perempuan lain", "Penggugat dan Tergugat pernah berhasil dirukunkan oleh keluarga"),
    s2: bas("Tergugat telah berzina", "keluarga berhasil dirukunkan keduanya"),
    pihak: GUGAT,
    posita: "",
  },
];

describe("CERMIN_ALASAN = cerminAlasan() bot", () => {
  it("sama persis", () => {
    expect(CERMIN_ALASAN).toEqual(layanan.cerminAlasan());
  });

  it("memuat ketiga daftar, tidak ada daftar lain", () => {
    expect(Object.keys(CERMIN_ALASAN).sort()).toEqual([...DAFTAR].sort());
    for (const d of DAFTAR) expect((cermin[d] ?? []).length).toBeGreaterThan(0);
  });

  it.each(DAFTAR)("tiap entri %s lolos penyaring portal", (daftar) => {
    for (const e of cermin[daftar] ?? []) {
      const hasil = validasiEntri(daftar, { kunci: e.kunci, nilai: e.nilai, data: e.data ?? {} });
      expect(hasil, `${daftar} ${e.kunci}: ${e.nilai}`).toMatchObject({ ok: true });
    }
  });

  it.each(DAFTAR)("tiap entri %s lolos penyaring bot, tidak satu pun ditolak", (daftar) => {
    const baca = pustaka.bacaDaftarTipe({ tipeKeluaran: tipeDariCermin() }, daftar);
    expect(baca.ada).toBe(true);
    expect(baca.ditolak).toEqual([]);
    expect(baca.entri).toHaveLength((cermin[daftar] ?? []).length);
  });
});

describe("tanpa opsi.tipeKeluaran vs tipeKeluaran = cermin: keluaran sama persis", () => {
  it.each(CONTOH)("$judul", ({ s1, s2, pihak, posita }) => {
    const tanpa = layanan.dariKeteranganSaksi(s1, s2, "22 September 2026", pihak, posita);
    const dengan = layanan.dariKeteranganSaksi(s1, s2, "22 September 2026", pihak, posita, {
      tipeKeluaran: tipeDariCermin(),
    });
    expect(dengan).toEqual(tanpa);
    expect(dengan.tipeKeluaranDitolak).toBeUndefined();
  });
});

describe("opsi.tipeKeluaran sungguh dipakai, dan yang ditolak disebut", () => {
  const [contoh] = CONTOH;
  const jalankan = (daftar: Record<string, unknown>) =>
    layanan.dariKeteranganSaksi(contoh.s1, contoh.s2, "", contoh.pihak, contoh.posita, {
      tipeKeluaran: { versi: "uji", daftar },
    });
  const nilai = (h: Hasil, kode: string) => h.usulan.find((u) => u.kode === kode);

  it("frasa dari portal mengganti frasa tertanam", () => {
    const frasa = (cermin["bersama.alasan.frasa"] ?? []).map((e) =>
      e.kunci === "cemburu" ? { ...e, nilai: "bersikap cemburu yang tidak beralasan" } : e
    );
    expect(nilai(jalankan({ "bersama.alasan.frasa": frasa }), "5227")?.nilai).toContain(
      "bersikap cemburu yang tidak beralasan"
    );
  });

  it("bunyi upaya damai dari portal dipakai; daftar yang dimatikan seluruhnya disebut, bukan diganti bunyi lain", () => {
    const gagal = [{ kunci: "gagal", nilai: "keluarga sudah mendamaikan {lawan} dan {pelaku} tetapi gagal", urutan: 0 }];
    expect(nilai(jalankan({ "putusan.upaya-damai.bunyi": gagal }), "1268")?.nilai).toBe(
      "keluarga sudah mendamaikan Penggugat dan Tergugat tetapi gagal"
    );
    const mati = nilai(jalankan({ "putusan.upaya-damai.bunyi": [] }), "1268");
    expect(mati?.nilai).toBe("");
    expect(mati?.catatan).toContain("tidak tersedia");
  });

  it("ciri dari portal dipakai - daftar tanpa baris cemburu tidak lagi mengenal cemburu", () => {
    const ciri = (cermin["putusan.alasan.ciri"] ?? []).filter((e) => e.kunci !== "cemburu");
    const h = jalankan({ "putusan.alasan.ciri": ciri });
    expect(h.ciri).not.toContain("cemburu");
    expect(nilai(h, "5227")?.nilai).not.toContain("cemburu");
  });

  it("entri berbahaya ditolak DAN disebut; entri sah tetap dipakai", () => {
    const frasa = [
      ...(cermin["bersama.alasan.frasa"] ?? []),
      { kunci: "judi", nilai: "$" + "{process.exit()}", data: { urutan: 51 }, urutan: 90 },
      { kunci: "mabuk", nilai: "menjadi <b>pemabuk</b>", data: { urutan: 50 }, urutan: 91 },
      { kunci: "zina", nilai: "berzina dengan {nama}", data: { urutan: 70 }, urutan: 92 },
      { kunci: "cemburu", nilai: "bersikap cemburu", data: { urutan: 20 }, urutan: 93 },
    ];
    const h = jalankan({ "bersama.alasan.frasa": frasa });
    expect(h.tipeKeluaranDitolak).toEqual([
      { daftar: "bersama.alasan.frasa", kunci: "judi", alasan: "nilai_memuat_" + "$" + "{" },
      { daftar: "bersama.alasan.frasa", kunci: "mabuk", alasan: "nilai_memuat_<" },
      { daftar: "bersama.alasan.frasa", kunci: "zina", alasan: "nilai_penanda_tidak_sah:{nama}" },
      { daftar: "bersama.alasan.frasa", kunci: "cemburu", alasan: "kunci_ganda" },
    ]);
    // Yang sah tetap dipakai, dan frasa cemburu yang pertama tidak tertimpa.
    expect(nilai(h, "5227")?.nilai).toContain("melalaikan kewajiban nafkah lahir");
    expect(nilai(h, "5227")?.nilai).toContain("bersikap cemburu berlebihan");
  });
});
