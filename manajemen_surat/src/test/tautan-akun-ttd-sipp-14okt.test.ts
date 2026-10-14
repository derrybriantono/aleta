// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { kunciNama, kunciNamaLengkap } from "@/lib/nama-pegawai-sipp";
import {
  namaMirip,
  saringBuatAkun,
  saringPilihanTerapkan,
  subPeranDariSipp,
  susunPratinjauTautanSipp,
  usulanPeranDariGrup,
  type AkunAletaTautan,
  type BahanTautan,
  type KredensialTautan,
  type PenggunaSippDaftar,
} from "@/lib/tautan-akun-sipp";
import { akunPastiUntukNama, cocokkanTtdKeAkun, type AkunTtd } from "@/lib/tautan-ttd-akun";
import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { bacaKredensialSipp } from "@/server/modules/aleta-ecourt/checklist-milestone";
import { akunSippMilik } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { tautanSaatUnggah, tautkanTtdOtomatis } from "@/server/modules/aleta-ecourt/tautan-ttd";
import { kosongkanBatasMasukSipp, putuskanMasukSipp } from "@/server/modules/portal/masuk-sipp";
import {
  KETETAPAN_PENGGUNA,
  batalkanTautanMassal,
  pratinjauTautanSemua,
  terapkanTautanSemua,
  type DepsTautanSemua,
} from "@/server/modules/portal/tautan-semua-sipp";
import { lookupUserForLoginInDb } from "@/server/modules/users/service";

/**
 * ============================================================================
 * TAUTKAN SEMUA AKUN KE SIPP + TAUTAN OTOMATIS BERKAS TTD (14 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna 14 Okt:
 *   5. "Untuk TTD sudah ada namanya, minta tolong langsung ditautkan saja
 *      dengan akunnya."
 *   6. "Ganti semua user dan password yang dari SIPP ke ALETA, cek namanya
 *      apabila double 1 nama dengan user lain beritahu" - setiap akun SIPP
 *      punya akun ALETA bertautan; masuk dengan username + password SIPP.
 *
 * Yang diuji PERILAKU: pencocokan pasti/ganda/terblokir, pratinjau tidak
 * menulis, penerapan dalam satu transaksi + audit, pembatalan, akun baru tanpa
 * password ALETA tetap masuk dengan password SIPP (dan tidak tanpa password),
 * dan penautan TTD otomatis. Nama/username di sini contoh; password PALSU.
 */

const sipp = (
  username: string,
  namaLengkap: string,
  lain: Partial<PenggunaSippDaftar> = {}
): PenggunaSippDaftar => ({
  sippUserId: lain.sippUserId ?? String(Math.abs(hash(username))),
  username,
  namaLengkap,
  pejabat: [],
  diblokir: false,
  kedaluwarsa: false,
  grup: [],
  ...lain,
});

function hash(t: string) {
  let h = 7;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

const akun = (id: string, name: string, lain: Partial<AkunAletaTautan> = {}): AkunAletaTautan => ({
  id,
  username: lain.username ?? id,
  name,
  nip: null,
  roleId: "pelaksana",
  isActive: true,
  ...lain,
});

const kred = (userId: string, username: string, lain: Partial<KredensialTautan> = {}): KredensialTautan => ({
  userId,
  username,
  aktif: true,
  keadaan: "verified",
  sumber: "",
  ...lain,
});

const baris = (bahan: BahanTautan, userId: string) => susunPratinjauTautanSipp(bahan).baris.find((b) => b.userId === userId)!;

// ============================================================================
// A. PENCOCOKAN AKUN ALETA <-> SIPP
// ============================================================================

describe("A. pencocokan akun ALETA ke akun SIPP", () => {
  it("nama sama + satu akun SIPP aktif = pasti; NIP pejabat sama menguatkan", () => {
    const bahan: BahanTautan = {
      akun: [akun("usr-qa", "QADARIYAH, S.H.", { nip: "198604062006042001" })],
      kredensial: [],
      sipp: [sipp("qadariyah", "Qadariyah, S.H.", { pejabat: [{ jabatan: "panitera", nama: "Qadariyah", nip: "198604062006042001" }] })],
    };
    const b = baris(bahan, "usr-qa");
    expect(b.kelompok).toBe("pasti");
    expect(b.usernameSipp).toBe("qadariyah");
    expect(b.calon[0].dasar).toEqual(["nip", "nama"]);
  });

  it("satu nama dipakai DUA akun SIPP aktif = ganda (tidak dipilihkan)", () => {
    const bahan: BahanTautan = {
      akun: [akun("usr-narti", "NARTI")],
      kredensial: [],
      sipp: [sipp("meja2p", "Narti"), sipp("meja2g", "Narti")],
    };
    const b = baris(bahan, "usr-narti");
    expect(b.kelompok).toBe("ganda");
    expect(b.usernameSipp).toBe("");
    expect(b.sebab).toMatch(/2 akun SIPP aktif/);
  });

  it("akun SIPP yang diblokir tidak pernah jadi pasti; yang aktif menang atas yang diblokir", () => {
    const hanyaBlokir = baris(
      { akun: [akun("usr-asrah", "ASRAH RACHMAN, S.H.I.")], kredensial: [], sipp: [sipp("Asrah", "Asrah Rachman, S.H.I.", { diblokir: true })] },
      "usr-asrah"
    );
    expect(hanyaBlokir.kelompok).toBe("sipp-nonaktif");

    const campur = baris(
      {
        akun: [akun("usr-fikri", "FIKRIANTO, S.H.")],
        kredensial: [],
        sipp: [sipp("jsp3", "Fikrianto, S.H.", { diblokir: true }), sipp("fikri", "Fikrianto, S.H.", { kedaluwarsa: false })],
      },
      "usr-fikri"
    );
    expect(campur.kelompok).toBe("pasti");
    expect(campur.usernameSipp).toBe("fikri");
  });

  it("NIP berbeda membantah nama yang sama", () => {
    const b = baris(
      {
        akun: [akun("usr-x", "SRI WAHYUNI, S.H.", { nip: "198605142009042007" })],
        kredensial: [],
        sipp: [sipp("sri", "Sri Wahyuni", { pejabat: [{ jabatan: "panitera", nama: "Sri Wahyuni", nip: "197001012000032001" }] })],
      },
      "usr-x"
    );
    expect(b.kelompok).not.toBe("pasti");
  });

  it("satu akun SIPP cocok ke DUA akun ALETA = keduanya ganda", () => {
    const p = susunPratinjauTautanSipp({
      akun: [akun("usr-a", "MUSTINI"), akun("usr-b", "Mustini")],
      kredensial: [],
      sipp: [sipp("mustini", "Mustini")],
    });
    expect(p.baris.map((b) => b.kelompok)).toEqual(["ganda", "ganda"]);
    expect(p.namaGandaAleta).toHaveLength(1);
  });

  it("akun SIPP yang sudah diklaim akun ALETA lain = ganda; Super Admin, nonaktif, dicabut tidak disentuh", () => {
    const p = susunPratinjauTautanSipp({
      akun: [
        akun("usr-lama", "PEMEGANG LAMA"),
        akun("usr-andini", "ANDINI PUSPITA SARI"),
        akun("usr-root", "ANDI ROOT", { roleId: "super-admin" }),
        akun("usr-off", "UNUN FIDIYASARI", { isActive: false }),
        akun("usr-cabut", "TANTY RESTIANTY"),
      ],
      kredensial: [kred("usr-lama", "andini"), kred("usr-cabut", "tanty", { aktif: false })],
      sipp: [sipp("andini", "Andini Puspita Sari"), sipp("unun", "Unun Fidiyasari"), sipp("tanty", "Tanty Restianty")],
    });
    const k = Object.fromEntries(p.baris.map((b) => [b.userId, b.kelompok]));
    expect(k).toMatchObject({ "usr-andini": "ganda", "usr-root": "super-admin", "usr-off": "nonaktif", "usr-cabut": "dicabut", "usr-lama": "sudah" });
  });

  it("tautan yang ada ke akun SIPP bernama lain / diblokir disebut sebagai MASALAH", () => {
    const p = susunPratinjauTautanSipp({
      akun: [akun("usr-rahma", "RAHMA ANGGOROSIWI"), akun("usr-blok", "MANNARIA")],
      kredensial: [kred("usr-rahma", "meja1g"), kred("usr-blok", "mannaria")],
      sipp: [sipp("meja1g", "Tiffany RS"), sipp("mannaria", "Mannaria", { diblokir: true })],
    });
    expect(p.baris.find((b) => b.userId === "usr-rahma")?.masalah).toMatch(/tidak sama/);
    expect(p.baris.find((b) => b.userId === "usr-blok")?.masalah).toMatch(/DIBLOKIR/);
  });

  it("nama hanya MIRIP = ragu, tidak pernah pasti", () => {
    const b = baris({ akun: [akun("usr-m", "MUNIFAH, S.H.")], kredensial: [], sipp: [sipp("munifa", "Munifa")] }, "usr-m");
    expect(b.kelompok).toBe("ragu");
    expect(namaMirip("Munifah", "Munifa")).toBe(true);
    expect(namaMirip("Idris", "Muh. Idris, S.H.")).toBe(true);
    expect(namaMirip("Ali", "Ali Akbar")).toBe(false);
  });

  it("kunci nama lengkap: koma di tengah nama tidak memotong ('SUDARMIN, H.I.M. TANG')", () => {
    expect(kunciNama("SUDARMIN, H.I.M. TANG, S.H.I., M.H")).toBe("sudarmin");
    expect(kunciNamaLengkap("SUDARMIN, H.I.M. TANG, S.H.I., M.H")).toBe(kunciNamaLengkap("SUDARMIN H.I.M. TANG, S.H.I.,M.H"));
    expect(kunciNamaLengkap("RESMI, S.E., Ak.")).toBe("resmi");
  });
});

// ============================================================================
// B. PETUGAS SIPP TANPA AKUN ALETA + PEMETAAN PERAN
// ============================================================================

describe("B. petugas SIPP tanpa akun ALETA", () => {
  it("dibuatkan bila tunggal; ganda bila namanya dipakai akun SIPP lain; bentrok bila username terpakai; akun SIPP kedua milik pegawai yang ada tidak dibuatkan", () => {
    const p = susunPratinjauTautanSipp({
      akun: [akun("usr-rahma", "RAHMA ANGGOROSIWI"), akun("usr-old", "ORANG LAMA", { username: "jsp9", dihapus: true })],
      kredensial: [kred("usr-rahma", "meja3g")],
      sipp: [
        sipp("meja3g", "Rahma Anggorosiwi"),
        sipp("meja3p", "Rahma Anggorosiwi"),
        sipp("sitti", "Sitti Nurhidayah, S.H.I.", { grup: ["Panitera Pengganti"] }),
        sipp("meja2p", "Narti"),
        sipp("meja2g", "Narti"),
        sipp("jsp9", "Juru Sita Baru", { grup: ["Jurusita"] }),
        sipp("lama", "Pegawai Pensiun", { diblokir: true }),
      ],
    });
    const k = Object.fromEntries(p.sippTanpaAkun.map((s) => [s.username, s.kelompok]));
    expect(k).toEqual({ sitti: "buat", meja2p: "ganda", meja2g: "ganda", jsp9: "bentrok" });
    expect(p.sippAkunLain.map((s) => s.username)).toEqual(["meja3p"]);
    expect(p.namaGandaSipp.map((g) => g.nama).sort()).toEqual(["Narti", "Rahma Anggorosiwi"]);
  });

  it("peran UTAMA akun baru selalu pelaksana (keputusan pengguna 14 Okt); padanan grup hanya keterangan", () => {
    for (const grup of ["Hakim", "Ketua/Wakil Ketua", "Panmud Gugatan", "Administrator", "Panitera Pengganti", "Jurusita", "Meja I Gugatan", "Kasir"]) {
      const u = usulanPeranDariGrup([grup]);
      expect(u.peranAman, grup).toBe("pelaksana");
      expect(u.jabatanAman, grup).toBe("pos-pengadministrasi-umum");
    }
    expect(usulanPeranDariGrup(["Hakim"])).toMatchObject({ tinggi: true, peranPadanan: "hakim" });
    expect(usulanPeranDariGrup(["Panitera Pengganti"])).toMatchObject({ tinggi: false, peranPadanan: "panitera-pengganti" });
  });

  it("sub-peran/tugas dari username + grup SIPP (struktur additional_role_ids yang ada)", () => {
    expect(subPeranDariSipp({ username: "meja1g", grup: ["Meja I Gugatan"] })).toEqual(["petugas_meja_1_gugatan"]);
    expect(subPeranDariSipp({ username: "meja2p", grup: [] })).toEqual(["petugas_meja_2_permohonan"]);
    expect(subPeranDariSipp({ username: "x", grup: ["Meja III Permohonan", "Kasir"] })).toEqual(["petugas_meja_3_permohonan", "kasir"]);
    expect(subPeranDariSipp({ username: "deleg", grup: ["Koordinator Delegasi"] })).toEqual(["operator_delegasi"]);
    // Grup yang sama dengan peran utama tidak menjadi sub-peran.
    expect(subPeranDariSipp({ username: "Idris", grup: ["Hakim"] })).toEqual([]);
    expect(subPeranDariSipp({ username: "andini", grup: ["Panitera Pengganti"] })).toEqual([]);
  });

  it("ketetapan pengguna: Munifa -> munifa,SH. dikonfirmasi; Fikrianto -> fikri dibuatkan; selebihnya tetap ganda", () => {
    expect(KETETAPAN_PENGGUNA.map((k) => k.usernameSipp)).toEqual(["munifa,SH.", "fikri"]);
    const p = susunPratinjauTautanSipp({
      akun: [
        akun("usr-munifa", "MUNIFA, S.H.", { nip: "198000000000122001" }),
        akun("usr-narti", "NARTI"),
      ],
      kredensial: [kred("usr-munifa", "munifa,SH.")],
      sipp: [
        sipp("munifa,SH.", "Munifa, S.H.", { pejabat: [{ jabatan: "panitera", nama: "Munifa", nip: "198000000000122003" }] }),
        sipp("munifa", "Munifa,SH"),
        sipp("jsp3", "Fikrianto, S.H.", { diblokir: true }),
        sipp("fikri", "Fikrianto, S.H.", { grup: ["Panmud Permohonan"] }),
        sipp("waka", "Drs. H. Karmin, M.H."),
        sipp("karmin", "Drs. H. Karmin, M.H.", { diblokir: true }),
        sipp("meja2p", "Narti"),
        sipp("meja2g", "Narti"),
      ],
      ketetapan: KETETAPAN_PENGGUNA,
    });
    const munifa = p.baris.find((b) => b.userId === "usr-munifa")!;
    expect(munifa).toMatchObject({ kelompok: "sudah", masalah: "", ditetapkanPengguna: true });
    expect(p.baris.find((b) => b.userId === "usr-narti")?.kelompok).toBe("ganda");
    const k = Object.fromEntries(p.sippTanpaAkun.map((s) => [s.username, s.kelompok]));
    expect(k).toMatchObject({ fikri: "buat", waka: "ganda" });
    expect(p.sippTanpaAkun.find((s) => s.username === "fikri")?.usulan).toMatchObject({ peranAman: "pelaksana", peranPadanan: "panitera-muda" });

    // Ketetapan ke akun SIPP yang diblokir / diklaim akun lain tidak berlaku.
    const blokir = susunPratinjauTautanSipp({
      akun: [akun("usr-f", "FIKRIANTO, S.H.")],
      kredensial: [],
      sipp: [sipp("fikri", "Fikrianto, S.H.", { diblokir: true })],
      ketetapan: KETETAPAN_PENGGUNA,
    });
    expect(blokir.baris[0].kelompok).toBe("sipp-nonaktif");
    const diklaim = susunPratinjauTautanSipp({
      akun: [akun("usr-f", "FIKRIANTO, S.H."), akun("usr-lain", "ORANG LAIN")],
      kredensial: [kred("usr-lain", "fikri")],
      sipp: [sipp("fikri", "Fikrianto, S.H.")],
      ketetapan: KETETAPAN_PENGGUNA,
    });
    expect(diklaim.baris.find((b) => b.userId === "usr-f")?.kelompok).toBe("ganda");
  });

  it("penyaring: pasti hanya ke padanannya, ganda hanya ke calon aktif, satu SIPP satu akun", () => {
    const bahan: BahanTautan = {
      akun: [akun("usr-q", "QADARIYAH"), akun("usr-n", "NARTI"), akun("usr-root", "ROOT", { roleId: "super-admin" })],
      kredensial: [],
      sipp: [sipp("qadariyah", "Qadariyah"), sipp("meja2p", "Narti"), sipp("meja2g", "Narti"), sipp("jsx", "Narti", { diblokir: true })],
    };
    const p = susunPratinjauTautanSipp(bahan);
    const { diterima, ditolak } = saringPilihanTerapkan(
      p,
      [
        { userId: "usr-q", usernameSipp: "meja2p" },
        { userId: "usr-n", usernameSipp: "jsx" },
        { userId: "usr-root", usernameSipp: "qadariyah" },
      ],
      []
    );
    expect(diterima).toEqual([]);
    expect(ditolak.map((d) => d.sebab).join(" | ")).toMatch(/padanan pastinya.*diblokir.*super-admin/);

    const ok = saringPilihanTerapkan(p, [{ userId: "usr-q", usernameSipp: "QADARIYAH" }, { userId: "usr-n", usernameSipp: "meja2g" }], []);
    expect(ok.diterima).toEqual([
      { userId: "usr-q", usernameSipp: "qadariyah" },
      { userId: "usr-n", usernameSipp: "meja2g" },
    ]);
    const dua = saringPilihanTerapkan(p, [{ userId: "usr-q", usernameSipp: "qadariyah" }, { userId: "usr-n", usernameSipp: "qadariyah" }], []);
    expect(dua.diterima).toEqual([]);

    const buat = saringBuatAkun(
      susunPratinjauTautanSipp({ akun: [], kredensial: [], sipp: [sipp("meja2p", "Narti"), sipp("meja2g", "Narti")] }),
      ["meja2p", "meja2g", "tidakada"]
    );
    expect(buat.diterima.map((s) => s.username)).toEqual(["meja2p"]);
    expect(buat.ditolak.map((d) => d.usernameSipp)).toEqual(["meja2g", "tidakada"]);
  });
});

// ============================================================================
// C. BASIS DATA: PRATINJAU, TERAPKAN, BATAL, MASUK DENGAN PASSWORD SIPP
// ============================================================================

let db: AletaDatabase | null = null;
afterEach(async () => {
  kosongkanBatasMasukSipp();
  await db?.close?.();
  db = null;
});

async function buatPengguna(d: AletaDatabase, id: string, nama: string, peran = "pelaksana", lain: { username?: string; nip?: string } = {}) {
  const waktu = new Date().toISOString();
  const jabatan = await d.queryOne<{ id: string }>(`SELECT id FROM positions LIMIT 1`);
  await d.run(
    `INSERT INTO users (id, username, password_hash, name, nip, email, whatsapp_number, role_id, position_id, created_at, updated_at)
     VALUES (?, ?, 'x', ?, ?, ?, '0', ?, ?, ?, ?)`,
    [id, lain.username ?? id, nama, lain.nip ?? null, `${id}@uji.local`, peran, String(jabatan?.id), waktu, waktu]
  );
}

const hitung = async (d: AletaDatabase, tabel: string) =>
  Number((await d.queryOne<{ n: number | string }>(`SELECT COUNT(*) AS n FROM ${tabel}`))?.n ?? 0);

function depsSipp(daftar: PenggunaSippDaftar[]): DepsTautanSemua {
  return { daftarSipp: async () => ({ ok: true, data: { pengguna: daftar } }) };
}

const SIPP_UJI = [
  sipp("qadariyah", "Qadariyah, S.H.", { sippUserId: "11", grup: ["Kasir"] }),
  sipp("meja1g", "Tiffany RS", { sippUserId: "16", grup: ["Meja I Gugatan"] }),
  sipp("sitti", "Sitti Nurhidayah, S.H.I.", { sippUserId: "12", grup: ["Panitera Pengganti"] }),
  sipp("hakimbaru", "Hakim Baru Sekali", { sippUserId: "13", grup: ["Hakim"] }),
  sipp("meja2p", "Narti", { sippUserId: "14" }),
  sipp("meja2g", "Narti", { sippUserId: "15" }),
];

describe("C. basis data", () => {
  it("pratinjau TIDAK menulis apa pun; bot mati = galat, bukan pratinjau kosong", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-qa", "QADARIYAH, S.H.");
    const sebelum = [await hitung(db, "users"), await hitung(db, "external_app_credentials"), await hitung(db, "audit_logs")];
    const p = await pratinjauTautanSemua(db, depsSipp(SIPP_UJI));
    expect(p.baris.find((b) => b.userId === "usr-qa")?.kelompok).toBe("pasti");
    expect([await hitung(db, "users"), await hitung(db, "external_app_credentials"), await hitung(db, "audit_logs")]).toEqual(sebelum);
    await expect(pratinjauTautanSemua(db, { daftarSipp: async () => ({ ok: false, error: "bot mati" }) })).rejects.toThrow(/bot mati/);
  });

  it("terapkan: tautan + sub-peran + akun baru dalam satu transaksi, tanpa password, peran utama tidak diubah, dengan audit", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-qa", "QADARIYAH, S.H.", "panitera-pengganti");
    await buatPengguna(db, "usr-tif", "TIFFANY RS", "analis-perkara");
    await db.run(`UPDATE users SET additional_role_ids_json = '["operator_sipp"]' WHERE id = 'usr-tif'`, []);
    await db.run(
      `INSERT INTO external_app_credentials (id, user_id, app_id, external_username, is_enabled, last_verified_status, created_at, updated_at)
       VALUES ('eac-tif', 'usr-tif', 'sipp', 'meja1g', 1, 'verified', 'x', 'x')`,
      []
    );
    await buatPengguna(db, "usr-uji-admin", "ADMIN UJI", "admin");
    const aktor = { id: "usr-uji-admin", roleId: "admin" };
    const posisiSebelum = await db.queryAll<{ id: string; role_id: string; position_id: string }>(
      `SELECT id, role_id, position_id FROM users WHERE id IN ('usr-qa', 'usr-tif') ORDER BY id`,
      []
    );

    const pr = await pratinjauTautanSemua(db, depsSipp(SIPP_UJI));
    expect(pr.baris.find((b) => b.userId === "usr-tif")).toMatchObject({ kelompok: "sudah", subPeranUsulan: ["petugas_meja_1_gugatan"] });
    expect(pr.baris.find((b) => b.userId === "usr-qa")).toMatchObject({ kelompok: "pasti", subPeranUsulan: ["kasir"] });

    await expect(
      terapkanTautanSemua(db, depsSipp(SIPP_UJI), { id: "usr-qa", roleId: "pelaksana" }, { tautkan: [{ userId: "usr-qa", usernameSipp: "qadariyah" }] })
    ).rejects.toThrow(/Admin/);

    const hasil = await terapkanTautanSemua(db, depsSipp(SIPP_UJI), aktor, {
      tautkan: [{ userId: "usr-qa", usernameSipp: "qadariyah" }],
      buat: ["sitti", "hakimbaru", "meja2p", "meja2g"],
      subPeran: ["usr-qa", "usr-tif", "usr-uji-admin"],
    });
    expect(hasil.ditautkan).toEqual([{ userId: "usr-qa", usernameSipp: "qadariyah" }]);
    expect(hasil.subPeran).toEqual([
      { userId: "usr-qa", tambah: ["kasir"] },
      { userId: "usr-tif", tambah: ["petugas_meja_1_gugatan"] },
    ]);
    expect(hasil.dibuat.map((d) => [d.usernameSipp, d.peran, d.jabatan])).toEqual([
      ["sitti", "pelaksana", "pos-pengadministrasi-umum"],
      ["hakimbaru", "pelaksana", "pos-pengadministrasi-umum"],
      ["meja2p", "pelaksana", "pos-pengadministrasi-umum"],
    ]);
    expect(hasil.ditolak.map((d) => d.usernameSipp)).toEqual(["meja2g"]);

    // Peran utama & jabatan akun yang ada TIDAK berubah; sub-peran digabung, tidak dikurangi.
    expect(
      await db.queryAll(`SELECT id, role_id, position_id FROM users WHERE id IN ('usr-qa', 'usr-tif') ORDER BY id`, [])
    ).toEqual(posisiSebelum);
    expect(
      JSON.parse(String((await db.queryOne<{ j: string }>(`SELECT additional_role_ids_json AS j FROM users WHERE id = 'usr-tif'`))?.j))
    ).toEqual(["operator_sipp", "petugas_meja_1_gugatan"]);
    expect(
      JSON.parse(String((await db.queryOne<{ j: string }>(`SELECT additional_role_ids_json AS j FROM users WHERE username = 'meja2p'`))?.j))
    ).toEqual(["petugas_meja_2_permohonan"]);

    const tautan = await db.queryOne<Record<string, unknown>>(
      `SELECT external_username, encrypted_password, password_md5_hash, is_enabled, tautan_sumber, tautan_ditinjau_oleh FROM external_app_credentials WHERE user_id = 'usr-qa'`
    );
    expect(tautan).toMatchObject({ external_username: "qadariyah", encrypted_password: "", password_md5_hash: "", tautan_sumber: "admin-massal", tautan_ditinjau_oleh: "usr-uji-admin" });
    expect(akunSippMilik(await bacaKredensialSipp(db), "usr-qa")).toEqual(["qadariyah"]);

    const baru = await db.queryOne<{ id: string; password_hash: string; role_id: string; email: string }>(
      `SELECT id, password_hash, role_id, email FROM users WHERE username = 'sitti'`
    );
    expect(baru?.password_hash).toBe("");
    expect(baru?.email).toMatch(/@aleta\.invalid$/);
    expect(await db.queryOne(`SELECT id FROM accounts WHERE user_id = ? AND provider_id = 'credential'`, [baru!.id])).toBeFalsy();

    const audit = (await db.queryAll<{ action: string; actor_user_id: string }>(`SELECT action, actor_user_id FROM audit_logs`, [])).filter((a) =>
      /SIPP/.test(a.action)
    );
    expect(audit.map((a) => a.action).sort()).toEqual(
      [
        "ADD_SUB_ROLE_FROM_SIPP",
        "ADD_SUB_ROLE_FROM_SIPP",
        "CREATE_USER_FROM_SIPP",
        "CREATE_USER_FROM_SIPP",
        "CREATE_USER_FROM_SIPP",
        "LINK_SIPP_ACCOUNT_BULK",
        "SIPP_BULK_LINK_APPLY",
      ].sort()
    );
    expect(new Set(audit.map((a) => a.actor_user_id))).toEqual(new Set(["usr-uji-admin"]));
  });

  it("satu yang gagal di dalam transaksi = seluruh penerapan DIGULUNG (BEGIN ... ROLLBACK, tanpa COMMIT)", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-qa", "QADARIYAH, S.H.");
    await buatPengguna(db, "usr-uji-admin", "ADMIN UJI", "admin");
    // Jabatan aman dihapus -> pembuatan akun gagal SESUDAH tautan usr-qa ditulis.
    await db.run(`DELETE FROM positions WHERE id = 'pos-pengadministrasi-umum'`, []);
    // pg-mem tidak menggulung transaksi sungguhan; yang dibuktikan di sini:
    // seluruh tulisan berjalan di SATU klien transaksi yang diakhiri ROLLBACK.
    const pool = db.getQueryable() as unknown as { connect: () => Promise<{ query: (...a: unknown[]) => unknown }> };
    const asli = pool.connect.bind(pool);
    const kendali: string[] = [];
    pool.connect = async () => {
      const klien = await asli();
      const q = klien.query.bind(klien);
      klien.query = (...a: unknown[]) => {
        if (typeof a[0] === "string" && /^(BEGIN|COMMIT|ROLLBACK)$/.test(a[0].trim())) kendali.push(a[0].trim());
        return q(...a);
      };
      return klien;
    };
    await expect(
      terapkanTautanSemua(db, depsSipp(SIPP_UJI), { id: "usr-uji-admin", roleId: "admin" }, {
        tautkan: [{ userId: "usr-qa", usernameSipp: "qadariyah" }],
        buat: ["hakimbaru"],
      })
    ).rejects.toThrow(/belum ada di ALETA/);
    expect(kendali).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("batal per akun: tautan dinonaktifkan (tidak dihapus), akun buatan alat ikut nonaktif; tautan manual tidak dapat dibatalkan di sini", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-qa", "QADARIYAH, S.H.");
    await buatPengguna(db, "usr-uji-admin", "ADMIN UJI", "admin");
    const aktor = { id: "usr-uji-admin", roleId: "admin" };
    const hasil = await terapkanTautanSemua(db, depsSipp(SIPP_UJI), aktor, { tautkan: [{ userId: "usr-qa", usernameSipp: "qadariyah" }], buat: ["sitti"] });

    expect(await batalkanTautanMassal(db, aktor, "usr-qa")).toMatchObject({ ok: true, akunDinonaktifkan: false });
    expect(akunSippMilik(await bacaKredensialSipp(db), "usr-qa")).toEqual([]);
    expect((await db.queryOne<{ external_username: string }>(`SELECT external_username FROM external_app_credentials WHERE user_id = 'usr-qa'`))?.external_username).toBe("qadariyah");

    const idBaru = hasil.dibuat[0].userId;
    expect(await batalkanTautanMassal(db, aktor, idBaru)).toMatchObject({ ok: true, akunDinonaktifkan: true });
    expect(Number((await db.queryOne<{ is_active: number }>(`SELECT is_active FROM users WHERE id = ?`, [idBaru]))?.is_active)).toBe(0);

    // Pratinjau sesudahnya: yang dibatalkan = "dicabut", tidak diusulkan lagi.
    const p = await pratinjauTautanSemua(db, depsSipp(SIPP_UJI));
    expect(p.baris.find((b) => b.userId === "usr-qa")?.kelompok).toBe("dicabut");

    await buatPengguna(db, "usr-manual", "MANUAL");
    await db.run(
      `INSERT INTO external_app_credentials (id, user_id, app_id, external_username, is_enabled, created_at, updated_at) VALUES ('eac-m', 'usr-manual', 'sipp', 'manual', 1, 'x', 'x')`,
      []
    );
    await expect(batalkanTautanMassal(db, aktor, "usr-manual")).rejects.toThrow(/bukan buatan/);
  });

  it("akun BARU (tanpa password ALETA) masuk dengan password SIPP, ditolak tanpa password / password salah / bot mati", async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    await buatPengguna(db, "usr-uji-admin", "ADMIN UJI", "admin");
    await terapkanTautanSemua(db, depsSipp(SIPP_UJI), { id: "usr-uji-admin", roleId: "admin" }, { buat: ["sitti"] });
    const d = db;
    const SANDI_SIPP = "sandi-sipp-palsu";
    const deps = (botHidup = true) => ({
      cariPengguna: async (identitas: string) => {
        const u = await lookupUserForLoginInDb(d, { identifier: identitas });
        return u ? { id: u.id, roleId: u.roleId, name: u.name } : null;
      },
      akunSippMilik: async (userId: string) => akunSippMilik(await bacaKredensialSipp(d), userId),
      verifikasiSipp: async (username: string, sandi: string) =>
        botHidup
          ? { ok: true as const, data: { ditemukan: username === "sitti", cocok: username === "sitti" && sandi === SANDI_SIPP, sippUserId: "12" } }
          : { ok: false as const, error: "bot mati" },
      // Pemeriksa password ALETA yang SEBENARNYA dipakai: baris accounts 'credential'.
      verifikasiSandiAleta: async (userId: string) =>
        Boolean(await d.queryOne(`SELECT id FROM accounts WHERE user_id = ? AND provider_id = 'credential' AND password IS NOT NULL`, [userId])),
      catatJejak: async () => undefined,
    });
    const h = new Headers({ "x-forwarded-for": "10.0.0.9" });
    const masuk = await putuskanMasukSipp(deps(), { identitas: "sitti", sandi: SANDI_SIPP }, { headers: h }, {});
    expect(masuk).toMatchObject({ jenis: "masuk", lewat: "sipp", usernameSipp: "sitti" });
    expect((await putuskanMasukSipp(deps(), { identitas: "sitti", sandi: "" }, { headers: h }, {})).jenis).toBe("tolak");
    expect((await putuskanMasukSipp(deps(), { identitas: "sitti", sandi: "salah" }, { headers: h }, {})).jenis).toBe("tolak");
    expect((await putuskanMasukSipp(deps(false), { identitas: "sitti", sandi: SANDI_SIPP }, { headers: h }, {})).jenis).toBe("tolak");
  });
});

// ============================================================================
// D. TANDA TANGAN: TAUTAN OTOMATIS LEWAT NAMA
// ============================================================================

const AKUN_TTD: AkunTtd[] = [
  { id: "usr-himawan", nama: "HIMAWAN TATURA WIJAYA, S.H.I.,M.H.", peran: "hakim", subPeran: "" },
  { id: "usr-sudarmin", nama: "SUDARMIN H.I.M. TANG, S.H.I.,M.H", peran: "wakil-ketua", subPeran: "" },
  { id: "usr-sri1", nama: "SRI WAHYUNI, S.H.", peran: "panitera-muda", subPeran: "" },
  { id: "usr-sri2", nama: "Sri Wahyuni", peran: "pelaksana", subPeran: "" },
  { id: "usr-mati", nama: "LUKMAN HAKIM, S.E.", peran: "kasubag", subPeran: "", isActive: false },
];

describe("D. tanda tangan bernama -> akun", () => {
  it("pasti / ganda / tidak ketemu / sudah / tanpa nama", () => {
    const hasil = cocokkanTtdKeAkun(
      [
        { id: 7, namaPejabat: "HIMAWAN TATURA WIJAYA, S.H.I., M.H.", penggunaId: "", disahkan: true },
        { id: 12, namaPejabat: "SUDARMIN, H.I.M. TANG, S.H.I., M.H", penggunaId: "", disahkan: true },
        { id: 20, namaPejabat: "SRI WAHYUNI, S.H.", penggunaId: "", disahkan: false },
        { id: 9, namaPejabat: "LUKMAN HAKIM, S.E., M.AK.", penggunaId: "", disahkan: true },
        { id: 11, namaPejabat: "HIMAWAN TATURA WIJAYA", penggunaId: "usr-himawan", disahkan: true },
        { id: 30, namaPejabat: "", penggunaId: "", disahkan: false },
      ],
      AKUN_TTD
    );
    expect(hasil.map((h) => [h.id, h.kelompok, h.akun?.id ?? ""])).toEqual([
      [7, "pasti", "usr-himawan"],
      [12, "pasti", "usr-sudarmin"],
      [20, "ganda", ""],
      [9, "tidak-ketemu", ""],
      [11, "sudah", "usr-himawan"],
      [30, "tanpa-nama", ""],
    ]);
    expect(akunPastiUntukNama("Munifah", [{ id: "m", nama: "MUNIFA, S.H.", peran: "x", subPeran: "" }]).jenis).toBe("tidak");
  });

  it("pratinjau tidak menulis; terapkan hanya yang pasti (dan yang dipilih), membawa nama untuk penjaga bot", async () => {
    const tulis: Array<{ id: number; namaPejabat: string; penggunaId: string }> = [];
    const deps = {
      daftarBerkas: async () => [
        { id: 7, namaPejabat: "HIMAWAN TATURA WIJAYA, S.H.I., M.H.", penggunaId: "", disahkan: true },
        { id: 12, namaPejabat: "SUDARMIN, H.I.M. TANG, S.H.I., M.H", penggunaId: "", disahkan: true },
        { id: 20, namaPejabat: "SRI WAHYUNI, S.H.", penggunaId: "", disahkan: false },
      ],
      daftarAkun: async () => AKUN_TTD,
      tulisTautan: async (id: number, p: { penggunaId: string; namaPejabat: string }) => {
        tulis.push({ id, namaPejabat: p.namaPejabat, penggunaId: p.penggunaId });
        return { ok: true };
      },
    };
    const pratinjau = await tautkanTtdOtomatis(deps, { terapkan: false });
    expect(pratinjau.ringkasan).toMatchObject({ pasti: 2, ganda: 1 });
    expect(tulis).toEqual([]);

    await tautkanTtdOtomatis(deps, { terapkan: true, ids: [12, 20] });
    expect(tulis).toEqual([{ id: 12, namaPejabat: "SUDARMIN, H.I.M. TANG, S.H.I., M.H", penggunaId: "usr-sudarmin" }]);
  });

  it("unggahan baru tanpa akun dipilih: ditautkan bila pasti, tidak bila ganda atau akun sudah dipilih", () => {
    expect(tautanSaatUnggah({ namaPejabat: "Himawan Tatura Wijaya", penggunaId: "" }, AKUN_TTD)).toMatchObject({ penggunaId: "usr-himawan", peran: "hakim" });
    expect(tautanSaatUnggah({ namaPejabat: "Sri Wahyuni", penggunaId: "" }, AKUN_TTD)).toBeNull();
    expect(tautanSaatUnggah({ namaPejabat: "Himawan Tatura Wijaya", penggunaId: "usr-lain" }, AKUN_TTD)).toBeNull();
  });

  it("bot tautkanAkun: hanya berkas belum bertaut dengan nama yang SAMA, tidak menyentuh pengesahan", async () => {
    const AKAR_BOT = path.resolve(process.cwd(), "..", "aleta_bot");
    const muatBot = createRequire(path.join(AKAR_BOT, "services", "x.js"));
    const jalurDb = muatBot.resolve("../bot_db_config");
    const jalurLayanan = muatBot.resolve("./tandaTanganService");
    const tabel = [
      { id: 1, nama_pejabat: "HIMAWAN", pengguna_id: "", disahkan: 1 },
      { id: 2, nama_pejabat: "IDRIS", pengguna_id: "usr-manusia", disahkan: 1 },
    ];
    const kueriTercatat: string[] = [];
    const palsu = {
      query(sql: string, params: unknown[], cb: (e: unknown, r?: unknown) => void) {
        kueriTercatat.push(sql);
        if (/information_schema/.test(sql)) return cb(null, [{ n: 1 }]);
        if (/^\s*UPDATE/.test(sql)) {
          const [pid, , , id, nama] = params as [string, string, string, number, string];
          const b = tabel.find((x) => x.id === id && x.pengguna_id === "" && x.nama_pejabat === nama);
          if (b) b.pengguna_id = pid;
          return cb(null, { affectedRows: b ? 1 : 0 });
        }
        return cb(null, []);
      },
    };
    const cache = muatBot.cache as Record<string, unknown>;
    const lama = cache[jalurDb];
    delete cache[jalurLayanan];
    cache[jalurDb] = { id: jalurDb, filename: jalurDb, loaded: true, exports: palsu };
    try {
      const ttd = muatBot("./tandaTanganService") as {
        tautkanAkun: (id: number, p: Record<string, string>) => Promise<{ ok: boolean; alasan?: string }>;
      };
      expect(await ttd.tautkanAkun(1, { penggunaId: "usr-himawan", namaPejabat: "HIMAWAN" })).toMatchObject({ ok: true });
      expect(await ttd.tautkanAkun(2, { penggunaId: "usr-lain", namaPejabat: "IDRIS" })).toMatchObject({ ok: false, alasan: "sudah_bertaut_atau_nama_berubah" });
      expect(await ttd.tautkanAkun(1, { penggunaId: "", namaPejabat: "HIMAWAN" })).toMatchObject({ ok: false, alasan: "akun_kosong" });
      expect(tabel.map((b) => [b.pengguna_id, b.disahkan])).toEqual([
        ["usr-himawan", 1],
        ["usr-manusia", 1],
      ]);
      expect(kueriTercatat.filter((q) => /^\s*UPDATE/.test(q)).every((q) => !/disahkan/.test(q))).toBe(true);
    } finally {
      delete cache[jalurLayanan];
      if (lama) cache[jalurDb] = lama;
      else delete cache[jalurDb];
    }
  });
});
