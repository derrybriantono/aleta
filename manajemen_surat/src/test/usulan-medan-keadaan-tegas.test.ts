// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import {
  saringKalimatRujukan,
  usulkanMedanPutusan,
  type MedanPilihan,
  type UsulanMedan,
} from "@/lib/usulan-medan-putusan";

/**
 * ============================================================================
 * KEADAAN ISTERI DAN NUSYUZ - BAWAAN TETAP, SEBUTAN TEGAS DIIKUTI
 * ============================================================================
 *
 * Permintaan pengguna 26 September 2026 (butir 2): keadaan isteri dan nusyuz
 * tetap memakai bawaan yang berlaku (cerai gugat Suci, cerai talak Tidak
 * diketahui; nusyuz Tidak Nusyuz) - kecuali pertimbangan hukum MENYEBUTNYA
 * dengan tegas. Yang tegas dijawab "pasti"; kutipan pasal dan teori tidak.
 *
 * Kalimat nusyuz di bawah bentuk sungguhan pertimbangan PA Donggala 2025-2026
 * (sebutan pihak dipertahankan, nama dibuang). Kalimat keadaan isteri
 * disusun dari bentuk pertanyaan hakim, sebab 942 putusan cerai dikabulkan
 * 2025-2026 tidak satu pun menyebutnya sebagai fakta; bentuk yang harus
 * DIABAIKAN diambil dari putusan sungguhan ("tiga kali suci", "tujuan suci
 * perkawinan", "dalam keadaan tidak hamil").
 */

const KEADAAN: MedanPilihan = {
  kunci: 'select[name="keadaan_istri"]',
  label: "Keadaan Istri",
  pilihan: [
    { nilai: "", label: "Pilih Keadaan Istri" },
    { nilai: "1", label: "Suci" },
    { nilai: "2", label: "Haid" },
    { nilai: "3", label: "Hamil" },
    { nilai: "4", label: "Tidak diketahui" },
  ],
};
const NUSYUZ: MedanPilihan = {
  kunci: 'input[name="status_nusyuz"]',
  label: "Status Nusyuz",
  pilihan: [
    { nilai: "1", label: "Nusyuz" },
    { nilai: "0", label: "Tidak Nusyuz" },
  ],
};

const usul = (naskah: string, medan: MedanPilihan, jenisPerkara: string) =>
  usulkanMedanPutusan(naskah, [medan], { jenisPerkara })[0];

const PEMBUKA = "Menimbang, bahwa Penggugat dan Tergugat telah berpisah tempat tinggal. ";

describe("keadaan isteri: sebutan tegas diikuti, sisanya bawaan", () => {
  it.each([
    ["Menimbang, bahwa Termohon di persidangan menerangkan dirinya dalam keadaan suci.", "Cerai Talak", "Suci"],
    ["Menimbang, bahwa Termohon mengaku saat ini sedang haid.", "Cerai Talak", "Haid"],
    ["Menimbang, bahwa Penggugat saat ini sedang hamil 4 (empat) bulan.", "Cerai Gugat", "Hamil"],
    ["Menimbang, bahwa Termohon kini sedang mengandung anak kedua.", "Cerai Talak", "Hamil"],
  ])("tegas: %s -> %s", (kalimat, jenis, harapan) => {
    const u = usul(PEMBUKA + kalimat, KEADAAN, jenis);
    expect(u.nilaiLabel).toBe(harapan);
    expect(u.keyakinan).toBe("pasti");
  });

  it.each([
    // kutipan iddah dan rujukan
    ["Menimbang, bahwa masa iddah yang dimaksud ditetapkan 3 (tiga) kali suci atau sekurang-kurangnya 90 (sembilan puluh) hari.", "Cerai Talak", "Tidak diketahui"],
    ["Menimbang, bahwa waktu tunggu bagi yang masih haid ditetapkan 3 (tiga) kali suci.", "Cerai Gugat", "Suci"],
    // bukan keadaan isteri
    ["Menimbang, bahwa dengan perbuatan Tergugat yang demikian, tujuan suci perkawinan tidak tercapai.", "Cerai Gugat", "Suci"],
    ["Menimbang, bahwa kebutuhan dasar Termohon yang diceraikan dalam keadaan tidak hamil meliputi biaya makan.", "Cerai Talak", "Tidak diketahui"],
    // peristiwa yang sudah lewat
    ["Menimbang, bahwa sejak Penggugat sedang hamil anak pertama, Tergugat sering pergi.", "Cerai Gugat", "Suci"],
  ])("bawaan: %s", (kalimat, jenis, harapan) => {
    const u = usul(PEMBUKA + kalimat, KEADAAN, jenis);
    expect(u.nilaiLabel).toBe(harapan);
    expect(u.keyakinan).toBe("cukup");
  });
});

describe("nusyuz: bawaan Tidak Nusyuz, sebutan tegas 'pasti'", () => {
  it.each([
    ["Menimbang, bahwa Penggugat Rekonvensi telah tamkin sempurna dan tidak dalam keadaan nusyuz.", "Tidak Nusyuz"],
    ["Dengan demikian, fakta bahwa Penggugat tidak melakukan perbuatan nusyuz dinyatakan terbukti.", "Tidak Nusyuz"],
    ["Menimbang, bahwa karena dalil yang menjadi landasan nusyuz tidak terbukti, Majelis menolak dalil itu.", "Tidak Nusyuz"],
    ["Menimbang, bahwa oleh karena itu Penggugat selaku isteri tidak dapat dikatakan sebagai isteri yang nusyuz.", "Tidak Nusyuz"],
    ["Menimbang, bahwa telah terbukti di persidangan bahwa Penggugat telah melakukan perbuatan nusyuz terhadap Tergugat.", "Nusyuz"],
  ])("tegas: %s -> %s", (kalimat, harapan) => {
    const u = usul(PEMBUKA + kalimat, NUSYUZ, "Cerai Talak");
    expect(u.nilaiLabel).toBe(harapan);
    expect(u.keyakinan).toBe("pasti");
  });

  it.each([
    ["Menimbang, bahwa Majelis perlu memeriksa apakah Termohon terbukti sebagai istri yang nusyuz atau tidak."],
    ["Menimbang, bahwa hak nafkah iddah dapat gugur apabila istri terbukti tidak taat, kecuali istri tidak nusyuz."],
    ["Menimbang, bahwa Penggugat tidak mampu membuktikan dirinya tidak nusyuz."],
    ["Menimbang, bahwa rumah tangga Penggugat dan Tergugat sudah pecah."],
  ])("bawaan: %s", (kalimat) => {
    const u = usul(PEMBUKA + kalimat, NUSYUZ, "Cerai Talak");
    expect(u.nilaiLabel).toBe("Tidak Nusyuz");
    expect(u.keyakinan).toBe("cukup");
  });
});

/**
 * ============================================================================
 * PEMERIKSA 26 SEPTEMBER 2026 - T1, T2, T7, T8
 * ============================================================================
 *
 * Bentuk pertama aturan tegas diukur ulang atas pertimbangan, posita, dan
 * keterangan saksi sipp_donggala: 11 perkara baru "pasti Hamil", 9 salah.
 * Kalimat di bawah bentuk sungguhan korpus itu (sebutan pihak dipertahankan,
 * nama disederhanakan), ditambah bentuk pengingkaran sintetis pemeriksa.
 * Semuanya harus kembali ke BAWAAN ("cukup").
 */
describe("T1 - keadaan isteri: kehamilan lampau, orang lain, dan ingkar bukan temuan", () => {
  it.each([
    [
      "Bahwa penyebab kemelut rumah tangga tersebut adalah karena Tergugat sudah menikah dengan wanita lain dan sedang mengandung anak Tergugat;",
      "Cerai Gugat",
      "Suci",
    ],
    ["Pada Maret 2018 Tergugat meninggalkan Penggugat dalam keadaan hamil anak Kedua;", "Cerai Gugat", "Suci"],
    [
      "Bahwa Tergugat menendang punggung Penggugat yang sedang hamil 2 bulan hingga Penggugat mengalami keguguran.",
      "Cerai Gugat",
      "Suci",
    ],
    ["Termohon tetap pergi dalam keadaan hamil;", "Cerai Talak", "Tidak diketahui"],
    ["Menimbang, bahwa berdasarkan keterangan Termohon, Termohon tidak dalam keadaan hamil.", "Cerai Talak", "Tidak diketahui"],
    ["Menimbang, bahwa Termohon bukan dalam keadaan haid saat ikrar.", "Cerai Talak", "Tidak diketahui"],
    ["Menimbang, bahwa Termohon saat ini tidak sedang hamil.", "Cerai Talak", "Tidak diketahui"],
    // Hanya pemeriksaan ingkar di antara subjek dan keadaannya yang menahan ini.
    ["Menimbang, bahwa Termohon sekarang tidak dalam keadaan haid.", "Cerai Talak", "Tidak diketahui"],
    ["Menimbang, bahwa petitum angka 3 gugatan Penggugat masih mengandung kekaburan.", "Cerai Gugat", "Suci"],
    // T8: "masih haid" pada kaidah iddah berarti belum menopause, bukan
    // sedang haid - hanya \biddah\b yang menahannya.
    ["Menimbang, bahwa Termohon masih haid sehingga masa iddah Termohon adalah tiga quru'.", "Cerai Talak", "Tidak diketahui"],
  ])("bawaan: %s", (kalimat, jenis, harapan) => {
    const u = usul(PEMBUKA + kalimat, KEADAAN, jenis);
    expect(u.nilaiLabel).toBe(harapan);
    expect(u.keyakinan).toBe("cukup");
  });

  // Masukan produksi = pertimbangan + duduk perkara. Duduk perkara memuat
  // posita, jawaban, dan saksi: yang di sana bukan temuan majelis.
  const DUDUK =
    "Bahwa Termohon saat ini sedang hamil 5 (lima) bulan;\nBahwa Termohon telah berbuat nusyuz karena meninggalkan rumah tanpa izin Pemohon;";
  const PERTIMBANGAN = "Menimbang, bahwa Pemohon dan Termohon telah berpisah tempat tinggal.";

  it("dengan pertimbangan terpisah, duduk perkara tidak dibaca medan temuan", () => {
    const [k, n] = usulkanMedanPutusan(`${PERTIMBANGAN}\n\n${DUDUK}`, [KEADAAN, NUSYUZ], {
      jenisPerkara: "Cerai Talak",
      pertimbangan: PERTIMBANGAN,
    });
    expect([k.nilaiLabel, k.keyakinan]).toEqual(["Tidak diketahui", "cukup"]);
    expect([n.nilaiLabel, n.keyakinan]).toEqual(["Tidak Nusyuz", "cukup"]);
  });

  it("tanpa pertimbangan terpisah perilakunya seperti dahulu (naskah dasar dibaca)", () => {
    const [k, n] = usulkanMedanPutusan(`${PERTIMBANGAN}\n\n${DUDUK}`, [KEADAAN, NUSYUZ], { jenisPerkara: "Cerai Talak" });
    expect([k.nilaiLabel, k.keyakinan]).toEqual(["Hamil", "pasti"]);
    expect([n.nilaiLabel, n.keyakinan]).toEqual(["Nusyuz", "pasti"]);
  });

  it("temuan yang memang tertulis di pertimbangan tetap diikuti", () => {
    const pertimbangan = `${PERTIMBANGAN}\nMenimbang, bahwa Termohon saat ini sedang hamil 5 (lima) bulan.`;
    const [k] = usulkanMedanPutusan(`${pertimbangan}\n\n${DUDUK}`, [KEADAAN], { jenisPerkara: "Cerai Talak", pertimbangan });
    expect([k.nilaiLabel, k.keyakinan]).toEqual(["Hamil", "pasti"]);
  });
});

describe("T2 - isi kutipan sesudah titik dua tetap kalimat rujukan", () => {
  it("kutipan pasal dalam satu baris dibuang bersama pembukanya", () => {
    const naskah =
      "Menimbang, bahwa Pasal 122 Kompilasi Hukum Islam berbunyi: Talak bid'i adalah talak yang dilarang, yaitu talak yang dijatuhkan pada waktu isteri dalam keadaan haid.\n" +
      "Menimbang, bahwa Termohon hadir di persidangan.";
    expect(saringKalimatRujukan(naskah)).toBe("Menimbang, bahwa Termohon hadir di persidangan.");
  });

  it("kutipan hadits di baris berikutnya dibuang sampai pertimbangan baru", () => {
    const naskah = [
      "Menimbang, bahwa hal ini sejalan dengan hadits riwayat Bukhari dari Ibnu Umar:",
      "“Perintahkan ia merujuknya, kemudian menahannya hingga suci, lalu haid, lalu suci.”",
      "Artinya: talak dijatuhkan kepada isteri dalam keadaan suci.",
      "Menimbang, bahwa Penggugat dan Tergugat telah berpisah.",
    ].join("\n");
    expect(saringKalimatRujukan(naskah)).toBe("Menimbang, bahwa Penggugat dan Tergugat telah berpisah.");
  });

  it("daftar FAKTA sesudah titik dua tidak ikut dibuang", () => {
    const naskah = [
      "Menimbang, bahwa berdasarkan Pasal 311 RBg Majelis menemukan fakta hukum sebagai berikut:",
      "1. Penggugat dan Tergugat sering bertengkar;",
      "2. Tergugat pergi meninggalkan Penggugat;",
    ].join("\n");
    const hasil = saringKalimatRujukan(naskah);
    expect(hasil).toContain("Penggugat dan Tergugat sering bertengkar;");
    expect(hasil).toContain("Tergugat pergi meninggalkan Penggugat;");
    expect(hasil).not.toMatch(/pasal/i);
  });
});

describe("T7/T8 - klaim pihak dan kaidah umum bukan temuan 'tidak nusyuz'", () => {
  it.each([
    ["Menimbang, bahwa Majelis tidak sependapat dengan Termohon yang menyatakan dirinya tidak nusyuz."],
    ["Menimbang, bahwa dalil Termohon yang menyatakan dirinya tidak nusyuz tidak terbukti, maka Termohon dinyatakan nusyuz."],
    ["Menimbang, bahwa Termohon dalam jawabannya menyatakan dirinya tidak nusyuz karena pergi atas izin Pemohon."],
    ["Menimbang, bahwa Pemohon mendalilkan Termohon nusyuz, sedangkan Termohon membantah dan menyatakan tidak nusyuz."],
    ["Menimbang, bahwa isteri yang tidak nusyuz berhak atas nafkah iddah dan mut'ah."],
    // Masing-masing hanya ditahan satu bentuk: "tidak sependapat", dan klaim
    // yang disusul penolakannya ("tidak beralasan").
    ["Menimbang, bahwa Majelis tidak sependapat dengan pendapat Termohon bahwa Termohon tidak nusyuz."],
    ["Menimbang, bahwa pengakuan Termohon bahwa Termohon tidak nusyuz tidak beralasan hukum."],
    // T8: hanya \bkecuali\b yang menahan kaidah ini.
    ["Menimbang, bahwa nafkah iddah tidak gugur kecuali terdapat bukti yang menunjukkan Termohon nusyuz."],
  ])("bawaan: %s", (kalimat) => {
    const u = usul(PEMBUKA + kalimat, NUSYUZ, "Cerai Talak");
    expect(u.nilaiLabel).toBe("Tidak Nusyuz");
    expect(u.keyakinan).toBe("cukup");
  });

  it("dalil NUSYUZ yang dinyatakan tidak terbukti tetap temuan tegas", () => {
    const u = usul(
      PEMBUKA + "Oleh karena dalil nusyuz yang diajukan Tergugat telah dinyatakan tidak terbukti, maka Penggugat berhak atas nafkah lampau;",
      NUSYUZ,
      "Cerai Talak"
    );
    expect([u.nilaiLabel, u.keyakinan]).toEqual(["Tidak Nusyuz", "pasti"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTE: POST isian-sipp mengirim PERTIMBANGAN draf tersendiri (T1)
// ─────────────────────────────────────────────────────────────────────────────

const NASKAH_DRAF_T1 = [
  "DUDUK PERKARA",
  "Bahwa Termohon saat ini sedang hamil 5 (lima) bulan;",
  "Bahwa Termohon telah berbuat nusyuz karena meninggalkan rumah tanpa izin Pemohon;",
  "PERTIMBANGAN HUKUM",
  "Menimbang, bahwa Pemohon dan Termohon telah berpisah tempat tinggal;",
  "AMAR PUTUSAN",
  "Mengabulkan permohonan Pemohon;",
  "PENUTUP",
  "Demikian diputuskan.",
].join("\n");

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    queryOne: async () => ({ naskah: NASKAH_DRAF_T1, keadaan: "draf", versi: 1 }),
  }),
}));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => ({ name: "Penguji" }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewaySippKonteks: async () => ({ ok: false, error: "tidak dipakai POST" }),
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));

describe("rute POST isian-sipp - nusyuz dan keadaan isteri dari pertimbangan saja", () => {
  it("posita di duduk perkara tidak menjadi 'pasti Hamil' atau 'pasti Nusyuz'", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/putusan/isian-sipp/route");
    const jawab = await POST(
      new NextRequest("http://localhost/api/aleta-ecourt/putusan/isian-sipp", {
        method: "POST",
        body: JSON.stringify({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", medan: [KEADAAN, NUSYUZ] }),
      })
    );
    const isi = (await jawab.json()) as { data: { ada: boolean; usulan: UsulanMedan[] } };
    expect(isi.data.ada).toBe(true);
    const [k, n] = isi.data.usulan;
    expect([k.nilaiLabel, k.keyakinan]).toEqual(["Tidak diketahui", "cukup"]);
    expect([n.nilaiLabel, n.keyakinan]).toEqual(["Tidak Nusyuz", "cukup"]);
  });
});
