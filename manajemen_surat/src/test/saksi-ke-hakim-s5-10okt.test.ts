// @vitest-environment node
/**
 * ============================================================================
 * 10 OKT 2026 - S5=H1: FAKTA SAKSI + POSITA KE KARTU HAKIM 0222/0246/9944/5227
 * ============================================================================
 *
 * Kalimat di bawah adalah kalimat NYATA keterangan saksi dan posita PA
 * Donggala (salinan server 9 Okt) yang disamarkan - nama, tempat, dan nomor
 * dibuang, bentuk kalimatnya dipertahankan. Yang dijaga:
 *   1. pola fakta waktu: "bulan Desember tahun 2013", "sudah 8 bulan pisah",
 *      "sudah ± 2 tahun ... pergi", umur anak BUKAN lama pisah
 *   2. kartu yang dahulu "tidak ditemukan" diisi dari posita - ragu, asal posita
 *   3. tahun saja dari saksi + bulan dari posita pada tahun yang sama
 *   4. tingkat yakin: hanya golongan terukur >= 95% yang "pasti"; 9944 dan
 *      5227 TIDAK PERNAH pasti; posita/berbeda selalu ragu
 *   5. pelaku sebab tidak tertukar - DUA ARAH, cerai gugat dan cerai talak:
 *      perbuatan pihak yang mengajukan (0046) dan tuduhan terhadapnya tidak
 *      masuk kalimat "{pelaku} ..." (pelaku = 0047 = Tergugat/Termohon)
 */
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Sumber = { saksi: number; asal?: string; kalimat: string };
type Usulan = {
  kode: string;
  nilai: string;
  keyakinan: string;
  catatan: string;
  sumber: Sumber[];
  kesepakatan?: string;
  tingkat?: string;
  dasarTingkat?: string;
  nilaiSaksi?: string;
};
type HasilSaksi = {
  ciri: string[];
  usulan: Usulan[];
  ciriPelakuLawan?: { ciri: string; asal: string; kalimat: string; sebab: string }[];
};
type Pihak = { pelaku?: string; lawan?: string };
type Layanan = {
  dariKeteranganSaksi: (a: string, b: string, tanggalSidang?: string, pihak?: Pihak, posita?: string) => HasilSaksi;
  ambilBulanTahun: (k: string) => { nilai: string };
};

const require_ = createRequire(import.meta.url);
const layanan = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as Layanan;

const GUGAT: Pihak = { pelaku: "Tergugat", lawan: "Penggugat" };
const TALAK: Pihak = { pelaku: "Termohon", lawan: "Pemohon" };
const bas = (...butir: string[]) => butir.map((b) => `- Bahwa ${b};`).join("\n");
const dua = (teks: string, pihak: Pihak = GUGAT, posita = "", sidang = "") => layanan.dariKeteranganSaksi(teks, teks, sidang, pihak, posita);
const ambil = (h: HasilSaksi, kode: string) => {
  const u = h.usulan.find((x) => x.kode === kode);
  if (!u) throw new Error(`usulan ${kode} tidak ada`);
  return u;
};

describe("1. pola fakta waktu dari kalimat saksi nyata (disamarkan)", () => {
  it("'sejak bulan Desember tahun 2013' -> bulan Desember 2013 (dahulu jatuh ke 'tahun 2013')", () => {
    const u = ambil(dua(bas("antara Penggugat dan Tergugat sering terjadi perselisihan dan pertengkaran sejak bulan Desember tahun 2013")), "0222");
    expect(u.nilai).toBe("bulan Desember 2013");
  });

  it("ejaan petugas Pebruari/Nopember dibakukan", () => {
    expect(layanan.ambilBulanTahun("sejak Pebruari 2021").nilai).toBe("bulan Februari 2021");
    expect(layanan.ambilBulanTahun("pada bulan Nopember tahun 2019").nilai).toBe("bulan November 2019");
  });

  it.each([
    ["Penggugat dan Tergugat sudah 8 bulan pisah rumah", "8 bulan"],
    ["sudah ± 2 tahun Tergugat pergi meninggalkan Penggugat", "2 tahun"],
    ["Penggugat dan Tergugat berpisah tempat tinggal sudah kurang lebih 2 tahun 3 bulan", "2 tahun 3 bulan"],
  ])("lama pisah: %s", (kalimat, harapan) => {
    expect(ambil(dua(bas(kalimat)), "9944").nilai).toBe(harapan);
  });

  it("umur anak di depan kata pisah TIDAK terbaca sebagai lama pisah", () => {
    expect(ambil(dua(bas("anak umur 3 tahun ikut Penggugat sejak pisah rumah")), "9944").nilai).toBe("");
  });
});

describe("2-3. posita mengisi kartu yang dahulu 'tidak ditemukan'", () => {
  const POSITA =
    "Bahwa sejak bulan Mei 2023 Tergugat pergi meninggalkan Penggugat dan sejak saat itu pisah rumah kurang lebih 2 tahun;\n" +
    "Bahwa Tergugat sering bermain judi online;";

  it("tanpa keterangan saksi: 0246, 9944, 5227 dari posita - keyakinan ragu, tingkat ragu, kesepakatan posita, kutipan posita", () => {
    const h = layanan.dariKeteranganSaksi("", "", "", GUGAT, POSITA);
    const harap: Record<string, string> = { "0246": "bulan Mei 2023", "9944": "2 tahun", "5227": "Tergugat menjadi penjudi" };
    for (const [kode, nilai] of Object.entries(harap)) {
      const u = ambil(h, kode);
      expect(u.nilai, kode).toBe(nilai);
      expect(u.keyakinan, kode).toBe("ragu");
      expect(u.tingkat, kode).toBe("ragu");
      expect(u.kesepakatan, kode).toBe("posita");
      expect(u.sumber.every((s) => s.asal === "posita"), kode).toBe(true);
      expect(u.catatan, kode).toMatch(/posita - dalil yang belum dikuatkan saksi/);
    }
  });

  it("saksi hanya menyebut TAHUN, posita menyebut bulan pada tahun yang sama: bulannya dari posita, nilai saksi disebut, tingkat ragu", () => {
    const u = ambil(dua(bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak tahun 2023"), GUGAT, POSITA), "0246");
    expect(u.nilai).toBe("bulan Mei 2023");
    expect(u.nilaiSaksi).toBe("tahun 2023");
    expect(u.kesepakatan).toBe("sama");
    expect(u.tingkat).toBe("ragu");
    expect(u.sumber.map((s) => s.asal || s.saksi)).toEqual([1, 2, "posita"]);
  });

  it("tahun posita BERBEDA: bulan tidak dipinjam", () => {
    const u = ambil(dua(bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak tahun 2021"), GUGAT, POSITA), "0246");
    expect(u.nilai).toBe("tahun 2021");
    expect(u.tingkat).toBe("ragu");
  });
});

describe("4. tingkat yakin terukur - 'pasti' hanya untuk golongan >= 95%", () => {
  const POSITA = "Bahwa sejak bulan Mei 2023 Tergugat pergi meninggalkan Penggugat dan pisah rumah;";

  it("0246 kedua saksi sama + bulan + posita sama -> pasti", () => {
    const u = ambil(dua(bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2023"), GUGAT, POSITA), "0246");
    expect(u.keyakinan).toBe("pasti");
    expect(u.kesepakatan).toBe("sama");
    expect(u.tingkat).toBe("pasti");
    expect(u.dasarTingkat).toBe("sama, bulan, posita-sama");
  });

  it("0246 kedua saksi sama tetapi posita diam -> cukup, bukan pasti", () => {
    const u = ambil(dua(bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2023")), "0246");
    expect(u.tingkat).toBe("cukup");
  });

  it("saksi berbeda -> ragu (keyakinan bentrok tetap)", () => {
    const h = layanan.dariKeteranganSaksi(
      bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2023"),
      bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Juni 2023"),
      "",
      GUGAT,
      POSITA
    );
    const u = ambil(h, "0246");
    expect(u.keyakinan).toBe("bentrok");
    expect(u.kesepakatan).toBe("berbeda");
    expect(u.tingkat).toBe("ragu");
  });

  it("9944 dan 5227 tidak pernah pasti walau kedua saksi sama", () => {
    const h = dua(
      bas(
        "Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2023, sampai sekarang sudah 2 tahun",
        "penyebabnya karena Tergugat sering bermain judi"
      ),
      GUGAT,
      "Bahwa sejak bulan Mei 2023 pisah rumah kurang lebih 2 tahun; Tergugat sering bermain judi;"
    );
    expect(ambil(h, "9944").keyakinan).toBe("pasti");
    expect(ambil(h, "9944").tingkat).not.toBe("pasti");
    expect(ambil(h, "5227").keyakinan).toBe("pasti");
    expect(ambil(h, "5227").tingkat).toBe("cukup");
  });

  it("9944 dihitung dari pisah rumah ke tanggal sidang -> ragu", () => {
    const u = ambil(dua(bas("Penggugat dan Tergugat sudah pisah tempat tinggal sejak bulan Mei 2023"), GUGAT, "", "22 September 2026"), "9944");
    expect(u.kesepakatan).toBe("dihitung");
    expect(u.tingkat).toBe("ragu");
  });

  it("kartu kosong tidak bertingkat", () => {
    for (const u of layanan.dariKeteranganSaksi("", "").usulan) {
      if (["0222", "0246", "9944", "5227"].includes(u.kode)) expect(u.tingkat).toBe("");
    }
  });
});

describe("5. pelaku sebab tidak tertukar - dua arah", () => {
  it("cerai gugat: 'Penggugat berselingkuh' TIDAK menjadi 'Tergugat menjalin hubungan ...'; nafkah oleh Tergugat tetap masuk", () => {
    const s = bas("penyebabnya karena Penggugat berselingkuh dengan laki-laki lain", "Tergugat tidak memberi nafkah");
    const h = dua(s, GUGAT, "Bahwa Penggugat berselingkuh; Tergugat tidak memberi nafkah;");
    const u = ambil(h, "5227");
    expect(u.nilai).toBe("Tergugat melalaikan kewajiban nafkah lahir");
    expect(u.nilai).not.toMatch(/hubungan|pihak lain/);
    expect(h.ciriPelakuLawan?.map((x) => [x.ciri, x.sebab])).toEqual([["pihak lain (wanita/pria idaman lain)", "lawan"]]);
    expect(u.catatan).toContain("dilakukan Penggugat");
  });

  it("cerai gugat, arah sebaliknya: 'Tergugat berselingkuh' TETAP masuk", () => {
    const s = bas("penyebabnya karena Tergugat berselingkuh dengan wanita lain");
    const h = dua(s, GUGAT, "Bahwa Tergugat berselingkuh dengan wanita lain;");
    expect(ambil(h, "5227").nilai).toBe("Tergugat menjalin hubungan dengan pihak lain");
    expect(h.ciriPelakuLawan).toBeUndefined();
  });

  it("cerai talak: 'Pemohon bermain judi' tidak menjadi 'Termohon menjadi penjudi'; 'Termohon mabuk' tetap", () => {
    const s = bas("penyebabnya karena Pemohon sering bermain judi", "Termohon sering mabuk");
    const h = dua(s, TALAK, "Bahwa Pemohon bermain judi; Termohon sering mabuk-mabukan;");
    expect(ambil(h, "5227").nilai).toBe("Termohon menjadi pemabuk");
    expect(ambil(h, "5227").catatan).toContain("dilakukan Pemohon");
  });

  it("cerai talak, arah sebaliknya: 'Termohon bermain judi' tetap 'Termohon menjadi penjudi'", () => {
    const h = dua(bas("penyebabnya karena Termohon sering bermain judi"), TALAK, "Bahwa Termohon bermain judi;");
    expect(ambil(h, "5227").nilai).toBe("Termohon menjadi penjudi");
  });

  it("tuduhan: 'Tergugat menuduh Penggugat berselingkuh' bukan perselingkuhan siapa pun", () => {
    const h = dua(bas("Tergugat cemburu dan menuduh Penggugat berselingkuh"), GUGAT, "Bahwa Tergugat menuduh Penggugat berselingkuh;");
    expect(ambil(h, "5227").nilai).not.toMatch(/hubungan|pihak lain/);
    expect(h.ciriPelakuLawan?.[0].sebab).toBe("tuduhan");
  });

  it("perbuatan Tergugat SEBELUM tuduhan tetap masuk; objek ('memukul Penggugat, mencekik') bukan subjek", () => {
    const s = bas("Tergugat memiliki hubungan dengan wanita lain namun justru Tergugat menuduh Penggugat berselingkuh bahkan pernah memukul Penggugat");
    const h = dua(s, GUGAT, "Bahwa Tergugat memiliki wanita lain dan memukul Penggugat;");
    expect(h.ciri.sort()).toEqual(["kekerasan dalam rumah tangga", "pihak lain (wanita/pria idaman lain)"]);
    const s2 = bas("Tergugat suka mabuk-mabukan dan memukul Penggugat, mencekik dan menendang");
    expect(dua(s2, GUGAT, "Bahwa Tergugat mabuk dan memukul Penggugat;").ciri.sort()).toEqual(["kekerasan dalam rumah tangga", "mabuk"]);
  });

  it("milik bukan subjek: 'menghabiskan uang Penggugat untuk bermain judi' tetap judi Tergugat", () => {
    const h = dua(bas("Tergugat sering menghabiskan uang Penggugat untuk bermain judi online"), GUGAT, "Bahwa Tergugat bermain judi online;");
    expect(ambil(h, "5227").nilai).toBe("Tergugat menjadi penjudi");
  });
});
