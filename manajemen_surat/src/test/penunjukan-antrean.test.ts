// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  AMBANG_KEDALUWARSA_HARI,
  JABATAN_PENETAP,
  antreanPerkara,
  antreanUntukSaya,
  bolehMenetapkan,
  sebutanJabatan,
  titipkanPenetapan,
  tutupTitipan,
} from "@/server/modules/aleta-ecourt/penunjukan-antrean";
import { simpanAturanPenunjukan } from "@/server/modules/aleta-ecourt/penunjukan-pengaturan";
import { createManagedUserInDb } from "@/server/modules/users/service";

/**
 * Antrean penetapan: menyerahkan pekerjaan, bukan akun.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - jabatan yang salah BENAR-BENAR ditolak menutup titipan sebagai
 *     dikerjakan - inilah yang membedakan antrean dari papan pengumuman,
 *   - Super Admin dan Admin tetap penuh, sesuai keputusan yang sudah diambil,
 *   - menitipkan boleh dilakukan siapa pun yang boleh membuka papannya -
 *     menitipkan bukan menetapkan,
 *   - titipan kedua atas hal yang sama MENGGANTIKAN yang pertama, bukan
 *     menumpuk; pejabatnya tidak boleh disuruh memilih di antara dua usulan.
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
  const hasil = await createManagedUserInDb(db as AletaDatabase, "usr-super", {
    roleOverride: roleOverride ?? null,
    username: `ujiantre${urutan}`,
    password: "rahasia123",
    email: `ujiantre${urutan}@pa.go.id`,
    whatsappNumber: `62812955${String(4000 + urutan)}`,
    name: `Pegawai Antrean ${urutan}`,
    nip: `19940102201714${String(4000 + urutan)}`,
    positionId,
    isActive: true,
  });
  return hasil.id;
}

const buatKetua = () => buatPegawai("pos-ketua");
const buatPanitera = () => buatPegawai("pos-panitera");
const buatAdmin = () => buatPegawai("pos-ketua", "admin");

async function titipPmh(actorUserId: string) {
  return titipkanPenetapan(db as AletaDatabase, {
    actorUserId,
    perkaraId: "542",
    nomorPerkara: "542/Pdt.G/2026/PA.Dgl",
    jenis: "pmh",
    usulan: { hakim_ketua: "Sudarmin H.I.M. Tang" },
    ringkasan: "Majelis B — Sudarmin, Idris, Derry",
  });
}

describe("jabatan mana menetapkan apa", () => {
  it("bawaannya LONGGAR - operator dapat mengerjakan keempatnya", () => {
    // Itulah cara kerja yang berjalan: penetapan disiapkan operator atas
    // arahan Ketua Pengadilan demi kelancaran proses. Yang ketat disediakan
    // bagi pengadilan yang menghendakinya.
    for (const jenis of Object.keys(JABATAN_PENETAP)) {
      expect(bolehMenetapkan("panitera", jenis)).toBe(true);
      expect(bolehMenetapkan("panitera-muda", jenis)).toBe(true);
    }
  });

  it("PMH milik Ketua dan Wakil saat ketat", () => {
    expect(bolehMenetapkan("ketua", "pmh", "ketat")).toBe(true);
    expect(bolehMenetapkan("wakil-ketua", "pmh", "ketat")).toBe(true);
    expect(bolehMenetapkan("panitera", "pmh", "ketat")).toBe(false);
  });

  it("PPP dan PJS milik Panitera saat ketat", () => {
    expect(bolehMenetapkan("panitera", "ppp", "ketat")).toBe(true);
    expect(bolehMenetapkan("panitera", "pjs", "ketat")).toBe(true);
    expect(bolehMenetapkan("ketua", "ppp", "ketat")).toBe(false);
  });

  it("PHS milik ketua majelis saat ketat", () => {
    expect(bolehMenetapkan("hakim", "phs", "ketat")).toBe(true);
    expect(bolehMenetapkan("hakim", "pmh", "ketat")).toBe(false);
  });

  it("Super Admin dan Admin selalu berwenang, bahkan saat ketat", () => {
    for (const jenis of Object.keys(JABATAN_PENETAP)) {
      expect(bolehMenetapkan("super-admin", jenis, "ketat")).toBe(true);
      expect(bolehMenetapkan("admin", jenis, "ketat")).toBe(true);
    }
  });

  it("peran yang tidak menetapkan apa pun ditolak saat ketat", () => {
    for (const jenis of Object.keys(JABATAN_PENETAP)) {
      expect(bolehMenetapkan("jurusita", jenis, "ketat")).toBe(false);
      expect(bolehMenetapkan("panitera-muda", jenis, "ketat")).toBe(false);
    }
  });

  it("menyebut jabatannya untuk ditampilkan", () => {
    expect(sebutanJabatan("pmh")).toBe("Ketua Pengadilan");
    expect(sebutanJabatan("ppp")).toBe("Panitera");
    expect(sebutanJabatan("phs")).toBe("ketua majelis");
  });
});

describe("menitipkan", () => {
  it("boleh dilakukan peran yang bukan penetapnya", async () => {
    // Menitipkan bukan menetapkan - usulannya tetap diperiksa lalu ditekan
    // pejabatnya sendiri.
    const panitera = await buatPanitera();
    const hasil = await titipPmh(panitera);
    expect(hasil.jenis).toBe("pmh");
    expect(hasil.untuk).toBe("Ketua Pengadilan");
  });

  it("menolak jenis penetapan yang tidak dikenali", async () => {
    const panitera = await buatPanitera();
    await expect(
      titipkanPenetapan(db as AletaDatabase, {
        actorUserId: panitera,
        perkaraId: "542",
        nomorPerkara: "542/Pdt.G/2026/PA.Dgl",
        jenis: "penetapan-karangan",
        usulan: {},
        ringkasan: "",
      })
    ).rejects.toThrow(/tidak dikenali/i);
  });

  it("menolak titipan tanpa perkara", async () => {
    const panitera = await buatPanitera();
    await expect(
      titipkanPenetapan(db as AletaDatabase, {
        actorUserId: panitera,
        perkaraId: "",
        nomorPerkara: "",
        jenis: "pmh",
        usulan: {},
        ringkasan: "",
      })
    ).rejects.toThrow(/tidak disebutkan/i);
  });

  it("titipan kedua MENGGANTIKAN yang pertama, bukan menumpuk", async () => {
    const panitera = await buatPanitera();
    await titipPmh(panitera);
    await titipPmh(panitera);

    // Meninggalkan keduanya membuat pejabatnya memilih di antara dua usulan
    // tanpa tahu mana yang terbaru.
    const antre = await antreanPerkara(db as AletaDatabase, "542");
    expect(antre).toHaveLength(1);
  });

  it("menyimpan usulannya beku, apa adanya", async () => {
    const panitera = await buatPanitera();
    await titipPmh(panitera);
    const antre = await antreanPerkara(db as AletaDatabase, "542");
    expect(antre[0].usulan).toEqual({ hakim_ketua: "Sudarmin H.I.M. Tang" });
    expect(antre[0].sebutan).toBe("Penetapan Majelis Hakim");
  });
});

describe("yang menunggu saya", () => {
  it("Ketua melihat titipan PMH", async () => {
    const panitera = await buatPanitera();
    await titipPmh(panitera);

    const ketua = await buatKetua();
    const hasil = await antreanUntukSaya(db as AletaDatabase, ketua);
    expect(hasil.untukSaya).toHaveLength(1);
    expect(hasil.untukSaya[0].jenis).toBe("pmh");
  });

  it("Panitera TIDAK melihat titipan PMH sebagai miliknya", async () => {
    const panitera = await buatPanitera();
    await titipPmh(panitera);

    const hasil = await antreanUntukSaya(db as AletaDatabase, panitera);
    expect(hasil.untukSaya).toHaveLength(0);
    // Tetapi tahu ada yang menunggu pejabat lain - supaya ia tidak mengira
    // titipannya hilang.
    expect(hasil.seluruhnya).toBe(1);
  });

  it("Admin melihat seluruhnya", async () => {
    const panitera = await buatPanitera();
    await titipPmh(panitera);

    const admin = await buatAdmin();
    const hasil = await antreanUntukSaya(db as AletaDatabase, admin);
    expect(hasil.untukSaya).toHaveLength(1);
  });
});

describe("menutup titipan", () => {
  it("Ketua boleh menutup PMH sebagai dikerjakan", async () => {
    const panitera = await buatPanitera();
    const titipan = await titipPmh(panitera);
    const ketua = await buatKetua();

    const hasil = await tutupTitipan(db as AletaDatabase, {
      actorUserId: ketua,
      id: titipan.id,
      keadaan: "dikerjakan",
      akunSipp: "fahri",
    });
    expect(hasil.keadaan).toBe("dikerjakan");
    expect(await antreanPerkara(db as AletaDatabase, "542")).toHaveLength(0);
  });

  it("Panitera boleh menutup PMH saat modenya longgar", async () => {
    // Bawaannya longgar - operator memang mengerjakan keempatnya. Menahannya
    // di sini akan membuat barisnya menggantung sebagai pekerjaan yang
    // menunggu padahal sudah dikerjakan.
    const panitera = await buatPanitera();
    const titipan = await titipPmh(panitera);

    const hasil = await tutupTitipan(db as AletaDatabase, {
      actorUserId: panitera,
      id: titipan.id,
      keadaan: "dikerjakan",
    });
    expect(hasil.keadaan).toBe("dikerjakan");
  });

  it("Panitera DITOLAK menutup PMH saat modenya ketat", async () => {
    const admin = await buatAdmin();
    await simpanAturanPenunjukan(db as AletaDatabase, {
      actorUserId: admin,
      kunci: "penetapanBerjabatan",
      nilai: "ketat",
    });

    const panitera = await buatPanitera();
    const titipan = await titipPmh(panitera);

    await expect(
      tutupTitipan(db as AletaDatabase, {
        actorUserId: panitera,
        id: titipan.id,
        keadaan: "dikerjakan",
      })
    ).rejects.toThrow(/Ketua Pengadilan, bukan peran Anda/i);
  });

  it("siapa pun boleh membatalkan titipan", async () => {
    const panitera = await buatPanitera();
    const titipan = await titipPmh(panitera);

    // Membatalkan bukan menetapkan - operator yang salah menitipkan harus
    // dapat menariknya kembali tanpa memanggil Ketua.
    const hasil = await tutupTitipan(db as AletaDatabase, {
      actorUserId: panitera,
      id: titipan.id,
      keadaan: "dibatalkan",
      alasan: "salah perkara",
    });
    expect(hasil.keadaan).toBe("dibatalkan");
  });

  it("titipan yang sudah ditutup tidak dapat ditutup dua kali", async () => {
    const panitera = await buatPanitera();
    const titipan = await titipPmh(panitera);
    const ketua = await buatKetua();

    await tutupTitipan(db as AletaDatabase, {
      actorUserId: ketua,
      id: titipan.id,
      keadaan: "dikerjakan",
    });
    await expect(
      tutupTitipan(db as AletaDatabase, {
        actorUserId: ketua,
        id: titipan.id,
        keadaan: "dikerjakan",
      })
    ).rejects.toThrow(/sudah dikerjakan/i);
  });

  it("titipan yang tidak ada dijawab apa adanya", async () => {
    const ketua = await buatKetua();
    await expect(
      tutupTitipan(db as AletaDatabase, {
        actorUserId: ketua,
        id: "antre-tidak-ada",
        keadaan: "dikerjakan",
      })
    ).rejects.toThrow(/tidak ditemukan/i);
  });
});

/**
 * ============================================================================
 * TITIPAN YANG TIDAK PERNAH KEDALUWARSA MENUMPUK SELAMANYA
 * ============================================================================
 *
 * Keadaan kedaluwarsa sudah disediakan tabelnya sejak awal tetapi belum ada
 * yang menandainya. Titipan yang tidak dikerjakan karena itu tinggal di daftar
 * selamanya - dan daftar yang sebagian besarnya mati berhenti dibaca, yang
 * merusak justru bagian yang masih hidup.
 *
 * Yang menentukan kebenarannya SARINGAN pada kedua daftar bacanya, bukan
 * penyapunya. Kalau kedaluwarsa hanya berarti "sudah ditandai", dua layar yang
 * membaca tabel yang sama menampilkan hal berbeda tergantung siapa yang
 * kebetulan membuka layar "pekerjaan saya" lebih dahulu.
 */
describe("titipan kedaluwarsa sendiri", () => {
  /** Memundurkan waktu penyiapan satu titipan, seolah ia dititipkan dulu. */
  async function tuakan(id: string, hari: number) {
    const dulu = new Date(Date.now() - hari * 24 * 60 * 60 * 1000).toISOString();
    await (db as AletaDatabase)
      .prepare("UPDATE aleta_sipp_penunjukan_antrean SET disiapkan_at = ? WHERE id = ?")
      .run(dulu, id);
  }

  it("yang lewat ambangnya hilang dari daftar pekerjaan saya", async () => {
    const ketua = await buatKetua();
    const { id } = await titipPmh(ketua);

    // Sehari sebelum ambang: masih hidup.
    await tuakan(id, AMBANG_KEDALUWARSA_HARI - 1);
    const masih = await antreanUntukSaya(db as AletaDatabase, ketua);
    expect(masih.untukSaya.map((x) => x.id)).toContain(id);

    // Sehari sesudahnya: sudah tidak.
    await tuakan(id, AMBANG_KEDALUWARSA_HARI + 1);
    const sudah = await antreanUntukSaya(db as AletaDatabase, ketua);
    expect(sudah.untukSaya.map((x) => x.id)).not.toContain(id);
  });

  it("ditandai kedaluwarsa, bukan dihapus", async () => {
    // Pertanyaan "kenapa penetapan ini tidak pernah dikerjakan" harus tetap
    // dapat dijawab setahun kemudian. Baris yang dihapus tidak menjawabnya.
    const ketua = await buatKetua();
    const { id } = await titipPmh(ketua);
    await tuakan(id, AMBANG_KEDALUWARSA_HARI + 3);
    await antreanUntukSaya(db as AletaDatabase, ketua);

    const baris = await (db as AletaDatabase)
      .prepare(
        "SELECT keadaan, alasan_batal FROM aleta_sipp_penunjukan_antrean WHERE id = ? LIMIT 1"
      )
      .all<{ keadaan: string; alasan_batal: string }>(id);

    expect(baris).toHaveLength(1);
    expect(baris[0].keadaan).toBe("kedaluwarsa");
    // Alasannya menyebut ambangnya, supaya yang membacanya tidak perlu
    // mencari angka itu di dalam kode.
    expect(baris[0].alasan_batal).toContain(String(AMBANG_KEDALUWARSA_HARI));
  });

  it("daftar per perkara ikut menyaring, tanpa menunggu penyapunya", async () => {
    // Panel ekstensi menggambar daftar ini tiap kali ia menyusun dirinya,
    // dan tidak boleh menulis ke basis data untuk itu. Karena itu saringannya
    // yang harus benar sendiri - bukan bergantung pada penyapu yang berjalan
    // di layar lain.
    const ketua = await buatKetua();
    const { id } = await titipPmh(ketua);
    await tuakan(id, AMBANG_KEDALUWARSA_HARI + 1);

    const daftar = await antreanPerkara(db as AletaDatabase, "542");
    expect(daftar.map((x) => x.id)).not.toContain(id);

    // Dan ia memang BELUM ditandai - saringannya yang bekerja, bukan penyapu.
    const baris = await (db as AletaDatabase)
      .prepare("SELECT keadaan FROM aleta_sipp_penunjukan_antrean WHERE id = ? LIMIT 1")
      .all<{ keadaan: string }>(id);
    expect(baris[0].keadaan).toBe("menunggu");
  });

  it("yang lewat waktu tidak dapat ditutup sebagai dikerjakan", async () => {
    // Menutupnya berarti mencatat penetapan dikerjakan atas usulan yang
    // tanggalnya sudah lewat - catatan yang menyatakan sesuatu yang tidak
    // benar, dan itu lebih buruk daripada titipan yang hangus.
    const ketua = await buatKetua();
    const { id } = await titipPmh(ketua);
    await tuakan(id, AMBANG_KEDALUWARSA_HARI + 1);

    await expect(
      tutupTitipan(db as AletaDatabase, { actorUserId: ketua, id, keadaan: "dikerjakan" })
    ).rejects.toThrow(/lewat 14 hari/);
  });

  it("titipan baru tidak terganggu sama sekali", async () => {
    const ketua = await buatKetua();
    const { id } = await titipPmh(ketua);
    const daftar = await antreanUntukSaya(db as AletaDatabase, ketua);
    expect(daftar.untukSaya.map((x) => x.id)).toContain(id);
    expect(await antreanPerkara(db as AletaDatabase, "542")).toHaveLength(1);
  });
});
