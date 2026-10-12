// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import {
  adaDariPetitum,
  butirKumulasi,
  gabungSebutan,
  keteranganKumulasi,
  namaJenisDenganKumulasi,
  type KumulasiPerkara,
} from "@/lib/kumulasi-perkara";
import { SAKLAR_TAMPILAN } from "@/lib/tampilan-antrian-sidang";

/**
 * ============================================================================
 * KUMULASI PERKARA - DARI SIPP, ATAU DARI PETITUM BILA SIPP KOSONG
 * ============================================================================
 *
 * Antrian sidang butir 1, 12 Oktober 2026: "Cerai Gugat Kumulasi Hak Asuh
 * Anak"; bila SIPP tidak diisi, petitumnya dianalisa.
 *
 * TEMPAT SIPP MENCATATNYA: perkara_kumulasi(perkara_id, jenis_perkara_id).
 * Terukur 12 Okt 2026: sipp_donggala 86 perkara dari 10.216 (Itsbat 51,
 * Penguasaan Anak 32, Lain-Lain 2, Pengesahan Anak 1 - seluruhnya cerai
 * talak/gugat); sipp (Bungku) 36 perkara dari 5.554.
 * perkara_perbaikan_gugatan.petitum: 0 baris di keduanya.
 *
 * KETEPATAN ANALISA PETITUM - diukur atas seluruh perkara cerai talak/gugat
 * (sipp_donggala 5.655, sipp Bungku 3.480) dengan kumulasiDariPetitum yang
 * SAMA dengan yang dipasang (skrip ukur menjalankan berkas layanan ini):
 *
 *   Daya tangkap, atas perkara yang kumulasinya TERISI di SIPP:
 *     Itsbat Nikah   51/51 (Donggala), 25/25 (Bungku)
 *     Hak Asuh Anak  30/32 (Donggala) - 2 sisanya petitumnya memang tidak
 *                    menuntut hak asuh sama sekali (salah isi SIPP);
 *                    9/9 (Bungku)
 *     Pengesahan Anak 1 & Lain-Lain 3: petitumnya ternyata hak asuh, nafkah
 *                    anak, dan mahar - ketiganya tertangkap sebagai jenis
 *                    sebenarnya.
 *
 *   Temuan pada perkara yang SIPP-nya KOSONG (petugas lupa):
 *     Donggala 170 perkara (Itsbat 98, Hak Asuh 61, Nafkah Anak 28,
 *              Nafkah Iddah 6, Mut'ah 5, Madliyah 5, Harta Bersama 1)
 *     Bungku   128 perkara (Itsbat 110, Hak Asuh 15, Nafkah Anak 6,
 *              Iddah 3, Mut'ah 2)
 *   Pembanding kedua: amar putusan dianalisa dengan pola yang sama. Temuan
 *   yang jenisnya ikut disebut amar dianggap benar (Donggala 117 dari 204
 *   temuan, Bungku 92 dari 136); SELURUH sisanya - amarnya diam karena
 *   dicabut, gugur, NO, atau belum putus - dibaca satu per satu. Salah
 *   tangkap yang ditemukan - dan dijaga uji di bawah - 9: posita "bahwa ...
 *   dalam pengasuhan" (1), "sah akta nikah" (2), "sah ... perkawinan putus
 *   karena perceraian" (1), nama "Idah" (1), nama "Pramadhika" (1),
 *   "nafkah lampau anak" sebagai madliyah (3). Sesudah diperbaiki: 0 salah
 *   tangkap yang jelas; 1 meragukan (petitum tulisan sendiri yang mencampur
 *   posita dan tuntutan, 719/Pdt.G/2025).
 */

const akar = path.resolve(process.cwd(), "..");
const muat = createRequire(import.meta.url);
type Layanan = {
  kumulasiDariPetitum: (html: string) => Array<{ kode: string; nama: string; kutipan: string }>;
  satukanKumulasi: (m: {
    jenisPerkaraId: number;
    sipp?: Array<{ jenisPerkaraId: number; nama: string }>;
    petitum?: string;
  }) => KumulasiPerkara | null;
  kumulasiBanyakPerkara: (
    id: Array<number | string>,
    opsi: { db: unknown; skema: unknown }
  ) => Promise<Record<string, KumulasiPerkara>>;
  diktumPetitum: (html: string) => string[];
};
const layanan = muat(path.join(akar, "aleta_bot/services/kumulasiPerkaraService.js")) as Layanan;

const kode = (html: string) => layanan.kumulasiDariPetitum(html).map((x) => x.kode);

/** Petitum berbentuk SIPP: paragraf HTML, Primer lalu Subsider. */
const petitum = (...butir: string[]) =>
  `<p>Primer</p>${butir.map((b, i) => `<p>${i + 1}. ${b};</p>`).join("")}<p>Subsider:</p><p>Jika Majelis Hakim berpendapat lain, mohon putusan yang seadil-adilnya (ex aequo et bono);</p>`;

describe("analisa petitum - hanya tuntutan yang sungguh diminta", () => {
  it("kepala SUBSIDER yang ditulis SEBELUM PRIMER tidak membuang seluruh petitum (253/Pdt.G/2024/PA.Buk)", () => {
    const html =
      "<p>SUBSIDER:</p><p>PRIMER:</p><p>1. Mengabulkan gugatan Penggugat;</p>" +
      "<p>2. Menetapkan anak bernama Ani berada dalam hadhanah (pemeliharaan) Penggugat;</p>" +
      "<p>SUBSIDER: Mohon putusan yang seadil-adilnya</p>";
    expect(kode(html)).toEqual(["hak-asuh-anak"]);
  });

  it("mengenali hak asuh, itsbat, nafkah anak, iddah, mut'ah, madliyah, harta bersama, mahar", () => {
    const html = petitum(
      "Mengabulkan Gugatan Penggugat",
      "Menetapkan sah pernikahan Penggugat dengan Tergugat yang dilangsungkan pada tanggal 03 Maret 2006 di wilayah hukum Kantor Urusan Agama Kecamatan Balaesang",
      "Menjatuhkan talak satu ba&#39;in sughra Tergugat (Ahmad bin Umar) terhadap Penggugat (Siti binti Ali)",
      "Menetapkan Penggugat sebagai pemegang hak asuh atas anak yang bernama A, usia 7 tahun",
      "Menghukum Tergugat untuk membayar biaya hadhanah (nafkah anak) kepada Penggugat setiap bulan Rp1.000.000",
      "Menghukum Tergugat membayar nafkah iddah Rp3.000.000 dan mut&#39;ah berupa cincin emas",
      "Menghukum Tergugat membayar nafkah madliyah selama 24 bulan",
      "Menetapkan sebagai harta bersama berupa sebidang tanah",
      "Menghukum Tergugat untuk membayar mahar berupa 1 ekor sapi",
      "Membebankan biaya perkara sesuai peraturan yang berlaku"
    );
    expect(kode(html)).toEqual([
      "itsbat-nikah",
      "hak-asuh-anak",
      "nafkah-anak",
      "nafkah-iddah",
      "mutah",
      "nafkah-madliyah",
      "harta-bersama",
      "mahar",
    ]);
  });

  it("petitum cerai biasa tanpa tuntutan lain: kosong", () => {
    const html = petitum(
      "Mengabulkan Gugatan Penggugat",
      "Menjatuhkan talak satu ba&#39;in shughra Tergugat (Taufik bin Syahrir) terhadap Penggugat (Rosfayanti binti Ahmad)",
      "Membebankan biaya perkara ini sesuai peraturan yang berlaku"
    );
    expect(kode(html)).toEqual([]);
  });

  it("biaya hadhanah adalah NAFKAH anak, bukan hak asuh", () => {
    const html = petitum("Menghukum Tergugat untuk membayar biaya hadhanah kepada Penggugat Rp1.500.000 setiap bulan");
    expect(kode(html)).toEqual(["nafkah-anak"]);
  });

  it("yang ditolak dan yang di bagian subsider tidak dihitung", () => {
    expect(kode(petitum("Menolak gugatan Penggugat tentang hak asuh anak"))).toEqual([]);
    const subsider =
      "<p>Primer</p><p>Mengabulkan gugatan Penggugat;</p><p>Subsider:</p><p>Menetapkan hak asuh anak kepada Penggugat;</p>";
    expect(kode(subsider)).toEqual([]);
  });

  it("posita yang tersalin ke petitum ('bahwa ...') bukan tuntutan (terukur 407/Pdt.G/2024)", () => {
    const html = petitum(
      "bahwa setelah menikah Penggugat dan Tergugat dikaruniai seorang anak, saat ini anak tersebut berada dalam pengasuhan Tergugat"
    );
    expect(kode(html)).toEqual([]);
  });

  it("'sah akta nikah' dan 'sah ... perkawinan putus' bukan itsbat (terukur 3)", () => {
    expect(kode(petitum("Menyatakan sah akta nikah nomor: 73/IV/1992"))).toEqual([]);
    expect(
      kode(petitum("Menyatakan sah menurut hukum perkawinan antara Penggugat dan Tergugat putus karena perceraian"))
    ).toEqual([]);
  });

  it("itsbat yang 'adalah sah'-nya jauh di belakang tetap terbaca (terukur 2 di Bungku)", () => {
    const html = petitum(
      "Menetapkan perkawinan antara Pemohon (Budi Bin Sutarmun) dengan Termohon (Endang Binti Tasdik) yang terjadi pada tanggal 18 Desember 2002 bertempat di Desa Puntari Makmur, Kecamatan Witaponda (dahulu Kecamatan Bungku Barat), Kabupaten Morowali, Provinsi Sulawesi Tengah adalah sah"
    );
    expect(kode(html)).toEqual(["itsbat-nikah"]);
  });

  it("nama pihak tidak terbaca sebagai kata kunci: 'Idah', 'Pramadhika' (terukur)", () => {
    expect(
      kode(petitum("Memberi izin kepada Pemohon (Iwan bin Laodje) untuk menjatuhkan talak satu raj'i kepada Termohon (Idah binti Lukaudju)"))
    ).toEqual([]);
    expect(
      kode(petitum("Menjatuhkan talak satu ba'in shughra Tergugat (Punggawa Pramadhika bin Abd Salam) terhadap Penggugat"))
    ).toEqual([]);
  });

  it("'nafkah lampau anak' adalah nafkah anak, bukan madliyah (terukur 3)", () => {
    expect(kode(petitum("Menghukum kepada Tergugat memberikan nafkah lampau anak sebesar Rp15.000.000"))).toEqual([
      "nafkah-anak",
    ]);
  });

  it("hak akses mengunjungi anak = hak asuh, walau kata 'hak asuh' terhapus (terukur 336/Pdt.G/2026)", () => {
    const html = petitum(
      "Menetapkan Faiha binti Yusup. dengan tetap memberikan hak akses kepada Tergugat untuk mengunjungi anak tersebut"
    );
    expect(kode(html)).toEqual(["hak-asuh-anak"]);
  });

  it("daftar anak berbutir disatukan dengan diktumnya (terukur 33/Pdt.G/2024/PA.Buk)", () => {
    const html =
      "<p>PRIMER:</p><p>Mengabulkan gugatan Penggugat;</p><p>Menetapkan anak dari perkawinan Penggugat dan Tergugat yang bernama : a. NURFADILAH (Perempuan) Lahir 13 Juni 2011; b. NUR FIKA (Perempuan) Lahir 29 Juli 2014; Tetap berada pada Penggugat</p><p>Membebankan biaya perkara ini menurut hukum;</p><p>SUBSIDER:</p>";
    expect(kode(html)).toEqual(["hak-asuh-anak"]);
    expect(layanan.diktumPetitum(html).some((d) => d.startsWith("menetapkan anak") && d.includes("tetap berada"))).toBe(
      true
    );
  });

  it("petitum satu paragraf tanpa titik koma tetap terpotong per diktum", () => {
    const html =
      "<p>PRIMER Mengabulkan gugatan Penggugat untuk seluruhnya. Menetapkan sah pernikahan Penggugat dengan Tergugat yang dilangsungkan pada tanggal 07 Juli 1997. Menjatuhkan talak satu ba'in shugraa Tergugat. SUBSIDER mohon putusan yang seadil-adilnya</p>";
    expect(kode(html)).toEqual(["itsbat-nikah"]);
  });
});

describe("menyatukan SIPP dan petitum", () => {
  const html = petitum("Menetapkan Penggugat sebagai pemegang hak asuh atas anak bernama B", "Menghukum Tergugat memberikan nafkah anak Rp500.000 per bulan");

  it("SIPP terisi: sebutan SIPP dipakai, jenis pokok dibuang, temuan petitum yang lain ikut bertanda", () => {
    const hasil = layanan.satukanKumulasi({
      jenisPerkaraId: 347,
      sipp: [
        { jenisPerkaraId: 347, nama: "Cerai Gugat" },
        { jenisPerkaraId: 349, nama: "Penguasaan Anak" },
      ],
      petitum: html,
    });
    expect(hasil?.sumber).toBe("campuran");
    expect(hasil?.daftar.map((x) => [x.nama, x.sumber])).toEqual([
      ["Hak Asuh Anak", "sipp"],
      ["Nafkah Anak", "petitum"],
    ]);
  });

  it("SIPP kosong: dari petitum saja", () => {
    const hasil = layanan.satukanKumulasi({ jenisPerkaraId: 346, sipp: [], petitum: html });
    expect(hasil?.sumber).toBe("petitum");
    expect(hasil?.daftar.every((x) => x.sumber === "petitum" && Boolean(x.kutipan))).toBe(true);
  });

  it("jenis selain cerai talak/gugat tidak dianalisa petitumnya", () => {
    // Pada gugatan harta bersama (348) "harta bersama" adalah pokoknya.
    expect(
      layanan.satukanKumulasi({ jenisPerkaraId: 348, petitum: petitum("Menetapkan sebagai harta bersama sebidang tanah") })
    ).toBeNull();
    // Tetapi catatan SIPP-nya tetap dipakai.
    expect(
      layanan.satukanKumulasi({ jenisPerkaraId: 364, sipp: [{ jenisPerkaraId: 366, nama: "Hibah" }] })?.daftar[0]
    ).toMatchObject({ nama: "Hibah", sumber: "sipp" });
  });

  it("tanpa kumulasi: null", () => {
    expect(layanan.satukanKumulasi({ jenisPerkaraId: 347, petitum: petitum("Mengabulkan gugatan Penggugat") })).toBeNull();
  });
});

describe("pembaca SIPP - satu kueri IN, tabel tak terdaftar tidak menjatuhkan", () => {
  const dbPalsu = (perkara: unknown[], kumulasi: unknown[]) => {
    const kueri: string[] = [];
    return {
      kueri,
      query(sql: string, _p: unknown[], cb: (e: unknown, r: unknown[]) => void) {
        kueri.push(sql);
        cb(null, /perkara_kumulasi/.test(sql) ? kumulasi : perkara);
      },
    };
  };

  it("SIPP + petitum per perkara; perkara tanpa kumulasi tidak berkunci", async () => {
    const db = dbPalsu(
      [
        { perkaraId: 1, jenisPerkaraId: 347, petitum: petitum("Menetapkan hak asuh anak kepada Penggugat") },
        { perkaraId: 2, jenisPerkaraId: 347, petitum: petitum("Mengabulkan gugatan") },
        { perkaraId: 3, jenisPerkaraId: 346, petitum: "" },
      ],
      [{ perkaraId: 3, jenisPerkaraId: 360, nama: "Pengesahan Perkawinan/Istbat Nikah" }]
    );
    const skema = { tabelAda: async () => true, kolomAda: async () => true };
    const peta = await layanan.kumulasiBanyakPerkara([1, 2, 3, 3], { db, skema });
    expect(Object.keys(peta).sort()).toEqual(["1", "3"]);
    expect(peta["1"].daftar[0]).toMatchObject({ nama: "Hak Asuh Anak", sumber: "petitum" });
    expect(peta["3"].daftar[0]).toMatchObject({ nama: "Itsbat Nikah", sumber: "sipp" });
    expect(db.kueri).toHaveLength(2);
    expect(db.kueri.every((q) => /^\s*SELECT/i.test(q))).toBe(true);
  });

  it("perkara_kumulasi tidak ada: tabelnya tidak dikueri, petitum tetap dibaca", async () => {
    const db = dbPalsu([{ perkaraId: 1, jenisPerkaraId: 347, petitum: petitum("Menetapkan hak asuh anak kepada Penggugat") }], []);
    const skema = { tabelAda: async () => false, kolomAda: async () => true };
    const peta = await layanan.kumulasiBanyakPerkara([1], { db, skema });
    expect(peta["1"].sumber).toBe("petitum");
    expect(db.kueri.some((q) => /perkara_kumulasi/.test(q))).toBe(false);
  });

  it("perkara_kumulasi terdaftar di sippSkemaService.TABEL", () => {
    const teks = readFileSync(path.join(akar, "aleta_bot/services/sippSkemaService.js"), "utf8");
    const awal = teks.indexOf("const TABEL = [");
    const blok = teks.slice(awal, teks.indexOf("];", awal));
    expect(blok).toContain('"perkara_kumulasi"');
  });
});

describe("sebutan di layar (lib/kumulasi-perkara)", () => {
  const k: KumulasiPerkara = {
    sumber: "campuran",
    daftar: [
      { kode: "itsbat-nikah", nama: "Itsbat Nikah", sumber: "sipp" },
      { kode: "hak-asuh-anak", nama: "Hak Asuh Anak", sumber: "petitum", kutipan: "menetapkan hak asuh anak ..." },
    ],
  };

  it("Cerai Gugat Kumulasi Hak Asuh Anak - contoh pengguna", () => {
    expect(
      namaJenisDenganKumulasi("Cerai Gugat", {
        sumber: "sipp",
        daftar: [{ kode: "hak-asuh-anak", nama: "Hak Asuh Anak", sumber: "sipp" }],
      })
    ).toBe("Cerai Gugat Kumulasi Hak Asuh Anak");
    expect(namaJenisDenganKumulasi("Cerai Gugat", k)).toBe("Cerai Gugat Kumulasi Itsbat Nikah dan Hak Asuh Anak");
    expect(namaJenisDenganKumulasi("Cerai Talak", null)).toBe("Cerai Talak");
    expect(namaJenisDenganKumulasi("", null)).toBe("—");
  });

  it("gabungan tiga atau lebih memakai koma dan 'dan'", () => {
    expect(gabungSebutan(["A", "B", "C"])).toBe("A, B, dan C");
    expect(gabungSebutan(["A"])).toBe("A");
    expect(gabungSebutan([])).toBe("");
  });

  it("hasil petitum selalu ditandai, dengan kutipannya", () => {
    expect(adaDariPetitum(k)).toBe(true);
    const ket = keteranganKumulasi(k);
    expect(ket).toContain("Itsbat Nikah - tercatat di SIPP");
    expect(ket).toContain("Hak Asuh Anak - dari petitum");
    expect(ket).toContain("menetapkan hak asuh anak");
  });

  it("bentuk rusak dari bot lama tidak menjatuhkan layar", () => {
    expect(butirKumulasi(undefined)).toEqual([]);
    expect(butirKumulasi({ sumber: "sipp", daftar: null } as unknown as KumulasiPerkara)).toEqual([]);
  });

  it("saklar kumulasi-perkara ada dan menyebut ketiga layar", () => {
    const saklar = SAKLAR_TAMPILAN.find((x) => x.kunci === "kumulasi-perkara");
    expect(saklar?.keterangan).toContain("Jadwal Mediasi");
    expect(saklar?.keterangan).toContain("Status Perkara");
  });
});

describe("tersambung ke layar dan ke bot", () => {
  const baca = (p: string) => readFileSync(path.join(akar, p), "utf8");

  it("Jadwal Sidang memakai saklarnya di baris dan rincian", () => {
    const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
    expect(layar.split('tampil(tampilan, "kumulasi-perkara")').length - 1).toBeGreaterThanOrEqual(2);
    expect(layar).toContain("<JenisDenganKumulasi");
    expect(layar).toContain("<RincianKumulasi");
  });

  it("Jadwal Mediasi dan Status Perkara mengikuti saklar yang sama", () => {
    for (const p of [
      "manajemen_surat/src/components/portal/aleta-ecourt-mediasi.tsx",
      "manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx",
    ]) {
      const t = baca(p);
      expect(t, p).toContain("useSaklarKumulasi()");
      expect(t, p).toContain("<JenisDenganKumulasi");
      expect(t, p).toContain("<RincianKumulasi");
    }
  });

  it("bot mengirim kumulasi di jadwal sidang, jadwal mediasi, rincian, dan status perkara", () => {
    const jadwal = baca("aleta_bot/services/sippJadwalSidangService.js");
    expect(jadwal).toContain("kumulasiPerkaraService.kumulasiBanyakPerkara(idPerkara)");
    expect(jadwal.split("kumulasiTerbaca:").length - 1).toBe(3);
    const status = baca("aleta_bot/services/sippStatusPerkaraService.js");
    expect(status).toContain("rincian.kumulasi");
  });
});
