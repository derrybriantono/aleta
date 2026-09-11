// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  KAPABILITAS_EKSTENSI,
  KETERANGAN_KAPABILITAS,
  bacaSemuaPengecualian,
  cariPenggunaUntukPengecualian,
  kapabilitasPengguna,
  kapabilitasPeran,
  kemampuanPenuh,
  pastikanKapabilitas,
  simpanAksesEkstensi,
  simpanPengecualianPengguna,
} from "@/server/modules/aleta-ecourt/akses";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Pengecualian akses ekstensi untuk satu orang.
 *
 * Yang dijaga di sini:
 *
 *   - tidak ada baris berarti IKUT PERAN, dan perubahan peran tetap sampai
 *     kepada orang yang tidak dikecualikan,
 *   - pengecualian benar-benar sampai ke penjagaan rute, bukan hanya ke layar,
 *   - yang sudah lewat masa berlakunya berhenti berlaku tanpa dihapus,
 *   - Super Admin dan Admin tidak dapat dikecualikan lewat jalur ini,
 *   - pemberian tanpa alasan ditolak.
 *
 * Yang TIDAK boleh terjadi: seseorang yang pernah dikecualikan lalu
 * dikembalikan "ikut peran" tetap membawa nilai lamanya diam-diam.
 */
let db: AletaDatabase | null = null;
let urutan = 0;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPegawai(positionId: string, roleOverride?: "super-admin" | "admin") {
  urutan += 1;
  return createManagedUserInDb(db!, "usr-super", {
    roleOverride: roleOverride ?? null,
    username: `pengguna${urutan}`,
    password: "rahasia123",
    email: `pengguna${urutan}@pa.go.id`,
    whatsappNumber: `62812345${String(4000 + urutan)}`,
    name: `Pegawai ${urutan}`,
    nip: `19940102201712${String(4000 + urutan)}`,
    positionId,
    isActive: true,
  });
}

const buatSuperAdmin = () => buatPegawai("pos-ketua", "super-admin");
const buatHakim = () => buatPegawai("pos-hakim");
const buatJurusita = () => buatPegawai("pos-jurusita");

/** Tanggal kemarin dan besok, untuk menguji masa berlaku. */
const kemarin = () => new Date(Date.now() - 86_400_000).toISOString();
const besok = () => new Date(Date.now() + 86_400_000).toISOString();

describe("daftar kemampuan tidak boleh tertinggal di mana pun", () => {
  it("kemampuanPenuh menyalakan SELURUH kemampuan yang terdaftar", () => {
    const penuh = kemampuanPenuh();
    expect(Object.keys(penuh).sort()).toEqual([...KAPABILITAS_EKSTENSI].sort());
    expect(Object.values(penuh).every((x) => x === true)).toBe(true);
  });

  it("tiap kemampuan punya label dan penjelasannya", () => {
    // Halaman pengaturan menggambar kolomnya dari keterangan ini. Kemampuan
    // yang tidak punya keterangan tidak akan pernah muncul di layar - ia ada,
    // menjaga rute, dan tidak dapat diatur siapa pun.
    for (const kunci of KAPABILITAS_EKSTENSI) {
      expect(KETERANGAN_KAPABILITAS[kunci], kunci).toBeTruthy();
      expect(KETERANGAN_KAPABILITAS[kunci].label.length, kunci).toBeGreaterThan(3);
      expect(KETERANGAN_KAPABILITAS[kunci].penjelasan.length, kunci).toBeGreaterThan(20);
    }
  });

  it("blangko ABT punya kemampuannya sendiri, terpisah dari panel", () => {
    // Menulis keterangan saksi ke ABT menghapus lalu menulis ulang seluruh
    // tanya-jawab satu sidang. Itu bukan perbuatan yang sama beratnya dengan
    // melihat panel, dan tidak boleh dibuka oleh kemampuan yang sama.
    expect(KAPABILITAS_EKSTENSI).toContain("blangko-abt");
    expect(KAPABILITAS_EKSTENSI).toContain("panel");
  });
});

describe("pengecualian akses ekstensi untuk satu orang", () => {
  it("tanpa pengecualian, kemampuannya sama persis dengan perannya", async () => {
    const hakim = await buatHakim();
    const dariPeran = await kapabilitasPeran(db!, hakim.roleId as never);
    const dariOrang = await kapabilitasPengguna(db!, { id: hakim.id, roleId: hakim.roleId });
    expect(dariOrang).toEqual(dariPeran);
  });

  it("memberi kemampuan yang perannya tidak punya", async () => {
    const admin = await buatSuperAdmin();
    const jurusita = await buatJurusita();

    const sebelum = await kapabilitasPengguna(db!, { id: jurusita.id, roleId: jurusita.roleId });
    expect(sebelum["penunjukan-otomatis"]).toBe(false);

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: jurusita.id,
      kapabilitas: "penunjukan-otomatis",
      aktif: true,
      alasan: "Ditugaskan membantu kepaniteraan selama panitera cuti.",
    });

    const sesudah = await kapabilitasPengguna(db!, { id: jurusita.id, roleId: jurusita.roleId });
    expect(sesudah["penunjukan-otomatis"]).toBe(true);
    // Kemampuan lain tidak ikut berubah.
    expect(sesudah.panel).toBe(sebelum.panel);
    expect(sesudah.berkas).toBe(sebelum.berkas);
  });

  it("mencabut kemampuan yang perannya punya, tanpa menyentuh rekan sejabatannya", async () => {
    const admin = await buatSuperAdmin();
    const hakimA = await buatHakim();
    const hakimB = await buatHakim();

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: hakimA.id,
      kapabilitas: "berkas",
      aktif: false,
      alasan: "Sedang dalam pemeriksaan pengawasan internal.",
    });

    const a = await kapabilitasPengguna(db!, { id: hakimA.id, roleId: hakimA.roleId });
    const b = await kapabilitasPengguna(db!, { id: hakimB.id, roleId: hakimB.roleId });
    expect(a.berkas).toBe(false);
    expect(b.berkas).toBe(true);
  });

  it("pengecualian benar-benar sampai ke penjagaan rute, bukan hanya ke layar", async () => {
    const admin = await buatSuperAdmin();
    const jurusita = await buatJurusita();

    await expect(pastikanKapabilitas(db!, jurusita.id, "penunjukan")).rejects.toThrow(/tidak diberi akses/i);

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: jurusita.id,
      kapabilitas: "penunjukan",
      aktif: true,
      alasan: "Merangkap tugas kepaniteraan.",
    });

    await expect(pastikanKapabilitas(db!, jurusita.id, "penunjukan")).resolves.toBeTruthy();
  });

  it("pengecualian mengalahkan pengaturan peran, ke arah mana pun", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();

    // Perannya dimatikan, orangnya dikecualikan menyala.
    await simpanAksesEkstensi(db!, {
      actorUserId: admin.id,
      roleId: hakim.roleId as never,
      kapabilitas: "berkas",
      aktif: false,
    });
    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: hakim.id,
      kapabilitas: "berkas",
      aktif: true,
      alasan: "Hakim pengawas bidang, perlu membaca berkas.",
    });

    const hasil = await kapabilitasPengguna(db!, { id: hakim.id, roleId: hakim.roleId });
    expect(hasil.berkas).toBe(true);
    await expect(pastikanKapabilitas(db!, hakim.id, "berkas")).resolves.toBeTruthy();
  });

  it("dikembalikan ikut peran, dan perubahan peran kelak tetap sampai kepadanya", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: hakim.id,
      kapabilitas: "berkas",
      aktif: false,
      alasan: "Pemeriksaan internal.",
    });
    expect((await kapabilitasPengguna(db!, { id: hakim.id, roleId: hakim.roleId })).berkas).toBe(false);

    // aktif: null = hapus pengecualiannya.
    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: hakim.id,
      kapabilitas: "berkas",
      aktif: null,
    });
    expect((await kapabilitasPengguna(db!, { id: hakim.id, roleId: hakim.roleId })).berkas).toBe(true);

    // Dan sekarang perannya benar-benar kembali menentukan.
    await simpanAksesEkstensi(db!, {
      actorUserId: admin.id,
      roleId: hakim.roleId as never,
      kapabilitas: "berkas",
      aktif: false,
    });
    expect((await kapabilitasPengguna(db!, { id: hakim.id, roleId: hakim.roleId })).berkas).toBe(false);

    // Barisnya benar-benar hilang - bukan sekadar tidak dipakai.
    const daftar = await bacaSemuaPengecualian(db!);
    expect(daftar.find((x) => x.userId === hakim.id)).toBeUndefined();
  });

  it("yang lewat masa berlakunya berhenti berlaku, tetapi barisnya tetap terbaca", async () => {
    const admin = await buatSuperAdmin();
    const jurusita = await buatJurusita();

    // Dipilih kemampuan yang perannya TIDAK punya - kalau tidak, ujinya lulus
    // tanpa membuktikan apa pun: nilai perannya kebetulan sama dengan nilai
    // pengecualiannya.
    expect((await kapabilitasPeran(db!, jurusita.roleId as never))["penunjukan-otomatis"]).toBe(false);

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: jurusita.id,
      kapabilitas: "penunjukan-otomatis",
      aktif: true,
      alasan: "Membantu kepaniteraan selama dua pekan, sesuai surat tugas.",
      berlakuSampai: kemarin(),
    });

    const hasil = await kapabilitasPengguna(db!, { id: jurusita.id, roleId: jurusita.roleId });
    expect(hasil["penunjukan-otomatis"]).toBe(false);

    // "Siapa yang pernah diberi akses ini" adalah pertanyaan pemeriksaan -
    // jawaban yang terhapus bukan jawaban.
    const daftar = await bacaSemuaPengecualian(db!);
    const orang = daftar.find((x) => x.userId === jurusita.id);
    expect(orang).toBeTruthy();
    expect(orang!.pengecualian[0].kedaluwarsa).toBe(true);
    expect(orang!.pengecualian[0].alasan).toContain("surat tugas");
  });

  it("yang masa berlakunya belum lewat tetap berlaku", async () => {
    const admin = await buatSuperAdmin();
    const jurusita = await buatJurusita();

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: jurusita.id,
      kapabilitas: "penunjukan-otomatis",
      aktif: true,
      alasan: "Membantu kepaniteraan, sesuai surat tugas.",
      berlakuSampai: besok(),
    });

    const hasil = await kapabilitasPengguna(db!, { id: jurusita.id, roleId: jurusita.roleId });
    expect(hasil["penunjukan-otomatis"]).toBe(true);
  });

  it("menolak pemberian tanpa alasan, dan menerima pencabutan tanpa alasan", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: hakim.id,
        kapabilitas: "berkas",
        aktif: false,
        alasan: "  ",
      })
    ).rejects.toThrow(/alasan/i);

    // Mengembalikan ke peran tidak perlu alasan - ia menghapus pengecualian,
    // bukan membuat keadaan baru yang harus dijelaskan.
    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: hakim.id,
        kapabilitas: "berkas",
        aktif: null,
      })
    ).resolves.toBeTruthy();
  });

  it("Super Admin dan Admin tidak dapat dikecualikan", async () => {
    const admin = await buatSuperAdmin();
    const sasaran = await buatSuperAdmin();

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: sasaran.id,
        kapabilitas: "berkas",
        aktif: false,
        alasan: "Percobaan membatasi administrasi.",
      })
    ).rejects.toThrow(/selalu berkemampuan penuh/i);

    // Dan kemampuannya tetap penuh lewat jalur pembacaan mana pun.
    const hasil = await kapabilitasPengguna(db!, { id: sasaran.id, roleId: sasaran.roleId });
    expect(hasil).toEqual(kemampuanPenuh());
  });

  it("hanya Super Admin dan Admin yang boleh memberi pengecualian", async () => {
    const hakim = await buatHakim();
    const sasaran = await buatJurusita();

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: hakim.id,
        userId: sasaran.id,
        kapabilitas: "berkas",
        aktif: true,
        alasan: "Mencoba memberi sendiri.",
      })
    ).rejects.toThrow(/Super Admin dan Admin/i);
  });

  it("menolak kemampuan dan pengguna yang tidak dikenali", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: hakim.id,
        kapabilitas: "kemampuan-karangan",
        aktif: true,
        alasan: "Percobaan.",
      })
    ).rejects.toThrow(/tidak dikenali/i);

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: "usr-tidak-ada",
        kapabilitas: "berkas",
        aktif: true,
        alasan: "Percobaan.",
      })
    ).rejects.toThrow(/Pengguna tidak dikenali/i);
  });

  it("menolak tanggal berlaku yang tidak dapat dibaca", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();

    await expect(
      simpanPengecualianPengguna(db!, {
        actorUserId: admin.id,
        userId: hakim.id,
        kapabilitas: "berkas",
        aktif: true,
        alasan: "Percobaan tanggal.",
        berlakuSampai: "besok pagi",
      })
    ).rejects.toThrow(/tanggal/i);
  });
});

describe("daftar dan pencarian untuk halaman pengaturan", () => {
  it("daftar hanya memuat orang yang benar-benar dikecualikan", async () => {
    const admin = await buatSuperAdmin();
    const hakim = await buatHakim();
    await buatJurusita();

    expect(await bacaSemuaPengecualian(db!)).toHaveLength(0);

    await simpanPengecualianPengguna(db!, {
      actorUserId: admin.id,
      userId: hakim.id,
      kapabilitas: "blangko-abt",
      aktif: false,
      alasan: "Belum mengikuti pelatihan blangko.",
    });

    const daftar = await bacaSemuaPengecualian(db!);
    expect(daftar).toHaveLength(1);
    expect(daftar[0].userId).toBe(hakim.id);
    // Selisihnya terbaca: kewenangan perannya di samping hasil akhirnya.
    expect(daftar[0].dariPeran["blangko-abt"]).toBe(true);
    expect(daftar[0].berlaku["blangko-abt"]).toBe(false);
  });

  it("pencarian menemukan pegawai menurut nama, dan diam untuk satu huruf", async () => {
    const hakim = await buatHakim();

    expect(await cariPenggunaUntukPengecualian(db!, "P")).toHaveLength(0);

    const hasil = await cariPenggunaUntukPengecualian(db!, hakim.name.slice(0, 6));
    expect(hasil.length).toBeGreaterThan(0);
    expect(hasil.some((x) => x.userId === hakim.id)).toBe(true);
    // Membawa kewenangan perannya, supaya layar dapat menggambar keadaan awal
    // tanpa satu permintaan tambahan per orang.
    expect(Object.keys(hasil[0].dariPeran).sort()).toEqual([...KAPABILITAS_EKSTENSI].sort());
  });
});
