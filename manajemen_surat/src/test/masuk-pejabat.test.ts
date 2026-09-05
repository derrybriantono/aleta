// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { masukLangkahPerkara, masukSebagaiPejabat } from "@/server/modules/aleta-ecourt/masuk-pejabat";
import { type UsulanPenetapan } from "@/server/modules/aleta-ecourt/rencana-penetapan";
import { createManagedUserInDb } from "@/server/modules/users/service";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";
import { simpanAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { encryptCredentialSecret } from "@/server/shared/security";

/**
 * Masuk SIPP atas nama pejabat lain.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Ini pintu yang memakai kredensial ORANG LAIN, dan segala yang dikerjakan
 * sesudahnya tercatat di SIPP atas nama orang itu. Maka yang diuji paling
 * keras bukan kemampuannya membuka, melainkan sikapnya MENOLAK:
 *
 *   - akun yang sandinya belum teruji ditolak DI SINI, bukan dibiarkan gagal
 *     di tengah rangkaian dan meninggalkan perkara setengah jadi,
 *
 *   - akun yang diblokir karena mutasi tidak pernah terpilih,
 *
 *   - halaman jembatannya WAJIB membawa perintah menutup sesi lama dan nama
 *     yang harus dibuktikan. Tanpa keduanya, sesi lama yang bertahan akan
 *     membuat penetapan tercatat atas akun yang kebetulan sedang terbuka,
 *
 *   - jejaknya ditulis SEBELUM jembatan dibuka, supaya percobaan yang putus di
 *     tengah tetap terbaca.
 */
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: vi.fn(),
}));

const { callAletaBotSippBridge } = await import("@/server/modules/aleta-sipp/aleta-sipp-datasource");
const jembatan = vi.mocked(callAletaBotSippBridge);

let db: AletaDatabase | null = null;

const akun = (
  username: string,
  pejabatId: string,
  kode: string,
  namaLengkap: string,
  grup: string,
  diblokir = false
) => ({
  username,
  namaLengkap,
  grup,
  pejabatId,
  kode,
  nama: namaLengkap,
  nip: "",
  diblokir,
  kedaluwarsa: false,
  aktif: !diblokir,
  terakhirMasuk: "2026-09-02T00:00:00.000Z",
});

// Disalin dari keadaan PA Donggala yang berjalan.
const DARI_SIPP = {
  hakim: [
    akun("fahri", "32", "A", "Fahri Saifuddin, S.H.I., M.H.", "Ketua/Wakil Ketua"),
    akun("sudarmin", "33", "B", "Sudarmin H.I.M. Tang, S.H.I.,M.H", "Ketua/Wakil Ketua"),
    akun("Himawan", "26", "C1", "Himawan Tatura Wijaya, S.H.I.,M.H.", "Hakim"),
    akun("Waka062024", "29", "B", "Akbar Ali, S.H.I.", "Hakim", true),
  ],
  panitera: [akun("Sri Susilowati", "26", "", "Sri Susilowati, S.H.", "Panitera/Wakil Panitera")],
  jurusita: [],
};

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  jembatan.mockReset();
  jembatan.mockResolvedValue({ ok: true, data: DARI_SIPP, bridge: {} } as never);
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function pasangKredensial(username: string, keadaan: string, userId = "usr-super") {
  const waktu = new Date().toISOString();
  // userId dapat diganti: external_app_credentials UNIK per (user_id, app_id),
  // jadi beberapa akun SIPP menuntut beberapa pengguna ALETA yang berbeda.
  await (db as AletaDatabase)
    .prepare(
      `INSERT INTO external_app_credentials (
        id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
        is_enabled, last_verified_status, created_at, updated_at
      ) VALUES (?, ?, 'sipp', ?, ?, '', 1, ?, ?, ?)`
    )
    .run(
      `eac-${userId}-${username.replace(/\W/g, "")}`,
      userId,
      username,
      encryptCredentialSecret("sandi-sipp"),
      keadaan,
      waktu,
      waktu
    );
}

const superAdmin = {
  id: "usr-super",
  name: "SUPER ADMIN DERRY",
  isActive: true,
  roleId: "super-admin" as const,
};

async function jumlahJejak() {
  const baris = await (db as AletaDatabase)
    .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'SIPP_MASUK_SEBAGAI_PEJABAT'")
    .get<{ n: number }>();
  return Number(baris?.n ?? 0);
}

describe("menolak yang belum siap", () => {
  it("akun yang sandinya BELUM DIUJI ditolak, bukan dicoba", async () => {
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.BELUM_DIUJI);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, { actor: superAdmin, jenis: "pmh", pejabatId: "32" })
    ).rejects.toThrow(/belum siap/i);
    expect(await jumlahJejak()).toBe(0);
  });

  it("akun yang sandinya sudah tidak cocok ditolak dengan sebabnya", async () => {
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SANDI_SALAH);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, { actor: superAdmin, jenis: "pmh", pejabatId: "32" })
    ).rejects.toThrow(/tidak cocok/i);
  });

  it("akun yang diblokir karena mutasi tidak pernah terpilih", async () => {
    // Akbar Ali sudah mutasi, akunnya diblokir. Yang benar adalah menolak,
    // bukan memaksa memakainya.
    await pasangKredensial("Waka062024", KEADAAN_KREDENSIAL.SAH);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, { actor: superAdmin, jenis: "phs", pejabatId: "29" })
    ).rejects.toThrow(/tidak ada akun SIPP aktif/i);
  });

  it("pejabat yang tidak dikenal ditolak, bukan asal ambil akun lain", async () => {
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, { actor: superAdmin, jenis: "pmh", pejabatId: "9999" })
    ).rejects.toThrow(/tidak ada akun SIPP aktif/i);
  });

  it("jenis penetapan yang tidak dikenali ditolak", async () => {
    await expect(
      masukSebagaiPejabat(db as AletaDatabase, {
        actor: superAdmin,
        jenis: "penetapan-karangan",
        pejabatId: "32",
      })
    ).rejects.toThrow(/tidak dikenali/i);
  });

  it("akun ALETA yang tidak aktif ditolak", async () => {
    await expect(
      masukSebagaiPejabat(db as AletaDatabase, {
        actor: { ...superAdmin, isActive: false },
        jenis: "pmh",
        pejabatId: "32",
      })
    ).rejects.toThrow(/tidak aktif/i);
  });

  it("bot yang mati menghentikan, bukan meloloskan", async () => {
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH);
    jembatan.mockResolvedValue({ ok: false, error: "bridge mati", bridge: {} } as never);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, { actor: superAdmin, jenis: "pmh", pejabatId: "32" })
    ).rejects.toThrow(/tidak terbaca/i);
  });
});

describe("membuka jembatan yang berhati-hati", () => {
  beforeEach(async () => {
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH);
  });

  it("halaman jembatannya membawa perintah menutup sesi lama", async () => {
    // Tanpa ini, halaman masuk SIPP mengalihkan ke dashboard dan sesi LAMA
    // yang bertahan - penetapan akan tercatat atas akun yang sedang terbuka.
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
    });

    expect(html).toContain("logout");
    expect(html).toMatch(/alamatKeluar/);
  });

  it("membawa nama yang harus dibuktikan sesudah mendarat", async () => {
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
    });

    expect(html).toContain("Fahri Saifuddin");
    expect(html).toMatch(/namaDiharap/);
  });

  it("memakai kredensial PEJABATNYA, bukan milik yang menekan tombol", async () => {
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
    });

    expect(html).toContain("fahri");
    // Nama operator BOLEH - bahkan harus - tampil sebagai pertanggungjawaban.
    // Yang dilarang adalah mengaku kredensialnya milik operator, sebab itu
    // menyesatkan justru di layar yang harus paling jelas.
    expect(html).toContain("dikerjakan oleh SUPER ADMIN DERRY");
    expect(html).not.toContain("milik SUPER ADMIN DERRY");
  });

  it("tombol masuk manual DIBUANG pada jalur ini", async () => {
    // Tombol itu menyimpan sandi pejabat lain di dalam halaman, dengan tombol
    // yang mengirimkannya tanpa menutup sesi lama dan tanpa membuktikan
    // pendaratannya. Ia memotong seluruh pengaman yang baru dibangun.
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
    });

    // Yang dijaga: tidak ada FORMULIR dan tidak ada TOMBOL KIRIM di halaman.
    // Bukan kata "manual" - kata itu juga muncul pada pesan captcha yang tidak
    // ada hubungannya, dan menuntutnya hilang hanya membuat uji ini rewel
    // tanpa menjaga apa pun.
    expect(html).not.toContain('id="cadangan"');
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain('type="hidden"');
  });

  it("jejaknya ditulis SEBELUM jembatan dibuka", async () => {
    await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
      nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
    });

    expect(await jumlahJejak()).toBe(1);
    const baris = await (db as AletaDatabase)
      .prepare(
        "SELECT payload_json FROM audit_logs WHERE action = 'SIPP_MASUK_SEBAGAI_PEJABAT' LIMIT 1"
      )
      .get<{ payload_json: string }>();
    const isi = JSON.parse(String(baris?.payload_json ?? "{}"));
    expect(isi.akunSipp).toBe("fahri");
    expect(isi.nomorPerkara).toBe("545/Pdt.G/2026/PA.Dgl");
    expect(isi.dikerjakanOleh).toBe("SUPER ADMIN DERRY");
  });
});

describe("resolusi pelaksana per langkah", () => {
  const usulan: UsulanPenetapan = {
    perkaraId: "10096",
    tanggalPenetapan: "2026-09-01",
    pmh: { bentuk: "majelis", majelisKode: "B", ketuaHakimId: "33", anggotaHakimId: ["28"], sebab: "" },
    ppp: { paniteraId: "", sebab: "" },
    pjs: { jurusitaId: "", nama: "", dugaanBerhalangan: false, sebab: "" },
    phs: { tanggalSidang: "2026-09-15", sebab: "" },
    // Majelisnya sudah tercatat - PMH perkara ini sudah tersimpan. Tanpa itu
    // PHS memang tidak boleh dibukakan sesi siapa pun.
    tercatat: { ada: true, ketuaHakimId: "33", ketuaNama: "Sudarmin H.I.M. Tang" },
  };

  beforeEach(async () => {
    // Tiga pejabat, tiga pengguna ALETA berbeda dengan perannya masing-masing -
    // sebab kredensial SIPP unik per pengguna, dan peran itulah yang membedakan
    // pimpinan (ketua) dari panitera saat resolusi.
    const buat = async (positionId: string, tandai: string) =>
      (
        await createManagedUserInDb(db as AletaDatabase, "usr-super", {
          roleOverride: null,
          username: `pelaksana_${tandai}`,
          password: "rahasia123",
          email: `pelaksana_${tandai}@pa.go.id`,
          whatsappNumber: `628129${tandai}`,
          name: `Pelaksana ${tandai}`,
          nip: `19940102201799${tandai}`,
          positionId,
          isActive: true,
        })
      ).id;

    const idKetua = await buat("pos-ketua", "0001");
    const idHakim = await buat("pos-hakim", "0002");
    const idPanitera = await buat("pos-panitera", "0003");

    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH, idKetua);
    await pasangKredensial("sudarmin", KEADAAN_KREDENSIAL.SAH, idHakim);
    await pasangKredensial("Sri Susilowati", KEADAAN_KREDENSIAL.SAH, idPanitera);
  });

  it("PMH masuk sebagai PIMPINAN, bukan ketua majelis perkara", async () => {
    // Ketua majelis perkara ini sudarmin (id 33). PMH tetap dikerjakan
    // pimpinan pengadilan - fahri - bukan sudarmin.
    const html = await masukLangkahPerkara(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      nomorPerkara: "545/Pdt.G/2026",
      usulan,
    });
    expect(html).toContain("Fahri Saifuddin");
  });

  it("PPP masuk sebagai PANITERA", async () => {
    const html = await masukLangkahPerkara(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "ppp",
      nomorPerkara: "545",
      usulan,
    });
    expect(html).toContain("Sri Susilowati");
  });

  it("PHS masuk sebagai KETUA MAJELIS YANG TERCATAT pada perkara itu", async () => {
    const html = await masukLangkahPerkara(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "phs",
      nomorPerkara: "545",
      usulan,
    });
    expect(html).toContain("Sudarmin");
  });

  it("PHS mengikuti yang TERCATAT, bukan yang diusulkan, bila keduanya berbeda", async () => {
    // Penetapan yang menyimpang dari usulan memang terjadi dan sah. Yang
    // membuka sesi harus mengikuti yang benar-benar ditetapkan.
    const html = await masukLangkahPerkara(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "phs",
      nomorPerkara: "545",
      usulan: { ...usulan, tercatat: { ada: true, ketuaHakimId: "32", ketuaNama: "Fahri" } },
    });
    expect(html).toContain("Fahri Saifuddin");
    expect(html).not.toContain("Sudarmin");
  });

  it("PHS DITOLAK selama majelisnya belum tercatat", async () => {
    // Inti penjagaannya: yang dibuka di sini sesi SIPP atas nama orang lain,
    // dan usulan boleh berubah sampai PMH benar-benar tersimpan. Masuk sebagai
    // hakim yang ternyata bukan ketua majelisnya berarti PHS tercatat atas
    // nama yang keliru.
    await expect(
      masukLangkahPerkara(db as AletaDatabase, {
        actor: superAdmin,
        jenis: "phs",
        nomorPerkara: "545",
        usulan: { ...usulan, tercatat: { ada: false, ketuaHakimId: "", ketuaNama: "" } },
      })
    ).rejects.toThrow(/Kerjakan PMH lebih dulu/i);
  });

  it("Data Umum ditolak - bukan langkah akun pejabat lain", async () => {
    await expect(
      masukLangkahPerkara(db as AletaDatabase, {
        actor: superAdmin,
        jenis: "data-umum",
        nomorPerkara: "545",
        usulan,
      })
    ).rejects.toThrow(/tidak dikerjakan dengan akun pejabat lain/i);
  });
});

describe("gerbang jabatan", () => {
  it("Super Admin selalu berwenang", async () => {
    await pasangKredensial("Sri Susilowati", KEADAAN_KREDENSIAL.SAH);
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "ppp",
      pejabatId: "26",
    });
    expect(html).toContain("Sri Susilowati");
  });

  it("bawaannya LONGGAR - peran mana pun boleh, sesuai cara kerja yang berjalan", async () => {
    // Penetapan memang disiapkan operator atas arahan Ketua Pengadilan.
    // Menahannya di sini akan mematikan seluruh gunanya fitur ini.
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH);
    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: { ...superAdmin, roleId: "panitera-muda" as const },
      jenis: "pmh",
      pejabatId: "32",
    });
    expect(html).toContain("Fahri Saifuddin");
  });

  it("mode KETAT dari pengaturan benar-benar dipatuhi di sini", async () => {
    // Inilah celah yang ditutup: modenya dulu tidak dibaca sama sekali, jadi
    // pengadilan yang memilih ketat tetap dijaga saat menutup antrean tetapi
    // TIDAK dijaga pada jalur yang memakai kredensial orang lain.
    await simpanAturanPenunjukan(db as AletaDatabase, {
      actorUserId: "usr-super",
      kunci: "penetapanBerjabatan",
      nilai: "ketat",
    });
    await pasangKredensial("fahri", KEADAAN_KREDENSIAL.SAH);

    await expect(
      masukSebagaiPejabat(db as AletaDatabase, {
        actor: { ...superAdmin, roleId: "jurusita" as const },
        jenis: "pmh",
        pejabatId: "32",
      })
    ).rejects.toThrow(/bukan peran Anda/i);
  });
});

describe("nilai tersimpan yang tidak terbaca", () => {
  it("dijawab dengan keterangan, bukan galat yang meledak", async () => {
    // Terjadi secara WAJAR: kunci enkripsi diganti, atau basis data dipulihkan
    // dari cadangan lama. Sebelumnya decryptCredentialSecret melempar galat,
    // sehingga keterangan yang sudah disiapkan tidak pernah terjangkau dan
    // petugas hanya melihat layar galat.
    const waktu = new Date().toISOString();
    await (db as AletaDatabase)
      .prepare(
        `INSERT INTO external_app_credentials (
          id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
          is_enabled, last_verified_status, created_at, updated_at
        ) VALUES ('eac-rusak', 'usr-super', 'sipp', 'fahri', 'enc:v1:x:y:z', '', 1, ?, ?, ?)`
      )
      .run(KEADAAN_KREDENSIAL.SAH, waktu, waktu);

    const html = await masukSebagaiPejabat(db as AletaDatabase, {
      actor: superAdmin,
      jenis: "pmh",
      pejabatId: "32",
    });
    expect(html).toMatch(/tidak dapat dibaca/i);
  });
});
