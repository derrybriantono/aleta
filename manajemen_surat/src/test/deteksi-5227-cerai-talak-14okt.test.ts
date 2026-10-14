// @vitest-environment node
/**
 * R2 14 Okt 2026 - 5227 "Alasan-Alasan Cerai" untuk CERAI TALAK.
 *
 * Laporan pengguna (573/Pdt.G/2026/PA.Dgl): kedua saksi menerangkan penyebab
 * "Keluarga Termohon sering ikut campur ... dan sering merendahkan Pemohon
 * sebagai kepala keluarga", tetapi usulan hanya "terus-menerus terjadi
 * perselisihan" atau "Termohon melalaikan kewajiban nafkah lahir" - yang
 * keliru secara hukum: kewajiban nafkah ada pada suami (Pemohon).
 *
 * Teks saksi & posita di bawah NYATA (aps_badilag.abt_keterangan_saksi dan
 * SIPP perkara.posita, dibaca baca-saja 14 Okt); nama anak dan nomor akta
 * diganti. Ukur atas 272 CT + 1.220 CG putus 2024-2026: CT bersebab 75 -> 235,
 * "Termohon melalaikan nafkah" 7 -> 0, sama dengan isian hakim 7/37 -> 27/37.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type Apa = any;
const AKAR = path.resolve(process.cwd(), "..");
const muat = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const U: Apa = muat(path.join(AKAR, "aleta_bot/services/abtUsulanService.js"));
const KB: Apa = muat(path.join(AKAR, "aleta_bot/services/abtKalimatBaku.js"));
const S: Apa = muat(path.join(AKAR, "aleta_bot/services/isiGugatanService.js"));
const SC: Apa = muat(path.join(AKAR, "aleta_bot/services/deteksi/sebabCerai.js"));

const CT = { pelaku: "Termohon", lawan: "Pemohon" };
const CG = { pelaku: "Tergugat", lawan: "Penggugat" };
const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b}`).join("\n");
const u5227 = (h: Apa) => h.usulan.find((u: Apa) => u.kode === "5227");
const NAFKAH_KELIRU = /Termohon\s+melalaikan\s+kewajiban\s+(?:memberi\s+)?nafkah/i;

// ---- 573/Pdt.G/2026/PA.Dgl (cerai talak) ----------------------------------------
const S1_573 = bas(
  "saya kenal dengan Pemohon karena saya adalah paman Pemohon;",
  "pemohon menghadap di persidangan ini untuk mengajukan cerai terhadap istrinya sebagai Termohon;",
  "setelah menikah Pemohon dan Termohon tinggal bersama di rumah orang tua Termohon sampai berpisah;",
  "pemohon mengajukan cerai terhadap Termohon karena sudah tidak rukun dalam rumah tangganya;",
  "antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran sejak akhir tahun 2022;",
  "yang biasa menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena Keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon dan sering merendahkan Pemohon sebagai kepala keluarga;",
  "saya tidak pernah melihat Pemohon dan Termohon bertengkar, akan tetapi saya terlibat dalam proses mediasi antara Pemohon dan Termohon;",
  "pemohon dan Termohon sudah pisah tempat tinggal sejak bulan Maret 2023;",
  "yang meninggalkan tempat tinggal bersama adalah Pemohon;",
  "pemohon dan Termohon sudah pernah diupayakan untuk dirukunkan oleh pihak keluarga, namun tidak berhasil;"
);
const S2_573 = bas(
  "saya kenal dengan Pemohon karena saya adalah adik kandung Pemohon;",
  "pemohon mengajukan cerai terhadap Termohon karena sudah tidak rukun dalam rumah tangganya;",
  "antara Pemohon dan Termohon sering terjadi perselisihan dan pertengkaran sejak bulan November 2022;",
  "yang biasa menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena Keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon, Termohon dan keluarganya juga sering merendahkan Pemohon dan tidak pernah merasa cukup dengan nafkah yang diberikan Pemohon;",
  "saya pernah melihat dan mendengar langsung Pemohon dan Termohon bertengkar;",
  "pemohon dan Termohon sudah pisah tempat tinggal sejak bulan Maret 2023;",
  "yang meninggalkan tempat tinggal bersama adalah Pemohon;",
  "pemohon dan Termohon sudah pernah diupayakan untuk dirukunkan oleh pihak keluarga, namun tidak berhasil;"
);
const POSITA_573 = [
  "1. Bahwa pada tanggal 24 Juli 2011, Pemohon dan Termohon telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah pada Kantor Urusan Agama (KUA) Kecamatan Damsol, Kabupaten Donggala, Sulawesi Tengah, sebagaimana sesuai dengan Kutipan Akta Nikah Nomor : XXX;",
  "2. Bahwa setelah menikah, Pemohon dan Termohon tinggal bersama di rumah orang tua Termohon di Desa Sabang hingga pisah rumah;",
  "3. Bahwa setelah menikah, Pemohon dan Termohon hidup selayaknya suami isteri dan telah di karuniai 2 (Dua) orang anak yang masing-masing bernama: a. ANAK I bin AYAH, usia 12 tahun. b. ANAK II binti AYAH, usia 8 tahun Saat ini Kedua anak tersebut berada dalam pengasuhan Termohon ;",
  "4. Bahwa sejak bulan November 2022 keadaan rumah tangga Pemohon dan Termohon mulai tidak harmonis dan sering terjadi perselisihan dan pertengkaran yang disebabkan karena :",
  "a. Keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon;",
  "b. Pemohon tidak pernah melalaikan kewajibannya untuk memberikan nafkah namun Termohon selalu merasa kurang atas nafkah yang telah diberikan oleh Pemohon;",
  "5. Bahwa puncak keretakan hubungan rumah tangga Pemohon dengan Termohon tersebut terjadi pada tanggal Maret 2023, Pemohon pergi dari rumah kediaman bersama kerumah orangtua Pemohon di Desa Sioyong dikarenakan terjadi perselisihan dan pertengkaran antara Pemohon dan Termohon, sehingga Pemohon dan Termohon telah pisah rumah selama kurang lebih 3 tahun 5 bulan;",
].join("\n");

describe("573/Pdt.G/2026 - sebab keluarga Termohon ikut campur & merendahkan Pemohon", () => {
  const h = U.dariKeteranganSaksi(S1_573, S2_573, "", CT, POSITA_573, {});
  const u = u5227(h);

  it("5227 memuat kedua sebab yang diterangkan kedua saksi, persis isian hakim", () => {
    expect(u.nilai).toBe(
      "keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon dan sering merendahkan Pemohon sebagai kepala keluarga"
    );
    expect(u.nilai).not.toMatch(NAFKAH_KELIRU);
    expect(u.nilai).not.toMatch(/^Antara Pemohon dan Termohon terus-menerus/);
  });

  it("keyakinan dari kedua saksi; tingkat tetap 'cukup' (5227 tidak pernah pasti)", () => {
    expect(u.keyakinan).toBe("pasti");
    expect(u.tingkat).toBe("cukup");
    expect(u.kodePola).toBe("sebab-keluarga-campur");
    expect(u.sumber.map((s: Apa) => s.saksi)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("sebab satu saksi (nafkah) tidak masuk, disebut di catatan dengan rumusan yang benar", () => {
    expect(u.catatan).toContain("Termohon tidak pernah merasa cukup dengan nafkah yang diberikan Pemohon (saksi 2, juga didalilkan)");
    const nafkah = h.sebab5227.find((b: Apa) => b.sebab === "tidak cukup nafkah");
    expect(nafkah).toMatchObject({ kekuatan: "satu saksi", didalilkan: true, dipakai: false });
    // Ciri lama "campur tangan keluarga" kini terwakili - tidak lagi "tanpa frasa".
    expect(h.ciriTanpaFrasa).not.toContain("campur tangan keluarga");
  });
});

describe("cerai talak lain (teks saksi nyata)", () => {
  const kasus: [string, string, string, string][] = [
    [
      "404/Pdt.G/2025 - tidak taat & tidak mendengar nasihat",
      bas("yang biasa menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena Termohon tidak taat dan patuh kepada Pemohon dan Termohon tidak mendengar nasehat Pemohon dan Termohon selingkuh dengan laki laki lain ;"),
      bas("ya, penyebab mereka berselisih dan bertengkar, yang saya tahu yaitu Termohon tidak taat kepada Pemohon dan sering mengabaikan nasihat yang disampaikan oleh Pemohon;"),
      "Termohon tidak taat kepada Pemohon dan tidak mau mendengarkan nasihat Pemohon",
    ],
    [
      "565/Pdt.G/2025 - tidak mau ikut tinggal bersama suami",
      bas("yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena Termohon tidak mau pindah tugas dan tinggal bersama Pemohon di Donggala;"),
      bas("yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena antara Pemohon dan Termohon tidak ada kesepakatan tentang tempat tinggal, karena Termohon tidak mau ikut Pemohon tinggal di Donggala;"),
      "Termohon tidak mau ikut tinggal bersama Pemohon",
    ],
    [
      "183/Pdt.G/2026 - orang tua / keluarga Termohon ikut campur",
      bas("setahu saya penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena orang tua Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon;"),
      bas("yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena Keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon;"),
      "keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon",
    ],
    [
      "409/Pdt.G/2025 - istri tidak merasa cukup dengan nafkah",
      bas("yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena masalah ekonomi dimana Termohon merasa tidak cukup atas nafkah yang diberikan oleh Pemohon;"),
      bas("yang menjadi penyebab perselisihan dan pertengkaran antara Pemohon dan Termohon adalah karena masalah ekonomi dimana Termohon kurang bersyukur dan selalu merasa kurang atas nafkah yang telah diberikan oleh Pemohon;"),
      "Termohon tidak pernah merasa cukup dengan nafkah yang diberikan Pemohon",
    ],
  ];
  it.each(kasus)("%s", (_judul, s1, s2, harap) => {
    const u = u5227(U.dariKeteranganSaksi(s1, s2, "", CT, "", {}));
    expect(u.nilai).toBe(harap);
    expect(u.nilai).not.toMatch(NAFKAH_KELIRU);
  });

  it("subjek dibaca per klausa: pihak lawan, penyangkal, dan 'Pemohon dan Termohon' tidak menjadi sebab Termohon", () => {
    const lawan = u5227(
      U.dariKeteranganSaksi(
        bas("Pemohon sering keluar rumah tanpa izin Termohon sehingga bertengkar;"),
        bas("Pemohon sering keluar rumah tanpa izin sehingga sering bertengkar;"),
        "",
        CT,
        "",
        {}
      )
    );
    expect(lawan.nilai).not.toMatch(/keluar rumah/);
    const sangkal = u5227(
      U.dariKeteranganSaksi(bas("Termohon tidak pernah merendahkan Pemohon, mereka bertengkar;"), bas("Termohon tidak pernah merendahkan Pemohon dan sering bertengkar;"), "", CT, "", {})
    );
    expect(sangkal.nilai).not.toMatch(/merendahkan/);
    const bersama = SC.deteksi({
      b1: ["Pemohon dan Termohon tidak pernah lagi berhubungan badan sejak pisah"],
      b2: ["Pemohon dan Termohon tidak pernah lagi berhubungan badan"],
      butirPosita: [],
      pihak: CT,
    });
    expect(bersama.butir.map((b: Apa) => b.kunci)).not.toContain("nafkah batin");
  });
});

describe("nafkah lahir bukan kewajiban istri - tidak pernah dituduhkan kepada Termohon", () => {
  it("kalimat baku: ciri nafkah pada cerai talak dipulangkan sebagai tidakBerlaku", () => {
    const r = KB.susunAlasanRinci(["tidak memberi nafkah", "cemburu", "perselisihan terus-menerus"], CT);
    expect(r.kalimat).toBe("Termohon bersikap cemburu berlebihan yang memicu perselisihan terus-menerus dengan Pemohon");
    expect(r.tidakBerlaku).toEqual(["tidak memberi nafkah"]);
    // Cerai gugat tidak berubah.
    expect(KB.susunAlasanRinci(["tidak memberi nafkah"], CG).kalimat).toBe("Tergugat melalaikan kewajiban nafkah lahir");
  });

  it("kedua saksi menyebut 'masalah nafkah' pada CT: tidak menjadi 'Termohon melalaikan ...', catatan menjelaskan", () => {
    const u = u5227(
      U.dariKeteranganSaksi(
        bas("Pemohon dan Termohon sering bertengkar karena masalah nafkah;"),
        bas("Pemohon dan Termohon sering bertengkar karena masalah nafkah;"),
        "",
        CT,
        "Bahwa sering terjadi pertengkaran karena masalah nafkah;",
        {}
      )
    );
    expect(u.nilai).not.toMatch(NAFKAH_KELIRU);
    expect(u.catatan).toContain("kewajiban nafkah lahir ada pada Pemohon (suami)");
  });

  it("SDG cerai talak: alasan nafkah ditolak (kewajiban_suami), saksi tidak diusulkan berkata 'Termohon melalaikan'", () => {
    const templat = [{ no: "1", tanya: "Apa penyebab pertengkaran Pemohon dan Termohon?", jawab: "karena ..." }];
    const h = U.susunKeteranganSaksiSdg({ templat, alasan: ["tidak memberi nafkah", "cemburu"], ...CT });
    expect(h.alasan).toEqual(["cemburu"]);
    expect(h.alasanDitolak).toEqual([{ kunci: "tidak memberi nafkah", sebab: "kewajiban_suami" }]);
    expect(h.saksi1[0].jawab).not.toMatch(NAFKAH_KELIRU);
    const p = U.susunKeteranganSaksiSdg({ templat, posita: POSITA_573, ...CT });
    expect(p.alasan).not.toContain("tidak memberi nafkah");
  });

  it("e-Court (isiGugatan) cerai talak: bunyi sebab dari dalil, tanpa 'Termohon melalaikan'", () => {
    const h = S.susunIsiGugatan({ sebutan: CT, dokumen: [{ judul: "Dokumen Permohonan", peran: "gugatan", teks: POSITA_573 }] });
    const u = h.usulan.find((x: Apa) => x.kode === "5227");
    expect(u.pilihan.map((p: Apa) => p.nilai)).toContain(
      "keluarga Termohon sering ikut campur dalam urusan rumah tangga Pemohon dan Termohon, serta Termohon tidak pernah merasa cukup dengan nafkah yang diberikan Pemohon"
    );
    for (const p of u.pilihan) expect(p.nilai).not.toMatch(NAFKAH_KELIRU);
    expect(u.pilihan.map((x: Apa) => x.kodePola)).toEqual(u.kodePola.split(","));
  });
});

describe("cerai gugat pembanding", () => {
  it("tanpa sebab baru: kalimat lama tidak berubah sehuruf pun", () => {
    const u = u5227(
      U.dariKeteranganSaksi(
        bas("Penggugat dan Tergugat sering bertengkar karena Tergugat tidak memberi nafkah dan sering bermain judi;"),
        bas("Penggugat dan Tergugat sering bertengkar karena Tergugat tidak memberi nafkah dan suka judi;"),
        "",
        CG,
        "Bahwa Tergugat tidak memberi nafkah dan sering berjudi;",
        {}
      )
    );
    expect(u.nilai).toBe("Tergugat melalaikan kewajiban nafkah lahir serta menjadi penjudi");
  });

  it("keluarga Tergugat ikut campur (dahulu 'tanpa frasa', ragu) kini ikut kalimat, sesudah perbuatan Tergugat", () => {
    const u = u5227(
      U.dariKeteranganSaksi(
        bas("penyebabnya karena Tergugat tidak memberi nafkah dan keluarga Tergugat sering ikut campur dalam urusan rumah tangga Penggugat dan Tergugat;"),
        bas("yang menjadi penyebab adalah Tergugat tidak memberi nafkah, keluarga Tergugat juga sering ikut campur;"),
        "",
        CG,
        "Bahwa Tergugat tidak memberi nafkah; Bahwa keluarga Tergugat sering ikut campur dalam rumah tangga;",
        {}
      )
    );
    expect(u.nilai).toBe(
      "Tergugat melalaikan kewajiban nafkah lahir, serta keluarga Tergugat sering ikut campur dalam urusan rumah tangga Penggugat dan Tergugat"
    );
    expect(u.keyakinan).toBe("pasti");
    expect(u.catatan).not.toContain("belum ada frasa bakunya");
  });

  it("hanya posita yang menyebut sebab: keyakinan 'ragu', kesepakatan 'posita'", () => {
    const u = u5227(
      U.dariKeteranganSaksi(
        bas("Penggugat dan Tergugat sering bertengkar;"),
        bas("antara Penggugat dan Tergugat sering terjadi pertengkaran;"),
        "",
        CG,
        "Bahwa keluarga Tergugat selalu ikut campur dalam urusan rumah tangga Penggugat dan Tergugat sehingga sering terjadi pertengkaran;",
        {}
      )
    );
    expect(u.nilai).toBe("keluarga Tergugat sering ikut campur dalam urusan rumah tangga Penggugat dan Tergugat");
    expect(u.keyakinan).toBe("ragu");
    expect(u.tingkat).toBe("ragu");
    expect(u.kesepakatan).toBe("posita");
  });
});
