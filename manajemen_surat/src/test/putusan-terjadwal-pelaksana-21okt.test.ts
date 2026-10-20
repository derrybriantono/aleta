// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BATAS, witaKeMs } from "@/lib/putusan-terjadwal";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

import { NOMOR_LAIN, PENGGUGAT, TERGUGAT, barisPutusan, buatDocx, rtf } from "./putusan-terjadwal-bahan";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL - PELAKSANA SERVER DAN SISI PERAMBAN (21 Okt 2026, agen B3)
 * ============================================================================
 *
 * Menjalankan pelaksana e-Doc dan layanan peramban atas basis data pg-mem dengan SIPP/bot TIRUAN
 * yang menjaga keadaannya sendiri (e-Doc yang sudah diunggah muncul di cek berikutnya). Yang dijaga:
 *
 *   - urutan pengaman: hak -> kunci -> cek SIPP -> berkas utuh -> pemeriksaan isi -> SATU kiriman ->
 *     bukti dari SIPP -> kunci dilepas (juga saat gagal);
 *   - tidak menimpa: e-Doc yang sudah ada dilewati; cek gagal = tidak mengunggah apa pun;
 *   - gagal satu langkah / satu perkara tidak membatalkan yang lain;
 *   - jendela jam kerja, jeda antar perkara, satu butir per detak;
 *   - jeda manusiawi e-Doc sesudah pengisian dari peramban, dan seluruh alur peramban -> server.
 */

vi.mock("@/server/modules/aleta-ecourt/hak-putusan", async (asli) => {
  const mod = await asli<typeof import("@/server/modules/aleta-ecourt/hak-putusan")>();
  return { ...mod, pastikanMajelisPutusan: vi.fn(async () => undefined) };
});

import { bacaPengaturan } from "@/server/modules/putusan-terjadwal/dasar";
import { buatJadwal, kelola, tahapkanBerkas, type Pelaku } from "@/server/modules/putusan-terjadwal/layanan";
import {
  bersihkanBerkas,
  detakPelaksana,
  jalankanEdocButir,
  kedaluwarsakan,
  pulihkanMacet,
  type DepsPelaksana,
} from "@/server/modules/putusan-terjadwal/pelaksana";
import { giliranPeramban, klaimPeramban, laporPeramban, lepasPeramban, siapkanDraf } from "@/server/modules/putusan-terjadwal/peramban";

const pelaku = (id: string, nama: string, peran: string): Pelaku => ({ actor: { id, name: nama, roleId: peran, isActive: true }, peran }) as unknown as Pelaku;
const HAKIM = pelaku("usr-pl-hakim", "Hakim Satu", "hakim");
const HAKIM_LAIN = pelaku("usr-pl-hakim2", "Hakim Dua", "hakim");

// Rabu 21 Okt 2026.
const wita = (t: string) => new Date(witaKeMs(t));
let JAM = wita("2026-10-21 09:00");
const AKAR = mkdtempSync(path.join(process.env.TMP || process.env.TEMP || ".", "ptj-pelaksana-"));

type KeadaanSipp = { adaBaris: boolean; putusan: boolean; anonim: boolean };
type Rekam = { urut: string[]; unggah: Array<Record<string, unknown>>; kunciDilepas: number };

/** SIPP/bot tiruan dengan keadaan sendiri. */
function buatDunia(o: Partial<{
  sipp: KeadaanSipp;
  kunciSibuk: boolean;
  cekGagal: boolean;
  bacaCekSesudahGagal: boolean;
  userAktif: boolean;
  peran: string;
  milikDitolak: boolean;
  unggahMelempar: boolean;
  botTolakAnonim: boolean;
  botTidakMenulis: boolean;
  sisa: Array<{ jenis: string; kata: string; konteks: string }>;
  penyamarGagal: boolean;
  anonimBocor: boolean;
  ubahGagal: boolean;
  namaPihakTakTerbaca: boolean;
  berkas: Map<string, Uint8Array>;
}> = {}) {
  const sipp: KeadaanSipp = o.sipp ?? { adaBaris: true, putusan: false, anonim: false };
  const rekam: Rekam = { urut: [], unggah: [], kunciDilepas: 0 };
  const berkas = o.berkas ?? new Map<string, Uint8Array>();
  let cekKe = 0;
  const deps: DepsPelaksana = {
    sekarang: () => JAM,
    acak: () => 0.5,
    bacaBerkas: async (jalur) => berkas.get(jalur) ?? null,
    hapusBerkas: async (jalur) => {
      rekam.urut.push(`hapus:${jalur}`);
      return berkas.delete(jalur);
    },
    muatPengguna: async (_db, id) => (o.userAktif === false ? { id, name: "Nonaktif", isActive: false } : { id, name: id === HAKIM.actor.id ? "Hakim Satu" : "Hakim Dua", roleId: o.peran ?? "hakim", isActive: true }),
    periksaMilik: async () => {
      rekam.urut.push("milik");
      if (o.milikDitolak) throw new ApiError(403, "Perkara ini bukan perkara majelis Anda.");
    },
    ambilKunci: async () => {
      rekam.urut.push("kunci");
      return o.kunciSibuk ? { ok: false, alasan: "sedang_dikerjakan", oleh: "Panitera Uji" } : { ok: true, token: "tok-1" };
    },
    lepasKunci: async () => {
      rekam.urut.push("lepas");
      rekam.kunciDilepas += 1;
    },
    cekSlot: async () => {
      cekKe += 1;
      rekam.urut.push("cek");
      if (o.cekGagal && !(o.bacaCekSesudahGagal && cekKe > 1)) return { ok: false, sebab: "SIPP belum dapat dibaca." };
      return { ok: true, adaBaris: sipp.adaBaris, adaPutusan: sipp.putusan, adaAnonim: sipp.anonim };
    },
    konteksPihak: async () => {
      rekam.urut.push("konteks");
      return o.namaPihakTakTerbaca ? { namaPihak: null, sebab: "SIPP tidak terbaca" } : { namaPihak: [PENGGUGAT, TERGUGAT], sebab: "" };
    },
    ubahKeRtf: async () => {
      rekam.urut.push("ubah-rtf");
      return o.ubahGagal ? { ok: false, sebab: "soffice tidak ada" } : { ok: true, bita: rtf(barisPutusan(undefined)) };
    },
    anonimkan: async (masukan, nomor) => {
      rekam.urut.push("anonimkan");
      if (o.penyamarGagal) return { ok: false, sebab: "Data para pihak di SIPP belum terbaca (timeout)." };
      // Penyamar sungguhan menyamarkan NASKAH YANG DIA TERIMA: bila naskahnya milik perkara lain, anonimisasinya pun.
      const nomorNaskah = Buffer.from(masukan).toString("latin1").includes(NOMOR_LAIN) ? NOMOR_LAIN : nomor;
      return { ok: true, bita: rtf(barisPutusan(nomorNaskah, { anonim: !o.anonimBocor })), sisa: o.sisa ?? [] };
    },
    unggah: async (m) => {
      rekam.urut.push("unggah");
      rekam.unggah.push(m as unknown as Record<string, unknown>);
      if (o.unggahMelempar) throw new Error("jaringan putus");
      const hasil: Array<{ jenis: string; ok: boolean; alasan?: string; pesan?: string }> = [];
      if (m.putusan) {
        hasil.push({ jenis: "putusan", ok: true });
        if (!o.botTidakMenulis) sipp.putusan = true;
      }
      if (m.anonimisasi) {
        if (o.botTolakAnonim) hasil.push({ jenis: "anonimisasi", ok: false, alasan: "tulis_gagal", pesan: "folder anonimisasi tidak dapat ditulis" });
        else {
          hasil.push({ jenis: "anonimisasi", ok: true });
          if (!o.botTidakMenulis) sipp.anonim = true;
        }
      }
      return { ok: hasil.some((x) => x.ok), berkas: hasil };
    },
    muatLibur: async () => () => false,
  };
  return { deps, sipp, rekam, berkas };
}

describe("pelaksana e-Doc dan sisi peramban (pg-mem)", () => {
  let db: AletaDatabase;
  const baris = async (sql: string, p: unknown[] = []) => db.queryAll<Record<string, unknown>>(sql, p as never[]);
  let n = 300;

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
    const peran = await db.queryOne<{ id: string }>("SELECT id FROM roles LIMIT 1");
    const jabatan = await db.queryOne<{ id: string }>("SELECT id FROM positions LIMIT 1");
    const sekarang = new Date().toISOString();
    for (const p of [HAKIM, HAKIM_LAIN]) {
      await db.run(
        "INSERT INTO users (id, username, password_hash, name, email, whatsapp_number, role_id, position_id, created_at, updated_at) VALUES (?, ?, 'x', ?, ?, '0', ?, ?, ?, ?)",
        [p.actor.id, p.actor.id, p.actor.name, p.actor.id + "@uji.lokal", peran?.id ?? "", jabatan?.id ?? "", sekarang, sekarang]
      );
    }
  }, 180000);
  afterAll(async () => {
    await db?.close();
    rmSync(AKAR, { recursive: true, force: true });
  });
  beforeEach(async () => {
    JAM = wita("2026-10-21 09:00");
    // Setiap uji mulai dari antrean bersih supaya detak memilih butir milik ujinya sendiri.
    await db.run("DELETE FROM aleta_putusan_jadwal_butir");
    await db.run("DELETE FROM aleta_putusan_jadwal");
    await db.run("DELETE FROM aleta_putusan_jadwal_berkas");
    await db.run("DELETE FROM aleta_putusan_jadwal_jejak");
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE kunci = 'sistem:putusan-terjadwal'");
  });

  const depsLayanan = { sekarang: () => wita("2026-10-21 06:00"), muatLibur: async () => (_iso: string) => false, akunSipp: async () => ({ ok: true as const, username: "hakim.satu" }) };

  /** Menjadwalkan satu perkara; berkas disimpan sungguhan di folder uji dan disalin ke dunia tiruan. */
  async function jadwalkan(
    dunia: ReturnType<typeof buatDunia>,
    o: { langkah?: Record<string, boolean>; pemilik?: Pelaku; mulai?: string; bita?: Uint8Array | ((nomor: string) => Uint8Array); nama?: string; jedaMin?: number; tanpaBerkas?: boolean } = {}
  ) {
    const id = ++n;
    const nomor = `${id}/Pdt.G/2026/PA.Dgl`;
    const pem = o.pemilik ?? HAKIM;
    let berkasId: string | undefined;
    if (!o.tanpaBerkas) {
      const bita = typeof o.bita === "function" ? o.bita(nomor) : (o.bita ?? rtf(barisPutusan(nomor)));
      const h = await tahapkanBerkas(db, pem, { nama: o.nama ?? `putusan-${id}.rtf`, bita }, { sekarang: () => wita("2026-10-21 06:00"), akar: AKAR });
      if (!h.ok) throw new Error(h.sebab);
      berkasId = h.berkas.id;
      const baru = await db.queryOne<{ jalur: string }>("SELECT jalur FROM aleta_putusan_jadwal_berkas WHERE id = ?", [berkasId]);
      dunia.berkas.set(baru!.jalur, bita);
    }
    const hasil = await buatJadwal(
      db,
      pem,
      "192.168.9.97",
      {
        mulai: o.mulai ?? "2026-10-21 08:00",
        jedaMin: o.jedaMin ?? 120,
        lintasHari: true,
        butir: [{ perkaraId: String(30000 + id), nomorPerkara: nomor, jenisPerkara: "Cerai Gugat", berkasId, langkah: o.langkah ?? { putusan: true, anonim: true } }],
      },
      depsLayanan
    );
    return { butirId: hasil.butir[0].id, nomor, perkaraId: String(30000 + id), jadwalId: hasil.jadwalId };
  }
  const butir = async (id: string) => (await baris("SELECT * FROM aleta_putusan_jadwal_butir WHERE id = ?", [id]))[0];

  // ── Alur normal ──
  it("alur normal: urutan pengaman, SATU kiriman, bukti dari SIPP, butir selesai, jejak 'pelaksana server', berkas dijadwalkan hapus", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    const h = await detakPelaksana(db, dunia.deps);
    expect(h).toMatchObject({ jalan: true, butirId: j.butirId, status: "selesai" });
    expect(dunia.rekam.urut).toEqual(["milik", "kunci", "cek", "konteks", "anonimkan", "unggah", "cek", "lepas"]);
    expect(dunia.rekam.unggah).toHaveLength(1);
    const m = dunia.rekam.unggah[0];
    expect(m).toMatchObject({ perkaraId: j.perkaraId, nomorPerkara: j.nomor, olehUsername: "hakim.satu", operator: "Hakim Satu", peranPenekan: "hakim", ip: "192.168.9.97" });
    expect(m.putusan).toBeInstanceOf(Uint8Array);
    expect(m.anonimisasi).toBeInstanceOf(Uint8Array);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "selesai", status_putusan: "selesai", status_anonim: "selesai", klaim_oleh: "", percobaan: 0 });
    expect(String(b.catatan_putusan)).toMatch(/terbukti ada di SIPP/);
    expect(Date.parse(String(b.selesai_pada))).toBe(JAM.getTime());
    expect(Date.parse(String(b.berkas_hapus_pada))).toBe(JAM.getTime() + 7 * 24 * 3600_000);
    const [jadwal] = await baris("SELECT status FROM aleta_putusan_jadwal WHERE id = ?", [j.jadwalId]);
    expect(jadwal.status).toBe("selesai");
    const jejak = await baris("SELECT peristiwa, pelaku, hasil FROM aleta_putusan_jadwal_jejak WHERE butir_id = ? ORDER BY waktu, peristiwa", [j.butirId]);
    const peristiwa = jejak.map((x) => x.peristiwa);
    expect(peristiwa).toEqual(expect.arrayContaining(["dijadwalkan", "dimulai", "edoc-putusan", "edoc-anonim", "butir-selesai"]));
    for (const x of jejak.filter((y) => y.peristiwa !== "dijadwalkan")) expect(x.pelaku).toBe("pelaksana server");
    const audit = await baris("SELECT actor_user_id FROM audit_logs WHERE action = 'PUTUSAN_TERJADWAL_BUTIR_SELESAI' AND entity_id = ?", [j.butirId]);
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_user_id).toBe(HAKIM.actor.id);
  });

  it("tidak ada kata ALETA yang dikirim ke jalur tulis SIPP (akun, operator-untuk-SIPP, nomor, berkas)", async () => {
    const dunia = buatDunia();
    await jadwalkan(dunia, { nama: "Aleta putusan akhir.rtf" });
    await detakPelaksana(db, dunia.deps);
    const m = dunia.rekam.unggah[0];
    for (const [k, v] of Object.entries(m)) {
      if (v instanceof Uint8Array) expect(Buffer.from(v).toString("latin1")).not.toMatch(/aleta/i);
      else if (k !== "operator") expect(String(v)).not.toMatch(/aleta/i);
    }
  });

  it("bukan waktunya / di luar jendela kerja / akhir pekan / sedang dalam jeda: tidak dikerjakan", async () => {
    const dunia = buatDunia();
    await jadwalkan(dunia, { mulai: "2026-10-21 10:00" });
    JAM = wita("2026-10-21 09:30");
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    await db.run("UPDATE aleta_putusan_jadwal_butir SET waktu_rencana = ?", [wita("2026-10-21 09:00").toISOString()]);
    JAM = wita("2026-10-21 12:30");
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    JAM = wita("2026-10-21 21:00");
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    JAM = wita("2026-10-24 09:00");
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    expect(dunia.rekam.unggah).toHaveLength(0);
    JAM = wita("2026-10-21 13:30");
    expect((await detakPelaksana(db, dunia.deps)).jalan).toBe(true);
  });

  it("satu butir per detak, berurutan menurut waktu rencana, dengan jeda minimum dari butir yang baru selesai", async () => {
    const dunia = buatDunia();
    const a = await jadwalkan(dunia, { mulai: "2026-10-21 08:00" });
    const b = await jadwalkan(dunia, { mulai: "2026-10-21 08:01" });
    await db.run("UPDATE aleta_putusan_jadwal_butir SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-21 08:00").toISOString(), a.butirId]);
    await db.run("UPDATE aleta_putusan_jadwal_butir SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-21 08:01").toISOString(), b.butirId]);
    JAM = wita("2026-10-21 09:00");
    const h1 = await detakPelaksana(db, dunia.deps);
    expect(h1).toMatchObject({ jalan: true, butirId: a.butirId });
    // Detak berikutnya 20 detik kemudian: butir kedua jatuh tempo tetapi jeda minimum (120 dtk) belum lewat.
    JAM = new Date(JAM.getTime() + 20_000);
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    JAM = new Date(JAM.getTime() + 130_000);
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: true, butirId: b.butirId, status: "selesai" });
  });

  // ── Tidak menimpa ──
  it("e-Doc yang SUDAH ada dilewati dan tidak pernah diganti; dua-duanya ada = tidak ada kiriman sama sekali", async () => {
    const dunia = buatDunia({ sipp: { adaBaris: true, putusan: true, anonim: false } });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.unggah).toHaveLength(1);
    expect(dunia.rekam.unggah[0].putusan).toBeUndefined();
    expect(dunia.rekam.unggah[0].anonimisasi).toBeInstanceOf(Uint8Array);
    expect(await butir(j.butirId)).toMatchObject({ status_putusan: "dilewati", status_anonim: "selesai", status: "selesai" });

    const dunia2 = buatDunia({ sipp: { adaBaris: true, putusan: true, anonim: true } });
    const j2 = await jadwalkan(dunia2);
    JAM = new Date(JAM.getTime() + 600_000);
    await detakPelaksana(db, dunia2.deps);
    expect(dunia2.rekam.unggah).toHaveLength(0);
    expect(dunia2.rekam.urut).not.toContain("anonimkan");
    expect(await butir(j2.butirId)).toMatchObject({ status_putusan: "dilewati", status_anonim: "dilewati", status: "selesai" });
  });

  it("cek SIPP gagal = TIDAK mengunggah apa pun; ditunda, dihitung, dan gagal setelah batas percobaan", async () => {
    const dunia = buatDunia({ cekGagal: true });
    const j = await jadwalkan(dunia);
    for (let i = 1; i <= BATAS.percobaanMaks; i += 1) {
      const h = await detakPelaksana(db, dunia.deps);
      expect(h.jalan).toBe(true);
      const b = await butir(j.butirId);
      expect(b.percobaan).toBe(i);
      if (i < BATAS.percobaanMaks) {
        expect(b).toMatchObject({ status: "menunggu", status_putusan: "menunggu" });
        expect(Date.parse(String(b.tunggu_sampai))).toBe(JAM.getTime() + 180_000);
        // Sebelum tunggu_sampai: tidak dikerjakan lagi.
        expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
        JAM = new Date(JAM.getTime() + 181_000);
      }
    }
    expect(dunia.rekam.unggah).toHaveLength(0);
    const akhir = await butir(j.butirId);
    expect(akhir).toMatchObject({ status: "gagal", status_putusan: "gagal", status_anonim: "gagal" });
    expect(String(akhir.catatan_putusan)).toMatch(/Gagal setelah 4 percobaan.*tidak ada yang diunggah supaya tidak menimpa/);
  });

  it("Putusan Akhir belum terisi di SIPP: e-Doc ditunda (bukan diunggah), lalu berjalan begitu putusan terisi", async () => {
    const dunia = buatDunia({ sipp: { adaBaris: false, putusan: false, anonim: false } });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.unggah).toHaveLength(0);
    expect(await butir(j.butirId)).toMatchObject({ status: "menunggu", status_putusan: "menunggu" });
    expect(String((await butir(j.butirId)).catatan_putusan)).toMatch(/Putusan Akhir belum terisi di SIPP/);
    dunia.sipp.adaBaris = true;
    JAM = new Date(JAM.getTime() + 301_000);
    expect((await detakPelaksana(db, dunia.deps)).jalan).toBe(true);
    expect(await butir(j.butirId)).toMatchObject({ status: "selesai" });
  });

  // ── Kunci ──
  it("perkara dikerjakan pekerjaan lain (kunci sibuk): ditunda, tidak cek, tidak unggah, kunci tidak dilepas (bukan miliknya)", async () => {
    const dunia = buatDunia({ kunciSibuk: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.urut).toEqual(["milik", "kunci"]);
    expect(await butir(j.butirId)).toMatchObject({ status: "menunggu", percobaan: 1 });
    expect(String((await butir(j.butirId)).catatan_putusan)).toMatch(/sedang dikerjakan oleh Panitera Uji/);
  });

  it("kunci selalu dilepas, juga saat pengunggahan melempar galat; butir gagal dengan sebab, bukan menggantung", async () => {
    const dunia = buatDunia({ unggahMelempar: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.kunciDilepas).toBe(1);
    expect(dunia.rekam.urut.at(-1)).toBe("lepas");
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "gagal", status_putusan: "gagal", klaim_oleh: "" });
    expect(String(b.catatan_putusan)).toMatch(/Error tak terduga: jaringan putus/);
  });

  // ── Hak ──
  it("akun pemilik nonaktif / peran tak berhak / bukan majelis perkara: gagal tanpa kunci dan tanpa kiriman", async () => {
    for (const [opsi, pola] of [
      [{ userAktif: false }, /nonaktif/],
      [{ peran: "panitera-pengganti" }, /hanya untuk Hakim, Admin, dan Super Admin/],
      [{ milikDitolak: true }, /bukan perkara majelis Anda/],
    ] as const) {
      const dunia = buatDunia(opsi);
      const j = await jadwalkan(dunia);
      JAM = new Date(JAM.getTime() + 400_000);
      await detakPelaksana(db, dunia.deps);
      expect(dunia.rekam.unggah).toHaveLength(0);
      expect(dunia.rekam.urut).not.toContain("kunci");
      const b = await butir(j.butirId);
      expect(b.status).toBe("gagal");
      expect(String(b.catatan_putusan)).toMatch(pola);
    }
  });

  // ── Berkas ──
  it("berkas hilang dari penyimpanan atau berubah isinya: gagal dengan sebab, tidak dikirim", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    dunia.berkas.clear();
    await detakPelaksana(db, dunia.deps);
    expect(String((await butir(j.butirId)).catatan_putusan)).toMatch(/tidak ada lagi di penyimpanan/);

    const dunia2 = buatDunia();
    const j2 = await jadwalkan(dunia2);
    for (const k of dunia2.berkas.keys()) dunia2.berkas.set(k, rtf(["{diubah}"]));
    JAM = new Date(JAM.getTime() + 400_000);
    await detakPelaksana(db, dunia2.deps);
    expect(String((await butir(j2.butirId)).catatan_putusan)).toMatch(/sidik jari tidak sama/);
    expect(dunia.rekam.unggah.length + dunia2.rekam.unggah.length).toBe(0);
  });

  // ── Anonimisasi: gagal satu langkah tidak membatalkan yang lain ──
  it("masih ada data pribadi: anonimisasi TERTAHAN (tidak diunggah), e-Doc putusan tetap terunggah, butir 'sebagian'", async () => {
    const dunia = buatDunia({ sisa: [{ jenis: "nama pihak", kata: "Hendrawan", konteks: "kuasa Hendrawan" }, { jenis: "NIK", kata: "7271000000000001", konteks: "NIK" }] });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.unggah).toHaveLength(1);
    expect(dunia.rekam.unggah[0].anonimisasi).toBeUndefined();
    expect(dunia.rekam.unggah[0].putusan).toBeInstanceOf(Uint8Array);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "sebagian", status_putusan: "selesai", status_anonim: "tertahan" });
    expect(String(b.catatan_anonim)).toMatch(/masih memuat 2 bagian yang tampak data pribadi/);
    expect(String(b.catatan_anonim)).toMatch(/Tidak diunggah/);
  });

  it("penyamar tidak dapat bekerja: anonimisasi gagal dengan petunjuk, putusan tetap terunggah", async () => {
    const dunia = buatDunia({ penyamarGagal: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "sebagian", status_putusan: "selesai", status_anonim: "gagal" });
    expect(String(b.catatan_anonim)).toMatch(/Penyamar ALETA belum dapat bekerja.*cadangan anonimisasi ABT memerlukan sesi ABT di peramban/i);
  });

  it("hasil penyamar yang masih memuat nama pihak ditolak penjaga isi (sama dengan unggah-sipp): tertahan, putusan tetap jalan", async () => {
    const dunia = buatDunia({ anonimBocor: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.unggah).toHaveLength(1);
    expect(dunia.rekam.unggah[0].anonimisasi).toBeUndefined();
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "sebagian", status_putusan: "selesai", status_anonim: "tertahan" });
    expect(String(b.catatan_anonim)).toMatch(/masih memuat nama pihak/);
  });

  it("bot menolak anonimisasi saja: anonimisasi gagal dengan sebab bot, e-Doc putusan selesai", async () => {
    const dunia = buatDunia({ botTolakAnonim: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "sebagian", status_putusan: "selesai", status_anonim: "gagal" });
    expect(String(b.catatan_anonim)).toMatch(/Ditolak: folder anonimisasi tidak dapat ditulis/);
  });

  it("DOCX: e-Doc putusan = berkas asli apa adanya; anonimisasi dibuat dari RTF hasil konversi; konversi gagal = anonimisasi gagal, putusan jalan", async () => {
    const dunia = buatDunia();
    let docx: Uint8Array = new Uint8Array();
    const j = await jadwalkan(dunia, { bita: (nomor) => (docx = buatDocx(barisPutusan(nomor))), nama: "putusan.docx" });
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.urut).toContain("ubah-rtf");
    expect(Buffer.from(dunia.rekam.unggah[0].putusan as Uint8Array).equals(Buffer.from(docx))).toBe(true);
    expect((await butir(j.butirId)).status).toBe("selesai");

    const dunia2 = buatDunia({ ubahGagal: true });
    const j2 = await jadwalkan(dunia2, { bita: (nomor) => buatDocx(barisPutusan(nomor)), nama: "p2.docx" });
    JAM = new Date(JAM.getTime() + 400_000);
    await detakPelaksana(db, dunia2.deps);
    const b2 = await butir(j2.butirId);
    expect(b2).toMatchObject({ status: "sebagian", status_putusan: "selesai", status_anonim: "gagal" });
    expect(String(b2.catatan_anonim)).toMatch(/tidak dapat diubah menjadi RTF/);
  });

  it("bukti dari SIPP: bot menjawab berhasil tetapi SIPP belum memuat e-Doc-nya = GAGAL, bukan selesai", async () => {
    const dunia = buatDunia({ botTidakMenulis: true });
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "gagal", status_putusan: "gagal", status_anonim: "gagal" });
    expect(String(b.catatan_putusan)).toMatch(/SIPP belum memuat e-Doc-nya/);
  });

  it("isi berkas yang menyebut perkara lain ditahan penjaga isi walau lolos saat diunggah (tidak ada yang terkirim)", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    // Berkas di penyimpanan diganti naskah perkara lain DAN sidik jari disesuaikan (skenario terburuk): penjaga isi tetap menolak.
    const lain = rtf(barisPutusan(NOMOR_LAIN));
    for (const k of dunia.berkas.keys()) dunia.berkas.set(k, lain);
    const { sha256 } = await import("@/server/modules/putusan-terjadwal/berkas");
    await db.run("UPDATE aleta_putusan_jadwal_butir SET berkas_sha256 = ? WHERE id = ?", [sha256(lain), j.butirId]);
    await detakPelaksana(db, dunia.deps);
    expect(dunia.rekam.unggah).toHaveLength(0);
    const b = await butir(j.butirId);
    expect(b.status).toBe("gagal");
    expect(String(b.catatan_putusan)).toMatch(/menyebut nomor 13\/Pdt\.G\/2026\/PA\.Dgl/);
  });

  // ── Gagal satu perkara tidak membatalkan yang lain ──
  it("satu perkara melempar galat: gagal sendiri; perkara berikutnya tetap dikerjakan pada detak berikutnya", async () => {
    const dunia = buatDunia();
    const a = await jadwalkan(dunia, { mulai: "2026-10-21 08:00" });
    const b = await jadwalkan(dunia, { mulai: "2026-10-21 08:00" });
    await db.run("UPDATE aleta_putusan_jadwal_butir SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-21 08:00").toISOString(), a.butirId]);
    await db.run("UPDATE aleta_putusan_jadwal_butir SET waktu_rencana = ? WHERE id = ?", [wita("2026-10-21 08:01").toISOString(), b.butirId]);
    const asli = dunia.deps.unggah;
    let ke = 0;
    dunia.deps.unggah = async (m) => {
      ke += 1;
      if (ke === 1) throw new Error("putus di tengah");
      return asli(m);
    };
    await detakPelaksana(db, dunia.deps);
    expect((await butir(a.butirId)).status).toBe("gagal");
    JAM = new Date(JAM.getTime() + 200_000);
    expect((await detakPelaksana(db, dunia.deps)).jalan).toBe(true);
    expect((await butir(b.butirId)).status).toBe("selesai");
  });

  it("dua detak serentak tidak mengerjakan dua kali (penjaga proses) dan pelaksana yang dimatikan di pengaturan diam", async () => {
    const dunia = buatDunia();
    await jadwalkan(dunia);
    const [x, y] = await Promise.all([detakPelaksana(db, dunia.deps), detakPelaksana(db, dunia.deps)]);
    expect([x.jalan, y.jalan].filter(Boolean)).toHaveLength(1);
    expect(dunia.rekam.unggah).toHaveLength(1);

    const dunia2 = buatDunia();
    await jadwalkan(dunia2);
    await db.run("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES ('*sistem*', 'sistem:putusan-terjadwal', ?, ?)", [JSON.stringify({ hapusHari: 7, pelaksanaNyala: false }), JAM.toISOString()]);
    JAM = new Date(JAM.getTime() + 400_000);
    expect(await detakPelaksana(db, dunia2.deps)).toMatchObject({ jalan: false, alasan: "dimatikan" });
    expect(dunia2.rekam.unggah).toHaveLength(0);
  });

  it("jadwal yang dibatalkan tidak dikerjakan", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    await kelola(db, HAKIM, { aksi: "batal", id: j.butirId }, { sekarang: () => JAM, muatLibur: async () => () => false });
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false, alasan: "tidak_ada" });
    expect(dunia.rekam.unggah).toHaveLength(0);
  });

  // ── Pemulihan dan pembersihan ──
  it("butir yang macet (masa pegang habis) dikembalikan ke antrean; setelah batas percobaan dinyatakan gagal", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    for (let i = 1; i <= BATAS.percobaanMaks; i += 1) {
      await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'jalan', status_putusan = 'jalan', status_anonim = 'jalan', klaim_oleh = 'server', klaim_sampai = ? WHERE id = ?", [new Date(JAM.getTime() - 1000).toISOString(), j.butirId]);
      expect(await pulihkanMacet(db, JAM)).toBe(1);
      const b = await butir(j.butirId);
      expect(b.percobaan).toBe(i);
      expect(b.status).toBe(i < BATAS.percobaanMaks ? "menunggu" : "gagal");
    }
    // Yang masa pegangnya belum habis tidak disentuh.
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'jalan', status_putusan = 'jalan', klaim_sampai = ? WHERE id = ?", [new Date(JAM.getTime() + 60_000).toISOString(), j.butirId]);
    expect(await pulihkanMacet(db, JAM)).toBe(0);
  });

  it("kedaluwarsa: butir yang tak sempat dikerjakan 3 hari sesudah jam rencana dinyatakan gagal dengan sebab - tidak berjalan sendiri pada hari yang tidak diduga", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true } });
    const baru = await jadwalkan(dunia, { langkah: { putusan: true }, mulai: "2026-10-21 08:30" });
    // Dua hari lewat: belum kedaluwarsa. Empat hari lewat: kedaluwarsa.
    const dua = new Date(Date.parse(String((await butir(j.butirId)).waktu_rencana)) + 2 * 24 * 3600_000);
    expect(await kedaluwarsakan(db, dua, await bacaPengaturan(db))).toBe(0);
    const empat = new Date(Date.parse(String((await butir(j.butirId)).waktu_rencana)) + 4 * 24 * 3600_000);
    expect(await kedaluwarsakan(db, empat, await bacaPengaturan(db))).toBe(2);
    const b = await butir(j.butirId);
    expect(b).toMatchObject({ status: "gagal", status_isi: "gagal", status_putusan: "gagal" });
    expect(String(b.catatan_isi)).toMatch(/Tidak dikerjakan dalam 3 hari.*SIPP tidak dibuka di peramban penjadwal.*Ulangi/);
    expect(b.selesai_pada).not.toBe("");
    expect((await butir(baru.butirId)).status).toBe("gagal");
    // Pelaksana tidak lagi memilihnya, juga sesudah jendela kerja datang.
    JAM = empat;
    expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
    expect(dunia.rekam.unggah).toHaveLength(0);
    // "Ulangi" menjadwalkannya kembali (berkas masih ada).
    await kelola(db, HAKIM, { aksi: "ulang", id: baru.butirId }, { sekarang: () => empat, muatLibur: async () => () => false });
    expect((await butir(baru.butirId)).status).toBe("menunggu");
  });

  it("pembersihan: berkas butir selesai dihapus sesudah N hari; berkas tahap yang tak pernah dipasang dibuang sesudah 24 jam; yang aktif tidak disentuh", async () => {
    const dunia = buatDunia();
    const satu = await jadwalkan(dunia);
    const dua = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    // Jitter butir pertama acak: yang dikerjakan detak ini dikenali dari statusnya, bukan dari urutan dibuat.
    const [selesai, aktif] = (await butir(satu.butirId)).status === "selesai" ? [satu, dua] : [dua, satu];
    expect((await butir(selesai.butirId)).status).toBe("selesai");
    const [bs] = await baris("SELECT berkas_jalur, berkas_id FROM aleta_putusan_jadwal_butir WHERE id = ?", [selesai.butirId]);
    const [ba] = await baris("SELECT berkas_jalur FROM aleta_putusan_jadwal_butir WHERE id = ?", [aktif.butirId]);
    // Belum waktunya.
    expect(await bersihkanBerkas(db, dunia.deps, new Date(JAM.getTime() + 6 * 24 * 3600_000))).toBe(0);
    // Tahap yatim.
    const yatim = await tahapkanBerkas(db, HAKIM, { nama: "yatim.rtf", bita: rtf(barisPutusan("777/Pdt.G/2026/PA.Dgl")) }, { sekarang: () => JAM, akar: AKAR });
    expect(yatim.ok).toBe(true);
    const n1 = await bersihkanBerkas(db, dunia.deps, new Date(JAM.getTime() + 8 * 24 * 3600_000));
    expect(n1).toBe(2);
    expect(dunia.rekam.urut).toContain(`hapus:${bs.berkas_jalur}`);
    expect(dunia.rekam.urut).not.toContain(`hapus:${ba.berkas_jalur}`);
    expect((await butir(selesai.butirId)).berkas_jalur).toBe("");
    expect((await butir(aktif.butirId)).berkas_jalur).toBe(ba.berkas_jalur);
    const [bb] = await baris("SELECT dihapus_pada, jalur FROM aleta_putusan_jadwal_berkas WHERE id = ?", [bs.berkas_id]);
    expect(bb.jalur).toBe("");
    expect(bb.dihapus_pada).not.toBe("");
  });

  it("jalankanEdocButir tidak pernah melempar, juga saat dependensinya melempar di tempat tak terduga", async () => {
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    await db.run("UPDATE aleta_putusan_jadwal_butir SET status_putusan = 'jalan', status_anonim = 'jalan', status = 'jalan' WHERE id = ?", [j.butirId]);
    dunia.deps.muatPengguna = async () => {
      throw new Error("basis data putus");
    };
    const h = await jalankanEdocButir(db, dunia.deps, (await butir(j.butirId)) as never);
    expect(h.putusan?.status).toBe("gagal");
    expect(h.anonim?.catatan).toMatch(/basis data putus/);
  });

  // ── Sisi peramban ──
  describe("peramban: isi & simpan Putusan Akhir", () => {
    const tautan = async () => ({ alamat: "http://192.168.10.10/SIPP/perkara_detil_agama/AbC123==", alasan: "" });
    const dpl = (dunia: ReturnType<typeof buatDunia>) => ({ ...dunia.deps, tautan });

    it("giliran: butir jatuh tempo milik penjadwal, dengan tautan halaman perkara; orang lain tidak mendapatkannya", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true, anonim: true } });
      const g = await giliranPeramban(db, HAKIM, { akunSipp: "Hakim.Satu" }, dpl(dunia));
      expect(g).toMatchObject({ ada: true, butir: { id: j.butirId, nomorPerkara: j.nomor, akunSipp: "hakim.satu", adaBerkas: true, langkah: { putusan: true, anonim: true } }, tautan: { alamat: expect.stringContaining("perkara_detil_agama/") } });
      expect(await giliranPeramban(db, HAKIM_LAIN, { akunSipp: "hakim.satu" }, dpl(dunia))).toMatchObject({ ada: false, alasan: "tidak_ada" });
    });

    it("giliran menahan: akun SIPP beda, di luar jam kerja, belum waktunya (menyebut jam berikutnya), dalam jeda", async () => {
      const dunia = buatDunia();
      await jadwalkan(dunia, { langkah: { isi: true }, mulai: "2026-10-21 10:00" });
      JAM = wita("2026-10-21 09:00");
      const belum = await giliranPeramban(db, HAKIM, {}, dpl(dunia));
      expect(belum).toMatchObject({ ada: false, alasan: "belum_waktunya" });
      expect((belum as { berikutnyaWita: string }).berikutnyaWita).toMatch(/^2026-10-21 10:0\d$/);
      JAM = wita("2026-10-21 10:30");
      expect(await giliranPeramban(db, HAKIM, { akunSipp: "orang.lain" }, dpl(dunia))).toMatchObject({ ada: false, alasan: "akun_beda", akunLain: ["hakim.satu"] });
      JAM = wita("2026-10-21 12:20");
      expect(await giliranPeramban(db, HAKIM, {}, dpl(dunia))).toMatchObject({ ada: false, alasan: "di_luar_jam_kerja" });
      JAM = wita("2026-10-21 13:30");
      await db.run("UPDATE aleta_putusan_jadwal_butir SET selesai_pada = ? WHERE pemilik_id = ? AND status = 'selesai'", [JAM.toISOString(), HAKIM.actor.id]);
      // Butir lain milik hakim yang baru selesai satu menit lalu -> jeda 120 detik.
      const lain = await jadwalkan(dunia, { langkah: { putusan: true } });
      await db.run("UPDATE aleta_putusan_jadwal_butir SET status = 'selesai', selesai_pada = ? WHERE id = ?", [new Date(JAM.getTime() - 60_000).toISOString(), lain.butirId]);
      expect(await giliranPeramban(db, HAKIM, {}, dpl(dunia))).toMatchObject({ ada: false, alasan: "jeda" });
      JAM = new Date(JAM.getTime() + 90_000);
      expect((await giliranPeramban(db, HAKIM, {}, dpl(dunia))).ada).toBe(true);
    });

    it("akun SIPP di peramban dikenali dari username ATAU nama tampil yang dicatat saat dijadwalkan; selain itu 'akun beda'", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true } });
      await db.run("UPDATE aleta_putusan_jadwal_butir SET nama_sipp = 'Hakim Satu, S.H., M.H.' WHERE id = ?", [j.butirId]);
      for (const masuk of ["hakim.satu", "HAKIM.SATU", "Hakim  Satu, S.H., M.H."]) {
        expect((await giliranPeramban(db, HAKIM, { akunSipp: masuk }, dpl(dunia))).ada).toBe(true);
      }
      expect(await giliranPeramban(db, HAKIM, { akunSipp: "Hakim Dua" }, dpl(dunia))).toMatchObject({ ada: false, alasan: "akun_beda" });
      // Tanpa nama tampil yang tercatat, hanya username yang cocok.
      await db.run("UPDATE aleta_putusan_jadwal_butir SET nama_sipp = '' WHERE id = ?", [j.butirId]);
      expect(await giliranPeramban(db, HAKIM, { akunSipp: "Hakim Satu, S.H., M.H." }, dpl(dunia))).toMatchObject({ ada: false, alasan: "akun_beda" });
    });

    it("klaim: satu pemegang; yang kedua ditolak; orang lain 403; akun beda dan belum waktunya ditolak dengan alasan", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true } });
      await expect(klaimPeramban(db, HAKIM_LAIN, { id: j.butirId }, dunia.deps)).rejects.toThrow(/milik pengguna lain/);
      expect(await klaimPeramban(db, HAKIM, { id: j.butirId, akunSipp: "orang.lain" }, dunia.deps)).toMatchObject({ ok: false, alasan: "akun_beda" });
      expect(await klaimPeramban(db, HAKIM, { id: j.butirId, akunSipp: "hakim.satu" }, dunia.deps)).toMatchObject({ ok: true });
      expect(await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps)).toMatchObject({ ok: false, alasan: "bukan_giliran" });
      const b = await butir(j.butirId);
      expect(b).toMatchObject({ status: "jalan", status_isi: "jalan", klaim_oleh: `peramban:${HAKIM.actor.id}` });
      expect(Date.parse(String(b.klaim_sampai))).toBe(JAM.getTime() + BATAS.masaPegangDetik * 1000);
      // Tidak ikut dipilih pelaksana server selama dipegang peramban.
      expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
      const baru = await jadwalkan(dunia, { langkah: { isi: true }, mulai: "2026-10-21 14:00" });
      JAM = wita("2026-10-21 09:00");
      expect(await klaimPeramban(db, HAKIM, { id: baru.butirId }, dunia.deps)).toMatchObject({ ok: false, alasan: "belum_waktunya" });
    });

    it("draf: berkas RTF dipasang menjadi draf; DOCX diubah ke RTF dulu; sidik jari berubah / berkas hilang / tanpa pemegang ditolak", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true } });
      const panggilan: Array<Record<string, unknown>> = [];
      const buatDraf = vi.fn(async (_db: unknown, aktor: string, m: Record<string, unknown>) => {
        panggilan.push({ aktor, ...m });
        return { ok: true, versi: 4, bagian: [{ kunci: "pertimbangan", judul: "Pertimbangan hukum", aksara: 120, halangan: "" }] };
      });
      const dd = { ...dunia.deps, buatDraf: buatDraf as never };
      expect(await siapkanDraf(db, HAKIM, { id: j.butirId }, dd)).toMatchObject({ ok: false, sebab: expect.stringMatching(/tidak sedang Anda pegang/) });
      await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps);
      const h = await siapkanDraf(db, HAKIM, { id: j.butirId }, dd);
      expect(h).toMatchObject({ ok: true, versi: 4, dariDraf: false, bagian: [{ judul: "Pertimbangan hukum", aksara: 120 }] });
      expect(panggilan[0]).toMatchObject({ aktor: HAKIM.actor.id, perkaraId: j.perkaraId, nomorPerkara: j.nomor });
      expect(dunia.rekam.urut).not.toContain("ubah-rtf");

      const dunia2 = buatDunia();
      const j2 = await jadwalkan(dunia2, { langkah: { isi: true }, bita: (nomor) => buatDocx(barisPutusan(nomor)), nama: "x.docx" });
      await klaimPeramban(db, HAKIM, { id: j2.butirId }, dunia2.deps);
      await siapkanDraf(db, HAKIM, { id: j2.butirId }, { ...dunia2.deps, buatDraf: buatDraf as never });
      expect(dunia2.rekam.urut).toContain("ubah-rtf");

      // Sidik jari berubah.
      const dunia3 = buatDunia();
      const j3 = await jadwalkan(dunia3, { langkah: { isi: true } });
      await klaimPeramban(db, HAKIM, { id: j3.butirId }, dunia3.deps);
      for (const k of dunia3.berkas.keys()) dunia3.berkas.set(k, rtf(["{lain}"]));
      expect(await siapkanDraf(db, HAKIM, { id: j3.butirId }, dd3(dunia3, buatDraf))).toMatchObject({ ok: false, sebab: expect.stringMatching(/sidik jari tidak sama/) });
      dunia3.berkas.clear();
      expect(await siapkanDraf(db, HAKIM, { id: j3.butirId }, dd3(dunia3, buatDraf))).toMatchObject({ ok: false, sebab: expect.stringMatching(/tidak ada lagi di penyimpanan/) });
    });
    const dd3 = (dunia: ReturnType<typeof buatDunia>, buatDraf: unknown) => ({ ...dunia.deps, buatDraf: buatDraf as never });

    it("draf tanpa berkas: memakai draf ALETA terbaru bila ada, kalau tidak ditolak dengan kalimat awam", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true }, tanpaBerkas: true });
      await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps);
      expect(await siapkanDraf(db, HAKIM, { id: j.butirId }, dunia.deps)).toMatchObject({ ok: false, sebab: expect.stringMatching(/Belum ada berkas yang dipasang maupun draf/) });
      await db.run(
        "INSERT INTO aleta_putusan_draf (id, perkara_id, nomor_perkara, versi, keadaan, naskah, dibuat_oleh, dibuat_at) VALUES ('drf-uji', ?, ?, 2, 'draf', 'x', 'uji', ?)",
        [j.perkaraId, j.nomor, JAM.toISOString()]
      ).catch(() => undefined);
      const ada = await db.queryOne("SELECT versi FROM aleta_putusan_draf WHERE nomor_perkara = ?", [j.nomor]);
      if (ada) expect(await siapkanDraf(db, HAKIM, { id: j.butirId }, dunia.deps)).toMatchObject({ ok: true, dariDraf: true, versi: 2 });
    });

    it("lapor selesai: e-Doc menyusul 30-150 detik kemudian (tidak seketika); tanpa e-Doc butir langsung selesai; bukan pemegang = 409", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true } });
      await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps);
      await expect(laporPeramban(db, HAKIM_LAIN, { id: j.butirId, hasil: "selesai" }, dunia.deps)).rejects.toThrow(/milik pengguna lain/);
      const r = await laporPeramban(db, HAKIM, { id: j.butirId, hasil: "selesai", catatan: "Tersimpan di SIPP." }, dunia.deps);
      expect(r.status).toBe("menunggu");
      const sesudah = Date.parse(r.edocSesudah) - JAM.getTime();
      expect(sesudah).toBeGreaterThanOrEqual(30_000);
      expect(sesudah).toBeLessThanOrEqual(150_000);
      expect(await butir(j.butirId)).toMatchObject({ status_isi: "selesai", status: "menunggu", klaim_oleh: "" });
      await expect(laporPeramban(db, HAKIM, { id: j.butirId, hasil: "selesai" }, dunia.deps)).rejects.toThrow(/tidak sedang Anda pegang/);

      const dunia2 = buatDunia();
      const j2 = await jadwalkan(dunia2, { langkah: { isi: true }, tanpaBerkas: true });
      await klaimPeramban(db, HAKIM, { id: j2.butirId }, dunia2.deps);
      const r2 = await laporPeramban(db, HAKIM, { id: j2.butirId, hasil: "dilewati" }, dunia2.deps);
      expect(r2.status).toBe("selesai");
      const b2 = await butir(j2.butirId);
      expect(b2.selesai_pada).not.toBe("");
      expect(String(b2.catatan_isi)).toMatch(/sudah terisi di SIPP - tidak ditimpa/);
    });

    it("lapor tertahan (praperiksa menahan): e-Doc ikut tertahan (tidak jalan tanpa Putusan Akhir), 'Ulangi' membukanya kembali", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true, anonim: true } });
      await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps);
      await laporPeramban(db, HAKIM, { id: j.butirId, hasil: "tertahan", catatan: "Praperiksa menahan: status bertentangan" }, dunia.deps);
      const b = await butir(j.butirId);
      expect(b).toMatchObject({ status: "gagal", status_isi: "tertahan", status_putusan: "tertahan", status_anonim: "tertahan" });
      JAM = new Date(JAM.getTime() + 3600_000);
      expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
      expect(dunia.rekam.unggah).toHaveLength(0);
      await kelola(db, HAKIM, { aksi: "ulang", id: j.butirId }, { sekarang: () => JAM, muatLibur: async () => () => false });
      expect(await butir(j.butirId)).toMatchObject({ status: "menunggu", status_isi: "menunggu", status_putusan: "menunggu" });
    });

    it("lepas: kembali ke antrean tanpa dikerjakan (tunda), tidak menghitung percobaan kecuali diminta; setelah batas = gagal", async () => {
      const dunia = buatDunia();
      const j = await jadwalkan(dunia, { langkah: { isi: true } });
      await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps);
      await lepasPeramban(db, HAKIM, { id: j.butirId, tundaDetik: 300, sebab: "Halaman perkara tidak terbuka." }, dunia.deps);
      let b = await butir(j.butirId);
      expect(b).toMatchObject({ status: "menunggu", status_isi: "menunggu", klaim_oleh: "", percobaan: 0 });
      expect(Date.parse(String(b.tunggu_sampai))).toBe(JAM.getTime() + 300_000);
      // Sebelum tunggu_sampai tidak muncul sebagai giliran.
      expect(await giliranPeramban(db, HAKIM, {}, { ...dunia.deps, tautan })).toMatchObject({ ada: false });
      for (let i = 1; i <= BATAS.percobaanMaks; i += 1) {
        // Maju sampai giliran terbuka lagi (tunggu_sampai lewat, di dalam jendela kerja, di luar jeda).
        for (let coba = 0; coba < 40; coba += 1) {
          JAM = new Date(JAM.getTime() + 20 * 60_000);
          if ((await klaimPeramban(db, HAKIM, { id: j.butirId }, dunia.deps)).ok) break;
        }
        await lepasPeramban(db, HAKIM, { id: j.butirId, sebab: "gagal buka", hitung: true }, dunia.deps);
        b = await butir(j.butirId);
        if (b.status === "gagal") break;
      }
      expect(b.status).toBe("gagal");
      expect(String(b.catatan_isi)).toMatch(/Gagal setelah 4 percobaan/);
    });

    it("UJUNG KE UJUNG: peramban mengisi Putusan Akhir, lalu server mengunggah e-Doc beberapa saat kemudian; semuanya selesai", async () => {
      const dunia = buatDunia({ sipp: { adaBaris: false, putusan: false, anonim: false } });
      const j = await jadwalkan(dunia, { langkah: { isi: true, putusan: true, anonim: true } });
      // Server tidak menyentuh butir yang masih menunggu pengisian di peramban.
      expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
      const g = await giliranPeramban(db, HAKIM, { akunSipp: "hakim.satu" }, dpl(dunia));
      expect(g.ada).toBe(true);
      await klaimPeramban(db, HAKIM, { id: j.butirId, akunSipp: "hakim.satu" }, dunia.deps);
      // Peramban menyimpan Putusan Akhir di SIPP.
      dunia.sipp.adaBaris = true;
      const lapor = await laporPeramban(db, HAKIM, { id: j.butirId, hasil: "selesai" }, dunia.deps);
      // Belum waktunya e-Doc.
      JAM = new Date(JAM.getTime() + 10_000);
      expect(await detakPelaksana(db, dunia.deps)).toMatchObject({ jalan: false });
      JAM = new Date(Date.parse(lapor.edocSesudah) + 1000);
      const h = await detakPelaksana(db, dunia.deps);
      expect(h).toMatchObject({ jalan: true, butirId: j.butirId, status: "selesai" });
      expect(await butir(j.butirId)).toMatchObject({ status_isi: "selesai", status_putusan: "selesai", status_anonim: "selesai" });
      const jejak = await baris("SELECT peristiwa, pelaku FROM aleta_putusan_jadwal_jejak WHERE butir_id = ?", [j.butirId]);
      const pelakuPer = Object.fromEntries(jejak.map((x) => [x.peristiwa, x.pelaku]));
      expect(pelakuPer["isi-putusan"]).toBe("peramban: Hakim Satu");
      expect(pelakuPer["edoc-putusan"]).toBe("pelaksana server");
      expect(pelakuPer["dijadwalkan"]).toBe("pengguna: Hakim Satu");
    });
  });

  it("pengaturan hapus berkas dipakai: hapusHari 3 menjadwalkan penghapusan 3 hari sesudah selesai", async () => {
    await db.run("INSERT INTO aleta_ekstensi_setelan (pengguna_id, kunci, nilai, diubah_pada) VALUES ('*sistem*', 'sistem:putusan-terjadwal', ?, ?)", [JSON.stringify({ hapusHari: 3, pelaksanaNyala: true }), JAM.toISOString()]);
    expect((await bacaPengaturan(db)).hapusHari).toBe(3);
    const dunia = buatDunia();
    const j = await jadwalkan(dunia);
    await detakPelaksana(db, dunia.deps);
    expect(Date.parse(String((await butir(j.butirId)).berkas_hapus_pada))).toBe(JAM.getTime() + 3 * 24 * 3600_000);
  });
});
