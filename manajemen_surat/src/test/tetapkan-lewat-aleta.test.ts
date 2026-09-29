// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * MENETAPKAN LEWAT ALETA - TANPA BERPINDAH AKUN SIPP
 * ============================================================================
 *
 * Tombol Kerjakan dahulu hanya dapat mengisi BORANG SIPP yang sedang terbuka.
 * Di halaman detail perkara - tempat panel paling sering dibuka - borang itu
 * memang tidak ada, sehingga tombolnya praktis tidak pernah dapat ditekan dan
 * keempat penetapan tetap menuntut empat kali buka halaman sambil berganti
 * empat akun.
 *
 * Mesin tulisnya sudah ada dan sudah lengkap. Yang belum ada jalannya.
 *
 * ============================================================================
 * YANG DIUJI PALING KERAS: ID, BUKAN NAMA
 * ============================================================================
 *
 * Jalur borang mengisi NAMA ke kotak formulir; mesin tulis menulis ID ke
 * perkara_hakim_pn, perkara_panitera_pn, dan perkara_jurusita. Keduanya
 * diambil dari sumber yang sama dengan urutan menang yang sama, tetapi yang
 * keliru berakibat sangat berbeda: nama yang salah terlihat sebelum disimpan;
 * ID yang salah langsung mendarat di basis data atas nama orang lain.
 */

const akar = path.resolve(process.cwd(), "..");
const konten = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8").replace(
  /\r\n/g,
  "\n"
);

/** Memotong fungsi puncak beserta pembantunya, lalu menjalankannya. */
function potongFungsi(nama: string[]): string {
  const baris = konten.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();
  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }
  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

type Nilai = { hakimId?: number[]; petugasId?: number; tanggalSidang?: string } | null;

const buat = new Function(
  `${potongFungsi(["idUntukTulis", "pilihanDari", "susunanTerpilih"])}
   return idUntukTulis;`
) as () => (jenis: string, usulan: unknown, pilihanManual?: unknown) => Nilai;

const idUntukTulis = buat();

const USULAN = {
  tanggalPenetapan: "2026-09-10",
  pmh: {
    bentuk: "majelis",
    anggota: [
      { hakimId: 1, nama: "Fahri Saifuddin" },
      { hakimId: 3, nama: "Himawan Tatura Wijaya" },
      { hakimId: 5, nama: "Derry Briantono" },
    ],
    hitungan: [
      { hakimId: 1, nama: "Fahri Saifuddin" },
      { hakimId: 2, nama: "Sudarmin H.I.M. Tang" },
      { hakimId: 3, nama: "Himawan Tatura Wijaya" },
      { hakimId: 5, nama: "Derry Briantono" },
    ],
    susunanTerpakai: [
      {
        kunci: "2-3-5",
        anggota: [
          { hakimId: 2, nama: "Sudarmin H.I.M. Tang" },
          { hakimId: 3, nama: "Himawan Tatura Wijaya" },
          { hakimId: 5, nama: "Derry Briantono" },
        ],
      },
    ],
  },
  ppp: {
    usulan: { paniteraId: 11, nama: "Sri Susilowati" },
    calon: [
      { paniteraId: 11, nama: "Sri Susilowati" },
      { paniteraId: 12, nama: "Andini Puspita Sari" },
    ],
  },
  pjs: {
    usulan: { jurusitaId: 21, nama: "Mustini" },
    calon: [
      { jurusitaId: 21, nama: "Mustini" },
      { jurusitaId: 22, nama: "Tanty Restianty" },
    ],
  },
  phs: { usulan: "2026-09-24", calon: [{ tanggal: "2026-09-24" }, { tanggal: "2026-10-01" }] },
};

describe("id yang dikirim ke mesin tulis", () => {
  it("PMH memulangkan ketiga kursinya, berurutan", () => {
    expect(idUntukTulis("pmh", USULAN)).toEqual({ hakimId: [1, 3, 5] });
  });

  it("PPP dan PJS memulangkan id petugasnya", () => {
    expect(idUntukTulis("ppp", USULAN)).toEqual({ petugasId: 11 });
    expect(idUntukTulis("pjs", USULAN)).toEqual({ petugasId: 21 });
  });

  it("PHS memulangkan tanggal sidangnya", () => {
    expect(idUntukTulis("phs", USULAN)).toEqual({ tanggalSidang: "2026-09-24" });
  });
});

describe("pilihan tangan menang atas usulan - sama seperti jalur blangko", () => {
  it("panitera pengganti yang dipilih tangan yang dipakai", () => {
    expect(idUntukTulis("ppp", USULAN, { ppp: 12 })).toEqual({ petugasId: 12 });
  });

  it("juru sita yang dipilih tangan yang dipakai", () => {
    expect(idUntukTulis("pjs", USULAN, { pjs: 22 })).toEqual({ petugasId: 22 });
  });

  it("tanggal sidang yang dipilih tangan yang dipakai", () => {
    expect(idUntukTulis("phs", USULAN, { phs: "2026-10-01" })).toEqual({
      tanggalSidang: "2026-10-01",
    });
  });

  it("tanggal di luar daftar TIDAK dipakai - jatuh kembali ke usulan", () => {
    // Tanggal yang tidak ada di daftar berarti daftarnya berubah sesudah papan
    // digambar. Memakainya berarti menetapkan hari yang bukan hari sidang
    // majelis itu.
    expect(idUntukTulis("phs", USULAN, { phs: "2026-12-25" })).toEqual({
      tanggalSidang: "2026-09-24",
    });
  });
});

describe("majelis yang tidak lengkap DITOLAK, bukan ditulis sebagian", () => {
  it("dua kursi saja tidak menghasilkan apa-apa", () => {
    // Majelis cacat harus dibongkar dengan tangan dari beberapa tabel
    // sekaligus, dan jejaknya di sys_audittrail tetap tinggal.
    const pincang = {
      ...USULAN,
      pmh: { ...USULAN.pmh, anggota: USULAN.pmh.anggota.slice(0, 2), susunanTerpakai: [] },
    };
    expect(idUntukTulis("pmh", pincang)).toBeNull();
  });

  it("hakim tunggal satu kursi tetap sah", () => {
    const tunggal = {
      ...USULAN,
      pmh: { ...USULAN.pmh, bentuk: "tunggal", anggota: [{ hakimId: 7, nama: "Idris" }], susunanTerpakai: [] },
    };
    expect(idUntukTulis("pmh", tunggal)).toEqual({ hakimId: [7] });
  });

  it("tanpa usulan sama sekali memulangkan kosong, bukan id nol", () => {
    expect(idUntukTulis("ppp", { ppp: {} })).toBeNull();
    expect(idUntukTulis("phs", { phs: {} })).toBeNull();
  });
});

describe("penyambungan tombol ke mesin tulis", () => {
  it("urutannya tidak dapat dibalik", () => {
    // SIPP menolak PPP/PJS selama majelisnya belum ada, dan PHS menetapkan
    // hari sidang BAGI majelis itu.
    expect(konten).toContain('const URUTAN_TULIS = ["pmh", "ppp", "pjs", "phs"];');
  });

  it("tekanan pertama KERING - belum menulis apa pun", () => {
    expect(konten).toContain("!rencanaSudahDibaca");
    expect(konten).toContain("Rencana penetapan - belum ada yang ditulis");
  });

  it("rencana yang sebagian gagal tidak membuka jalan menulis", () => {
    expect(konten).toContain("if (!rencanaSudahDibaca && hasil.ok)");
  });

  it("berhenti pada kegagalan SUNGGUHAN, dan menyebut yang tidak dilanjutkan", () => {
    // Sejak 1.123.0 langkah yang SUDAH ADA dilewati dan rantainya berjalan
    // terus; yang memutus hanya kegagalan yang sungguhan. Lihat
    // ekstensi-penetapan-lanjut.test.ts untuk penjaga lengkapnya.
    expect(konten).toContain("if (/_sudah_ada$/.test(kode)) {");
    expect(konten).not.toContain("if (!berhasil) break;");
    expect(konten).toContain("Tidak dilanjutkan:");
  });

  it("sesudah menulis, tombolnya tidak dihidupkan lagi", () => {
    // Menekan kedua kalinya akan menuliskan penetapan yang sama dua kali.
    expect(konten).toContain('hasil.ok ? "Penetapan selesai" : "Berhenti - periksa sebabnya"');
  });

  it("penolakan lama sudah tidak ada", () => {
    expect(konten).not.toContain("Blangko penunjukan tidak terbuka di halaman ini.");
  });
});

describe("toggle pejabat penetap", () => {
  it("bawaannya disimpan sejak awal, bukan hanya ketika diubah", () => {
    // Yang tidak menyentuh pilihan ini akan mengirim nama kosong, dan yang
    // kosong ditolak rutenya dengan sebab yang tidak menunjuk ke sini.
    expect(konten).toContain("if (otomatis) data.pejabatDipilih[langkah.jenis] = otomatis.username;");
  });

  it("hanya digambar bila calonnya memang lebih dari satu", () => {
    expect(konten).toContain("Array.isArray(x.calon) && x.calon.length > 1");
  });

  it("pilihan ALETA ditandai pada teksnya", () => {
    expect(konten).toContain('calon.otomatis ? " (pilihan ALETA)" : ""');
  });

  it("akun yang belum siap disebut apa adanya", () => {
    expect(konten).toContain("akunnya belum siap");
  });
});
