import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Jenis 345 KELALAIAN ATAS KEWAJIBAN SUAMI / ISTRI (paket abt-w3a-blangko-baru-perkawinan, agen W3a-C, 21 Okt 2026).
 *
 * BATAS: perkara jenis 345 di PA Donggala NOL (SIPP server 21 Okt 2026), jadi posita di bawah SINTETIS bergaya posita PA Donggala
 * (nama tidak ada). Kueri variabel data_sql diukur terpisah atas perkara cerai gugat nyata (abt-paket/.../sumber/w3aC_uji_sql.py, butuh VPN).
 */

const akar = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(akar, "aleta_bot", "package.json"));
const dir = path.join(akar, "aleta_bot", "services", "deteksi");
const kelalaian = require_(path.join(dir, "kelalaianKewajiban.js"));
const SUMBER = path.join(akar, "abt-paket", "w3a-blangko-baru-perkawinan", "sumber");
const KATALOG = path.join(akar, "ekstensi-sipp", "saksi-katalog");
const KAMUS = "D:/aleta-dev/kerja/w3a/abt-variabel-w3a.json";

type Fakta = { nilai: string; yakin: string; kalimat: string; catatan?: string };
type Peta = Record<string, Fakta>;
const nilai = (p: Peta, k: string) => (p[k] ? p[k].nilai : undefined);
const yakin = (p: Peta, k: string) => (p[k] ? p[k].yakin : undefined);

// Istri menggugat suami (sintetis).
const POSITA_ISTRI = `1. Bahwa pada tanggal 12 Mei 2018 Penggugat dan Tergugat telah melangsungkan pernikahan yang dicatat oleh Pegawai Pencatat Nikah Kantor Urusan Agama Kecamatan Banawa sebagaimana Kutipan Akta Nikah Nomor 123/45/V/2018; 2. Bahwa Penggugat adalah istri sah Tergugat dan sampai sekarang perkawinan tersebut belum pernah putus; 3. Bahwa dari pernikahan tersebut Penggugat dan Tergugat dikaruniai 1 orang anak; 4. Bahwa sejak bulan Maret 2024 Tergugat tidak lagi memberikan nafkah lahir kepada Penggugat dan tidak menyediakan tempat tinggal yang layak bagi Penggugat; 5. Bahwa Tergugat bekerja sebagai nelayan dengan penghasilan Rp. 4.000.000,- per bulan; 6. Bahwa Tergugat meninggalkan Penggugat dan pergi dari rumah sejak Maret 2024 tanpa kabar; 7. Bahwa Penggugat telah berusaha menasihati Tergugat namun tidak berhasil;`;
const PETITUM_ISTRI = `1. Mengabulkan gugatan Penggugat; 2. Menyatakan Tergugat telah melalaikan kewajibannya sebagai suami terhadap Penggugat; 3. Menghukum Tergugat membayar nafkah lampau (madhiyah) sejak bulan Maret 2024 sampai dengan bulan Juli 2026 (29 bulan) sebesar Rp. 43.500.000,- (empat puluh tiga juta lima ratus ribu rupiah); 4. Menghukum Tergugat membayar nafkah kepada Penggugat sebesar Rp. 1.500.000,- (satu juta lima ratus ribu rupiah) setiap bulan; 5. Menghukum Tergugat menyediakan tempat tinggal yang layak bagi Penggugat; 6. Menghukum Tergugat membayar uang paksa (dwangsom) sebesar Rp. 100.000,- (seratus ribu rupiah) untuk setiap hari keterlambatan; 7. Menyatakan sah dan berharga sita jaminan (conservatoir beslag) atas sebidang tanah di Desa Contoh; 8. Membebankan biaya perkara menurut hukum;`;
// Suami menggugat istri (sintetis).
const POSITA_SUAMI = `1. Bahwa Penggugat adalah suami sah Tergugat yang menikah pada tanggal 3 Februari 2019; 2. Bahwa sejak Januari 2025 Tergugat tidak mau tinggal serumah dengan Penggugat dan pergi dari rumah kediaman bersama tanpa izin Penggugat; 3. Bahwa Tergugat tidak mengurus rumah tangga dan tidak berbakti kepada Penggugat sebagai suami;`;
const PETITUM_SUAMI = `1. Mengabulkan gugatan Penggugat; 2. Menghukum Tergugat untuk kembali tinggal serumah dengan Penggugat dan mengurus rumah tangga dengan sebaik-baiknya; 3. Membebankan biaya perkara kepada Penggugat;`;
// Cerai gugat (BUKAN gugatan kelalaian): tidak boleh menghasilkan apa pun.
const POSITA_CERAI = `Bahwa Penggugat dan Tergugat sering bertengkar terus-menerus; bahwa Tergugat meninggalkan Penggugat sejak tahun 2022 dan tidak memberi nafkah; bahwa Penggugat memohon bercerai dengan Tergugat.`;
const PETITUM_CERAI = `1. Mengabulkan gugatan Penggugat; 2. Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;`;
// Nafkah anak saja (bukan kelalaian terhadap pasangan): nafkah anak tidak boleh menjadi kewajiban pasangan.
const POSITA_ANAK = `Bahwa Penggugat adalah ibu kandung seorang anak; bahwa Tergugat tidak memberi nafkah untuk anak tersebut sejak tahun 2023.`;
const PETITUM_ANAK = `1. Mengabulkan gugatan Penggugat; 2. Menghukum Tergugat membayar nafkah anak sebesar Rp. 1.000.000,- setiap bulan;`;

describe("deteksi kelalaian kewajiban suami/istri (345)", () => {
  it("terdaftar untuk jenis 345 dan peta variabel memuat 3690-3733 yang relevan", () => {
    expect(kelalaian.kunci).toBe("kelalaian-kewajiban");
    expect(kelalaian.jenisPerkaraId).toEqual([345]);
    const kode = kelalaian.variabel.map((v: { kode: string }) => v.kode);
    for (const k of ["3691", "3694", "3696", "3697", "3700", "3701", "3702", "3704", "3706", "3709", "3710"]) expect(kode).toContain(k);
  });

  describe("istri menggugat suami", () => {
    const p: Peta = kelalaian.deteksi(POSITA_ISTRI, { petitum: PETITUM_ISTRI });
    it("kedudukan dan kewajiban dari posita (cukup/pasti)", () => {
      expect(nilai(p, "3691")).toBe("istri");
      expect(["pasti", "cukup"]).toContain(yakin(p, "3691"));
      expect(nilai(p, "3694")).toContain("memberi nafkah lahir");
      expect(nilai(p, "3694")).toContain("menyediakan tempat kediaman");
      expect(nilai(p, "3694")).not.toContain("berbakti"); // kewajiban istri tidak boleh muncul bila Penggugat istri
      expect(nilai(p, "3694")).not.toContain("mengatur urusan rumah tangga");
      expect(yakin(p, "3694")).toBe("cukup");
      expect(nilai(p, "3697")).toBe("sejak bulan Maret 2024");
      expect(yakin(p, "3697")).toBe("cukup");
    });
    it("tuntutan dari petitum hanya USULAN (ragu): besaran ditetapkan hakim", () => {
      expect(nilai(p, "3700")).toBe("Rp1.500.000,00 (satu juta lima ratus ribu rupiah)");
      expect(nilai(p, "3701")).toBe("sejak bulan Maret 2024 sampai dengan bulan Juli 2026 (29 bulan)");
      expect(nilai(p, "3702")).toBe("Rp43.500.000,00 (empat puluh tiga juta lima ratus ribu rupiah)");
      expect(nilai(p, "3704")).toContain("tempat tinggal yang layak");
      expect(nilai(p, "3709")).toBe("sebidang tanah di Desa Contoh");
      expect(nilai(p, "3710")).toBe("Rp100.000,00 (seratus ribu rupiah)");
      for (const k of ["3700", "3701", "3702", "3704", "3709", "3710"]) expect(yakin(p, k), k).toBe("ragu");
    });
    it("tiap nilai membawa kalimat sumber dan yakin yang sah", () => {
      for (const [k, f] of Object.entries(p)) {
        expect(f.kalimat.length, k).toBeGreaterThan(5);
        expect(["pasti", "cukup", "ragu"]).toContain(f.yakin);
      }
    });
    it("tuntutan petitum tidak menghasilkan 3706 (kembali serumah) bila tidak diminta", () => {
      expect(p["3706"]).toBeUndefined();
    });
  });

  describe("suami menggugat istri", () => {
    const p: Peta = kelalaian.deteksi(POSITA_SUAMI, { petitum: PETITUM_SUAMI });
    it("kedudukan suami dan kewajiban istri", () => {
      expect(nilai(p, "3691")).toBe("suami");
      expect(nilai(p, "3694")).toContain("mengatur urusan rumah tangga");
      expect(nilai(p, "3694")).toContain("berbakti");
      expect(nilai(p, "3694")).toContain("tinggal serumah");
      expect(nilai(p, "3694")).not.toContain("memberi nafkah");
      expect(nilai(p, "3694")).not.toContain("kiswah");
      expect(nilai(p, "3697")).toBe("sejak bulan Januari 2025");
    });
    it("kewajiban lain bukan uang dari petitum (usulan ragu)", () => {
      expect(nilai(p, "3706")).toContain("kembali tinggal serumah");
      expect(nilai(p, "3706")).toContain("mengatur urusan rumah tangga");
      expect(yakin(p, "3706")).toBe("ragu");
      expect(p["3700"]).toBeUndefined();
    });
  });

  it("kedudukan yang bertentangan dengan jenis kelamin Penggugat di SIPP diturunkan menjadi ragu", () => {
    const p: Peta = kelalaian.deteksi(POSITA_ISTRI, { petitum: PETITUM_ISTRI, jenisKelaminPenggugat: "L" });
    expect(yakin(p, "3691")).toBe("ragu");
    expect(p["3691"].catatan).toContain("SIPP");
    const sama: Peta = kelalaian.deteksi(POSITA_ISTRI, { petitum: PETITUM_ISTRI, jenisKelaminPenggugat: "P" });
    expect(["pasti", "cukup"]).toContain(yakin(sama, "3691"));
  });

  it("posita yang tidak berkaitan tidak menghasilkan nilai apa pun (cerai, nafkah anak saja, kosong)", () => {
    expect(kelalaian.deteksi(POSITA_CERAI, { petitum: PETITUM_CERAI })).toEqual({});
    expect(kelalaian.deteksi("", {})).toEqual({});
    expect(kelalaian.deteksi("Bahwa Pemohon bermaksud menikah dengan calon suami pilihan Pemohon.", { petitum: "1. Mengabulkan permohonan Pemohon;" })).toEqual({});
    const anak: Peta = kelalaian.deteksi(POSITA_ANAK, { petitum: PETITUM_ANAK });
    expect(anak["3694"]).toBeUndefined(); // nafkah anak bukan kewajiban terhadap pasangan
    expect(anak["3700"]).toBeUndefined();
  });
});

describe("paket RTF dan variabel jenis 345 (dibangun ulang lewat python)", () => {
  const pythonAda = (() => {
    try {
      execFileSync("python", ["--version"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })();
  const hasil = (() => {
    if (!pythonAda) return null;
    const out = execFileSync("python", [path.join(SUMBER, "w3aC_periksa.py")], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" }, maxBuffer: 32 * 1024 * 1024, timeout: 240000 });
    return JSON.parse(out.trim().split("\n").pop() as string);
  })();

  it.skipIf(!pythonAda)("15 putusan + 38 BAS ditulis, tanpa galat isi (token ada, tanpa kata jenis lain, tanpa Aleta, amar berurutan, PETA unik)", () => {
    expect(hasil.galat).toEqual([]);
    expect(hasil.putusan).toBe(15);
    expect(hasil.bas).toBe(38);
    expect(hasil.peta).toBe(15);
  });
  it.skipIf(!pythonAda)("37 variabel baru semuanya dipakai di naskah atau daftar isian", () => {
    expect(hasil.variabel).toBe(37);
    expect(hasil.token_baru_tak_terpakai).toEqual([]);
  });
});

describe("katalog saksi jenis 345", () => {
  const Mesin = require_(path.join(akar, "ekstensi-sipp", "saksi-katalog.js"));
  const baca = (n: string) => JSON.parse(readFileSync(path.join(KATALOG, n), "utf8"));
  const utama = baca("kelalaian-kewajiban.json");
  const tambahan = baca("kelalaian-kewajiban-tergugat.json");
  const variabelAda = existsSync(KAMUS) ? new Set(Object.keys(JSON.parse(readFileSync(KAMUS, "utf8")))) : null;

  it("lolos periksaKatalog tanpa galat (utama, tambahan, dan gabungan)", () => {
    expect(Mesin.periksaKatalog(utama, { namaBerkas: "kelalaian-kewajiban.json", variabelAda }).galat).toEqual([]);
    expect(Mesin.periksaKatalog(tambahan, { namaBerkas: "kelalaian-kewajiban-tergugat.json", variabelAda }).galat).toEqual([]);
    const gabung = Mesin.gabungKatalog(utama, [utama, tambahan]);
    expect(gabung.digabungDari).toContain("kelalaian-kewajiban-tergugat");
    expect(Mesin.periksaKatalog(gabung, { variabelAda }).galat).toEqual([]);
    expect(Mesin.ringkasKatalog(utama).pertanyaan).toBeGreaterThanOrEqual(24);
  });
  it("dikenali untuk jenis 345 dan tidak berebut dengan jenis lain", () => {
    const k = Mesin.kenaliKatalog([utama, tambahan, baca("nafkah-anak.json"), baca("cerai-gugat.json")], { jenisPerkaraId: "345" });
    expect(k && k.kunci).toBe("kelalaian-kewajiban");
  });
  it("butir kewajiban suami hanya diajukan bila Penggugat istri, butir kewajiban istri hanya bila Penggugat suami", () => {
    const ids = (keadaan: Record<string, unknown>) => Mesin.pertanyaanAktif(utama, keadaan, "P", { tingkat: ["inti", "pilihan", "tambahan"] }).map((q: { id: string }) => q.id);
    const istri = ids({ kehadiran: "kontradiktoir", kedudukanPenggugat: "istri", kelalaian: ["nafkah", "tempat-kediaman"] });
    expect(istri).toContain("q-nafkah-diberikan");
    expect(istri).toContain("q-tempat-kediaman");
    expect(istri).not.toContain("q-rumah-tangga-istri");
    expect(istri).not.toContain("q-berbakti");
    const suami = ids({ kehadiran: "kontradiktoir", kedudukanPenggugat: "suami", kelalaian: ["rumah-tangga", "berbakti", "meninggalkan"] });
    expect(suami).toContain("q-rumah-tangga-istri");
    expect(suami).toContain("q-berbakti");
    expect(suami).toContain("q-meninggalkan-suami");
    expect(suami).not.toContain("q-nafkah-diberikan");
  });
  it("susunSaksi: dua saksi tidak pernah berbunyi sama pada butir yang sama dan semua jenis keterangan tersedia", () => {
    const keadaan = { kehadiran: "kontradiktoir", kedudukanPenggugat: "istri", kelalaian: ["nafkah"], tempatTinggal: "berpisah-rumah" };
    for (const jenis of ["melihat", "mendengar", "de-auditu", "sebagian", "tidak-tahu", "ragu"]) {
      const h = Mesin.susunSaksi(utama, {
        keadaan,
        benih: "1/Pdt.G/2026/PA.Dgl",
        saksi: [{ pihak: "P", jenis }, { pihak: "P", jenis }],
        variabel: (k: string) => ({ "0046": "Penggugat", "0047": "Tergugat" } as Record<string, string>)[k],
        slot: { sejak: "bulan Maret 2024", sumber: "tetangga", hal: "" },
      });
      expect(h.saksi.length, jenis).toBe(2);
      const baris1 = h.saksi[0].baris;
      const baris2 = h.saksi[1].baris;
      expect(baris1.length, jenis).toBeGreaterThan(8);
      expect(baris2.length, jenis).toBe(baris1.length);
      for (let i = 0; i < baris1.length; i += 1) {
        if (baris1[i].butir === "q-kenal" || baris1[i].butir === "q-penutup") continue;
        expect(baris1[i].jenis, `${jenis} ${baris1[i].butir}`).toBeTruthy();
        // butir yang sama: kalimat dua saksi tidak boleh sama persis
        expect(String(baris1[i].jawab) === String(baris2[i].jawab), `${jenis} ${baris1[i].butir}`).toBe(false);
      }
    }
  });
  it("tidak ada kata Aleta di katalog", () => {
    expect(readFileSync(path.join(KATALOG, "kelalaian-kewajiban.json"), "utf8")).not.toMatch(/aleta/i);
    expect(readFileSync(path.join(KATALOG, "kelalaian-kewajiban-tergugat.json"), "utf8")).not.toMatch(/aleta/i);
  });
});
