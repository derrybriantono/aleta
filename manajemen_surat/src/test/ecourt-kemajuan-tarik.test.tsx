/**
 * BUTIR 8 (1.189.x) - "Tarik dari e-Court" menampilkan PERSEN + GARIS PROSES
 * yang NYATA: jembatan melaporkan tahap sungguhan (@@ALETA-KEMAJUAN), bot
 * menyimpannya di tarikan (statusTarikan), layar menggambar bar + nama tahap.
 *
 * e-Court asli tidak dapat dihubungi dari laptop, jadi "jembatan" di sini
 * adalah e-Court TIRUAN: proses node sungguhan yang mencetak keluaran seperti
 * run.js (baris log + baris kemajuan, satu baris sengaja terbelah dua
 * potongan stdout), dijalankan lewat pemilah yang SAMA dengan penjadwal.
 */
import { cleanup, render } from "@testing-library/react";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LencanaVerifikasiMajelis } from "@/components/portal/aleta-ecourt-sidang";
import { tarikBelumUpload, type KeadaanTarik } from "@/lib/tarik-belum-upload";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const MODUL_KEMAJUAN = path.join(AKAR, "aleta_bot/services/ecourtKemajuanTarik.js");
const kemajuanMod = require_(MODUL_KEMAJUAN) as {
  barisKemajuan: (t: string, r?: Record<string, unknown>) => string;
  bacaBaris: (s: string) => Record<string, unknown> | null;
  hitungKemajuan: (l: Record<string, unknown>) => { tahap: string; persen: number; teks: string };
  majukan: (lama: unknown, l: Record<string, unknown>) => { tahap: string; persen: number; teks: string };
  pemilahBaris: (f: (l: Record<string, unknown>) => void) => (potongan: string) => void;
};
type Tarikan = { status: string; pesan: string; kemajuan?: { tahap: string; persen: number; teks: string } | null };
type Layanan = {
  tarikSekarang: (isi: Record<string, unknown>) => Promise<{ ok: boolean; dimulai?: boolean; jeda?: boolean; tarikan?: Tarikan }>;
  statusTarikan: (nomor: string) => { ada: boolean; tarikan: Tarikan | null; sisaJedaDetik: number };
  tungguTarikan: (nomor: string) => Promise<void>;
};
const harianMod = require_(path.join(AKAR, "aleta_bot/services/ecourtVerifikasiHarianService.js")) as {
  buatLayanan: (deps: Record<string, unknown>) => Layanan;
};

const HARI = "2026-10-10";
const NOMOR = "609/Pdt.G/2026/PA.Dgl";
const TMP = path.resolve(process.env.TMP || process.env.TEMP || "D:/Aplikasi/aleta/tmp", "uji-kemajuan-tarik");

afterEach(() => cleanup());

/** Skrip e-Court tiruan: keluaran seperti run.js --perkara, dengan jeda kecil. */
function skripTiruan(o: { gantung?: boolean; jedaMs?: number } = {}) {
  const jeda = o.jedaMs ?? 25;
  return `
const k = require(${JSON.stringify(MODUL_KEMAJUAN)});
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => process.stdout.write("[13.20.00] " + s + "\\n");
const maju = (t, r) => process.stdout.write(k.barisKemajuan(t, r) + "\\n");
(async () => {
  log("Membuka peramban e-Court..."); maju("buka-peramban"); await tidur(${jeda});
  maju("masuk-sesi"); log("Sesi tersimpan masih berlaku."); await tidur(${jeda});
  log("Membuka daftar perkara..."); maju("cari-perkara"); await tidur(${jeda});
  maju("cari-perkara", { i: 1, n: 2 }); await tidur(${jeda});
  maju("cari-perkara", { i: 2, n: 2 }); await tidur(${jeda});
  log("Penarikan tertarget: ${NOMOR}."); maju("buka-perkara", { i: 1, n: 1 }); await tidur(${jeda});
  maju("daftar-dokumen", { n: 3, nomor: "${NOMOR}" }); await tidur(${jeda});
  for (let i = 1; i <= 3; i++) {
    const baris = k.barisKemajuan("unduh", { i, n: 3, judul: "Dokumen " + i }) + "\\n";
    // Baris kedua sengaja terbelah dua potongan stdout.
    if (i === 2) { process.stdout.write(baris.slice(0, 20)); await tidur(${jeda}); process.stdout.write(baris.slice(20)); }
    else process.stdout.write(baris);
    log("    Terunduh pdf: dok" + i + ".pdf (12 KB)");
    await tidur(${jeda});
  }
  ${o.gantung ? "setInterval(() => {}, 1000); await new Promise(() => {});" : ""}
  maju("simpan"); log("=== Ringkasan sinkronisasi ===");
  process.exit(0);
})();
`;
}

/** tarikPerkara tiruan: proses anak sungguhan + pemilah yang sama dengan penjadwal. */
function tarikLewatTiruan(o: { gantung?: boolean; jedaMs?: number } = {}) {
  const anak: Array<ReturnType<typeof spawn>> = [];
  const fn = (_nomor: string, opsi: { padaKemajuan?: (l: Record<string, unknown>) => void } = {}) =>
    new Promise<{ kode: number }>((selesai) => {
      const p = spawn(process.execPath, ["-e", skripTiruan(o)], { stdio: ["ignore", "pipe", "pipe"] });
      anak.push(p);
      const pilah = kemajuanMod.pemilahBaris((l) => opsi.padaKemajuan?.(l));
      p.stdout.on("data", (b) => pilah(String(b)));
      p.on("close", (kode) => selesai({ kode: kode ?? -1 }));
    });
  return { fn, matikan: () => anak.forEach((p) => p.kill()) };
}

function layanan(tarikPerkara: unknown, berkasTarikan: string | null) {
  const perkara = [{ perkaraId: 1, nomorPerkara: NOMOR, agenda: "Duplik", sidangLalu: "2026-10-03" }];
  return harianMod.buatLayanan({
    kueriSipp: async (sql: string) => (/perkara_efiling_id/.test(sql) ? perkara : []),
    kueriBot: async () => [],
    menunggu: () => false,
    akunSiap: () => true,
    bolehJalan: () => true,
    sibuk: () => ({ sibuk: false, keterangan: "" }),
    sekarang: () => new Date(2026, 9, 10, 13, 20, 0),
    tarikPerkara,
    berkasTarikan,
  });
}

describe("kemajuan murni (ecourtKemajuanTarik)", () => {
  it("baris bertanda dibaca dari tengah log; yang bukan kemajuan = null", () => {
    const b = kemajuanMod.barisKemajuan("unduh", { i: 2, n: 4, judul: "Jawaban" });
    expect(kemajuanMod.bacaBaris(`[13.20.01] ${b}`)).toEqual({ tahap: "unduh", i: 2, n: 4, judul: "Jawaban" });
    expect(kemajuanMod.bacaBaris("[13.20.01] Terunduh pdf: a.pdf")).toBeNull();
    expect(kemajuanMod.bacaBaris('@@ALETA-KEMAJUAN {"tahap":"ngawur"}')).toBeNull();
  });

  it("persen naik menurut urutan tahap; unduh i/n maju di rentangnya; 'selesai' = 100", () => {
    const urut = [
      { tahap: "mulai" },
      { tahap: "buka-peramban" },
      { tahap: "masuk-sesi" },
      { tahap: "cari-perkara", i: 1, n: 2 },
      { tahap: "cari-perkara", i: 2, n: 2 },
      { tahap: "buka-perkara" },
      { tahap: "daftar-dokumen", n: 3 },
      { tahap: "unduh", i: 1, n: 3 },
      { tahap: "unduh", i: 2, n: 3 },
      { tahap: "unduh", i: 3, n: 3 },
      { tahap: "simpan" },
      { tahap: "selesai" },
    ].map((l) => kemajuanMod.hitungKemajuan(l).persen);
    for (let i = 1; i < urut.length; i++) expect(urut[i], `langkah ${i}`).toBeGreaterThan(urut[i - 1]);
    expect(urut.at(-1)).toBe(100);
    expect(kemajuanMod.hitungKemajuan({ tahap: "unduh", i: 2, n: 5 }).teks).toBe("Mengunduh berkas 2/5");
  });

  it("majukan tidak pernah memundurkan persen dalam satu tarikan", () => {
    const lama = kemajuanMod.hitungKemajuan({ tahap: "cari-perkara", i: 2, n: 2 });
    expect(kemajuanMod.majukan(lama, { tahap: "cari-perkara" }).persen).toBe(lama.persen);
  });
});

describe("bot + e-Court tiruan: status tarikan membawa tahap nyata", () => {
  it("selama berjalan persen naik dan tahapnya terbaca (termasuk berkas i/n); sesudahnya 100% 'Selesai'", async () => {
    const tiruan = tarikLewatTiruan({ jedaMs: 40 });
    const L = layanan(tiruan.fn, null);
    const mulai = await L.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
    expect(mulai.dimulai).toBe(true);
    expect(mulai.tarikan?.kemajuan?.tahap).toBe("mulai");

    const terlihat: Array<{ persen: number; teks: string }> = [];
    const batas = Date.now() + 15000;
    for (;;) {
      const s = L.statusTarikan(NOMOR).tarikan!;
      if (s.kemajuan) terlihat.push({ persen: s.kemajuan.persen, teks: s.kemajuan.teks });
      if (s.status !== "berjalan" || Date.now() > batas) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    await L.tungguTarikan(NOMOR);
    const akhir = L.statusTarikan(NOMOR).tarikan!;
    expect(akhir.status).toBe("selesai");
    expect(akhir.kemajuan).toMatchObject({ tahap: "selesai", persen: 100 });

    const persen = terlihat.map((x) => x.persen);
    for (let i = 1; i < persen.length; i++) expect(persen[i]).toBeGreaterThanOrEqual(persen[i - 1]);
    const teks = new Set(terlihat.map((x) => x.teks));
    expect(teks.has("Mengunduh berkas 2/3"), [...teks].join(" | ")).toBe(true);
    expect([...teks].some((t) => t.startsWith("Mencari perkara di daftar e-Court"))).toBe(true);
    // Lebih dari tiga titik antara: garisnya benar-benar bergerak.
    expect(new Set(persen).size).toBeGreaterThan(3);
  }, 30000);

  it("bot dinyalakan ulang di tengah tarikan: layanan baru membaca simpanan -> 'terputus' beserta persen terakhirnya, dapat ditekan lagi", async () => {
    mkdirSync(TMP, { recursive: true });
    const berkas = path.join(TMP, `tarik-${process.pid}-${Date.now()}.json`);
    const tiruan = tarikLewatTiruan({ gantung: true, jedaMs: 10 });
    try {
      const L1 = layanan(tiruan.fn, berkas);
      await L1.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
      // Tunggu sampai tiruan tiba di unduhan dan simpanan (dijarangkan 1 dtk) tertulis.
      const batas = Date.now() + 10000;
      while (Date.now() < batas) {
        const k = L1.statusTarikan(NOMOR).tarikan?.kemajuan;
        if (k && k.tahap === "unduh" && k.teks === "Mengunduh berkas 3/3" && existsSync(berkas)) {
          const isi = JSON.parse(readFileSync(berkas, "utf8"));
          if (isi.tarikan && Object.values(isi.tarikan).some((t: any) => t.kemajuan && t.kemajuan.teks === "Mengunduh berkas 3/3")) break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      // Bot lama dianggap mati: prosesnya (L1) tidak dipakai lagi; anak tiruan
      // dibiarkan menggantung sampai akhir uji supaya L1 tidak menulis apa pun.

      // "Bot mulai ulang": layanan baru, simpanan yang sama.
      const L2 = layanan(tarikLewatTiruan().fn, berkas);
      const s = L2.statusTarikan(NOMOR);
      expect(s.ada).toBe(true);
      expect(s.tarikan?.status).toBe("terputus");
      expect(s.tarikan?.pesan).toContain("dinyalakan ulang");
      expect(s.tarikan?.kemajuan?.tahap).toBe("terputus");
      expect(s.tarikan?.kemajuan?.persen).toBeGreaterThanOrEqual(76);
      expect(s.sisaJedaDetik).toBe(0);
      const lagi = await L2.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
      expect(lagi.dimulai).toBe(true);
      await L2.tungguTarikan(NOMOR);

      // Tarikan SELESAI membawa jedanya melewati mulai ulang (tidak banjir ke e-Court).
      const L3 = layanan(tarikLewatTiruan().fn, berkas);
      expect(L3.statusTarikan(NOMOR).tarikan?.status).toBe("selesai");
      const j = await L3.tarikSekarang({ nomorPerkara: NOMOR, tanggal: HARI });
      expect(j.jeda).toBe(true);
    } finally {
      tiruan.matikan();
      await new Promise((r) => setTimeout(r, 1500));
      rmSync(berkas, { force: true });
    }
  }, 30000);
});

describe("run.js melaporkan tiap tahap (tanpa menarik apa pun)", () => {
  it("baris kemajuan ada di titik kerja yang sesungguhnya", () => {
    const run = readFileSync(path.join(AKAR, "aleta_bot/tools/ecourt-bridge/run.js"), "utf8");
    for (const potongan of [
      'kemajuan("buka-peramban")',
      'kemajuan("masuk-sesi")',
      'kemajuan("cari-perkara")',
      'kemajuan("cari-perkara", { i: urutKategori, n: kategori.size })',
      'kemajuan("buka-perkara", { i: ringkasan.perkaraDiperiksa, n: tautan.length })',
      'kemajuan("daftar-dokumen", {',
      'kemajuan("unduh", { i: urutDokumen, n: semua.length, judul: dokumen.judul })',
      'kemajuan("simpan")',
    ]) {
      expect(run, potongan).toContain(potongan);
    }
    expect(run.indexOf('kemajuan("buka-peramban")')).toBeLessThan(run.indexOf('kemajuan("masuk-sesi")'));
    const sched = readFileSync(path.join(AKAR, "aleta_bot/services/ecourtSchedulerService.js"), "utf8");
    expect(sched).toContain("pilahKemajuan(teks);");
    expect(sched).toContain("kemajuan: keadaan.sedangJalan ? keadaan.kemajuan : null,");
  });
});

describe("portal: tarikBelumUpload melaporkan persen nyata; lencana menggambar garis", () => {
  it("tiap jawaban 'berjalan' diteruskan sebagai persen + langkah; selesai = 100", async () => {
    const urutan = [
      { persen: 13, teks: "Mencari perkara di daftar e-Court" },
      { persen: 50, teks: "Mengunduh berkas 1/3" },
      { persen: 63, teks: "Mengunduh berkas 2/3" },
    ];
    let tanya = 0;
    const ambil = async (alamat: string, init?: RequestInit) => {
      const json = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
      if (init?.method === "POST") {
        return json({ available: true, ok: true, dimulai: true, tarikan: { nomorPerkara: NOMOR, status: "berjalan", kemajuan: { tahap: "mulai", persen: 1, teks: "Memeriksa jadwal SIPP" } } });
      }
      const k = urutan[tanya++];
      if (k) return json({ available: true, ada: true, tarikan: { nomorPerkara: NOMOR, status: "berjalan", kemajuan: { tahap: "x", ...k } } });
      return json({ available: true, ada: true, tarikan: { nomorPerkara: NOMOR, status: "selesai", selesai: "2026-10-10 13:22:00", pesan: "Tidak ada dokumen baru (diperiksa 13.22)", kemajuan: { tahap: "selesai", persen: 100, teks: "Selesai" } } });
    };
    const dilapor: KeadaanTarik[] = [];
    const hasil = await tarikBelumUpload({ nomorPerkara: NOMOR, tanggal: HARI, alamat: "/aleta/api/x", ambil, tunggu: async () => undefined, padaKemajuan: (k) => dilapor.push(k) });
    expect(dilapor.map((k) => k.persen)).toEqual([1, 13, 50, 63]);
    expect(dilapor[3]).toMatchObject({ tahap: "berjalan", langkah: "Mengunduh berkas 2/3", pesan: "Mengunduh berkas 2/3..." });
    expect(hasil).toMatchObject({ tahap: "selesai", persen: 100 });
  });

  it("lencana: persen + progressbar (aria-valuenow) selama berjalan; garis merah di persen terakhir bila terputus", () => {
    const penanda = { keadaan: "belum-upload", label: "belum upload", kelas: "", keterangan: "Belum diunggah pihak." } as never;
    const { container, rerender } = render(
      createElement(LencanaVerifikasiMajelis, { penanda, tarikan: { tahap: "berjalan", pesan: "Mengunduh berkas 2/3...", dokumenBaru: [], persen: 63, langkah: "Mengunduh berkas 2/3" }, onTarik: () => {} })
    );
    const bar = container.querySelector('[data-garis-tarik][role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("63");
    expect(container.querySelector("[data-persen-tarik]")!.textContent).toBe("63%");
    expect((bar.firstElementChild as HTMLElement).style.width).toBe("63%");
    rerender(createElement(LencanaVerifikasiMajelis, { penanda, tarikan: { tahap: "masalah", pesan: "ALETA Bot dinyalakan ulang", dokumenBaru: [], persen: 76 }, onTarik: () => {} }));
    expect(container.querySelector("[data-garis-tarik]")!.getAttribute("aria-valuenow")).toBe("76");
    rerender(createElement(LencanaVerifikasiMajelis, { penanda, tarikan: { tahap: "selesai", pesan: "Tidak ada dokumen baru", dokumenBaru: [], persen: 100 }, onTarik: () => {} }));
    expect(container.querySelector("[data-garis-tarik]")).toBeNull();
  });
});
