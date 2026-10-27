// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

import { basisKunciTiruan } from "./kunci-basis-tiruan";

/**
 * ============================================================================
 * KUNCI PUTUSAN OTOMATIS (26 Okt 2026, perkara 615/Pdt.G/2026/PA.Dgl, terpasang 1.205.39)
 * ============================================================================
 *
 * Laporan: Putusan Otomatis menyimpan Putusan Akhir tetapi e-Doc putusan dan e-Doc anonimisasi tidak
 * terunggah; mengulang e-Doc saja ditolak "Perkara ini sedang dikerjakan oleh SUPER ADMIN DERRY
 * (putusan-otomatis)" - kunci milik pemiliknya sendiri yang tidak pernah dilepas.
 *
 * Bukti produksi (SELECT saja): aleta_bot_kunci_penetapan memuat baris perkara 10170, pemilik SUPER ADMIN
 * DERRY, tujuan putusan-otomatis, diambil 03:40:44 UTC, sampai 03:43:44 UTC (180 detik, tidak pernah
 * diperpanjang) - baris itu hanya tertinggal bila jalannya mati sebelum melepas. Baris serupa 21 Okt.
 *
 * Yang dijaga di sini dengan MENJALANKAN kode sungguhan: layanan kunci bot (basis data tiruan), modul
 * penetapan-kerja.js dan putusan-edoc-sekaligus.js di jsdom, dihubungkan lewat "rute portal" tiruan yang
 * meneruskan ke layanan bot yang sama.
 */

const AKAR = process.env.ALETA_AKAR_UJI ? path.resolve(process.env.ALETA_AKAR_UJI) : path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const muatKunci = (db: unknown) => (require_(path.join(AKAR, "aleta_bot/services/penetapanKunciService.js")) as any).buatLayanan({ db });

const KERJA = baca("ekstensi-sipp/penetapan-kerja.js");
const EDOC = baca("ekstensi-sipp/putusan-edoc-sekaligus.js");

const NOMOR = "615/Pdt.G/2026/PA.Dgl";
const PERKARA = 10170;
const DERRY = "SUPER ADMIN DERRY";
const TUJUAN = "putusan-otomatis";
const polos = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const sela = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// 1. Layanan kunci di bot
// ============================================================================
describe("kunci bot: pemilik yang sama tidak terhalang oleh pekerjaannya yang sudah mati", () => {
  const siap = (opsi?: { kolomDetak?: boolean }) => {
    const t = basisKunciTiruan(opsi);
    return { t, k: muatKunci(t.db) };
  };

  it("kunci sunyi >= 75 detik milik pemilik yang sama (jenis sama) diambil alih bila peramban meminta, dengan keterangan pekerjaan lama", async () => {
    const { t, k } = siap();
    const lama = await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 });
    t.jam.sekarang += 80;
    const baru = await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120, ambilAlih: true });
    expect(baru.ok).toBe(true);
    expect(baru.token).not.toBe(lama.token);
    expect(baru.diambilAlih).toMatchObject({ oleh: DERRY, tujuan: TUJUAN });
    expect(baru.diambilAlih.sejak).toBe("2026-10-26 03:40:44");
    // token lama tidak berlaku lagi: pekerjaan lama yang tiba-tiba hidup tidak dapat melepas/menulis atas nama kunci baru
    expect((await k.lepas({ perkaraId: PERKARA, token: lama.token })).dilepas).toBe(false);
    expect((await k.lepas({ perkaraId: PERKARA, token: baru.token })).dilepas).toBe(true);
  });

  it("tanpa permintaan ambil alih (pekerjaan server) kunci basi tidak diambil alih", async () => {
    const { t, k } = siap();
    await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 });
    t.jam.sekarang += 80;
    expect(await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 })).toMatchObject({ ok: false, alasan: "sedang_dikerjakan" });
  });

  it("kunci yang masih berdetak TIDAK diambil alih: ditolak, ditandai milik sendiri, dengan hitungan tunggu", async () => {
    const { t, k } = siap();
    const a = await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 });
    for (let i = 0; i < 4; i += 1) {
      t.jam.sekarang += 25;
      expect((await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120, tokenLama: a.token })).diperpanjang).toBe(true);
    }
    t.jam.sekarang += 30; // pemegang masih "hidup": terakhir berdetak 30 detik lalu
    const dua = await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120, ambilAlih: true });
    expect(dua).toMatchObject({ ok: false, alasan: "sedang_dikerjakan", milikSendiri: true });
    expect(dua.tungguDetik).toBeGreaterThan(0);
    expect(dua.tungguDetik).toBeLessThanOrEqual(45);
  });

  it("pengguna LAIN tetap ditolak walau kunci sudah sunyi; bebas sesudah kedaluwarsa", async () => {
    const { t, k } = siap();
    await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 });
    t.jam.sekarang += 100;
    const lain = await k.ambil({ perkaraId: PERKARA, pemilik: "Panitera Uji", tujuan: TUJUAN, ttlDetik: 120, ambilAlih: true });
    expect(lain).toMatchObject({ ok: false, alasan: "sedang_dikerjakan", oleh: DERRY, milikSendiri: false });
    expect(lain.tungguDetik).toBeGreaterThan(0);
    t.jam.sekarang += 30;
    expect((await k.ambil({ perkaraId: PERKARA, pemilik: "Panitera Uji", tujuan: TUJUAN, ttlDetik: 120 })).ok).toBe(true);
  });

  it("jenis pekerjaan lain (penetapan) milik pemilik yang sama tidak diambil alih oleh Putusan Otomatis", async () => {
    const { t, k } = siap();
    await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: "kerjakan-penetapan", ttlDetik: 120 });
    t.jam.sekarang += 100;
    expect((await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120, ambilAlih: true })).ok).toBe(false);
  });

  it("dua peminta ambil alih bersamaan: tepat satu menang", async () => {
    const { t, k } = siap();
    await k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120 });
    t.jam.sekarang += 90;
    const hasil = await Promise.all([1, 2, 3].map(() => k.ambil({ perkaraId: PERKARA, pemilik: DERRY, tujuan: TUJUAN, ttlDetik: 120, ambilAlih: true })));
    expect(hasil.filter((x: any) => x.ok)).toHaveLength(1);
  });

  it("tabel lama tanpa kolom detak: kolom ditambahkan sekali, kunci tetap jalan", async () => {
    const { t, k } = siap({ kolomDetak: false });
    expect((await k.ambil({ perkaraId: 1, pemilik: "A" })).ok).toBe(true);
    expect((await k.ambil({ perkaraId: 2, pemilik: "A" })).ok).toBe(true);
    expect(t.sql.filter((s) => /^ALTER TABLE/i.test(s))).toHaveLength(1);
  });

  it("keadaan untuk layar (lihat) tetap tidak membocorkan token dan tidak berubah bentuk", async () => {
    const { k } = siap();
    await k.ambil({ perkaraId: 21, pemilik: "A" });
    expect(Object.keys(await k.lihat(21)).sort()).toEqual(["aktif", "oleh", "sampai", "tujuan"]);
  });
});

// ============================================================================
// 2. Rantai: ekstensi (jsdom) -> rute portal tiruan -> layanan bot
// ============================================================================
type Dunia = ReturnType<typeof buatDunia>;

function buatDunia() {
  const t = basisKunciTiruan();
  const k = muatKunci(t.db);
  const sipp = {
    adaBaris: false,
    adaPutusan: false,
    adaAnonim: false,
    unggahan: [] as Array<{ putusan: string | null; anonimisasi: string | null }>,
  };
  const simpanan: Record<string, unknown> = {};
  return { t, k, sipp, simpanan, galatLepas: 0, lepasDipanggil: 0 };
}

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

/** Satu halaman SIPP di peramban pengguna `operator`; modul sungguhan, jaringan ke portal ditiru. */
function bukaHalaman(d: Dunia, operator: string, o: { tampilkanPerkara?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "http://192.168.10.10/SIPP/detil_perkara_agama", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  w.chrome = {
    storage: {
      local: {
        get: async (kunci: string | string[]) => {
          const hasil: Record<string, unknown> = {};
          for (const n of [kunci].flat()) if (n in d.simpanan) hasil[n] = polos(d.simpanan[n]);
          return hasil;
        },
        set: async (isi: Record<string, unknown>) => void Object.assign(d.simpanan, polos(isi)),
      },
    },
  };
  // Detak digerakkan tangan: tidak menunggu 25 detik sungguhan.
  const pewaktu = new Map<number, () => Promise<void> | void>();
  let urutan = 0;
  w.setInterval = (fn: () => Promise<void> | void) => {
    urutan += 1;
    pewaktu.set(urutan, fn);
    return urutan;
  };
  w.clearInterval = (id: number) => void pewaktu.delete(id);
  // Jeda "menunggu N detik" tidak ditunggu sungguhan: jam kunci dimajukan sebesar jeda itu.
  const asliSetTimeout = setTimeout;
  w.setTimeout = (fn: () => void, ms: number) => {
    d.t.jam.sekarang += (Number(ms) || 0) / 1000;
    return asliSetTimeout(fn, 0);
  };
  const detak = async () => {
    for (const fn of Array.from(pewaktu.values())) await fn();
  };

  const jawab = (isi: unknown, status = 200) => {
    const r: any = { ok: status < 300, status, json: async () => polos(isi), clone: () => r };
    return r;
  };
  const kiriman: string[] = [];
  w.alatAmbil = async (url: string, opsi?: { method?: string; body?: string }) => {
    const u = String(url);
    if (u.endsWith("/aleta-bot/penunjukan/kunci")) {
      const b = JSON.parse(String(opsi?.body || "{}"));
      kiriman.push(`${b.aksi}:${b.tujuan}`);
      // Meniru app/api/aleta-bot/penunjukan/kunci/route.ts: operator dari sesi, bukan dari badan.
      if (b.aksi === "lepas") {
        d.lepasDipanggil += 1;
        if (d.galatLepas > 0) {
          d.galatLepas -= 1;
          throw new Error("Failed to fetch");
        }
        return jawab({ ok: true, data: await d.k.lepas({ perkaraId: b.perkaraId, token: b.token }) });
      }
      const r = await d.k.ambil({
        perkaraId: b.perkaraId,
        pemilik: operator,
        tujuan: String(b.tujuan || "peramban").slice(0, 80),
        ttlDetik: Number(b.ttlDetik) > 0 ? Number(b.ttlDetik) : undefined,
        tokenLama: b.token || "",
        ambilAlih: b.ambilAlih === true,
      });
      if (r.ok) return jawab({ ok: true, data: r });
      return jawab({
        ok: true,
        data: {
          ok: false,
          alasan: r.alasan === "sedang_dikerjakan" ? "sedang_dikerjakan" : "kunci_tidak_tersedia",
          oleh: r.oleh,
          sampai: r.sampai,
          tujuan: r.tujuan,
          sejak: r.sejak,
          terakhirAktif: r.terakhirAktif,
          milikSendiri: r.milikSendiri,
          tungguDetik: r.tungguDetik,
        },
      });
    }
    if (u.includes("/unggah-massal/cek")) {
      return jawab({ ok: true, data: { adaBaris: d.sipp.adaBaris, adaPutusan: d.sipp.adaPutusan, adaAnonim: d.sipp.adaAnonim } });
    }
    if (u.includes("/putusan/anonim-mandiri")) {
      return jawab({ ok: true, data: { ok: true, rtfBase64: btoa("{\\rtf1 anonim}"), sisa: [] } });
    }
    throw new Error(`url tak dikenal: ${u}`);
  };
  w.a30PerkaraIdUntukAbt = async () => String(PERKARA);
  w.alatBolehUnggahPutusanKini = () => true;
  w.a30UnggahEdoc = async (p: { putusan: File | null; anonimisasi: File | null }) => {
    d.sipp.unggahan.push({ putusan: p.putusan ? p.putusan.name : null, anonimisasi: p.anonimisasi ? p.anonimisasi.name : null });
    const berkas: Array<{ jenis: string; ok: boolean; jalur: string }> = [];
    if (p.putusan) {
      d.sipp.adaPutusan = true;
      berkas.push({ jenis: "putusan", ok: true, jalur: "Putusan/2026/615.rtf" });
    }
    if (p.anonimisasi) {
      d.sipp.adaAnonim = true;
      berkas.push({ jenis: "anonimisasi", ok: true, jalur: "Anonim/2026/615.rtf" });
    }
    return { ok: true, berkas, bunyi: "x" };
  };
  w.pesanGagalUnggah = (b: { alasan?: string }) => `alasan ${b.alasan}`;
  w.alamatHalamanPerkara = () => Boolean(o.tampilkanPerkara);
  w.cariNomorPerkara = () => NOMOR;

  const ctx = (dom as unknown as { getInternalVMContext(): vm.Context }).getInternalVMContext();
  vm.runInContext(KERJA, ctx, { filename: "penetapan-kerja.js" });
  vm.runInContext(EDOC, ctx, { filename: "putusan-edoc-sekaligus.js" });
  const kabar = w.document.createElement("div");
  w.document.body.appendChild(kabar);
  return { w, modul: w.aletaPutusanEdoc, kerja: w.aletaPenetapanKerja, detak, kiriman, kabar, pewaktu };
}

type Halaman = ReturnType<typeof bukaHalaman>;

/** Meniru satu tekan "Putusan & unggah e-Doc": kunci -> Putusan Akhir tersimpan -> e-Doc berurutan -> lepas (finally). */
async function jalanPutusanOtomatis(d: Dunia, h: Halaman, o: { galatSesudahSimpan?: boolean } = {}) {
  const kunci = await h.modul.ambilKunci(NOMOR, String(PERKARA));
  if (!kunci.ok) return { ditolak: kunci.pesan as string };
  try {
    d.sipp.adaBaris = true; // Putusan Akhir tersimpan di SIPP
    if (o.galatSesudahSimpan) throw new Error("jaringan putus");
    const hasil = await h.modul.jalankan({
      nomorPerkara: NOMOR,
      kabar: h.kabar,
      wadah: null,
      putusan: new h.w.File(["{\\rtf1 putusan}"], "615 putusan.rtf"),
    });
    return { hasil, catatan: kunci.catatan as string };
  } finally {
    await kunci.lepas();
  }
}

describe("satu tekan tombol: Putusan Akhir -> e-Doc putusan -> e-Doc anonimisasi di bawah SATU kunci", () => {
  it("kunci tidak menolak langkah e-Doc di jalan yang sama; kedua e-Doc terunggah dalam satu kiriman; kunci lepas", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    const r = await jalanPutusanOtomatis(d, h);
    expect(r.ditolak).toBeUndefined();
    expect(r.hasil!.ok).toBe(true);
    expect(r.hasil!.langkah.map((l: any) => [l.kunci, l.nada])).toEqual([
      ["putusan", "ok"],
      ["anonimisasi", "ok"],
    ]);
    expect(d.sipp.unggahan).toHaveLength(1);
    expect(d.sipp.unggahan[0].putusan).toBeTruthy();
    expect(d.sipp.unggahan[0].anonimisasi).toBeTruthy();
    expect(d.t.baris.size).toBe(0);
  });

  it("langkah di dalam jalan yang sama boleh memakai token jalannya (kunci pinjaman): tidak ditolak, dan tidak melepas milik jalan induk", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    const induk = await h.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(induk.ok).toBe(true);
    // tanpa token: langkah kedua ditolak (pagar tetap menahan tab/klik ganda)
    expect((await h.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(false);
    const pinjam = await h.modul.ambilKunci(NOMOR, String(PERKARA), { token: induk.token });
    expect(pinjam).toMatchObject({ ok: true, token: induk.token });
    await pinjam.lepas();
    expect(d.t.baris.size).toBe(1); // jalan induk masih memegang
    await induk.lepas();
    expect(d.t.baris.size).toBe(0);
  });

  it("kunci dilepas juga saat jalan gagal sesudah Putusan Akhir tersimpan, jadi mengulang e-Doc saja tidak ditolak", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    await expect(jalanPutusanOtomatis(d, h, { galatSesudahSimpan: true })).rejects.toThrow("jaringan putus");
    expect(d.t.baris.size).toBe(0);
    const ulang = await jalanPutusanOtomatis(d, h);
    expect(ulang.ditolak).toBeUndefined();
    expect(ulang.hasil!.ok).toBe(true);
  });

  it("e-Doc yang sudah ada di SIPP tidak diunggah lagi (tanpa tulisan ganda)", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    await jalanPutusanOtomatis(d, h);
    expect(d.sipp.unggahan).toHaveLength(1);
    const lagi = await jalanPutusanOtomatis(d, h);
    expect(lagi.hasil!.langkah.every((l: any) => l.nada === "lewat")).toBe(true);
    expect(d.sipp.unggahan).toHaveLength(1);
  });
});

describe("melepas kunci dipastikan, bukan diharapkan", () => {
  it("melepas gagal dua kali (latar/jaringan sesaat) lalu berhasil: kunci tidak tertinggal", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    const kunci = await h.modul.ambilKunci(NOMOR, String(PERKARA));
    d.galatLepas = 2;
    await kunci.lepas();
    expect(d.lepasDipanggil).toBe(3);
    expect(d.t.baris.size).toBe(0);
  });

  it("halaman ditutup/dimuat ulang (pagehide): kunci yang dipegang dilepas saat itu juga", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    const kunci = await h.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(kunci.ok).toBe(true);
    expect(d.t.baris.size).toBe(1);
    h.w.dispatchEvent(new h.w.Event("pagehide"));
    await sela(20);
    expect(d.t.baris.size).toBe(0);
    expect(h.pewaktu.size).toBe(0); // detak berhenti
  });
});

describe("kunci dari halaman yang mati tidak menghalangi pemiliknya", () => {
  it("selama halaman hidup kunci berdetak: pemilik di tab lain tidak mengambil alih, pengguna lain ditolak dengan nama dan sebab", async () => {
    const d = buatDunia();
    const a = bukaHalaman(d, DERRY);
    const kunci = await a.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(kunci.ok).toBe(true);
    for (let i = 0; i < 6; i += 1) {
      d.t.jam.sekarang += 25;
      await a.detak();
    }
    const tabLain = bukaHalaman(d, DERRY);
    const ditolak = await tabLain.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(ditolak.ok).toBe(false);
    expect(ditolak.pesan).toContain("Putusan Otomatis Anda sebelumnya masih tercatat berjalan");
    expect(ditolak.pesan).toMatch(/tunggu \d+ detik/);
    const lain = bukaHalaman(d, "Panitera Uji");
    const tolakLain = await lain.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(tolakLain.ok).toBe(false);
    expect(tolakLain.pesan).toContain(`sedang dikerjakan oleh ${DERRY} (${TUJUAN})`);
    expect(tolakLain.pesan).toContain("supaya tidak tertulis ganda");
  });

  it("[615] halaman mati tanpa sempat melepas (kunci tertinggal): sesudah detak berhenti pemilik mengambil alih dengan pesan jelas; pengguna lain tetap ditolak", async () => {
    const d = buatDunia();
    const mati = bukaHalaman(d, DERRY);
    expect((await mati.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(true);
    // halaman mati: tidak ada pagehide, tidak ada detak lagi
    d.t.jam.sekarang += 80;
    const lain = bukaHalaman(d, "Panitera Uji");
    expect((await lain.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(false);

    const baru = bukaHalaman(d, DERRY);
    const k = await baru.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(k.ok).toBe(true);
    expect(k.catatan).toContain("Putusan Otomatis sebelumnya masih tercatat berjalan");
    expect(k.catatan).toContain("dilanjutkan oleh Anda");
    await k.lepas();
    expect(d.t.baris.size).toBe(0);
  });

  it("mengulang e-Doc saja sesudah jalan pertama mati: berhasil mengunggah, tanpa ditolak oleh pemiliknya sendiri", async () => {
    const d = buatDunia();
    const mati = bukaHalaman(d, DERRY);
    await mati.modul.ambilKunci(NOMOR, String(PERKARA));
    d.sipp.adaBaris = true; // Putusan Akhir sudah tersimpan sebelum halaman mati
    d.t.jam.sekarang += 90;
    const baru = bukaHalaman(d, DERRY);
    const r = await jalanPutusanOtomatis(d, baru);
    expect(r.ditolak).toBeUndefined();
    expect(r.catatan).toContain("dilanjutkan oleh Anda");
    expect(d.sipp.unggahan).toHaveLength(1);
    expect(d.t.baris.size).toBe(0);
  });
});

describe("e-Doc yang terputus karena halaman dimuat ulang dilanjutkan sesudah halaman termuat", () => {
  const berkas = (h: Halaman, isi = "{\\rtf1 putusan 615}") => new h.w.File([isi], "615 putusan.rtf", { type: "application/rtf" });

  it("niat dicatat sebelum Simpan; halaman mati; halaman perkara termuat lagi -> kedua e-Doc terunggah SEKALI dari berkas yang sama, catatan dihapus, kunci lepas", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    expect(await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(lama), putusanRtf: berkas(lama) })).toBe(true);
    const kunciLama = await lama.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(kunciLama.ok).toBe(true);
    d.sipp.adaBaris = true; // Simpan berhasil, lalu SIPP memuat ulang halaman: skrip lama mati di sini
    d.t.jam.sekarang += 5;

    const baru = bukaHalaman(d, DERRY, { tampilkanPerkara: true });
    const h = await baru.modul.periksaTertunda();
    expect(h.ada).toBe(true);
    expect(h.ok).toBe(true);
    expect(d.sipp.unggahan).toHaveLength(1);
    expect(d.sipp.unggahan[0].putusan).toContain("putusan.rtf");
    expect(d.sipp.unggahan[0].anonimisasi).toBeTruthy();
    expect(Object.keys((d.simpanan.putusanEdocTertunda as object) || {})).toHaveLength(0);
    expect(d.t.baris.size).toBe(0);
    // muat ulang lagi: tidak ada yang dikerjakan dua kali
    const lagi = await bukaHalaman(d, DERRY, { tampilkanPerkara: true }).modul.periksaTertunda();
    expect(lagi.ada).toBe(false);
    expect(d.sipp.unggahan).toHaveLength(1);
  });

  it("jalan yang selesai melapor menghapus catatan: halaman berikutnya tidak mengunggah apa pun", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    await h.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(h) });
    expect(Object.keys(d.simpanan.putusanEdocTertunda as object)).toHaveLength(1);
    await h.modul.hapusTertunda(NOMOR);
    const baru = await bukaHalaman(d, DERRY, { tampilkanPerkara: true }).modul.periksaTertunda();
    expect(baru.ada).toBe(false);
    expect(d.sipp.unggahan).toHaveLength(0);
  });

  it("kunci halaman mati masih segar: dicoba lagi sendiri sampai basi lalu diambil alih (pemilik yang sama)", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(lama) });
    await lama.modul.ambilKunci(NOMOR, String(PERKARA));
    d.sipp.adaBaris = true;
    const baru = bukaHalaman(d, DERRY, { tampilkanPerkara: true });
    const h = await baru.modul.lanjutkanTertunda({ nomorPerkara: NOMOR, kabar: baru.kabar, wadah: null, jedaKunciMs: 10000 });
    expect(h.ok).toBe(true);
    expect(d.sipp.unggahan).toHaveLength(1);
    expect(d.t.baris.size).toBe(0);
  });

  it("e-Doc sudah ada di SIPP (mis. jalan lama sempat mengunggah): dilewati, tidak diunggah ganda", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(lama) });
    Object.assign(d.sipp, { adaBaris: true, adaPutusan: true, adaAnonim: true });
    const h = await bukaHalaman(d, DERRY, { tampilkanPerkara: true }).modul.periksaTertunda();
    expect(h.ada).toBe(true);
    expect(h.langkah.every((l: any) => l.nada === "lewat")).toBe(true);
    expect(d.sipp.unggahan).toHaveLength(0);
  });

  it("catatan lewat 20 menit tidak dilanjutkan dan dibuang", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(lama) });
    const peta = d.simpanan.putusanEdocTertunda as Record<string, { pada: number }>;
    for (const v of Object.values(peta)) v.pada -= 21 * 60 * 1000;
    d.sipp.adaBaris = true;
    const h = await bukaHalaman(d, DERRY, { tampilkanPerkara: true }).modul.periksaTertunda();
    expect(h.ada).toBe(false);
    expect(d.sipp.unggahan).toHaveLength(0);
    expect(Object.keys((d.simpanan.putusanEdocTertunda as object) || {})).toHaveLength(0);
  });

  it("berkas pilihan terlalu besar untuk dititipkan: TIDAK diganti diam-diam dengan cetakan ABT; petugas diminta memilih lagi", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    const besar = berkas(lama);
    Object.defineProperty(besar, "size", { value: 9 * 1024 * 1024 });
    await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: besar });
    d.sipp.adaBaris = true;
    const h = await bukaHalaman(d, DERRY, { tampilkanPerkara: true }).modul.periksaTertunda();
    expect(h.ada).toBe(true);
    expect(h.ok).toBe(false);
    expect(h.bunyi).toContain("terlalu besar");
    expect(d.sipp.unggahan).toHaveLength(0);
  });

  it("halaman yang bukan perkara itu tidak menyentuh catatan", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    await lama.modul.catatTertunda({ nomorPerkara: NOMOR, perkaraId: String(PERKARA), putusan: berkas(lama) });
    const bukanPerkara = await bukaHalaman(d, DERRY, { tampilkanPerkara: false }).modul.periksaTertunda();
    expect(bukanPerkara.ada).toBe(false);
    expect(Object.keys(d.simpanan.putusanEdocTertunda as object)).toHaveLength(1);
  });
});

// ============================================================================
// 3. Penyambungan di kode ekstensi dan rute portal (penjaga)
// ============================================================================
describe("penyambungan", () => {
  const konten = baca("ekstensi-sipp/konten.js");

  it("Putusan Otomatis: niat e-Doc dicatat SEBELUM Simpan dan dihapus di finally; kunci dilepas di finally", () => {
    const i = konten.indexOf("const modEdocTunda = edocAbt");
    const catat = konten.indexOf("catatTertunda(", i);
    const simpan = konten.indexOf("simpanPutusanLaluBuka(nomorPerkara, hasilTerap, opsiSimpanA30)", i);
    const hapus = konten.indexOf("hapusTertunda(nomorPerkara)", i);
    expect(i).toBeGreaterThan(0);
    expect(catat).toBeGreaterThan(i);
    expect(simpan).toBeGreaterThan(catat);
    expect(konten.slice(simpan, hapus)).toContain("finally");
    expect(konten).toMatch(/\} finally \{\s*await kunci\.lepas\(\);\s*\}/);
  });

  it("rute portal meneruskan permintaan ambil alih dan keterangan pemegang ke ekstensi; gateway meneruskannya ke bot", () => {
    const rute = baca("manajemen_surat/src/app/api/aleta-bot/penunjukan/kunci/route.ts");
    expect(rute).toContain("ambilAlih: badan.ambilAlih === true");
    for (const f of ["sejak", "terakhirAktif", "milikSendiri", "tungguDetik"]) expect(rute).toContain(`${f}: r.badan.${f}`);
    expect(baca("aleta_bot/routes/internalGatewayRoutes.js")).toContain("ambilAlih: badan.ambilAlih === true");
    expect(baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts")).toContain("ambilAlih?: boolean");
  });

  it("hanya peramban yang berdetak yang boleh meminta ambil alih (kunci pekerjaan server tidak diambil alih)", () => {
    const bot = baca("aleta_bot/services/penetapanKunciService.js");
    expect(bot).toContain("ambilAlih === true");
    expect(KERJA).toContain("ambilAlih: true");
    expect(KERJA).toContain("DETAK_MS");
  });
});

describe("27 Okt: tab yang sama sesudah dimuat ulang tidak ditolak kunci miliknya sendiri", () => {
  // Laporan 27 Okt (601/Pdt.G/2026): "Isi & simpan Putusan Akhir" saja -> halaman SIPP dimuat ulang sesudah Simpan,
  // pelepasan di pagehide tidak sampai; e-Doc berikutnya ditolak "Putusan Otomatis Anda sebelumnya masih tercatat
  // berjalan sejak 11.38 ... tunggu 62 detik".
  const muatUlang = (d: ReturnType<typeof buatDunia>, lama: Halaman) => {
    const baru = bukaHalaman(d, DERRY);
    for (let i = 0; i < lama.w.sessionStorage.length; i += 1) {
      const k = lama.w.sessionStorage.key(i) as string;
      baru.w.sessionStorage.setItem(k, lama.w.sessionStorage.getItem(k) as string);
    }
    return baru;
  };

  it("halaman mati tanpa melepas, dimuat ulang di TAB YANG SAMA beberapa detik kemudian: kunci langsung dipakai lagi, tanpa menunggu", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    expect((await lama.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(true);
    d.t.jam.sekarang += 5; // masih segar - dulu ditolak milik sendiri
    const baru = muatUlang(d, lama);
    const k = await baru.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(k.ok).toBe(true);
    await k.lepas();
    expect(d.t.baris.size).toBe(0);
    expect(baru.w.sessionStorage.getItem("pk-kunci-tab")).toBeNull();
  });

  it("tab LAIN milik pengguna yang sama tetap ditolak selama kunci masih segar; pengguna lain juga", async () => {
    const d = buatDunia();
    const lama = bukaHalaman(d, DERRY);
    expect((await lama.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(true);
    d.t.jam.sekarang += 5;
    expect((await bukaHalaman(d, DERRY).modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(false);
    expect((await bukaHalaman(d, "Panitera Uji").modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(false);
  });

  it("pekerjaan yang MASIH berjalan di halaman yang sama tidak berbagi kunci: permintaan kedua ditolak", async () => {
    const d = buatDunia();
    const h = bukaHalaman(d, DERRY);
    const pertama = await h.modul.ambilKunci(NOMOR, String(PERKARA));
    expect(pertama.ok).toBe(true);
    expect((await h.modul.ambilKunci(NOMOR, String(PERKARA))).ok).toBe(false);
    await pertama.lepas();
  });
});
