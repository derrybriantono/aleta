// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const panggil = vi.fn();

vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: (operasi: string, params: Record<string, unknown>) => panggil(operasi, params),
}));

const { susunLembarTanyaJawab, petaPenanda } = await import("@/server/modules/aleta-ecourt/bas-tanya-jawab");
const { rakitBerkasPerkara } = await import("@/server/modules/aleta-ecourt/berkas-perkara");

/**
 * Alat bantu tulis BAS - pengisian tanya-jawab dari berkas perkara.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * BAS adalah dokumen resmi yang ditandatangani. Nama yang keliru di dalamnya
 * tidak dapat ditarik kembali. Karena itu yang diuji paling keras bukan
 * "berhasil mengisi", melainkan:
 *
 *   - penanda yang TIDAK dapat dipastikan dibiarkan utuh, tidak ditebak,
 *   - yang dibiarkan itu DISEBUTKAN, supaya panitera tahu apa yang harus diisi
 *     sendiri - penanda yang hilang diam-diam jauh lebih berbahaya daripada
 *     penanda yang masih terlihat,
 *   - nilai yang terisi membawa asal-usulnya, supaya dapat diperiksa tanpa
 *     membuka SIPP.
 */

const PIHAK = [
  { role: "Penggugat/Pemohon", name: "Reka Febrianti binti Rajab" },
  { role: "Tergugat/Termohon", name: "Andi Saputra bin Hamzah" },
];

const PERTANYAAN_A1A = [
  { urutan: 1, pertanyaan: "Apakah saudara kenal dengan #0046#?", jawabanBawaan: "Saya kenal dengan #0046# karena saya adalah ...;" },
  { urutan: 2, pertanyaan: "Apakah saudara kenal dengan #0047#?", jawabanBawaan: "Saya kenal dengan #0047# sebagai isteri/suami #0046#;" },
  { urutan: 3, pertanyaan: "Berapa jumlah anak #0046# dan #0047#? Sebutkan #0099#.", jawabanBawaan: "Sebanyak ... orang;" },
];

const VARIABEL = [
  { noVar: "0046", nama: "Pemohon/ Penggugat", jenis: "data_sql" },
  { noVar: "0047", nama: "Termohon/ Tergugat", jenis: "data_sql" },
  { noVar: "0099", nama: "Rincian anak", jenis: "manual" },
];

const MAJELIS = [
  { role: "Hakim", jabatan: "Hakim Ketua", urutan: 1, name: "Sudarmin H.I.M. Tang, S.H.I.,M.H" },
  { role: "Hakim", jabatan: "Hakim Anggota", urutan: 2, name: "Idris, S.H.I., M.H." },
];

const PANITERA = [{ role: "Panitera Pengganti", name: "Unun Fidiyasari Patangai, S.H." }];

const JURUSITA = [{ role: "Jurusita/Jurusita Pengganti", name: "Mohammad Syukri" }];

function jawab(
  opsi: {
    pihak?: unknown;
    pertanyaan?: unknown;
    adaKumpulan?: boolean;
    detail?: Record<string, unknown>;
  } = {}
) {
  panggil.mockImplementation(async (operasi: string) => {
    if (operasi === "case.detail")
      return {
        ok: true,
        data: opsi.detail ?? {
          nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
          jenisPerkara: "Cerai Gugat",
          tanggalDaftar: "2026-09-02T00:00:00.000Z",
          tanggalSurat: "2026-08-28T00:00:00.000Z",
        },
      };
    if (operasi === "case.judges") return { ok: true, data: MAJELIS };
    if (operasi === "case.panitera") return { ok: true, data: PANITERA };
    if (operasi === "case.jurusita") return { ok: true, data: JURUSITA };
    if (operasi === "case.parties") return { ok: true, data: opsi.pihak ?? PIHAK };
    if (operasi === "abt.tanyaJawab") {
      if (opsi.adaKumpulan === false) return { ok: true, data: { ada: false, sebab: "kode tidak dikenal" } };
      return { ok: true, data: { ada: true, pertanyaan: opsi.pertanyaan ?? PERTANYAAN_A1A, variabel: VARIABEL } };
    }
    return { ok: true, data: null };
  });
}

beforeEach(() => panggil.mockReset());

describe("mengisi yang sudah ada di sistem", () => {
  it("nama para pihak diisi dari SIPP, tidak ditanyakan lagi", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });

    expect(lembar.ok).toBe(true);
    expect(lembar.baris[0].pertanyaan).toBe("Apakah saudara kenal dengan Reka Febrianti binti Rajab?");
    expect(lembar.baris[1].pertanyaan).toBe("Apakah saudara kenal dengan Andi Saputra bin Hamzah?");
  });

  it("jawaban bawaan ikut terisi, bukan hanya pertanyaannya", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    expect(lembar.baris[1].jawabanBawaan).toContain("sebagai isteri/suami Reka Febrianti binti Rajab");
  });

  it("nilai yang terisi membawa asal-usulnya", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    const penggugat = lembar.terisi.find((x) => x.noVar === "0046");
    expect(penggugat?.nama).toBe("Pemohon/ Penggugat");
    // Asal harus menyebut sistem DAN tabelnya, supaya dapat ditelusuri kembali
    // tanpa menebak - "dari SIPP" saja tidak cukup untuk memeriksa satu nilai.
    expect(penggugat?.asal).toBe("SIPP - perkara_pihak");
  });

  it("peran dicocokkan longgar - SIPP menulis \"Penggugat/Pemohon\" dalam satu kolom", async () => {
    jawab({ pihak: [{ role: "PEMOHON", name: "Siti Aminah" }] });
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    expect(lembar.baris[0].pertanyaan).toContain("Siti Aminah");
  });
});

describe("yang tidak pasti tidak ditebak", () => {
  it("penanda tanpa padanan DIBIARKAN utuh, tidak dihilangkan", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    // #0099# tidak punya padanan di berkas - ia harus masih terlihat, bukan
    // lenyap menjadi ruang kosong yang tidak disadari panitera.
    expect(lembar.baris[2].pertanyaan).toContain("#0099#");
  });

  it("penanda yang dibiarkan disebutkan beserta namanya", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    const sisa = lembar.kosong.find((x) => x.noVar === "0099");
    expect(sisa).toBeDefined();
    expect(sisa?.nama).toBe("Rincian anak");
  });

  it("para pihak tidak terbaca: tidak ada yang diisi, dan sebabnya disebut", async () => {
    jawab({ pihak: [] });
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });

    expect(lembar.baris[0].pertanyaan).toContain("#0046#");
    expect(lembar.kosong.find((x) => x.noVar === "0046")?.sebab).toMatch(/tidak terbaca dari SIPP/i);
  });
});

describe("menolak dengan jelas", () => {
  it("perkara kosong ditolak sebelum menghubungi apa pun", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "", kode: "A1a" });
    expect(lembar.ok).toBe(false);
    expect(panggil).not.toHaveBeenCalled();
    expect(lembar.halangan.join(" ")).toMatch(/tidak dikenali/i);
  });

  it("kumpulan pertanyaan tidak dikenal: sebabnya diteruskan apa adanya", async () => {
    jawab({ adaKumpulan: false });
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "XYZ" });
    expect(lembar.ok).toBe(false);
    expect(lembar.halangan.join(" ")).toContain("kode tidak dikenal");
  });
});

/**
 * Peta penanda dipakai bersama oleh lembar tanya-jawab dan naskah blangko.
 *
 * Diuji langsung, bukan hanya lewat lembar tanya-jawab, karena rute naskah
 * memakainya tanpa melewati lembar sama sekali. Kalau petanya hanya teruji
 * pada satu jalur, jalur yang lain bebas berubah diam-diam - dan wujud
 * perubahannya adalah BAS dan putusan yang menyebut nama berbeda untuk perkara
 * yang sama.
 */
describe("peta penanda dipakai bersama", () => {
  it("nomor perkara dan kedua pihak terpetakan beserta asalnya", async () => {
    jawab();
    const berkas = await rakitBerkasPerkara("10096");
    const peta = petaPenanda(berkas);

    expect(peta.get("0001")?.nilai).toBe("545/Pdt.G/2026/PA.Dgl");
    expect(peta.get("0046")?.nilai).toBe("Reka Febrianti binti Rajab");
    expect(peta.get("0047")?.nilai).toBe("Andi Saputra bin Hamzah");
    expect(peta.get("0046")?.asal).toMatch(/SIPP/);
  });

  it("nilainya sama persis dengan yang dipakai lembar tanya-jawab", async () => {
    jawab();
    const [berkas, lembar] = await Promise.all([
      rakitBerkasPerkara("10096"),
      susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" }),
    ]);
    const peta = petaPenanda(berkas);

    for (const item of lembar.terisi) {
      expect(peta.get(item.noVar)?.nilai).toBe(item.nilai);
    }
  });

  it("pihak yang tidak terbaca tidak masuk peta, bukan masuk sebagai kosong", async () => {
    jawab({ pihak: [] });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    // Penanda yang tidak ada di peta dibiarkan utuh saat pengisian. Kalau ia
    // masuk peta dengan nilai kosong, penandanya lenyap menjadi ruang kosong
    // pada naskah resmi - dan tidak ada yang menyadarinya.
    expect(peta.has("0046")).toBe(false);
    expect(peta.has("0047")).toBe(false);
  });
});

/**
 * Penanda yang berasal dari SIPP menurut ABT sendiri.
 *
 * Nomor variabelnya tidak ditebak - tabel abt_variabel yang menyatakan bahwa
 * 0098 adalah perkara_pihak1.nama, 1061 adalah tanggal pendaftaran, dan
 * seterusnya. Uji ini menjaga pemetaan itu tetap seperti yang dinyatakan ABT,
 * karena penanda yang tergeser satu nomor menaruh nama di tempat tanggal pada
 * dokumen yang ditandatangani.
 */
describe("penanda yang berasal dari SIPP", () => {
  it("tanggal ditulis dalam bentuk yang dipakai naskah pengadilan", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0017")?.nilai).toBe("28 Agustus 2026");
    expect(peta.get("0306")?.nilai).toBe("2 September 2026");
    expect(peta.get("1061")?.nilai).toBe("2 September 2026");
  });

  it("tanggal dibaca sebagai UTC, tidak bergeser sehari", async () => {
    // SIPP mengirim tengah malam UTC. Ditafsirkan sebagai waktu setempat, ini
    // menjadi 1 September di mesin sebelah barat - tanggal sidang yang salah.
    jawab({ detail: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl", tanggalDaftar: "2026-09-02T00:00:00.000Z" } });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0306")?.nilai).toBe("2 September 2026");
  });

  it("nama pihak mengisi kedua penanda yang menunjuk orang yang sama", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0046")?.nilai).toBe("Reka Febrianti binti Rajab");
    expect(peta.get("0098")?.nilai).toBe("Reka Febrianti binti Rajab");
    expect(peta.get("0047")?.nilai).toBe("Andi Saputra bin Hamzah");
    expect(peta.get("0102")?.nilai).toBe("Andi Saputra bin Hamzah");
  });

  it("majelis, panitera, dan jurusita terisi dari SIPP", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0690")?.nilai).toBe("Sudarmin H.I.M. Tang, S.H.I.,M.H, Idris, S.H.I., M.H.");
    expect(peta.get("6033")?.nilai).toBe("Unun Fidiyasari Patangai, S.H.");
    expect(peta.get("6032")?.nilai).toBe("Mohammad Syukri");
  });
});

describe("sebutan yang mengikuti jenis perkara", () => {
  it("cerai gugat: surat gugatan, hasilnya putusan", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0053")?.nilai).toBe("gugatan");
    expect(peta.get("0194")?.nilai).toBe("putusan");
  });

  it("cerai talak tetap permohonan meski terdaftar sebagai Pdt.G", async () => {
    // Inilah sebabnya kode register saja tidak cukup: Cerai Talak berkode
    // Pdt.G tetapi diajukan sebagai permohonan, dan naskahnya harus menyebut
    // "permohonan" - bukan "gugatan".
    jawab({ detail: { nomorPerkara: "88/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak" } });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0053")?.nilai).toBe("permohonan");
    expect(peta.get("0194")?.nilai).toBe("putusan");
  });

  it("perkara voluntair menghasilkan penetapan, bukan putusan", async () => {
    jawab({ detail: { nomorPerkara: "208/Pdt.P/2026/PA.Dgl", jenisPerkara: "Itsbat Nikah" } });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0194")?.nilai).toBe("penetapan");
    expect(peta.get("5368")?.nilai).toBe("penetapan");
    expect(peta.get("0053")?.nilai).toBe("permohonan");
  });
});

describe("yang sengaja tidak diisi", () => {
  it("variabel yang di ABT dihitung dengan aturan sendiri dibiarkan", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    // Amar, penanda otomatis, dan isian per sidang punya aturannya sendiri di
    // ABT. Menyalin bentuknya berdasarkan tebakan berarti menaruh kalimat yang
    // TAMPAK benar ke dalam dokumen yang ditandatangani - dan kalimat yang
    // tampak benar jauh lebih sulit ketahuan keliru daripada penanda yang
    // masih terlihat.
    for (const noVar of ["4001", "8505", "5058", "0032", "0033", "7095", "0067"]) {
      expect(peta.has(noVar), `penanda ${noVar} seharusnya dibiarkan`).toBe(false);
    }
  });

  it("bagian yang kosong tidak masuk peta sebagai teks kosong", async () => {
    jawab({ detail: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl" } });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.has("0017")).toBe(false);
    expect(peta.has("0306")).toBe(false);
    expect(peta.has("0048")).toBe(false);
  });
});


/**
 * Penanda yang ditambahkan bersama pencatatan sidang.
 *
 * Ketua majelis DIBACA dari jabatannya di SIPP. Blangko menyebutnya sebagai
 * yang memimpin persidangan, jadi nama yang keliru di situ mengubah siapa yang
 * memimpin menurut naskah resmi.
 */
describe("ketua majelis dan pengaturan satker", () => {
  it("ketua majelis diambil menurut jabatannya, bukan urutan pertama", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("4004")?.nilai).toBe("Sudarmin H.I.M. Tang, S.H.I.,M.H");
    expect(peta.get("4004")?.asal).toContain("Hakim Ketua");
  });

  it("majelis tanpa jabatan ketua TIDAK menebak hakim pertama", async () => {
    // Menebaknya berarti menetapkan siapa yang memimpin persidangan menurut
    // naskah resmi - atas dasar urutan baris yang tidak menjanjikan apa pun.
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail") return { ok: true, data: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl" } };
      if (operasi === "case.judges")
        return { ok: true, data: [{ role: "Hakim", jabatan: "", name: "Hakim Tanpa Jabatan" }] };
      return { ok: true, data: [] };
    });

    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.has("4004")).toBe(false);
    expect(peta.get("0690")?.nilai).toBe("Hakim Tanpa Jabatan");
  });

  it("nama panitera mengisi ketiga penanda yang menunjuknya", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    for (const noVar of ["0015", "6033", "6034"]) {
      expect(peta.get(noVar)?.nilai).toBe("Unun Fidiyasari Patangai, S.H.");
    }
  });

  it("zona waktu dan nama satker berasal dari pengaturan", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0150")?.nilai).toBe("WITA");
    expect(peta.get("8008")?.nilai).toBe("Pengadilan Agama Donggala");
  });
});
