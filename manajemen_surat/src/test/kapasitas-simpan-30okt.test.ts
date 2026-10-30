// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { bolehAksi } from "@/lib/matriks-peran";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  SETELAN_BAWAAN,
  bersihkanLaporan,
  bolehBersihkanOtomatis,
  hitungPersen,
  periksaSetelan,
  perintahPembersihan,
  setelanDariTersimpan,
  susunKapasitas,
  susunPetunjuk,
  uraiRiwayatPembersihan,
  warnaKapasitas,
  type LaporanHost,
  type SetelanKapasitas,
} from "@/server/modules/kapasitas/hitung";

/**
 * ============================================================================
 * KAPASITAS PENYIMPANAN (30 Oktober 2026)
 * ============================================================================
 *
 * Yang dijaga PERILAKUNYA, bukan teks kodenya:
 *   - persen dan warna di batas persisnya (80,0 kuning; 90,0 merah) dan batas buatan;
 *   - setelan yang buruk DITOLAK (bukan dibetulkan diam-diam); saklar bersih otomatis MATI bawaan;
 *   - pembersihan hanya diizinkan bila saklar menyala DAN partisi di atas batas merah;
 *   - Super Admin mengatur, Admin hanya membaca, peran lain ditolak (rute sungguhan atas pg-mem);
 *   - skrip cron host dijalankan sungguhan dengan docker/df tiruan: tidak membersihkan di bawah
 *     ambang atau saat saklar mati, membersihkan dengan perintah yang tepat di atas ambang;
 *   - tidak ada soket Docker yang diberikan ke container;
 *   - skrip pindah/rollback lolos `bash -n`, tidak memformat/memartisi/menghapus.
 */

const GB = 1024 ** 3;
const TB = 1024 ** 4;
const SEKARANG = new Date("2026-10-30T10:00:00Z");

const AMBANG: SetelanKapasitas = { ...SETELAN_BAWAAN };

// ───────────────────────────────────────────────────────────────────────────
// Perhitungan murni
// ───────────────────────────────────────────────────────────────────────────

describe("persen dan ambang", () => {
  it("persen dibulatkan satu desimal; total nol atau data rusak = null (bukan 0)", () => {
    expect(hitungPersen(50 * GB, 200 * GB)).toBe(25);
    expect(hitungPersen(1, 3)).toBe(33.3);
    expect(hitungPersen(0, 200 * GB)).toBe(0);
    expect(hitungPersen(5, 0)).toBeNull();
    expect(hitungPersen(null, 10)).toBeNull();
    expect(hitungPersen(-1, 10)).toBeNull();
    expect(hitungPersen(Number.NaN, 10)).toBeNull();
  });

  it("warna tepat di batas: 79,9 hijau, 80 kuning, 89,9 kuning, 90 merah; tak terukur = kelabu", () => {
    expect(warnaKapasitas(79.9, AMBANG)).toBe("hijau");
    expect(warnaKapasitas(80, AMBANG)).toBe("kuning");
    expect(warnaKapasitas(89.9, AMBANG)).toBe("kuning");
    expect(warnaKapasitas(90, AMBANG)).toBe("merah");
    expect(warnaKapasitas(100, AMBANG)).toBe("merah");
    expect(warnaKapasitas(null, AMBANG)).toBe("kelabu");
  });

  it("ambang buatan Super Admin dipakai: kuning 60, merah 70", () => {
    const s = { ambangKuning: 60, ambangMerah: 70 };
    expect(warnaKapasitas(59.9, s)).toBe("hijau");
    expect(warnaKapasitas(60, s)).toBe("kuning");
    expect(warnaKapasitas(70, s)).toBe("merah");
  });
});

describe("setelan", () => {
  it("bawaan: 80% kuning, 90% merah, pembersihan otomatis MATI, umur 72 jam", () => {
    expect(SETELAN_BAWAAN).toEqual({ ambangKuning: 80, ambangMerah: 90, pembersihanOtomatis: false, umurCacheJam: 72 });
    expect(setelanDariTersimpan(null)).toEqual(SETELAN_BAWAAN);
  });

  it("perubahan sebagian digabung; yang tidak disebut tetap", () => {
    const h = periksaSetelan({ ambangMerah: 95 }, { ...SETELAN_BAWAAN, ambangKuning: 85 });
    expect(h).toEqual({ ok: true, setelan: { ambangKuning: 85, ambangMerah: 95, pembersihanOtomatis: false, umurCacheJam: 72 } });
  });

  it.each([
    [{ ambangKuning: 49 }, /kuning/i],
    [{ ambangKuning: 96 }, /kuning/i],
    [{ ambangKuning: 80.5 }, /kuning/i],
    [{ ambangKuning: "80" }, /kuning/i],
    [{ ambangMerah: 100 }, /merah/i],
    [{ ambangMerah: 59 }, /merah/i],
    [{ ambangKuning: 90, ambangMerah: 90 }, /lebih tinggi/i],
    [{ ambangKuning: 92, ambangMerah: 91 }, /lebih tinggi/i],
    [{ umurCacheJam: 23 }, /jam/i],
    [{ umurCacheJam: 721 }, /jam/i],
    [{ pembersihanOtomatis: "true" }, /benar atau salah/i],
    [{ pembersihanOtomatis: 1 }, /benar atau salah/i],
  ])("menolak %j", (masukan, pesan) => {
    const h = periksaSetelan(masukan);
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.pesan).toMatch(pesan);
  });

  it("setelan tersimpan yang rusak jatuh ke bawaan yang aman, bukan ke nilai berbahaya", () => {
    expect(setelanDariTersimpan({ ambangMerah: 1, pembersihanOtomatis: "ya" })).toEqual(SETELAN_BAWAAN);
    expect(setelanDariTersimpan([1, 2])).toEqual(SETELAN_BAWAAN);
    expect(setelanDariTersimpan({ pembersihanOtomatis: true, ambangMerah: 92, ambangKuning: 85, umurCacheJam: 48 })).toEqual({
      pembersihanOtomatis: true,
      ambangMerah: 92,
      ambangKuning: 85,
      umurCacheJam: 48,
    });
  });
});

describe("pemicu pembersihan", () => {
  const nyala: SetelanKapasitas = { ...SETELAN_BAWAAN, pembersihanOtomatis: true };

  it("saklar MATI: tidak pernah, berapa pun penuhnya", () => {
    expect(bolehBersihkanOtomatis(SETELAN_BAWAAN, 99.9)).toBe(false);
  });

  it("saklar menyala: hanya di/atas batas merah", () => {
    expect(bolehBersihkanOtomatis(nyala, 89.9)).toBe(false);
    expect(bolehBersihkanOtomatis(nyala, 90)).toBe(true);
    expect(bolehBersihkanOtomatis(nyala, 97)).toBe(true);
    expect(bolehBersihkanOtomatis({ ...nyala, ambangMerah: 95 }, 93)).toBe(false);
  });

  it("tak terukur tidak memicu pembersihan", () => {
    expect(bolehBersihkanOtomatis(nyala, null)).toBe(false);
    expect(bolehBersihkanOtomatis(nyala, Number.NaN)).toBe(false);
  });

  it("perintahnya SATU: builder prune dengan umur, bukan prune sistem/volume", () => {
    expect(perintahPembersihan(72)).toBe("docker builder prune --filter until=72h -f");
    expect(perintahPembersihan(48.9)).toBe("docker builder prune --filter until=48h -f");
    expect(perintahPembersihan(72)).not.toMatch(/system|volume|rm\b|-a\b/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Laporan host -> baris layar
// ───────────────────────────────────────────────────────────────────────────

function jalur(kunci: string, titik: string, perangkat: string, total: number, terpakai: number, ukuran: number | null, nama = kunci) {
  return { kunci, nama, jalur: `${titik === "/" ? "" : titik}/${kunci}`, titik, perangkat, totalByte: total, terpakaiByte: terpakai, sisaByte: total - terpakai, ukuranByte: ukuran };
}

/** Keadaan server 20 Okt: /home 200 GB hampir penuh memuat Docker + Postgres; / 715 GB lengang. */
function laporanSebelum(ubah: Partial<LaporanHost> = {}): LaporanHost {
  const HOME = { titik: "/home", perangkat: "/dev/mapper/centos-home" };
  const ROOT = { titik: "/", perangkat: "/dev/mapper/centos-root" };
  return {
    dibuat: new Date(SEKARANG.getTime() - 3 * 60000).toISOString(),
    intervalMenit: 10,
    dockerRoot: "/home/docker-data",
    postgresDir: "/home/aleta-data/postgres",
    jalur: [
      jalur("docker", HOME.titik, HOME.perangkat, 200 * GB, 190 * GB, null),
      jalur("aleta-data", ROOT.titik, ROOT.perangkat, 715 * GB, 113 * GB, null),
      jalur("postgres", HOME.titik, HOME.perangkat, 200 * GB, 190 * GB, 2 * GB),
      jalur("ecourt", ROOT.titik, ROOT.perangkat, 715 * GB, 113 * GB, 6 * GB),
      jalur("unggahan", ROOT.titik, ROOT.perangkat, 715 * GB, 113 * GB, 3 * GB),
      jalur("cadangan", ROOT.titik, ROOT.perangkat, 715 * GB, 113 * GB, 40 * GB),
    ],
    partisi: [
      { ...HOME, totalByte: 200 * GB, terpakaiByte: 190 * GB, sisaByte: 10 * GB },
      { ...ROOT, totalByte: 715 * GB, terpakaiByte: 113 * GB, sisaByte: 602 * GB },
    ],
    docker: { citraByte: 90 * GB, kontainerByte: GB, volumeByte: GB, cacheBuildByte: 75 * GB, cacheBuildBisaDibersihkanByte: 70 * GB },
    pembersihanTerakhir: null,
    ...ubah,
  };
}

describe("susunKapasitas", () => {
  it("/home 95%: partisi data Docker MERAH, ringkasan merah, database satu partisi dengan Docker", () => {
    const h = susunKapasitas({ laporan: laporanSebelum(), partisiBot: null, setelan: AMBANG, kini: SEKARANG });
    expect(h.sumber).toBe("host");
    const b = Object.fromEntries(h.baris.map((x) => [x.kunci, x]));
    expect(b["partisi-docker"]).toMatchObject({ jenis: "partisi", persen: 95, warna: "merah", titik: "/home" });
    expect(b["partisi-aleta"]).toMatchObject({ jenis: "partisi", warna: "hijau", titik: "/" });
    expect(h.ringkasan.warna).toBe("merah");
    expect(h.ringkasan.pesan).toContain("/home");
    expect(h.satuPartisiDenganDocker).toEqual(["Database portal"]);
    // bagian-bagian ada dan netral (tidak berwarna ambang)
    for (const k of ["postgres", "citra", "cache-build", "ecourt", "unggahan", "cadangan"]) {
      expect(b[k], k).toMatchObject({ jenis: "bagian", warna: "kelabu" });
    }
    expect(b["cache-build"].terpakaiByte).toBe(75 * GB);
    expect(b["cache-build"].persen).toBe(37.5);
    expect(b["cache-build"].keterangan).toContain("70");
  });

  it("sesudah dipindah ke / : semua hijau, tidak ada lagi 'satu partisi dengan Docker' dan tidak perlu pindah", () => {
    const ROOT = { titik: "/", perangkat: "/dev/mapper/centos-root" };
    const l = laporanSebelum({
      dockerRoot: "/aleta-docker/docker-data",
      jalur: [
        jalur("docker", ROOT.titik, ROOT.perangkat, 715 * GB, 300 * GB, null),
        jalur("aleta-data", ROOT.titik, ROOT.perangkat, 715 * GB, 300 * GB, null),
        jalur("postgres", ROOT.titik, ROOT.perangkat, 715 * GB, 300 * GB, 2 * GB),
      ],
      partisi: [
        { titik: "/home", perangkat: "/dev/mapper/centos-home", totalByte: 200 * GB, terpakaiByte: 10 * GB, sisaByte: 190 * GB },
        { ...ROOT, totalByte: 715 * GB, terpakaiByte: 300 * GB, sisaByte: 415 * GB },
      ],
    });
    const h = susunKapasitas({ laporan: l, partisiBot: null, setelan: AMBANG, kini: SEKARANG });
    expect(h.ringkasan.warna).toBe("hijau");
    expect(h.ringkasan.pesan).toMatch(/wajar/i);
    // docker, aleta, dan postgres semuanya satu partisi "/": tidak ada baris partisi-postgres terpisah
    expect(h.baris.find((x) => x.kunci === "partisi-postgres")).toBeUndefined();
    expect(h.satuPartisiDenganDocker).toEqual(["Database portal", "Data ALETA"]);
    expect(h.petunjuk.perluPindah).toBe(false);
  });

  it("postgres di partisi lain mendapat barisnya sendiri; ambang buatan dipakai", () => {
    const l = laporanSebelum();
    l.jalur = l.jalur.map((j) => (j.kunci === "postgres" ? jalur("postgres", "/data", "/dev/sdb1", 500 * GB, 300 * GB, 2 * GB) : j));
    const h = susunKapasitas({ laporan: l, partisiBot: null, setelan: { ...AMBANG, ambangKuning: 55, ambangMerah: 65 }, kini: SEKARANG });
    expect(h.baris.find((x) => x.kunci === "partisi-postgres")).toMatchObject({ persen: 60, warna: "kuning", titik: "/data" });
    expect(h.baris.find((x) => x.kunci === "partisi-docker")?.warna).toBe("merah");
  });

  it("bagian yang belum terukur: persen null, kelabu, 'Belum terukur'", () => {
    const l = laporanSebelum();
    l.jalur = l.jalur.map((j) => (j.kunci === "ecourt" ? { ...j, ukuranByte: null } : j));
    const h = susunKapasitas({ laporan: l, partisiBot: null, setelan: AMBANG, kini: SEKARANG });
    expect(h.baris.find((x) => x.kunci === "ecourt")).toMatchObject({ persen: null, warna: "kelabu", keterangan: "Belum terukur." });
  });

  it("laporan basi (cron berhenti): tidak dipercaya sebagai hijau", () => {
    const l = laporanSebelum({ dibuat: new Date(SEKARANG.getTime() - 120 * 60000).toISOString() });
    l.jalur = l.jalur.map((j) => (j.kunci === "docker" ? jalur("docker", "/", "/dev/x", 700 * GB, 100 * GB, null) : j));
    const h = susunKapasitas({ laporan: l, partisiBot: null, setelan: AMBANG, kini: SEKARANG });
    expect(h.basi).toBe(true);
    expect(h.umurMenit).toBe(120);
    expect(h.ringkasan.warna).not.toBe("hijau");
    expect(h.ringkasan.pesan).toContain("120 menit");
  });

  it("tanpa laporan host: cadangan dari partisi ALETA Bot (sumber 'bot'), tanpa rincian Docker", () => {
    const h = susunKapasitas({
      laporan: null,
      partisiBot: [
        { titik: "/boot", totalByte: GB, terpakaiByte: GB * 0.9 },
        { titik: "/home", totalByte: 200 * GB, terpakaiByte: 186 * GB },
        { titik: "/", totalByte: 715 * GB, terpakaiByte: 113 * GB },
      ],
      setelan: AMBANG,
      kini: SEKARANG,
    });
    expect(h.sumber).toBe("bot");
    expect(h.baris.map((b) => b.titik)).toEqual(["/home", "/"]);
    expect(h.baris[0]).toMatchObject({ persen: 93, warna: "merah" });
    expect(h.ringkasan.warna).toBe("merah");
  });

  it("tanpa apa pun: kelabu dan menyuruh memasang pemantau (tidak pernah hijau karangan)", () => {
    const h = susunKapasitas({ laporan: null, partisiBot: null, setelan: AMBANG, kini: SEKARANG });
    expect(h.sumber).toBe("tidak-ada");
    expect(h.ringkasan.warna).toBe("kelabu");
    expect(h.ringkasan.pesan).toMatch(/pasang pemantau/i);
  });
});

describe("petunjuk 1 TB", () => {
  it("total fisik server 915 GB: 1 TB TIDAK mungkin tanpa disk tambahan; saran pindah ke /", () => {
    const l = laporanSebelum();
    const p = susunPetunjuk(l.partisi, "/home");
    expect(p.totalFisikByte).toBe(915 * GB);
    expect(p.cukup1Tb).toBe(false);
    expect(p.kekuranganUntuk1TbByte).toBe(TB - 915 * GB);
    expect(p.perluPindah).toBe(true);
    expect(p.partisiTerbesar).toEqual({ titik: "/", sisaByte: 602 * GB });
    const teks = p.pesan.join(" ");
    expect(teks).toMatch(/TIDAK mungkin tanpa disk tambahan/);
    expect(teks).toMatch(/disk baru/);
    expect(teks).toMatch(/tidak pernah memformat/i);
    expect(p.perintah.join(" ")).toContain("pindah-data-docker.sh --periksa");
    expect(p.perintah.join(" ")).toContain("--jalankan /aleta-docker");
  });

  it("disk tambahan 1 TB terpasang: cukup, tanpa saran beli disk", () => {
    const p = susunPetunjuk(
      [
        { titik: "/", perangkat: "/dev/a", totalByte: 715 * GB, terpakaiByte: 113 * GB },
        { titik: "/home", perangkat: "/dev/b", totalByte: 200 * GB, terpakaiByte: 190 * GB },
        { titik: "/aleta-docker", perangkat: "/dev/c", totalByte: 1 * TB, terpakaiByte: 0 },
      ],
      "/home"
    );
    expect(p.cukup1Tb).toBe(true);
    expect(p.partisiTerbesar?.titik).toBe("/aleta-docker");
    expect(p.pesan.join(" ")).not.toMatch(/TIDAK mungkin/);
  });

  it("partisi berperangkat sama dihitung sekali; /boot tidak dihitung; tanpa data = tidak diketahui", () => {
    const p = susunPetunjuk(
      [
        { titik: "/", perangkat: "/dev/a", totalByte: 100 * GB, terpakaiByte: 1 },
        { titik: "/var/lib/x", perangkat: "/dev/a", totalByte: 100 * GB, terpakaiByte: 1 },
        { titik: "/boot", perangkat: "/dev/boot", totalByte: GB, terpakaiByte: 1 },
      ],
      "/"
    );
    expect(p.totalFisikByte).toBe(100 * GB);
    expect(susunPetunjuk([], null)).toMatchObject({ totalFisikByte: null, cukup1Tb: null });
  });
});

describe("pembacaan laporan dan riwayat", () => {
  it("laporan sah dibersihkan; yang bukan laporan, tanpa waktu, atau tanpa jalur = null; angka negatif dibuang", () => {
    expect(bersihkanLaporan(null)).toBeNull();
    expect(bersihkanLaporan({ dibuat: "bukan-tanggal", jalur: [] })).toBeNull();
    expect(bersihkanLaporan({ dibuat: "2026-10-30T00:00:00Z" })).toBeNull();
    const l = bersihkanLaporan({
      dibuat: "2026-10-30T00:00:00Z",
      jalur: [{ kunci: "docker", nama: "Data Docker", jalur: "/x", titik: "/", perangkat: "/dev/a", totalByte: 100, terpakaiByte: -5, sisaByte: "tujuh", ukuranByte: null }, { nama: "tanpa kunci" }, 7],
      partisi: [{ perangkat: "a", titik: "/", totalByte: 10, terpakaiByte: 5, sisaByte: 5 }, { totalByte: 1 }],
      docker: { cacheBuildByte: 5 },
    })!;
    expect(l.jalur).toHaveLength(1);
    expect(l.jalur[0]).toMatchObject({ totalByte: 100, terpakaiByte: null, sisaByte: null });
    expect(l.partisi).toHaveLength(1);
    expect(l.docker).toMatchObject({ cacheBuildByte: 5, citraByte: null });
    expect(l.intervalMenit).toBe(10);
  });

  it("riwayat JSON-baris: baris rusak/setengah ditulis dilewati, terbaru di depan", () => {
    const isi = [
      '{"pada":"2026-10-28T01:00:00Z","sebabPersen":93.1,"ambangMerah":90,"umurJam":72,"dibebaskanByte":70000000000,"kode":0,"perintah":"docker builder prune --filter until=72h -f"}',
      "bukan json",
      '{"pada":"2026-10-30T01:00:00Z","sebabPersen":91.5,"dibebaskanByte":1,"kode":1',
      '{"pada":"2026-10-29T01:00:00Z","sebabPersen":90.2,"kode":0}',
      "",
    ].join("\n");
    const r = uraiRiwayatPembersihan(isi);
    expect(r.map((x) => x.pada)).toEqual(["2026-10-29T01:00:00Z", "2026-10-28T01:00:00Z"]);
    expect(r[1]).toMatchObject({ sebabPersen: 93.1, dibebaskanByte: 70000000000, kode: 0 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rute sungguhan atas pg-mem
// ───────────────────────────────────────────────────────────────────────────

vi.mock("@/server/modules/sumber-daya/gateway", () => ({ mintaSumberDayaBot: vi.fn(async () => ({ ok: false, error: "bot tiruan mati" })) }));

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-hakim";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

let dirKapasitas = "";
const dirTemp: string[] = [];

function dirBaru(awalan: string) {
  const d = mkdtempSync(path.join(os.tmpdir(), awalan));
  dirTemp.push(d);
  return d;
}

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
}, 180000);
afterAll(async () => {
  await db?.close();
  for (const d of dirTemp) rmSync(d, { recursive: true, force: true });
});
beforeEach(() => {
  dirKapasitas = dirBaru("kap-rute-");
  process.env.ALETA_KAPASITAS_DIR = dirKapasitas;
  aktor = "usr-hakim";
});
afterEach(() => {
  delete process.env.ALETA_KAPASITAS_DIR;
});

async function rute() {
  return import("@/app/api/admin/kapasitas/route");
}
async function panggil(metode: "GET" | "POST", badan?: unknown) {
  const m = await rute();
  const req = new NextRequest("http://localhost/api/admin/kapasitas", {
    method: metode,
    ...(badan !== undefined ? { body: JSON.stringify(badan), headers: { "content-type": "application/json" } } : {}),
  });
  const r = await (metode === "GET" ? m.GET(req) : m.POST(req));
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: Record<string, any>; error?: { message?: string } } | null;
  return { status: r.status, isi };
}

describe("hak akses", () => {
  const persona = (roleId: string) => ({ id: "x", name: "x", roleId, positionId: "", username: "x" }) as unknown as Parameters<typeof bolehAksi>[0];

  it("matriks: hanya Super Admin yang mengatur; Admin dan hakim tidak", () => {
    expect(bolehAksi(persona("super-admin"), "kapasitas.atur")).toBe(true);
    expect(bolehAksi(persona("admin"), "kapasitas.atur")).toBe(false);
    expect(bolehAksi(persona("hakim"), "kapasitas.atur")).toBe(false);
  });

  it("GET: tanpa sesi 401, hakim 403, Admin 200 baca-saja, Super Admin 200 boleh mengatur", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("GET")).status).toBe(403);
    aktor = "usr-admin";
    const a = await panggil("GET");
    expect(a.status).toBe(200);
    expect(a.isi?.data?.bolehAtur).toBe(false);
    aktor = "usr-super";
    const s = await panggil("GET");
    expect(s.status).toBe(200);
    expect(s.isi?.data?.bolehAtur).toBe(true);
    expect(s.isi?.data?.setelan).toEqual(SETELAN_BAWAAN);
    expect(s.isi?.data?.setelan.pembersihanOtomatis).toBe(false);
  });

  it("POST: Admin dan hakim ditolak 403 (tidak ada yang tersimpan atau tertulis); Super Admin diterima", async () => {
    for (const a of ["usr-hakim", "usr-admin"]) {
      aktor = a;
      const r = await panggil("POST", { aksi: "simpan", setelan: { pembersihanOtomatis: true } });
      expect(r.status, a).toBe(403);
      expect((await panggil("POST", { aksi: "periksa" })).status, a).toBe(403);
    }
    expect(existsSync(path.join(dirKapasitas, "setelan-host.json"))).toBe(false);
    expect(existsSync(path.join(dirKapasitas, "minta-periksa.json"))).toBe(false);
    aktor = "usr-super";
    const baca = await panggil("GET");
    expect(baca.isi?.data?.setelan.pembersihanOtomatis).toBe(false);
  });
});

describe("simpan, periksa, dan jejak", () => {
  it("Super Admin menyimpan: setelan baru terbaca, cerminan untuk cron hanya angka dan benar/salah, audit tercatat", async () => {
    aktor = "usr-super";
    const r = await panggil("POST", { aksi: "simpan", setelan: { ambangKuning: 70, ambangMerah: 85, pembersihanOtomatis: true, umurCacheJam: 48 } });
    expect(r.status).toBe(200);
    expect(r.isi?.data?.setelan).toEqual({ ambangKuning: 70, ambangMerah: 85, pembersihanOtomatis: true, umurCacheJam: 48 });
    expect(r.isi?.data?.perintahPembersihan).toBe("docker builder prune --filter until=48h -f");

    const cermin = readFileSync(path.join(dirKapasitas, "setelan-host.json"), "utf8");
    expect(cermin.trim().split("\n")).toHaveLength(1);
    const j = JSON.parse(cermin) as Record<string, unknown>;
    expect(Object.keys(j).sort()).toEqual(["ambangKuning", "ambangMerah", "diubah", "pembersihanOtomatis", "umurCacheJam", "versi"]);
    expect(j).toMatchObject({ ambangKuning: 70, ambangMerah: 85, pembersihanOtomatis: true, umurCacheJam: 48 });

    const lagi = await panggil("GET");
    expect(lagi.isi?.data?.setelan.ambangMerah).toBe(85);

    const audit = await db!.queryAll<{ action: string; actor_user_id: string; payload_json: string }>(
      "SELECT action, actor_user_id, payload_json FROM audit_logs WHERE action = 'UPDATE_KAPASITAS_SETELAN'"
    );
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_user_id).toBe("usr-super");
    const muatan = JSON.parse(audit[0].payload_json) as { sebelum: SetelanKapasitas; sesudah: SetelanKapasitas };
    expect(muatan.sebelum.pembersihanOtomatis).toBe(false);
    expect(muatan.sesudah.pembersihanOtomatis).toBe(true);

    // kembalikan ke bawaan agar pengujian lain tidak terpengaruh
    await panggil("POST", { aksi: "simpan", setelan: SETELAN_BAWAAN });
  });

  it("nilai buruk: 400 dengan pesan, tidak ada yang berubah", async () => {
    aktor = "usr-super";
    const r = await panggil("POST", { aksi: "simpan", setelan: { ambangKuning: 95, ambangMerah: 90 } });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.isi)).toMatch(/lebih tinggi/);
    expect(existsSync(path.join(dirKapasitas, "setelan-host.json"))).toBe(false);
    expect((await panggil("POST", { aksi: "hapus-semua" })).status).toBe(400);
  });

  it("'Periksa sekarang' menaruh berkas pemicu untuk cron (tidak menjalankan apa pun)", async () => {
    aktor = "usr-super";
    const r = await panggil("POST", { aksi: "periksa" });
    expect(r.status).toBe(200);
    const pemicu = JSON.parse(readFileSync(path.join(dirKapasitas, "minta-periksa.json"), "utf8")) as { versi: number; pada: string };
    expect(pemicu.versi).toBe(1);
    expect(Number.isNaN(new Date(pemicu.pada).getTime())).toBe(false);
  });

  it("GET membaca laporan host dan mencatat pembersihan otomatis ke audit SEKALI per kejadian", async () => {
    const l = laporanSebelum({ dibuat: new Date().toISOString() });
    const mentah = { ...l, pembersihan: { terakhir: null } };
    writeFileSync(path.join(dirKapasitas, "laporan.json"), JSON.stringify(mentah));
    writeFileSync(
      path.join(dirKapasitas, "riwayat-bersih.jsonl"),
      '{"pada":"2026-10-29T03:00:00Z","sebabPersen":93.4,"ambangMerah":90,"umurJam":72,"dibebaskanByte":70000000000,"kode":0,"perintah":"docker builder prune --filter until=72h -f"}\n'
    );
    aktor = "usr-admin";
    const r1 = await panggil("GET");
    expect(r1.status).toBe(200);
    expect(r1.isi?.data?.kapasitas.sumber).toBe("host");
    expect(r1.isi?.data?.kapasitas.ringkasan.warna).toBe("merah");
    expect(r1.isi?.data?.riwayat).toHaveLength(1);
    await panggil("GET");
    await panggil("GET");
    let n = await db!.queryAll<{ id: string; actor_user_id: string | null }>("SELECT id, actor_user_id FROM audit_logs WHERE action = 'KAPASITAS_BERSIHKAN_CACHE_OTOMATIS'");
    expect(n).toHaveLength(1);
    expect(n[0].actor_user_id).toBeNull();
    // kejadian baru -> satu baris baru
    writeFileSync(
      path.join(dirKapasitas, "riwayat-bersih.jsonl"),
      '{"pada":"2026-10-29T03:00:00Z","kode":0}\n{"pada":"2026-10-30T03:00:00Z","kode":0,"dibebaskanByte":5}\n'
    );
    await panggil("GET");
    n = await db!.queryAll("SELECT id, actor_user_id FROM audit_logs WHERE action = 'KAPASITAS_BERSIHKAN_CACHE_OTOMATIS'");
    expect(n).toHaveLength(2);
  });

  it("akanDibersihkan hanya bila saklar menyala DAN partisi Docker di atas batas merah", async () => {
    writeFileSync(path.join(dirKapasitas, "laporan.json"), JSON.stringify(laporanSebelum({ dibuat: new Date().toISOString() })));
    aktor = "usr-super";
    await panggil("POST", { aksi: "simpan", setelan: { pembersihanOtomatis: false } });
    expect((await panggil("GET")).isi?.data?.akanDibersihkan).toBe(false);
    await panggil("POST", { aksi: "simpan", setelan: { pembersihanOtomatis: true } });
    expect((await panggil("GET")).isi?.data?.akanDibersihkan).toBe(true); // /home 95% >= 90
    await panggil("POST", { aksi: "simpan", setelan: { ambangKuning: 90, ambangMerah: 96 } });
    expect((await panggil("GET")).isi?.data?.akanDibersihkan).toBe(false); // 95% < 96
    await panggil("POST", { aksi: "simpan", setelan: SETELAN_BAWAAN });
  });
});

describe("Pusat kesehatan", () => {
  it("komponen kapasitas ikut menentukan warna keseluruhan; tanpa data = kelabu, galat = kelabu, merah tetap merah", async () => {
    const { KOMPONEN_PENENTU } = await import("@/server/modules/kesehatan/layanan");
    expect(KOMPONEN_PENENTU.has("kapasitas")).toBe(true);
    const { periksaKapasitas } = await import("@/server/modules/kesehatan/pemeriksa");
    expect(periksaKapasitas(undefined).warna).toBe("kelabu");
    expect(periksaKapasitas({ ok: false, error: "x" }).warna).toBe("kelabu");
    const merah = periksaKapasitas({ ok: true, data: { warna: "merah", ringkas: "Partisi /home terisi 95%.", rincian: [] } });
    expect(merah).toMatchObject({ warna: "merah", ringkas: "Partisi /home terisi 95%." });
  });

  it("ringkasUntukKesehatan menyebut tiap partisi, ambang, dan keadaan saklar", async () => {
    const { bacaKapasitas, ringkasUntukKesehatan } = await import("@/server/modules/kapasitas/layanan");
    writeFileSync(path.join(dirKapasitas, "laporan.json"), JSON.stringify(laporanSebelum({ dibuat: new Date().toISOString() })));
    const d = await bacaKapasitas(db!);
    const r = ringkasUntukKesehatan(d);
    expect(r.warna).toBe("merah");
    expect(r.rincian.map((x) => x.label)).toEqual(expect.arrayContaining(["Partisi data Docker", "Partisi data ALETA", "Batas kuning / merah", "Pembersihan otomatis"]));
    expect(r.rincian.find((x) => x.label === "Pembersihan otomatis")?.nilai).toBe("mati");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Container tidak diberi soket Docker
// ───────────────────────────────────────────────────────────────────────────

const REPO = path.resolve(process.cwd(), "..");

function semuaBerkas(dir: string, hasil: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) semuaBerkas(p, hasil);
    else hasil.push(p);
  }
  return hasil;
}

describe("tanpa soket Docker", () => {
  it("modul, rute, dan layar kapasitas tidak menyentuh docker.sock atau menjalankan perintah", () => {
    const berkas = [
      ...semuaBerkas(path.join(process.cwd(), "src/server/modules/kapasitas")),
      path.join(process.cwd(), "src/app/api/admin/kapasitas/route.ts"),
      path.join(process.cwd(), "src/components/portal/kapasitas-panel.tsx"),
    ];
    expect(berkas.length).toBeGreaterThanOrEqual(5);
    for (const b of berkas) {
      const t = readFileSync(b, "utf8");
      expect(t, b).not.toMatch(/docker\.sock/);
      expect(t, b).not.toMatch(/child_process|execSync|execFile|spawn\(|exec\(/);
    }
  });

  it("compose repo tidak memasang docker.sock ke container mana pun", () => {
    for (const f of readdirSync(REPO).filter((n) => /^docker-compose.*\.ya?ml$/.test(n))) {
      expect(readFileSync(path.join(REPO, f), "utf8"), f).not.toMatch(/docker\.sock/);
    }
  });

  it("portal hanya menaruh berkas di folder pertukaran (volume reports yang sudah ada)", () => {
    const t = readFileSync(path.join(process.cwd(), "src/server/modules/kapasitas/penyimpanan.ts"), "utf8");
    expect(t).toContain('"reports", "kapasitas"');
    expect(readFileSync(path.join(REPO, "docker-compose.yml"), "utf8")).toContain("/var/www/html/aleta-data/reports:/app/reports");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Skrip bash
// ───────────────────────────────────────────────────────────────────────────

function cariBash(): string | null {
  const kandidat = [process.env.ALETA_BASH, "C:/Program Files/Git/bin/bash.exe", "C:/Program Files/Git/usr/bin/bash.exe", "/bin/bash", "/usr/bin/bash"].filter(Boolean) as string[];
  return kandidat.find((k) => existsSync(k)) ?? null;
}
const BASH = cariBash();
const adaPython = (() => {
  for (const p of ["python3", "python"]) {
    const r = spawnSync(p, ["--version"], { encoding: "utf8" });
    if (!r.error && r.status === 0) return true;
  }
  return false;
})();

/** Jalur Windows -> bentuk msys (/d/...); di Linux tidak berubah. */
function posix(p: string) {
  return p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_m, d: string) => `/${d.toLowerCase()}`);
}

const SKRIP = path.join(REPO, "scripts", "kapasitas");
const NAMA_SKRIP = ["pindah-data-docker.sh", "kembalikan-data-docker.sh", "aleta-kapasitas-cron.sh", "lib-kapasitas.sh"];

function jalankanBash(perintah: string, env: Record<string, string> = {}) {
  return spawnSync(BASH as string, ["-c", perintah], { encoding: "utf8", env: { ...process.env, ...env }, timeout: 60_000 });
}

describe.skipIf(!BASH)("skrip server: sintaks dan keselamatan", () => {
  it.each(NAMA_SKRIP)("%s lolos bash -n, berakhir baris LF, dan memakai set -e atau pengecualian terkelola", (nama) => {
    const jalur = path.join(SKRIP, nama);
    const isi = readFileSync(jalur, "utf8");
    expect(isi.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(isi.includes("\r")).toBe(false);
    const r = spawnSync(BASH as string, ["-n", posix(jalur)], { encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  });

  it("tidak ada perintah yang memformat, memartisi, atau menghapus data permanen", () => {
    for (const nama of NAMA_SKRIP) {
      const baris = readFileSync(path.join(SKRIP, nama), "utf8")
        .split("\n")
        .filter((b) => !/^\s*#/.test(b) && !/^\s*(echo|info|warn|galat|die)\b/.test(b) && !/^\s*"?\s*$/.test(b));
      const kode = baris.join("\n");
      expect(kode, nama).not.toMatch(/\bmkfs(\.\w+)?\b|\bfdisk\b|\bparted\b|\bwipefs\b|\bpvcreate\b|\bvgcreate\b|\blvcreate\b|\blvextend\b|\blvremove\b|\bshred\b|\bdd\s+if=/);
      expect(kode, nama).not.toMatch(/\brm\s+-[a-zA-Z]*r/); // tidak ada rm -r / -rf sama sekali
      expect(kode, nama).not.toMatch(/docker\s+(system\s+prune|volume\s+(rm|prune)|rmi|image\s+prune)/);
    }
  });

  it("rsync pemindahan tanpa --delete; hanya rollback (menyamakan lokasi lama) memakainya", () => {
    const pindah = readFileSync(path.join(SKRIP, "pindah-data-docker.sh"), "utf8");
    const baris = pindah.split("\n").filter((b) => /rsync -/.test(b) && !/^\s*#/.test(b));
    expect(baris.length).toBeGreaterThanOrEqual(3);
    expect(baris.join("\n")).not.toMatch(/--delete/);
    expect(pindah).toMatch(/rsync -aHAX --numeric-ids/);
    expect(pindah).toMatch(/\.lama-/);
  });

  it("tahap-tahap pindah ada berurutan: cadangan DB sebelum berhenti, rsync sebelum ubah config, verifikasi sebelum ganti nama", () => {
    const t = readFileSync(path.join(SKRIP, "pindah-data-docker.sh"), "utf8");
    const pos = (s: string) => t.indexOf(s);
    expect(pos("cadangan-db.sh")).toBeGreaterThan(0);
    expect(pos("cadangan-db.sh")).toBeLessThan(pos("systemctl stop docker"));
    expect(pos("systemctl stop docker")).toBeLessThan(pos("rsync -aHAX --numeric-ids --info=stats1"));
    expect(pos("verifikasi_salinan \"$DOCKER_LAMA\"")).toBeLessThan(pos("ubah_daemon_json \"$ALETA_DAEMON_JSON\" set"));
    expect(pos("ubah_daemon_json \"$ALETA_DAEMON_JSON\" set")).toBeLessThan(t.lastIndexOf("systemctl start docker"));
    expect(pos("Verifikasi akhir")).toBeLessThan(pos('LAMA_DOCKER="$(ganti_nama'));
    expect(t).toContain("RestartCount");
    expect(t).toContain("restart=0");
  });
});

describe.skipIf(!BASH || !adaPython)("lib-kapasitas: fungsi dijalankan sungguhan atas berkas tiruan", () => {
  it("daemon.json: data-root digabung tanpa menimpa kunci lain, 'graph' lama dibuang, JSON rusak tidak disentuh", () => {
    const d = dirBaru("kap-lib-");
    const f = path.join(d, "daemon.json");
    writeFileSync(f, JSON.stringify({ "log-driver": "json-file", graph: "/old", dns: ["8.8.8.8"] }));
    const lib = posix(path.join(SKRIP, "lib-kapasitas.sh"));
    const r = jalankanBash(`source '${lib}'; ubah_daemon_json '${posix(f)}' set '//aleta-docker/docker-data' && ALETA_DAEMON_JSON='${posix(f)}' daemon_data_root`);
    expect(r.status, r.stderr).toBe(0);
    const j = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
    expect(j["data-root"]).toMatch(/aleta-docker\/docker-data$/);
    expect(j["log-driver"]).toBe("json-file");
    expect(j.dns).toEqual(["8.8.8.8"]);
    expect(j.graph).toBeUndefined();
    const hapus = jalankanBash(`source '${lib}'; ubah_daemon_json '${posix(f)}' hapus`);
    expect(hapus.status, hapus.stderr).toBe(0);
    const j2 = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
    expect(j2["data-root"]).toBeUndefined();
    expect(j2["log-driver"]).toBe("json-file");

    const rusak = path.join(d, "rusak.json");
    writeFileSync(rusak, "{bukan json");
    const gagal = jalankanBash(`source '${lib}'; ubah_daemon_json '${posix(rusak)}' set /x`);
    expect(gagal.status).not.toBe(0);
    expect(readFileSync(rusak, "utf8")).toBe("{bukan json");
  });

  it("jalur_postgres: override didahulukan, bentuk bertanda kutip dibaca, tidak ketemu = kosong", () => {
    const d = dirBaru("kap-compose-");
    const lib = posix(path.join(SKRIP, "lib-kapasitas.sh"));
    writeFileSync(path.join(d, "docker-compose.yml"), "services:\n  postgres:\n    volumes:\n      - /home/aleta-data/postgres:/var/lib/postgresql/data\n");
    const a = jalankanBash(`source '${lib}'; jalur_postgres`, { ALETA_APP_DIR: posix(d) });
    expect(a.stdout.trim()).toBe("/home/aleta-data/postgres");
    writeFileSync(path.join(d, "docker-compose.override.yml"), 'services:\n  postgres:\n    volumes:\n      - "/aleta-docker/postgres:/var/lib/postgresql/data:rw"\n');
    const b = jalankanBash(`source '${lib}'; jalur_postgres`, { ALETA_APP_DIR: posix(d) });
    expect(b.stdout.trim()).toBe("/aleta-docker/postgres");
    const kosong = dirBaru("kap-kosong-");
    expect(jalankanBash(`source '${lib}'; jalur_postgres`, { ALETA_APP_DIR: posix(kosong) }).stdout.trim()).toBe("");
  });

  it("manusia(): satuan basis 1024 sama dengan layar", () => {
    const lib = posix(path.join(SKRIP, "lib-kapasitas.sh"));
    const r = jalankanBash(`source '${lib}'; manusia 1073741824; echo; manusia 1099511627776; echo; manusia 512`);
    expect(r.stdout.split("\n")).toEqual(["1.0 GB", "1.0 TB", "512 B"]);
  });
});

/**
 * Cron host dijalankan SUNGGUHAN dengan `docker` dan `df` tiruan di PATH, sehingga
 * keputusan membersihkan diuji tanpa Docker dan tanpa bergantung pada disk mesin ini.
 */
function sediakanCron(opsi: { terpakai: number; setelan?: Record<string, unknown> | null }) {
  const akar = dirBaru("kap-cron-");
  const bin = path.join(akar, "bin");
  const app = path.join(akar, "app");
  const data = path.join(akar, "data");
  const kap = path.join(data, "reports", "kapasitas");
  for (const d of [bin, app, data, kap, path.join(data, "ecourt-docs"), path.join(data, "uploads")]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(app, "docker-compose.yml"), "services:\n  postgres:\n    volumes:\n      - /sim/pg:/var/lib/postgresql/data\n");
  const catatan = path.join(akar, "docker-dipanggil.log");
  writeFileSync(
    path.join(bin, "docker"),
    `#!/bin/bash
echo "$@" >> '${posix(catatan)}'
case "$1 $2" in
  "info --format") echo "${posix(akar)}/docker-root" ;;
  "system df") printf 'Images|96.2GB|90GB (93%%)\\nContainers|1.2MB|0B\\nLocal Volumes|3.4GB|0B (0%%)\\nBuild Cache|75.1GB|70.3GB\\n' ;;
  "builder prune") echo "Total reclaimed space: 70.3GB"; echo "${posix(akar)}/tandai-bersih" > /dev/null ;;
esac
`
  );
  // df tiruan: satu partisi 1000 byte, terpakai sesuai opsi.
  writeFileSync(
    path.join(bin, "df"),
    `#!/bin/bash
total=1000
pakai=$(cat '${posix(akar)}/terpakai')
sisa=$((total - pakai))
echo "Filesystem     1-blocks  Used Available Capacity Mounted on"
echo "/dev/sim1      $total $pakai $sisa 90% /"
`
  );
  writeFileSync(path.join(akar, "terpakai"), String(opsi.terpakai));
  chmodSync(path.join(bin, "docker"), 0o755);
  chmodSync(path.join(bin, "df"), 0o755);
  if (opsi.setelan) writeFileSync(path.join(kap, "setelan-host.json"), JSON.stringify(opsi.setelan) + "\n");
  mkdirSync(path.join(akar, "docker-root"), { recursive: true });
  const jalankan = (argumen = "--paksa") =>
    spawnSync(BASH as string, ["-c", `export PATH='${posix(bin)}':"$PATH"; bash '${posix(path.join(SKRIP, "aleta-kapasitas-cron.sh"))}' ${argumen}`], {
      encoding: "utf8",
      timeout: 60_000,
      env: {
        ...process.env,
        ALETA_APP_DIR: posix(app),
        ALETA_DATA_DIR: posix(data),
        ALETA_KAPASITAS_DIR: posix(kap),
      },
    });
  const diPanggil = () => (existsSync(catatan) ? readFileSync(catatan, "utf8").split("\n").filter(Boolean) : []);
  const jumlahPrune = () => diPanggil().filter((b) => b.startsWith("builder prune")).length;
  return { akar, kap, jalankan, diPanggil, jumlahPrune };
}

const SETELAN_NYALA = { versi: 1, pembersihanOtomatis: true, ambangKuning: 80, ambangMerah: 90, umurCacheJam: 72 };

describe.skipIf(!BASH)("aleta-kapasitas-cron.sh (dijalankan sungguhan, docker dan df tiruan)", () => {
  it("menulis laporan.json yang sah dan terbaca modul portal, dengan angka dari df dan docker system df", () => {
    const c = sediakanCron({ terpakai: 950 });
    const r = c.jalankan();
    expect(r.status, r.stderr).toBe(0);
    const mentah = JSON.parse(readFileSync(path.join(c.kap, "laporan.json"), "utf8")) as Record<string, any>;
    expect(mentah.versi).toBe(1);
    expect(mentah.docker).toMatchObject({ citraByte: 96200000000, cacheBuildByte: 75100000000, cacheBuildBisaDibersihkanByte: 70300000000 });
    expect(mentah.jalur.map((j: { kunci: string }) => j.kunci)).toEqual(["docker", "aleta-data", "postgres", "ecourt", "unggahan", "cadangan"]);
    expect(mentah.postgresDir).toBe("/sim/pg");
    const l = bersihkanLaporan(mentah)!;
    expect(l).not.toBeNull();
    const h = susunKapasitas({ laporan: l, partisiBot: null, setelan: AMBANG, kini: new Date() });
    expect(h.baris.find((b) => b.kunci === "partisi-docker")).toMatchObject({ persen: 95, warna: "merah" });
  });

  it("saklar MATI (tanpa berkas setelan) di 99%: tidak membersihkan", () => {
    const c = sediakanCron({ terpakai: 990, setelan: null });
    expect(c.jalankan().status).toBe(0);
    expect(c.jumlahPrune()).toBe(0);
  });

  it("saklar menyala tetapi di bawah ambang merah (89,9%): tidak membersihkan", () => {
    const c = sediakanCron({ terpakai: 899, setelan: SETELAN_NYALA });
    expect(c.jalankan().status).toBe(0);
    expect(c.jumlahPrune()).toBe(0);
  });

  it("saklar menyala di/atas ambang (90%): membersihkan dengan perintah yang TEPAT, mencatat riwayat, jeda 6 jam mencegah pengulangan", () => {
    const c = sediakanCron({ terpakai: 900, setelan: SETELAN_NYALA });
    expect(c.jalankan().status).toBe(0);
    const prune = c.diPanggil().filter((b) => b.startsWith("builder prune"));
    expect(prune).toEqual(["builder prune --filter until=72h -f"]);
    const riwayat = uraiRiwayatPembersihan(readFileSync(path.join(c.kap, "riwayat-bersih.jsonl"), "utf8"));
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0]).toMatchObject({ sebabPersen: 90, ambangMerah: 90, umurJam: 72, kode: 0, perintah: "docker builder prune --filter until=72h -f" });
    // pemeriksaan berikutnya tak lama sesudahnya: dilewati
    expect(c.jalankan().status).toBe(0);
    expect(c.jumlahPrune()).toBe(1);
    // laporan memuat waktu pembersihan terakhir
    const l = bersihkanLaporan(JSON.parse(readFileSync(path.join(c.kap, "laporan.json"), "utf8")))!;
    expect(l.pembersihanTerakhir).not.toBeNull();
  });

  it("umur dan ambang dari setelan dipakai; nilai asing di berkas setelan jatuh ke bawaan aman (tidak dijalankan sebagai perintah)", () => {
    const c = sediakanCron({ terpakai: 800, setelan: { pembersihanOtomatis: true, ambangMerah: 75, ambangKuning: 60, umurCacheJam: 24 } });
    expect(c.jalankan().status).toBe(0);
    expect(c.diPanggil().filter((b) => b.startsWith("builder prune"))).toEqual(["builder prune --filter until=24h -f"]);

    const aneh = sediakanCron({ terpakai: 950, setelan: null });
    writeFileSync(path.join(aneh.kap, "setelan-host.json"), '{"pembersihanOtomatis":true,"ambangMerah":"$(touch /tmp/pwned)","umurCacheJam":"72h; rm -rf /"}\n');
    expect(aneh.jalankan().status).toBe(0);
    // ambang aneh -> bawaan 90 (950 >= 900), umur aneh -> bawaan 72; perintahnya tetap yang baku
    expect(aneh.diPanggil().filter((b) => b.startsWith("builder prune"))).toEqual(["builder prune --filter until=72h -f"]);
    expect(aneh.diPanggil().join("\n")).not.toMatch(/pwned|rm -rf/);
  });

  it("berkas pemicu 'Periksa sekarang' memaksa pengukuran tanpa --paksa lalu dihapus; tanpa pemicu dan laporan baru, tidak mengukur", () => {
    const c = sediakanCron({ terpakai: 500 });
    expect(c.jalankan("--paksa").status).toBe(0);
    const awal = statSync(path.join(c.kap, "laporan.json")).mtimeMs;
    // laporan baru + tanpa pemicu: keluar cepat, laporan tidak ditulis ulang
    expect(c.jalankan("").status).toBe(0);
    expect(statSync(path.join(c.kap, "laporan.json")).mtimeMs).toBe(awal);
    // pemicu ada: mengukur ulang dan pemicu dihapus
    writeFileSync(path.join(c.kap, "minta-periksa.json"), '{"versi":1}\n');
    writeFileSync(path.join(c.akar, "terpakai"), "600");
    expect(c.jalankan("").status).toBe(0);
    expect(existsSync(path.join(c.kap, "minta-periksa.json"))).toBe(false);
    const l = bersihkanLaporan(JSON.parse(readFileSync(path.join(c.kap, "laporan.json"), "utf8")))!;
    expect(l.partisi[0].terpakaiByte).toBe(600);
  });
});
