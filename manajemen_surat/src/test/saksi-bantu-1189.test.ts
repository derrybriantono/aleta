/**
 * ============================================================================
 * 1.189.x BUTIR 10-12 - BANTU DATA SAKSI
 * ============================================================================
 *
 *   A. Keterangan HUBUNGAN: urai keterangan nyata satker, sebutan pihak menurut
 *      JENIS PERKARA (dua arah - pelaku/lawan pernah tertukar dua kali),
 *      daftar isi awal sama dengan hasil urai ekstensi.
 *   B. TEBAKAN diukur atas data saksi nyata (fixtures/saksi-ukur-1189.json):
 *      yang diisi otomatis harus >= 95% tepat, yang di bawahnya hanya usulan
 *      klik; isian petugas tidak pernah ditimpa.
 *   C. SAKSI GANDA: tingkat kecocokan bot, isian yang dikirim ekstensi.
 *   D. Rute /api/aleta-ecourt/saksi-bantu atas pg-mem berbenih: daftar,
 *      tambah, sembunyikan (Admin saja), konteks dari bot.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUBUNGAN_BAWAAN, kunciHubungan, rapikanDasarHubungan } from "@/lib/saksi-hubungan";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

const AKAR = path.resolve(__dirname, "../../..");
const SUMBER = readFileSync(path.join(AKAR, "ekstensi-sipp", "saksiscan.js"), "utf8").replace(/\r\n/g, "\n");
const UKUR = JSON.parse(readFileSync(path.join(__dirname, "fixtures", "saksi-ukur-1189.json"), "utf8")) as {
  keterangan: [string, number, number, number][];
  keteranganTerisi: number;
  agama: { islam: number; terisi: number };
  pekerjaan: { lakiLaki: { petani: number; jumlah: number }; perempuan: { rumahTangga: number; jumlah: number } };
  statusKawin: { kawin: number; terisi: number };
  pendidikan: { slta: number; terisi: number };
  alamatSamaPenggugat: { persis: number; jumlah: number };
};
const requireBot = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const { sebutanPihakPerkara } = requireBot("./services/sebutanPihakService") as {
  sebutanPihakPerkara: (b: Record<string, unknown>) => { satu: string; dua: string };
};

type Urai = { dasar: string; pihak: { jenis: string; ke: number | null } | null; bukanHubungan: boolean };
type Konteks = { sebutan: { satu: string; dua: string }; pihakPertama: unknown[]; pihakKedua: unknown[]; saksi?: unknown[] };
type Usulan = { medan: string; kuat: boolean; tulisan: string; langkah: { penunjuk: string; jenis: string; nilai: string }[] };
type KeadaanRef = { diisi: Record<string, string>; disentuh: Set<string>; otomatis: boolean };
type Murni = {
  saksibantuUrai: (t: string) => Urai;
  saksibantuDaftarSasaran: (k: Konteks) => { kunci: string; tulisan: string }[];
  saksibantuKunciSasaran: (p: Urai["pihak"], k: Konteks, ke: string) => string;
  saksibantuTulisanSasaran: (kunci: string, k: Konteks) => string;
  saksibantuSusun: (d: string, s: string) => string;
  saksibantuRapikan: (t: string, k: Konteks, ke: string) => string;
  saksibantuJkHubungan: (d: string) => string;
  saksibantuUsulan: (k: Record<string, unknown>) => Usulan[];
  saksibantuOtomatis: (u: Usulan[], k: KeadaanRef, mode: string) => Usulan[];
  saksibantuCatatSentuhan: (k: KeadaanRef, nilai: Record<string, string>) => KeadaanRef;
  saksibantuIsianGanda: (k: Record<string, string>, sekarang?: Date) => { nama: string; nik: string; tanggalLahir: string } | null;
  saksibantuSaksiSamaDiPerkara: (nama: string, k: Konteks) => { urutan: number } | null;
};

function murni(): Murni {
  const k: Record<string, unknown> = { console, globalThis: {} };
  vm.createContext(k);
  vm.runInContext(
    `var document = {}; ${SUMBER}\n;this.__m = { saksibantuUrai, saksibantuDaftarSasaran, saksibantuKunciSasaran, saksibantuTulisanSasaran, saksibantuSusun, saksibantuRapikan, saksibantuJkHubungan, saksibantuUsulan, saksibantuOtomatis, saksibantuCatatSentuhan, saksibantuIsianGanda, saksibantuSaksiSamaDiPerkara };`,
    k
  );
  return k.__m as Murni;
}
const m = murni();

/** Konteks seperti dijawab bot - sebutannya dari sebutanPihakService sungguhan. */
function konteks(bahan: { alurPerkaraId: number; jenisPerkaraId: number }, n1 = 1, n2 = 1): Konteks {
  const s = sebutanPihakPerkara(bahan);
  return {
    sebutan: { satu: s.satu, dua: s.dua },
    pihakPertama: Array.from({ length: n1 }, (_, i) => ({ urutan: i + 1, nama: `P${i + 1}`, alamat: "Desa Lalombi" })),
    pihakKedua: Array.from({ length: n2 }, (_, i) => ({ urutan: i + 1, nama: `T${i + 1}`, alamat: "" })),
    saksi: [{ urutan: 1, nama: "HASNAH BINTI LATIF", tanggalLahir: "", yangMenghadirkan: 1, keterangan: "Ibu Kandung Penggugat" }],
  };
}
// Nomor dari sipp_donggala: 346 Cerai Talak (alur gugatan 15, sebutan Pemohon),
// 347 Cerai Gugat (Penggugat), alur 16 permohonan (Istbat Nikah, 2 pemohon).
const CERAI_TALAK = konteks({ alurPerkaraId: 15, jenisPerkaraId: 346 });
const CERAI_GUGAT = konteks({ alurPerkaraId: 15, jenisPerkaraId: 347 });
const ISTBAT = konteks({ alurPerkaraId: 16, jenisPerkaraId: 360 }, 2, 0);

// ============================================================================
// A. KETERANGAN HUBUNGAN
// ============================================================================

describe("A. urai keterangan saksi nyata satker", () => {
  it("keterangan terukur (>= 3 kali) terurai menjadi dasar hubungan, kecuali yang memang bukan hubungan", () => {
    let jumlah = 0;
    let terurai = 0;
    for (const [teks, n] of UKUR.keterangan) {
      jumlah += n;
      const u = m.saksibantuUrai(teks);
      if (u.dasar) terurai += n;
      else expect(u.bukanHubungan, teks).toBe(true);
    }
    // Sisanya jenis perkara salah tempat ("itsbat nikah", "cerai gugat") dan nomor saksi.
    expect(terurai / jumlah).toBeGreaterThan(0.95);
    for (const [teks] of UKUR.keterangan) {
      if (/^(?:itsbat|cerai|dispensasi|saksi)/.test(teks)) expect(m.saksibantuUrai(teks).bukanHubungan, teks).toBe(true);
    }
  });

  it("ragam tulis disatukan: angka, x, titik, salah ketik, sebutan di depan", () => {
    const dasar = (t: string) => m.saksibantuUrai(t).dasar;
    expect(dasar("sepupu 1x penggugat.")).toBe("Sepupu Satu Kali");
    expect(dasar("sepupu 2 x")).toBe("Sepupu Dua Kali");
    expect(dasar("sepupu satu kali dengan penggugat")).toBe("Sepupu Satu Kali");
    expect(dasar("kemanakan penggugat.")).toBe("Keponakan");
    expect(dasar("bapak kandung pemohon i")).toBe("Ayah Kandung");
    expect(dasar("om penggugat")).toBe("Paman");
    expect(dasar("penggugat anak kandung")).toBe("Anak Kandung");
    expect(dasar("tetangga/pegawai syara")).toBe("Tetangga / Pegawai Syara");
    expect(m.saksibantuUrai("paman pemohon ii").pihak).toEqual({ jenis: "satu", ke: 2 });
    expect(m.saksibantuUrai("paman p2").pihak).toEqual({ jenis: "satu", ke: 2 });
    expect(m.saksibantuUrai("tetangga pemohon i dan pemohon ii").pihak).toEqual({ jenis: "para", ke: null });
    expect(m.saksibantuUrai("tetangga para pemohon").pihak).toEqual({ jenis: "para", ke: null });
    expect(m.saksibantuUrai("ibu kandung tergugat").pihak).toEqual({ jenis: "dua", ke: null });
    expect(m.saksibantuUrai("sepupu").pihak).toBeNull();
  });

  it("isi awal daftar (server) = titik tetap urai ekstensi; tanpa sebutan pihak; kuncinya unik", () => {
    const kunci = new Set<string>();
    for (const h of HUBUNGAN_BAWAAN) {
      expect(m.saksibantuUrai(h.teks).dasar, h.teks).toBe(h.teks);
      expect(h.teks).not.toMatch(/penggugat|tergugat|pemohon|termohon/i);
      expect(rapikanDasarHubungan(h.teks)).toMatchObject({ ok: true, teks: h.teks, kelompok: h.kelompok });
      kunci.add(kunciHubungan(h.teks));
    }
    expect(kunci.size).toBe(HUBUNGAN_BAWAAN.length);
    // Urut menurut pemakaian terukur.
    const jumlah = HUBUNGAN_BAWAAN.map((h) => h.jumlah);
    expect([...jumlah].sort((a, b) => b - a)).toEqual(jumlah);
  });

  it("tambah hubungan: sebutan pihak ditolak, huruf dirapikan", () => {
    expect(rapikanDasarHubungan("Ibu Kandung Penggugat")).toMatchObject({ ok: false });
    expect(rapikanDasarHubungan("sepupu EMPAT kali")).toEqual({ ok: true, teks: "Sepupu Empat Kali", kelompok: "keluarga" });
    expect(rapikanDasarHubungan("kepala dusun")).toEqual({ ok: true, teks: "Kepala Dusun", kelompok: "lain" });
    expect(rapikanDasarHubungan("x")).toMatchObject({ ok: false });
  });
});

describe("A. sebutan pihak menurut jenis perkara - DUA ARAH", () => {
  it("Cerai Talak (bernomor Pdt.G) = Pemohon; Cerai Gugat = Penggugat - dari sebutanPihakService", () => {
    expect(m.saksibantuDaftarSasaran(CERAI_TALAK).map((x) => x.tulisan)).toEqual(["Pemohon", "Termohon", "Pemohon dan Termohon"]);
    expect(m.saksibantuDaftarSasaran(CERAI_GUGAT).map((x) => x.tulisan)).toEqual(["Penggugat", "Tergugat", "Penggugat dan Tergugat"]);
    expect(m.saksibantuDaftarSasaran(ISTBAT).map((x) => x.tulisan)).toEqual(["Para Pemohon", "Pemohon I", "Pemohon II"]);
  });

  it('"Ibu Kandung" + yang menghadirkan -> lengkap; pihak kedua tidak tertukar', () => {
    const susun = (k: Konteks, ke: string) => m.saksibantuSusun("Ibu Kandung", m.saksibantuTulisanSasaran(m.saksibantuKunciSasaran(null, k, ke), k));
    expect(susun(CERAI_GUGAT, "1")).toBe("Ibu Kandung Penggugat");
    expect(susun(CERAI_GUGAT, "2")).toBe("Ibu Kandung Tergugat");
    expect(susun(CERAI_TALAK, "1")).toBe("Ibu Kandung Pemohon");
    expect(susun(CERAI_TALAK, "2")).toBe("Ibu Kandung Termohon");
    expect(susun(ISTBAT, "1")).toBe("Ibu Kandung Para Pemohon");
  });

  it("merapikan keterangan lama: sebutan yang salah untuk jenis perkaranya dibetulkan (112 kasus terukur)", () => {
    expect(m.saksibantuRapikan("ibu kandung penggugat", CERAI_TALAK, "1")).toBe("Ibu Kandung Pemohon");
    expect(m.saksibantuRapikan("ibu kandung tergugat", CERAI_TALAK, "1")).toBe("Ibu Kandung Termohon");
    expect(m.saksibantuRapikan("ibu kandung pemohon", CERAI_GUGAT, "1")).toBe("Ibu Kandung Penggugat");
    expect(m.saksibantuRapikan("Ibu Kandung termohon", CERAI_GUGAT, "1")).toBe("Ibu Kandung Tergugat");
    expect(m.saksibantuRapikan("tetangga", CERAI_GUGAT, "2")).toBe("Tetangga Tergugat");
    expect(m.saksibantuRapikan("paman pemohon ii", ISTBAT, "1")).toBe("Paman Pemohon II");
    expect(m.saksibantuRapikan("sepupu 1x", ISTBAT, "1")).toBe("Sepupu Satu Kali Para Pemohon");
    expect(m.saksibantuRapikan("itsbat nikah", ISTBAT, "1")).toBe("");
    // Pihak kedua yang tidak ada (permohonan voluntair) -> pihak pertama.
    expect(m.saksibantuRapikan("tetangga termohon", ISTBAT, "1")).toBe("Tetangga Para Pemohon");
  });
});

// ============================================================================
// B. TEBAKAN - DIUKUR ATAS DATA SAKSI NYATA
// ============================================================================

describe("B. tebakan atas data nyata: otomatis hanya bila >= 95% tepat", () => {
  it("jenis kelamin dari kata hubungan tepat >= 95% atas keterangan bergender (kuat)", () => {
    let benar = 0;
    let jumlah = 0;
    for (const [teks, , l, p] of UKUR.keterangan) {
      const jk = m.saksibantuJkHubungan(m.saksibantuUrai(teks).dasar);
      if (!jk) continue;
      jumlah += l + p;
      benar += jk === "L" ? l : p;
    }
    expect(jumlah).toBeGreaterThan(900);
    expect(benar / jumlah).toBeGreaterThan(0.95);
  });

  it("agama Islam >= 95% (kuat); pekerjaan, status kawin, alamat, pendidikan < 95% (hanya usulan / tidak ditebak)", () => {
    expect(UKUR.agama.islam / UKUR.agama.terisi).toBeGreaterThan(0.95);
    expect(UKUR.pekerjaan.lakiLaki.petani / UKUR.pekerjaan.lakiLaki.jumlah).toBeLessThan(0.95);
    expect(UKUR.pekerjaan.perempuan.rumahTangga / UKUR.pekerjaan.perempuan.jumlah).toBeLessThan(0.95);
    expect(UKUR.statusKawin.kawin / UKUR.statusKawin.terisi).toBeLessThan(0.95);
    expect(UKUR.alamatSamaPenggugat.persis / UKUR.alamatSamaPenggugat.jumlah).toBeLessThan(0.05);
    expect(UKUR.pendidikan.slta / UKUR.pendidikan.terisi).toBeLessThan(0.5);

    const u = m.saksibantuUsulan({
      agama: "", pilihanAgama: [{ nilai: "", tulisan: "Pilih Agama" }, { nilai: "1", tulisan: "Islam" }, { nilai: "2", tulisan: "Kristen" }],
      jenisKelamin: "", pekerjaan: "", apakahTni: "", statusKawin: "", umur: "40", alamat: "",
      hubungan: "Ibu Kandung", alamatPihak: "Desa Lalombi", sebutanPihak: "Penggugat",
    });
    const kuat = Object.fromEntries(u.map((x) => [x.medan, x.kuat]));
    expect(kuat).toEqual({ agama: true, jenisKelamin: true, pekerjaan: false, statusKawin: false, alamat: false });
    expect(u.find((x) => x.medan === "jenisKelamin")?.langkah).toEqual([{ penunjuk: "#pihak_jenis_kelamin", jenis: "pilih", nilai: "2" }]);
    // Pengadilan agama: #apakahtni "Lain-Lain" dulu, baru uraiannya.
    expect(u.find((x) => x.medan === "pekerjaan")?.langkah).toEqual([
      { penunjuk: "#apakahtni", jenis: "pilih", nilai: "2" },
      { penunjuk: "#pihak_pekerjaan", jenis: "teks", nilai: "Mengurus Rumah Tangga" },
    ]);
    expect(u.some((x) => /pendidikan/i.test(x.medan))).toBe(false);
  });

  it("medan yang SUDAH diisi petugas tidak mendapat usulan; tetangga tidak diusulkan alamat", () => {
    const u = m.saksibantuUsulan({
      agama: "2", pilihanAgama: [{ nilai: "1", tulisan: "Islam" }], jenisKelamin: "1", pekerjaan: "Guru", apakahTni: "2",
      statusKawin: "2", umur: "40", alamat: "Desa Labuan", hubungan: "Ibu Kandung", alamatPihak: "Desa Lalombi",
    });
    expect(u).toEqual([]);
    const tetangga = m.saksibantuUsulan({ agama: "1", jenisKelamin: "1", pekerjaan: "x", alamat: "", hubungan: "Tetangga", alamatPihak: "Desa Lalombi", umur: "20", statusKawin: "" });
    expect(tetangga.map((x) => x.medan)).toEqual([]);
    // PNS di #apakahtni = pekerjaan terisi walau uraiannya kosong.
    expect(m.saksibantuUsulan({ agama: "1", jenisKelamin: "1", pekerjaan: "", apakahTni: "3" }).map((x) => x.medan)).toEqual([]);
  });

  it("otomatis: hanya kuat, hanya blangko Tambah, sekali per medan; yang diubah petugas tidak pernah diisi lagi", () => {
    const k: KeadaanRef = { diisi: {}, disentuh: new Set(), otomatis: true };
    const usulan = m.saksibantuUsulan({ agama: "", pilihanAgama: [{ nilai: "1", tulisan: "Islam" }], jenisKelamin: "", pekerjaan: "", hubungan: "Paman" });
    expect(m.saksibantuOtomatis(usulan, k, "updt")).toEqual([]);
    expect(m.saksibantuOtomatis(usulan, { ...k, otomatis: false }, "add")).toEqual([]);
    expect(m.saksibantuOtomatis(usulan, k, "add").map((x) => x.medan)).toEqual(["agama", "jenisKelamin"]);

    // ALETA mengisi agama "1"; petugas menggantinya "2" -> disentuh.
    k.diisi.agama = "1";
    k.diisi.jenisKelamin = "1";
    m.saksibantuCatatSentuhan(k, { agama: "2", jenisKelamin: "1" });
    expect([...k.disentuh]).toEqual(["agama"]);
    expect(k.diisi).toEqual({ jenisKelamin: "1" });
    // Petugas mengosongkan agama lagi -> tetap TIDAK diisi otomatis.
    const lagi = m.saksibantuUsulan({ agama: "", pilihanAgama: [{ nilai: "1", tulisan: "Islam" }], jenisKelamin: "1", pekerjaan: "x" });
    expect(lagi.map((x) => x.medan)).toEqual(["agama"]);
    expect(m.saksibantuOtomatis(lagi, k, "add")).toEqual([]);
  });
});

// ============================================================================
// C. SAKSI GANDA
// ============================================================================

const ganda = requireBot("./services/saksiBantuService") as {
  tingkatGanda: (a: Record<string, unknown>, b: Record<string, unknown>) => string | null;
  medanKurang: (b: Record<string, unknown>) => { wajib: string[]; kurang: string[] };
  polaNama: (n: string) => string;
};

describe("C. saksi ganda", () => {
  const NIK = "7203094505900001";
  it("tingkat kecocokan: NIK+nama / nama+tgl lahir = pasti; NIK saja = nik; tgl lahir kosong = mungkin; tgl lahir beda = bukan", () => {
    expect(ganda.tingkatGanda({ nama: "Rosmiati binti La Ode", nik: NIK }, { nama: "ROSMIATI BINTI LA ODE", nik: NIK })).toBe("pasti");
    expect(ganda.tingkatGanda({ nama: "Efendi bin Tahir", tanggalLahir: "27/03/1963" }, { nama: "EFENDI BIN TAHIR", tanggalLahir: "1963-03-27" })).toBe("pasti");
    expect(ganda.tingkatGanda({ nama: "Budi", nik: NIK }, { nama: "Rosmiati", nik: NIK })).toBe("nik");
    expect(ganda.tingkatGanda({ nama: "Efendi bin Tahir", tanggalLahir: "" }, { nama: "EFENDI BIN TAHIR", tanggalLahir: "1963-03-27" })).toBe("mungkin");
    expect(ganda.tingkatGanda({ nama: "Efendi bin Tahir", tanggalLahir: "01/01/1970" }, { nama: "EFENDI BIN TAHIR", tanggalLahir: "1963-03-27" })).toBeNull();
    // NIK dummy tidak pernah menjadi dasar.
    expect(ganda.tingkatGanda({ nama: "A", nik: "7203010000000000" }, { nama: "B", nik: "7203010000000000" })).toBeNull();
  });

  it("data lama kurang: yang wajib menurut pilih() SIPP dipisahkan", () => {
    const k = ganda.medanKurang({ jenis_pihak_id: 1, warga_negara_id: 98, alamat: "", pekerjaan: "", tempat_lahir: "Palu", tanggal_lahir: "1970-01-01", jenis_kelamin: "L", agama_id: 1, pendidikan_id: null, status_kawin: "", nomor_indentitas: "" });
    expect(k.wajib).toEqual(["Alamat", "Pekerjaan"]);
    expect(k.kurang).toEqual(["Pendidikan", "Status kawin", "NIK"]);
    expect(ganda.polaNama("Efendi  bin Tahir, S.H.")).toBe("EFENDI%BIN%TAHIR%");
  });

  it("ekstensi: tanggal lahir bawaan SIPP (hari ini) dianggap kosong; nama terlalu pendek tidak dicari", () => {
    const hariIni = new Date(2026, 9, 10);
    expect(m.saksibantuIsianGanda({ nama: "Efendi bin Tahir", tglLahir: "10/10/2026" }, hariIni)).toEqual({ nama: "Efendi bin Tahir", nik: "", tanggalLahir: "" });
    expect(m.saksibantuIsianGanda({ nama: "Efendi bin Tahir", tglLahir: "27/03/1963", nik: NIK }, hariIni)).toEqual({ nama: "Efendi bin Tahir", nik: NIK, tanggalLahir: "27/03/1963" });
    expect(m.saksibantuIsianGanda({ nama: "Ef", tglLahir: "" }, hariIni)).toBeNull();
    expect(m.saksibantuSaksiSamaDiPerkara("Hasnah binti Latif", CERAI_GUGAT)).toMatchObject({ urutan: 1 });
    expect(m.saksibantuSaksiSamaDiPerkara("Hasnah", CERAI_GUGAT)).toBeNull();
  });
});

// ============================================================================
// D. RUTE - pg-mem berbenih, bot ditiru
// ============================================================================

let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", async (asli) => {
  const modul = await asli<typeof import("@/server/modules/aleta-bot/whatsapp-gateway-client")>();
  return {
    ...modul,
    getGatewaySaksiKonteks: async (nomor: string) => ({ ok: true, data: { ok: true, perkara: { nomor }, ...CERAI_TALAK } }),
    postGatewaySaksiGanda: async () => ({ ok: true, data: { ok: true, calon: [{ pihakId: "9", tingkat: "pasti", nama: "X" }] } }),
  };
});

async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}) {
  const rute = await import("@/app/api/aleta-ecourt/saksi-bantu/route");
  const req = new NextRequest(`http://localhost/api/aleta-ecourt/saksi-bantu${opsi.query ? `?${opsi.query}` : ""}`, {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawab = await (rute as unknown as Record<string, (r: NextRequest) => Promise<Response>>)[cara](req);
  return { status: jawab.status, isi: (await jawab.json()) as { data: Record<string, unknown>; error?: { message: string } } };
}

describe("D. rute saksi-bantu", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    await db?.close();
    db = null;
  });

  it("tanpa sesi 401; GET memulangkan isi awal + konteks sebutan dari bot", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    aktor = "usr-hakim";
    const r = await panggil("GET", { query: `nomorPerkara=${encodeURIComponent("608/Pdt.G/2026/PA.Dgl")}` });
    expect(r.status).toBe(200);
    const hubungan = r.isi.data.hubungan as { teks: string }[];
    expect(hubungan[0].teks).toBe("Tetangga");
    expect(hubungan.length).toBe(HUBUNGAN_BAWAAN.length);
    expect((r.isi.data.konteks as Konteks).sebutan).toEqual({ satu: "Pemohon", dua: "Termohon" });
    expect(r.isi.data.bolehKelola).toBe(false);
  });

  it("tambah (petugas), tidak ganda; sembunyikan hanya Admin; tercatat di audit", async () => {
    aktor = "usr-hakim";
    const t = await panggil("POST", { badan: { aksi: "tambah", teks: "kepala dusun" } });
    expect(t.status).toBe(200);
    expect(t.isi.data).toMatchObject({ ok: true, sudahAda: false, hubungan: { teks: "Kepala Dusun", bawaan: false } });
    const lagi = await panggil("POST", { badan: { aksi: "tambah", teks: "Kepala Dusun" } });
    expect(lagi.isi.data).toMatchObject({ sudahAda: true });
    expect((await panggil("POST", { badan: { aksi: "tambah", teks: "Ibu Kandung Penggugat" } })).status).toBe(400);

    const kunci = kunciHubungan("Tetangga");
    expect((await panggil("POST", { badan: { aksi: "sembunyikan", kunci } })).status).toBe(403);
    aktor = "usr-super";
    expect((await panggil("POST", { badan: { aksi: "sembunyikan", kunci } })).status).toBe(200);
    aktor = "usr-hakim";
    const daftar = (await panggil("GET")).isi.data.hubungan as { teks: string }[];
    expect(daftar.some((h) => h.teks === "Tetangga")).toBe(false);
    expect(daftar.some((h) => h.teks === "Kepala Dusun")).toBe(true);

    const jejak = await (db as AletaDatabase)
      .prepare("SELECT action FROM audit_logs WHERE action LIKE 'SAKSI_HUBUNGAN_%' ORDER BY created_at")
      .all<{ action: string }>();
    expect(jejak.map((j) => j.action)).toEqual(["SAKSI_HUBUNGAN_TAMBAH", "SAKSI_HUBUNGAN_SEMBUNYIKAN"]);
  });

  it("ganda: masukan diperiksa, jawaban bot diteruskan", async () => {
    expect((await panggil("POST", { badan: { aksi: "ganda", nama: "X", nik: "123" } })).status).toBe(400);
    const r = await panggil("POST", { badan: { aksi: "ganda", nama: "Efendi bin Tahir", tanggalLahir: "27/03/1963" } });
    expect(r.status).toBe(200);
    expect(r.isi.data.calon).toEqual([{ pihakId: "9", tingkat: "pasti", nama: "X" }]);
  });
});
