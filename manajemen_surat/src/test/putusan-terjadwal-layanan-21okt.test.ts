// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_PUTUSAN_TERJADWAL } from "@/server/db/schema";
import { msKeWita, witaKeMs } from "@/lib/putusan-terjadwal";
import { ApiError } from "@/server/shared/errors";

import { BARIS_BAS, NOMOR, NOMOR_LAIN, barisPutusan, buatDocx, buatZip, rtf } from "./putusan-terjadwal-bahan";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - MIGRASI, BERKAS, LAYANAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Menjalankan kodenya: pemeriksaan berkas (RTF, DOCX tanpa pustaka, BAS ditolak), penyimpanan di folder
 * yang di-mount (jalur tidak dapat keluar folder), dan layanan atas basis data pg-mem: menjadwalkan
 * (semua diperiksa dulu - satu yang tidak sah menolak seluruhnya), hak, berkas orang lain, berkas perkara
 * lain, perkara ganda, daftar milik sendiri, batal / tunda / ubah jam / ulang.
 */

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// ─── 1. Migrasi ──────────────────────────────────────────────────────────────

describe("migrasi 0080 - berkas = DDL schema.ts, jurnal tanpa lubang, ikut cadangan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0080_aleta_putusan_terjadwal.sql");

  it("jurnal: 0080 di idx 73 sekali (sesudah 0079), tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.tag.startsWith("0080_"))).toEqual([expect.objectContaining({ idx: 73, tag: "0080_aleta_putusan_terjadwal" })]);
    for (let i = 1; i < j.entries.length; i += 1) expect(j.entries[i]?.when).toBeGreaterThan(j.entries[i - 1]?.when ?? 0);
    expect(existsSync(SQL)).toBe(true);
  });

  it("pernyataan berkas = DDL_PUTUSAN_TERJADWAL, berjalan di pg-mem, keempat tabel ikut cadangan", () => {
    expect(pernyataan(readFileSync(SQL, "utf8"))).toEqual([...DDL_PUTUSAN_TERJADWAL.tabel, ...DDL_PUTUSAN_TERJADWAL.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(DDL_PUTUSAN_TERJADWAL.tabel).toHaveLength(4);
    for (const t of ["aleta_putusan_jadwal", "aleta_putusan_jadwal_butir", "aleta_putusan_jadwal_berkas", "aleta_putusan_jadwal_jejak"]) {
      expect(kosong.public.many(`SELECT * FROM ${t}`)).toEqual([]);
      expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain(t);
    }
  });

  it("tidak ada kunci asing dan tidak ada CHECK (nilai sah dijaga modul)", () => {
    const sql = readFileSync(SQL, "utf8").replace(/--.*$/gm, "");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(sql)).toBe(false);
  });
});

// ─── 2. Pemeriksaan dan penyimpanan berkas ───────────────────────────────────

import { bacaBerkas, bacaEntriZip, hapusBerkas, isiCocokPerkara, jalurSah, periksaBerkas, simpanBerkas, teksDariDocx } from "@/server/modules/putusan-terjadwal/berkas";

describe("pemeriksaan berkas", () => {
  it("RTF putusan: bentuk dari kepala berkas, nomor dari isi, pertimbangan + amar dapat dipotong, sidik jari", async () => {
    const h = await periksaBerkas(rtf(barisPutusan()), "apa-saja.bin");
    expect(h.ok).toBe(true);
    expect(h.bentuk).toBe("rtf");
    expect(h.nomorIsi).toBe(NOMOR);
    expect(h.isiDibaca).toBe(true);
    expect(h.bagianLengkap).toBe(true);
    expect(h.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(h.peringatan).toEqual([]);
  });

  it("DOCX (zip deflate dan zip tersimpan): teks dibaca tanpa pustaka, nomor terbaca, bagian lengkap, diberi peringatan konversi", async () => {
    for (const metode of [8, 0] as const) {
      const docx = buatDocx(barisPutusan(), metode);
      expect(teksDariDocx(docx)).toContain("PERTIMBANGAN HUKUM");
      const h = await periksaBerkas(docx, "putusan.docx");
      expect(h.ok).toBe(true);
      expect(h.bentuk).toBe("docx");
      expect(h.nomorIsi).toBe(NOMOR);
      expect(h.bagianLengkap).toBe(true);
      expect(h.peringatan.join(" ")).toMatch(/diubah menjadi RTF/);
    }
  });

  it("zip tanpa word/document.xml atau rusak: tidak melempar; isi tidak terbaca dan dikatakan", async () => {
    const zip = buatZip([{ nama: "lain.txt", isi: "x" }]);
    expect(bacaEntriZip(zip, "word/document.xml")).toBeNull();
    const h = await periksaBerkas(zip, "kosong.docx");
    expect(h.ok).toBe(true);
    expect(h.isiDibaca).toBe(false);
    expect(h.peringatan.join(" ")).toMatch(/tidak terbaca sekarang/);
    expect(bacaEntriZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), "word/document.xml")).toBeNull();
  });

  it("BAS dan PHS ditolak dengan namanya; yang bukan RTF/DOCX/DOC/PDF, kosong, dan berkas kunci Word ditolak", async () => {
    const bas = await periksaBerkas(rtf(BARIS_BAS), "bas.rtf");
    expect(bas.ok).toBe(false);
    expect(bas.tolak).toMatch(/Berita Acara/);
    const phs = await periksaBerkas(rtf(["PENETAPAN", `Nomor ${NOMOR}`, "Menimbang, bahwa perlu ditetapkan hari sidang;", "MENETAPKAN", "1. Menetapkan hari sidang pertama pada hari Selasa;"]), "phs.rtf");
    expect(phs.ok).toBe(false);
    expect((await periksaBerkas(new TextEncoder().encode("hanya teks biasa"), "a.rtf")).tolak).toMatch(/bukan RTF, DOCX, DOC, maupun PDF/);
    expect((await periksaBerkas(new Uint8Array(0), "a.rtf")).tolak).toMatch(/kosong/);
    expect((await periksaBerkas(rtf(barisPutusan()), "~$putusan.rtf")).tolak).toMatch(/kunci sementara Word/);
  });

  it("berkas lebih dari 10 MB ditolak sebelum dibaca isinya", async () => {
    const besar = new Uint8Array(10 * 1024 * 1024 + 1);
    besar.set(new TextEncoder().encode("{\\rtf1"), 0);
    expect((await periksaBerkas(besar, "besar.rtf")).tolak).toMatch(/melampaui 10 MB/);
  });

  it("RTF yang bukan putusan lengkap (tanpa amar) lolos dengan peringatan bahwa pengisian formulir akan ditahan", async () => {
    const h = await periksaBerkas(rtf(["PUTUSAN", `Nomor ${NOMOR}`, "DUDUK PERKARA", `Bahwa perkara Nomor ${NOMOR} ...`]), "sebagian.rtf");
    expect(h.ok).toBe(true);
    expect(h.bagianLengkap).toBe(false);
    expect(h.peringatan.join(" ")).toMatch(/pengisian formulir Putusan Akhir akan ditahan/);
  });

  it("isiCocokPerkara: kosong = lolos (tidak terbaca), sama = lolos, perkara lain = ditolak; nol di depan dan titik diabaikan", () => {
    expect(isiCocokPerkara("", NOMOR)).toBe(true);
    expect(isiCocokPerkara(NOMOR, NOMOR)).toBe(true);
    expect(isiCocokPerkara("012/Pdt.G/2026/PA.Dgl", NOMOR)).toBe(true);
    expect(isiCocokPerkara(NOMOR_LAIN, NOMOR)).toBe(false);
  });
});

describe("penyimpanan berkas", () => {
  const akar = mkdtempSync(path.join(process.env.TMP || process.env.TEMP || ".", "ptj-"));
  afterAll(() => rmSync(akar, { recursive: true, force: true }));

  it("ditulis di <akar>/<YYYYMM>/<id>.<ekstensi>, dibaca utuh, lalu dihapus", async () => {
    const jalur = await simpanBerkas("ptf-AbC123-9f", "docx", new Uint8Array([1, 2, 3]), { akar, kini: new Date(Date.UTC(2026, 9, 21)) });
    expect(jalur).toBe("202610/ptf-abc123-9f.docx");
    expect(jalurSah(jalur)).toBe(true);
    expect(Array.from((await bacaBerkas(jalur, akar)) ?? [])).toEqual([1, 2, 3]);
    expect(await hapusBerkas(jalur, akar)).toBe(true);
    expect(await bacaBerkas(jalur, akar)).toBeNull();
  });

  it("jalur dari luar bentuknya tidak pernah dibaca atau dihapus (tidak ada jalan keluar folder)", async () => {
    for (const jahat of ["../rahasia.rtf", "202610/../../x.rtf", "/etc/passwd", "202610/a.rtf", "202610\\x.rtf", "202610/ptf-abc123-9f.exe", ""]) {
      expect(jalurSah(jahat)).toBe(false);
      expect(await bacaBerkas(jahat, akar)).toBeNull();
      expect(await hapusBerkas(jahat, akar)).toBe(false);
    }
  });

  it("nama dari petugas TIDAK dipakai di cakram: hanya id dan ekstensi bentuk yang dikenali", async () => {
    const jalur = await simpanBerkas("ptf-xyz12345", "pdf", new Uint8Array([9]), { akar, kini: new Date(Date.UTC(2026, 9, 21)) });
    expect(jalur).toBe("202610/ptf-xyz12345.pdf");
    expect(jalur).not.toMatch(/aleta/i);
  });
});

// ─── 3. Layanan (pg-mem) ─────────────────────────────────────────────────────

vi.mock("@/server/modules/aleta-ecourt/hak-putusan", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-ecourt/hak-putusan")>();
  return { ...mod, pastikanMajelisPutusan: vi.fn(async () => undefined) };
});

import {
  buatJadwal,
  buangBerkasTahap,
  daftarJadwal,
  kelola,
  pratinjauJadwal,
  ringkasanFormBerkas,
  simpanPengaturan,
  tahapkanBerkas,
  type Pelaku,
} from "@/server/modules/putusan-terjadwal/layanan";
import { bacaPengaturan } from "@/server/modules/putusan-terjadwal/dasar";

const pelakuDari = (id: string, nama: string, peran: string): Pelaku =>
  ({ actor: { id, name: nama, roleId: peran, isActive: true }, peran }) as unknown as Pelaku;
const HAKIM = pelakuDari("usr-hakim-1", "Hakim Satu", "hakim");
const HAKIM_LAIN = pelakuDari("usr-hakim-2", "Hakim Dua", "hakim");
const ADMIN = pelakuDari("usr-admin-1", "Admin Uji", "admin");
const KETUA = pelakuDari("usr-ketua-1", "Ketua Uji", "ketua");

// Rabu 21 Okt 2026 06.00 WITA - sebelum jam kerja; jadwal pukul 09.00.
const KINI = new Date(witaKeMs("2026-10-21 06:00"));
const TIDAK_LIBUR = async () => (_iso: string) => false;
const AKUN_OK = async (_db: AletaDatabase, _id: string, diminta?: string) => ({ ok: true as const, username: diminta || "hakim.satu" });

describe("layanan jadwal atas basis data", () => {
  let db: AletaDatabase;
  const akar = mkdtempSync(path.join(process.env.TMP || process.env.TEMP || ".", "ptj-layanan-"));
  const deps = { sekarang: () => KINI, muatLibur: TIDAK_LIBUR, akunSipp: AKUN_OK };

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
    // Pengguna sungguhan untuk audit_logs.actor_user_id (berkunci asing ke users) - uji dengan id palsu lolos di sini, gagal di server.
    const peran = await db.queryOne<{ id: string }>("SELECT id FROM roles LIMIT 1");
    const jabatan = await db.queryOne<{ id: string }>("SELECT id FROM positions LIMIT 1");
    const sekarang = new Date().toISOString();
    for (const p of [HAKIM, HAKIM_LAIN, ADMIN, KETUA]) {
      await db.run(
        "INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, ?, ?, ?)",
        [p.actor.id, p.actor.id, p.actor.name, p.actor.id + "@uji.lokal", peran?.id ?? "", jabatan?.id ?? "", sekarang, sekarang]
      );
    }
  }, 180000);
  afterAll(async () => {
    await db?.close();
    rmSync(akar, { recursive: true, force: true });
  });

  const tahap = async (pelaku: Pelaku, baris: string[], nama = "putusan.rtf") => {
    const h = await tahapkanBerkas(db, pelaku, { nama, bita: rtf(baris) }, { sekarang: () => KINI, akar });
    if (!h.ok) throw new Error(h.sebab);
    return h.berkas;
  };
  let nomorBerikut = 100;
  const butirBaru = async (pelaku: Pelaku, opsi: { langkah?: Record<string, boolean>; tanpaBerkas?: boolean; nomorIsi?: string } = {}) => {
    const n = ++nomorBerikut;
    const nomor = `${n}/Pdt.G/2026/PA.Dgl`;
    const berkas = opsi.tanpaBerkas ? null : await tahap(pelaku, barisPutusan(opsi.nomorIsi ?? nomor), `putusan-${n}.rtf`);
    return {
      perkaraId: String(20000 + n),
      nomorPerkara: nomor,
      jenisPerkara: "Cerai Gugat",
      berkasId: berkas?.id,
      langkah: opsi.langkah ?? { isi: true, putusan: true, anonim: true },
    };
  };
  const jamMulai = "2026-10-21 09:00";
  const baris = async (sql: string, p: unknown[] = []) => db.queryAll<Record<string, unknown>>(sql, p as never[]);

  it("pratinjau memakai benih yang sama dengan jadwal sesungguhnya: jam pratinjau = jam tercatat", async () => {
    const pr = await pratinjauJadwal(db, { jumlah: 3, mulai: jamMulai, lintasHari: true }, deps);
    expect(pr.ok).toBe(true);
    const butir = await Promise.all([butirBaru(HAKIM), butirBaru(HAKIM), butirBaru(HAKIM)]);
    const h = await buatJadwal(db, HAKIM, "192.168.9.97", { mulai: jamMulai, lintasHari: true, benih: pr.benih, butir }, deps);
    expect(h.butir.map((b) => b.waktuIso)).toEqual(pr.butir.map((b) => b.iso));
  });

  it("menjadwalkan: jadwal + butir + berkas terpasang + jejak jujur + audit; atas akun SIPP penjadwal dan alamat peramban", async () => {
    const b = await butirBaru(HAKIM, { langkah: { isi: true, putusan: true, anonim: false } });
    const h = await buatJadwal(db, HAKIM, "192.168.9.97", { mulai: jamMulai, sumber: "perkara", akunSipp: "hakim.satu", butir: [b], catatan: "uji" }, deps);
    expect(h.akunSipp).toBe("hakim.satu");
    expect(h.butir).toHaveLength(1);
    expect(h.butir[0].langkah).toEqual(["Isi & simpan Putusan Akhir", "e-Doc putusan"]);
    expect(h.butir[0].waktuWita >= "2026-10-21 09:00" && h.butir[0].waktuWita < "2026-10-21 09:01").toBe(true);

    const [j] = await baris("SELECT * FROM aleta_putusan_jadwal WHERE id = ?", [h.jadwalId]);
    expect(j).toMatchObject({ dibuat_oleh: HAKIM.actor.id, akun_sipp: "hakim.satu", ip: "192.168.9.97", status: "aktif", peran: "hakim" });
    const [bt] = await baris("SELECT * FROM aleta_putusan_jadwal_butir WHERE jadwal_id = ?", [h.jadwalId]);
    expect(bt).toMatchObject({
      pemilik_id: HAKIM.actor.id,
      akun_sipp: "hakim.satu",
      status: "menunggu",
      status_isi: "menunggu",
      status_putusan: "menunggu",
      status_anonim: "tidak",
      langkah_anonim: 0,
    });
    const [bk] = await baris("SELECT dipakai_butir FROM aleta_putusan_jadwal_berkas WHERE id = ?", [b.berkasId]);
    expect(bk.dipakai_butir).toBe(bt.id);
    const jejak = await baris("SELECT * FROM aleta_putusan_jadwal_jejak WHERE jadwal_id = ? ORDER BY waktu", [h.jadwalId]);
    expect(jejak.map((x) => x.peristiwa)).toEqual(["dijadwalkan", "dijadwalkan"]);
    expect(String(jejak[0].pelaku)).toBe("pengguna: Hakim Satu");
    const audit = await baris("SELECT action, actor_user_id FROM audit_logs WHERE action = 'PUTUSAN_TERJADWAL_DIBUAT' AND entity_id = ?", [h.jadwalId]);
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_user_id).toBe(HAKIM.actor.id);
  });

  it("tanpa akun SIPP yang tertaut: ditolak, tidak ada satu baris pun tertulis", async () => {
    const b = await butirBaru(HAKIM);
    const sebelum = await baris("SELECT id FROM aleta_putusan_jadwal");
    await expect(
      buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, { ...deps, akunSipp: async () => ({ ok: false as const, pesan: "Akun ALETA Anda belum tertaut ke akun SIPP." }) })
    ).rejects.toThrow(/belum tertaut/);
    expect((await baris("SELECT id FROM aleta_putusan_jadwal")).length).toBe(sebelum.length);
  });

  it("nama tampil akun SIPP dicatat di jadwal dan butir; akun SIPP ganda ditolak dengan daftar pilihan (bukan ditebak)", async () => {
    const b = await butirBaru(HAKIM, { langkah: { isi: true } });
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, namaSipp: "  Hakim   Satu, S.H. ", butir: [b] }, deps);
    const [j] = await baris("SELECT nama_sipp FROM aleta_putusan_jadwal WHERE id = ?", [h.jadwalId]);
    const [bt] = await baris("SELECT nama_sipp FROM aleta_putusan_jadwal_butir WHERE jadwal_id = ?", [h.jadwalId]);
    expect(j.nama_sipp).toBe("Hakim Satu, S.H.");
    expect(bt.nama_sipp).toBe("Hakim Satu, S.H.");

    const lagi = await butirBaru(HAKIM, { langkah: { isi: true } });
    const ganda = async () => ({ ok: false as const, pesan: "Anda menyimpan 2 akun SIPP (a, b). Pilih akun yang dipakai.", kode: "akun_sipp_ganda", milik: ["a", "b"] });
    const galat = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [lagi] }, { ...deps, akunSipp: ganda }).catch((e) => e);
    expect(galat).toBeInstanceOf(ApiError);
    expect(galat.message).toMatch(/Pilih akun yang dipakai/);
    expect(galat.details).toEqual({ kode: "akun_sipp_ganda", milik: ["a", "b"] });
  });

  it("satu butir tidak sah menolak SELURUH jadwal (tanpa jadwal separuh jadi): berkas milik orang lain", async () => {
    const baik = await butirBaru(HAKIM);
    const milikLain = await butirBaru(HAKIM_LAIN);
    const sebelum = (await baris("SELECT id FROM aleta_putusan_jadwal")).length;
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [baik, milikLain] }, deps)).rejects.toThrow(/diunggah orang lain/);
    expect((await baris("SELECT id FROM aleta_putusan_jadwal")).length).toBe(sebelum);
    const [bk] = await baris("SELECT dipakai_butir FROM aleta_putusan_jadwal_berkas WHERE id = ?", [baik.berkasId]);
    expect(bk.dipakai_butir).toBe("");
  });

  it("berkas yang isinya menyebut perkara LAIN tidak dipasang (nama perkara disebut)", async () => {
    const salah = await butirBaru(HAKIM, { nomorIsi: NOMOR_LAIN });
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [salah] }, deps)).rejects.toThrow(/menyebut nomor 13\/Pdt\.G\/2026\/PA\.Dgl/);
  });

  it("e-Doc dipilih tanpa berkas, tanpa langkah sama sekali, perkara ganda, nomor tak terbaca: semuanya ditolak dengan kalimat awam", async () => {
    const tanpa = await butirBaru(HAKIM, { tanpaBerkas: true });
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [tanpa] }, deps)).rejects.toThrow(/berkas putusannya belum dipasang/);
    const kosong = await butirBaru(HAKIM, { langkah: {} });
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [kosong] }, deps)).rejects.toThrow(/belum ada langkah/);
    const a = await butirBaru(HAKIM);
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [a, { ...a }] }, deps)).rejects.toThrow(/terpilih dua kali/);
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [{ ...a, perkaraId: "abc" }] }, deps)).rejects.toThrow(/belum terbaca/);
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [] }, deps)).rejects.toThrow(/Belum ada perkara/);
  });

  it("perkara yang sudah dijadwalkan (menunggu) tidak dijadwalkan lagi; berkas yang sudah dipasang tidak dipakai dua kali", async () => {
    const b = await butirBaru(HAKIM);
    await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const lagi = { ...b };
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [lagi] }, deps)).rejects.toThrow(/sudah dijadwalkan/);
    const b2 = await butirBaru(HAKIM);
    const b3 = { ...(await butirBaru(HAKIM)), berkasId: b2.berkasId };
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b2, b3] }, deps)).rejects.toThrow(/Satu berkas tidak dapat dipasang ke dua perkara/);
  });

  it("hakim yang bukan majelis perkara itu ditolak (pagar kedua), pesan menyebut perkaranya, tidak ada yang tertulis", async () => {
    const { pastikanMajelisPutusan } = await import("@/server/modules/aleta-ecourt/hak-putusan");
    const b = await butirBaru(HAKIM);
    vi.mocked(pastikanMajelisPutusan).mockRejectedValueOnce(new ApiError(403, "Perkara ini bukan perkara majelis Anda."));
    const sebelum = (await baris("SELECT id FROM aleta_putusan_jadwal")).length;
    await expect(buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, { ...deps, periksaMilik: undefined })).rejects.toThrow(new RegExp(`${b.nomorPerkara.replace(/\//g, "\\/")}: Perkara ini bukan perkara majelis Anda`));
    expect((await baris("SELECT id FROM aleta_putusan_jadwal")).length).toBe(sebelum);
  });

  it("jam mulai yang sudah lewat ditolak; jadwal yang tidak muat di hari itu ditolak dengan sebab (tidak diam-diam digeser)", async () => {
    const b = await butirBaru(HAKIM);
    await expect(buatJadwal(db, HAKIM, "", { mulai: "2026-10-21 05:00", batasAkhir: "2026-10-21 05:30", butir: [b] }, deps)).rejects.toThrow();
    const banyak = await Promise.all(Array.from({ length: 8 }, () => butirBaru(HAKIM)));
    await expect(buatJadwal(db, HAKIM, "", { mulai: "2026-10-21 15:30", jedaMin: 300, jedaMaks: 300, butir: banyak }, deps)).rejects.toThrow(/muat di hari itu/);
    const sebelum = (await baris("SELECT id FROM aleta_putusan_jadwal")).length;
    const ok = await buatJadwal(db, HAKIM, "", { mulai: "2026-10-21 15:30", jedaMin: 300, jedaMaks: 300, lintasHari: true, butir: banyak }, deps);
    expect(ok.butir.some((x) => x.waktuWita.startsWith("2026-10-22"))).toBe(true);
    expect((await baris("SELECT id FROM aleta_putusan_jadwal")).length).toBe(sebelum + 1);
  });

  it("tanpa berkas boleh bila hanya mengisi Putusan Akhir (memakai draf ALETA terbaru)", async () => {
    const b = await butirBaru(HAKIM, { tanpaBerkas: true, langkah: { isi: true } });
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const [bt] = await baris("SELECT berkas_id, berkas_jalur, status_isi, status_putusan FROM aleta_putusan_jadwal_butir WHERE id = ?", [h.butir[0].id]);
    expect(bt).toMatchObject({ berkas_id: "", berkas_jalur: "", status_isi: "menunggu", status_putusan: "tidak" });
  });

  it("pilihan form hanya status putusan dan verstek; pilihan lain dibuang dan ringkasannya tampil di hasil", async () => {
    const b = { ...(await butirBaru(HAKIM)), pilihan: { statusPutusan: "Dikabulkan", verstek: "y", rahasia: "x" } };
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    expect(h.butir[0].ringkasForm).toBe("Status putusan: Dikabulkan · Verstek: ya");
    const [bt] = await baris("SELECT pilihan_json FROM aleta_putusan_jadwal_butir WHERE id = ?", [h.butir[0].id]);
    expect(JSON.parse(String(bt.pilihan_json))).toEqual({ statusPutusan: "Dikabulkan", verstek: "Y" });
  });

  it("ringkasan pilihan form: status putusan dan verstek diperkirakan dari AMAR dengan aturan Putusan Otomatis; berkas orang lain tidak dibaca", async () => {
    const naskah = (amar: string[]) => [
      ...barisPutusan(`${900}/Pdt.G/2026/PA.Dgl`).slice(0, 13),
      "MENGADILI:",
      ...amar,
      "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
    ];
    const verstek = await tahap(HAKIM, naskah(["1. Mengabulkan gugatan Penggugat secara verstek;", "2. Menjatuhkan talak satu ba'in sughra Tergugat terhadap Penggugat;"]), "verstek.rtf");
    const tolak = await tahap(HAKIM, naskah(["1. Menolak gugatan Penggugat seluruhnya;"]), "tolak.rtf");
    const r = await ringkasanFormBerkas(db, HAKIM, [{ berkasId: verstek.id, jenisPerkara: "Cerai Gugat" }, { berkasId: tolak.id, jenisPerkara: "Cerai Gugat" }], {
      akar,
      statusNama: async () => ["Dikabulkan", "Ditolak", "Tidak Diterima", "Dicabut"],
    });
    expect(r.statusTersedia).toEqual(["Dikabulkan", "Ditolak", "Tidak Diterima", "Dicabut"]);
    expect(r.ringkasan[verstek.id]).toMatchObject({ ada: true, status: { label: "Dikabulkan" }, verstek: { label: "Ya" } });
    expect(r.ringkasan[tolak.id]).toMatchObject({ ada: true, status: { label: "Ditolak" } });
    expect(r.ringkasan[tolak.id].verstek?.label).not.toBe("Ya");
    // Milik orang lain dan berkas yang tidak ada: tidak dibaca, sebabnya disebut.
    const lain = await r2(HAKIM_LAIN);
    const orang = await ringkasanFormBerkas(db, HAKIM, [{ berkasId: lain.id }, { berkasId: "tidak-ada" }], { akar, statusNama: async () => [] });
    expect(orang.ringkasan[lain.id]).toMatchObject({ ada: false, sebab: expect.stringMatching(/bukan milik Anda/) });
    expect(orang.ringkasan["tidak-ada"]).toMatchObject({ ada: false, sebab: expect.stringMatching(/tidak ditemukan/) });
    // Status putusan satker tak terbaca (bot mati): ringkasan tetap tersusun, status kosong dan jujur.
    const tanpaDaftar = await ringkasanFormBerkas(db, HAKIM, [{ berkasId: verstek.id }], { akar, statusNama: async () => { throw new Error("bot mati"); } });
    expect(tanpaDaftar.statusTersedia).toEqual([]);
    expect(tanpaDaftar.ringkasan[verstek.id].ada).toBe(true);
  });
  const r2 = (pelaku: Pelaku) => tahap(pelaku, barisPutusan("902/Pdt.G/2026/PA.Dgl"), "lain.rtf");

  // ── Berkas tahap ──
  it("berkas tahap: hanya pemiliknya yang dapat membuang; yang sudah dipasang tidak dapat dibuang; berkas ditolak tidak tersimpan", async () => {
    const tahapan = await tahap(HAKIM, barisPutusan("501/Pdt.G/2026/PA.Dgl"));
    await expect(buangBerkasTahap(db, HAKIM_LAIN, tahapan.id, { akar })).rejects.toThrow(/bukan milik Anda/);
    expect((await buangBerkasTahap(db, HAKIM, tahapan.id, { akar, sekarang: () => KINI })).ok).toBe(true);
    const [b] = await baris("SELECT jalur, dihapus_pada FROM aleta_putusan_jadwal_berkas WHERE id = ?", [tahapan.id]);
    expect(b.jalur).toBe("");
    expect(b.dihapus_pada).not.toBe("");

    const dipakai = await butirBaru(HAKIM);
    await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [dipakai] }, deps);
    const r = await buangBerkasTahap(db, HAKIM, dipakai.berkasId as string, { akar });
    expect(r.ok).toBe(false);

    const sebelum = (await baris("SELECT id FROM aleta_putusan_jadwal_berkas")).length;
    const ditolak = await tahapkanBerkas(db, HAKIM, { nama: "bas.rtf", bita: rtf(BARIS_BAS) }, { sekarang: () => KINI, akar });
    expect(ditolak.ok).toBe(false);
    expect((await baris("SELECT id FROM aleta_putusan_jadwal_berkas")).length).toBe(sebelum);
  });

  // ── Daftar dan kelola ──
  it("daftar: milik sendiri; pengawas (Ketua/Admin) dapat semua dengan semua=1; hakim lain tidak melihat milik orang", async () => {
    const b = await butirBaru(HAKIM_LAIN);
    await buatJadwal(db, HAKIM_LAIN, "", { mulai: jamMulai, butir: [b] }, { ...deps, akunSipp: async () => ({ ok: true as const, username: "hakim.dua" }) });
    const milikSatu = await daftarJadwal(db, HAKIM, {}, { sekarang: () => KINI });
    expect(milikSatu.jadwal.every((j) => j.dibuatNama === "Hakim Satu")).toBe(true);
    expect(milikSatu.jadwal.flatMap((j) => j.butir.map((x) => x.nomorPerkara))).not.toContain(b.nomorPerkara);
    const hakimLainPaksaSemua = await daftarJadwal(db, HAKIM_LAIN, { semua: true }, { sekarang: () => KINI });
    expect(hakimLainPaksaSemua.jadwal.every((j) => j.dibuatNama === "Hakim Dua")).toBe(true);
    const semua = await daftarJadwal(db, KETUA, { semua: true }, { sekarang: () => KINI });
    expect(semua.jadwal.flatMap((j) => j.butir.map((x) => x.nomorPerkara))).toContain(b.nomorPerkara);
    expect(semua.ringkasan.menunggu).toBeGreaterThan(0);
    // Sebutan untuk petugas: WITA, bukan UTC.
    const t = semua.jadwal[0].butir[0];
    expect(t.waktuWita).toBe(msKeWita(Date.parse(t.waktuIso)).slice(0, 16));
    expect(t.waktuSebut).toMatch(/WITA|pukul/);
  });

  it("kelola: batal butir menunggu -> dibatalkan, berkas dijadwalkan hapus; batal oleh orang lain ditolak; Admin boleh", async () => {
    const b = await butirBaru(HAKIM);
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const id = h.butir[0].id;
    await expect(kelola(db, HAKIM_LAIN, { aksi: "batal", id }, deps)).rejects.toThrow(/bukan milik Anda/);
    const r = await kelola(db, ADMIN, { aksi: "batal", id }, deps);
    expect(r.ringkas).toMatch(/dibatalkan/);
    const [bt] = await baris("SELECT status, status_isi, status_putusan, status_anonim, berkas_hapus_pada, selesai_pada FROM aleta_putusan_jadwal_butir WHERE id = ?", [id]);
    expect(bt).toMatchObject({ status: "dibatalkan", status_isi: "batal", status_putusan: "batal", status_anonim: "batal" });
    expect(bt.berkas_hapus_pada).not.toBe("");
    await expect(kelola(db, HAKIM, { aksi: "batal", id }, deps)).rejects.toThrow(/sudah dibatalkan|tidak dapat dibatalkan/);
    const jejak = await baris("SELECT pelaku FROM aleta_putusan_jadwal_jejak WHERE butir_id = ? AND peristiwa = 'dibatalkan'", [id]);
    expect(jejak[0].pelaku).toBe("pengguna: Admin Uji");
  });

  it("kelola: butir yang sedang dikerjakan tidak dapat dibatalkan; setelah masa pegang habis dapat", async () => {
    const b = await butirBaru(HAKIM);
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const id = h.butir[0].id;
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'jalan', status_isi = 'jalan', klaim_oleh = 'server', klaim_sampai = ? WHERE id = ?", [new Date(KINI.getTime() + 600_000).toISOString(), id]);
    await expect(kelola(db, HAKIM, { aksi: "batal", id }, deps)).rejects.toThrow(/sedang dikerjakan/);
    await db.run("UPDATE aleta_putusan_jadwal_butir SET klaim_sampai = ? WHERE id = ?", [new Date(KINI.getTime() - 1000).toISOString(), id]);
    expect((await kelola(db, HAKIM, { aksi: "batal", id }, deps)).ringkas).toMatch(/dibatalkan/);
  });

  it("kelola: batal-jadwal membatalkan semua yang menunggu; tunda menggeser ke dalam jam kerja; ubah jam ke malam ditolak", async () => {
    const dua = [await butirBaru(HAKIM), await butirBaru(HAKIM)];
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: dua }, deps);
    const [x, y] = h.butir;
    const t = await kelola(db, HAKIM, { aksi: "tunda", id: x.id, menit: 90 }, deps);
    expect(t.ringkas).toMatch(/dipindah/);
    const [bx] = await baris("SELECT waktu_rencana FROM aleta_putusan_jadwal_butir WHERE id = ?", [x.id]);
    expect(Date.parse(String(bx.waktu_rencana))).toBeGreaterThan(Date.parse(x.waktuIso) + 80 * 60_000);
    await expect(kelola(db, HAKIM, { aksi: "jadwal-ulang", id: y.id, wita: "2026-10-21 21:30" }, deps)).rejects.toThrow(/di luar jam kerja/);
    await expect(kelola(db, HAKIM, { aksi: "jadwal-ulang", id: y.id, wita: "2026-10-21 05:30" }, deps)).rejects.toThrow();
    const ulang = await kelola(db, HAKIM, { aksi: "jadwal-ulang", id: y.id, wita: "2026-10-21 14:20" }, deps);
    expect(ulang.ringkas).toMatch(/Rabu, 21 Oktober 2026 pukul 14\.20/);
    // Tunda yang jatuh malam digeser ke pagi berikutnya, bukan ditaruh malam hari.
    await kelola(db, HAKIM, { aksi: "tunda", id: y.id, menit: 600 }, deps);
    const [by] = await baris("SELECT waktu_rencana FROM aleta_putusan_jadwal_butir WHERE id = ?", [y.id]);
    expect(msKeWita(Date.parse(String(by.waktu_rencana))).slice(0, 10)).toBe("2026-10-22");
    expect(msKeWita(Date.parse(String(by.waktu_rencana))).slice(11, 16) >= "07:30").toBe(true);
    const semua = await kelola(db, HAKIM, { aksi: "batal-jadwal", id: h.jadwalId }, deps);
    expect(semua.ringkas).toMatch(/2 perkara dibatalkan/);
    const [j] = await baris("SELECT status FROM aleta_putusan_jadwal WHERE id = ?", [h.jadwalId]);
    expect(j.status).toBe("dibatalkan");
  });

  it("kelola: ulang mengembalikan langkah gagal/tertahan ke menunggu (yang selesai tetap), berkas yang sudah dihapus tidak dapat diulang", async () => {
    const b = await butirBaru(HAKIM, { langkah: { putusan: true, anonim: true } });
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const id = h.butir[0].id;
    await db.run(
      "UPDATE aleta_putusan_jadwal_butir SET status = 'sebagian', status_putusan = 'selesai', status_anonim = 'tertahan', catatan_anonim = 'masih ada data pribadi', selesai_pada = ? WHERE id = ?",
      [KINI.toISOString(), id]
    );
    const r = await kelola(db, HAKIM, { aksi: "ulang", id }, deps);
    expect(r.ringkas).toMatch(/1 langkah/);
    const [bt] = await baris("SELECT status, status_putusan, status_anonim, selesai_pada, percobaan FROM aleta_putusan_jadwal_butir WHERE id = ?", [id]);
    expect(bt).toMatchObject({ status: "menunggu", status_putusan: "selesai", status_anonim: "menunggu", selesai_pada: "", percobaan: 0 });
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'gagal', status_anonim = 'gagal', berkas_jalur = '' WHERE id = ?", [id]);
    await expect(kelola(db, HAKIM, { aksi: "ulang", id }, deps)).rejects.toThrow(/sudah dihapus dari penyimpanan/);
  });

  it("kelola: lihat menandai sudah dilihat (lencana notifikasi berkurang)", async () => {
    const b = await butirBaru(HAKIM, { langkah: { putusan: true } });
    const h = await buatJadwal(db, HAKIM, "", { mulai: jamMulai, butir: [b] }, deps);
    const id = h.butir[0].id;
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'selesai', status_putusan = 'selesai', selesai_pada = ? WHERE id = ?", [KINI.toISOString(), id]);
    const sebelum = (await daftarJadwal(db, HAKIM, {}, { sekarang: () => KINI })).ringkasan.belumDilihat;
    expect(sebelum).toBeGreaterThan(0);
    await kelola(db, HAKIM, { aksi: "lihat", id }, deps);
    expect((await daftarJadwal(db, HAKIM, {}, { sekarang: () => KINI })).ringkasan.belumDilihat).toBe(sebelum - 1);
  });

  it("pengaturan: hanya Admin/Super Admin yang mengubah; nilai dibatasi; tercatat di jejak dan audit", async () => {
    await expect(simpanPengaturan(db, HAKIM, { hapusHari: 3 })).rejects.toThrow(/Hanya Super Admin dan Admin/);
    expect((await bacaPengaturan(db)).hapusHari).toBe(7);
    const baru = await simpanPengaturan(db, ADMIN, { hapusHari: 14, pelaksanaNyala: false });
    expect(baru).toMatchObject({ hapusHari: 14, pelaksanaNyala: false, diubahOleh: "Admin Uji" });
    expect((await bacaPengaturan(db)).pelaksanaNyala).toBe(false);
    await expect(simpanPengaturan(db, ADMIN, { hapusHari: 0 })).rejects.toThrow(/1-90 hari/);
    await expect(simpanPengaturan(db, ADMIN, { hapusHari: 91 })).rejects.toThrow(/1-90 hari/);
    await simpanPengaturan(db, ADMIN, { hapusHari: 7, pelaksanaNyala: true });
    const audit = await baris("SELECT action FROM audit_logs WHERE action = 'PUTUSAN_TERJADWAL_PENGATURAN'");
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});
