// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import {
  type AkunSiapPakai,
  bacaPemetaanJabatan,
  pilihAkunPejabat,
} from "@/server/modules/aleta-ecourt/pemetaan-jabatan";
import { KEADAAN_KREDENSIAL } from "@/server/modules/external-apps/service";

/**
 * Menautkan akun SIPP dengan jabatannya.
 *
 * ============================================================================
 * DARI MANA DATA UJI INI BERASAL
 * ============================================================================
 *
 * Bukan karangan. Bentuknya disalin dari user_hakim + hakim_pn milik PA
 * Donggala yang sungguhan, termasuk kejanggalan yang benar-benar ada di sana:
 * hakim_id 30 punya TIGA akun SIPP sekaligus, dan Majelis B punya dua akun
 * yang salah satunya - bekas hakim terdahulu - sudah diblokir.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 *   - akun yang diblokir TIDAK PERNAH terpilih. Salah pilih di sini berarti
 *     penetapan dikerjakan atas nama hakim yang keliru,
 *
 *   - besar-kecil huruf tidak boleh memisahkan: ALETA menyimpan "Fahri",
 *     SIPP mencatat "fahri",
 *
 *   - akun yang belum siap tetap DITAMPILKAN beserta sebabnya, tidak dibuang -
 *     petugas yang bertanya "mengapa PHS ini tidak bisa" perlu membacanya.
 */
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: vi.fn(),
}));

const { callAletaBotSippBridge } = await import("@/server/modules/aleta-sipp/aleta-sipp-datasource");
const jembatan = vi.mocked(callAletaBotSippBridge);

let db: AletaDatabase | null = null;

const hakim = (
  username: string,
  pejabatId: string,
  kode: string,
  nama: string,
  ubah: Partial<{ diblokir: boolean; kedaluwarsa: boolean; terakhirMasuk: string }> = {}
) => ({
  username,
  pejabatId,
  kode,
  nama,
  nip: "",
  diblokir: ubah.diblokir ?? false,
  kedaluwarsa: ubah.kedaluwarsa ?? false,
  aktif: !(ubah.diblokir ?? false) && !(ubah.kedaluwarsa ?? false),
  terakhirMasuk: ubah.terakhirMasuk ?? "2026-09-02T00:00:00.000Z",
});

// Disalin dari keadaan PA Donggala yang berjalan.
const DARI_SIPP = {
  hakim: [
    hakim("fahri", "32", "A", "Fahri Saifuddin"),
    hakim("Abdul Salam", "30", "A", "Abdul Salam", { diblokir: true }),
    hakim("hamid", "30", "A", "Abdul Salam", { diblokir: true }),
    hakim("hakim5", "30", "A", "Abdul Salam", { diblokir: true }),
    hakim("sudarmin", "33", "B", "Sudarmin H.I.M. Tang"),
    hakim("Waka062024", "29", "B", "Akbar Ali", { diblokir: true }),
    hakim("Himawan", "26", "C1", "Himawan Tatura Wijaya"),
    hakim("Idris", "28", "C2", "Idris"),
    hakim("derry briantono", "31", "C3", "Derry Briantono"),
    hakim("nurbaya", "17", "A", "Nurbaya", { diblokir: true, kedaluwarsa: true }),
  ],
  panitera: [hakim("Sri Susilowati", "26", "", "Sri Susilowati")],
  jurusita: [hakim("Artia Toha", "22", "", "Mohammad Syukri")],
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

async function pasangKredensial(username: string, keadaan: string, aktif = true) {
  const waktu = new Date().toISOString();
  await (db as AletaDatabase)
    .prepare(
      `INSERT INTO external_app_credentials (
        id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
        is_enabled, last_verified_status, created_at, updated_at
      ) VALUES (?, 'usr-super', 'sipp', ?, 'enc:v1:x:y:z', '', ?, ?, ?, ?)`
    )
    .run(`eac-${username.replace(/\W/g, "")}`, username, aktif ? 1 : 0, keadaan, waktu, waktu);
}

describe("membaca penautan", () => {
  it("menempelkan keadaan kredensial ALETA ke akun SIPP", async () => {
    await pasangKredensial("derry briantono", KEADAAN_KREDENSIAL.SAH);
    const hasil = await bacaPemetaanJabatan(db as AletaDatabase);

    const derry = hasil.akun.find((x) => x.username === "derry briantono");
    expect(derry?.siap).toBe(true);
    expect(derry?.adaKredensial).toBe(true);
    expect(derry?.kode).toBe("C3");
  });

  it("mencocokkan tanpa membedakan besar-kecil huruf", async () => {
    // ALETA menyimpan "Fahri", SIPP mencatat "fahri". Tanpa ini, akun Ketua
    // Pengadilan akan selamanya terbaca sebagai belum berkredensial.
    await pasangKredensial("Fahri", KEADAAN_KREDENSIAL.SAH);
    const hasil = await bacaPemetaanJabatan(db as AletaDatabase);

    const fahri = hasil.akun.find((x) => x.username === "fahri");
    expect(fahri?.adaKredensial).toBe(true);
    expect(fahri?.siap).toBe(true);
  });

  it("akun yang belum siap tetap ditampilkan beserta sebabnya", async () => {
    const hasil = await bacaPemetaanJabatan(db as AletaDatabase);

    const diblokir = hasil.akun.find((x) => x.username === "Waka062024");
    expect(diblokir).toBeDefined();
    expect(diblokir?.siap).toBe(false);
    expect(diblokir?.sebabBelumSiap).toMatch(/diblokir/i);

    const belumDiisi = hasil.akun.find((x) => x.username === "Himawan");
    expect(belumDiisi?.sebabBelumSiap).toMatch(/belum diisi/i);
  });

  it("sandi yang sudah tidak cocok disebut apa adanya", async () => {
    await pasangKredensial("Idris", KEADAAN_KREDENSIAL.SANDI_SALAH);
    const hasil = await bacaPemetaanJabatan(db as AletaDatabase);

    const idris = hasil.akun.find((x) => x.username === "Idris");
    expect(idris?.siap).toBe(false);
    expect(idris?.sebabBelumSiap).toMatch(/tidak cocok/i);
  });

  it("bot yang mati dijawab apa adanya, bukan daftar kosong yang menyesatkan", async () => {
    jembatan.mockResolvedValue({ ok: false, error: "bridge mati", bridge: {} } as never);
    const hasil = await bacaPemetaanJabatan(db as AletaDatabase);

    expect(hasil.ok).toBe(false);
    expect(hasil.galat).toContain("bridge mati");
  });
});

describe("memilih akun seorang pejabat", () => {
  let akun: AkunSiapPakai[] = [];

  beforeEach(async () => {
    await pasangKredensial("derry briantono", KEADAAN_KREDENSIAL.SAH);
    akun = (await bacaPemetaanJabatan(db as AletaDatabase)).akun;
  });

  it("TIDAK PERNAH memilih akun yang diblokir", async () => {
    // hakim_id 30 punya tiga akun, KETIGANYA diblokir. Jawaban yang benar
    // adalah "tidak ada", bukan memaksa memilih salah satunya.
    expect(pilihAkunPejabat(akun, "hakim", "30")).toBeNull();
  });

  it("memilih satu-satunya akun yang hidup", () => {
    expect(pilihAkunPejabat(akun, "hakim", "33")?.username).toBe("sudarmin");
    expect(pilihAkunPejabat(akun, "hakim", "31")?.username).toBe("derry briantono");
  });

  it("hakim_id yang tidak dikenal dijawab kosong, bukan asal ambil", () => {
    expect(pilihAkunPejabat(akun, "hakim", "9999")).toBeNull();
    expect(pilihAkunPejabat(akun, "hakim", "")).toBeNull();
  });

  it("jabatan tidak boleh tertukar walau nomornya sama", () => {
    // hakim_id 26 adalah Himawan, panitera_id 26 adalah Sri Susilowati.
    // Angka yang sama, orang yang berbeda.
    expect(pilihAkunPejabat(akun, "hakim", "26")?.username).toBe("Himawan");
    expect(pilihAkunPejabat(akun, "panitera", "26")?.username).toBe("Sri Susilowati");
  });

  it("yang sandinya sudah teruji didahulukan bila ada beberapa yang hidup", async () => {
    const dua: AkunSiapPakai[] = [
      { ...akun[0], jabatan: "hakim", pejabatId: "77", username: "lama", siap: false, adaKredensial: false, diblokir: false, kedaluwarsa: false },
      { ...akun[0], jabatan: "hakim", pejabatId: "77", username: "terpakai", siap: true, adaKredensial: true, diblokir: false, kedaluwarsa: false },
    ];
    expect(pilihAkunPejabat(dua, "hakim", "77")?.username).toBe("terpakai");
  });
});
