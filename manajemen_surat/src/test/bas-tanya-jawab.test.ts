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

// Pertanyaan sungguhan memakai SEBUTAN, bukan nama - persis seperti BAS
// sungguhan PA Donggala yang berbunyi "Apakah saksi kenal dengan Pemohon I dan
// Pemohon II?". Pertanyaan keempat memakai #0098# supaya jalur NAMA tetap
// teruji di sebelahnya.
const PERTANYAAN_A1A = [
  { urutan: 1, pertanyaan: "Apakah saudara kenal dengan #0046#?", jawabanBawaan: "Saya kenal dengan #0046# karena saya adalah ...;" },
  { urutan: 2, pertanyaan: "Apakah saudara kenal dengan #0047#?", jawabanBawaan: "Saya kenal dengan #0047# sebagai isteri/suami #0046#;" },
  { urutan: 3, pertanyaan: "Berapa jumlah anak #0046# dan #0047#? Sebutkan #0099#.", jawabanBawaan: "Sebanyak ... orang;" },
  { urutan: 4, pertanyaan: "Sebutkan nama lengkap #0046#: #0098#.", jawabanBawaan: "Namanya #0098#;" },
];

const VARIABEL = [
  { noVar: "0046", nama: "Pemohon/ Penggugat", jenis: "data_sql" },
  { noVar: "0047", nama: "Termohon/ Tergugat", jenis: "data_sql" },
  { noVar: "0098", nama: "Nama #0046#", jenis: "data_sipp" },
  { noVar: "0099", nama: "Rincian anak", jenis: "manual" },
];

const MAJELIS = [
  { role: "Hakim", jabatan: "Hakim Ketua", urutan: 1, name: "Sudarmin H.I.M. Tang, S.H.I.,M.H" },
  { role: "Hakim", jabatan: "Hakim Anggota", urutan: 2, name: "Idris, S.H.I., M.H." },
];

// role adalah sebutan SERAGAM yang dipasang jembatan bot; jabatan adalah yang
// SESUNGGUHNYA tercatat SIPP. Keduanya sengaja dibedakan di sini karena #6034#
// dan #6032# meminta jabatannya, bukan labelnya - dan label "Jurusita/Jurusita
// Pengganti" kalau tercetak apa adanya akan memuat garis miringnya.
const PANITERA = [
  { role: "Panitera Pengganti", jabatan: "Panitera Pengganti", name: "Unun Fidiyasari Patangai, S.H." },
];

const JURUSITA = [
  { role: "Jurusita/Jurusita Pengganti", jabatan: "Jurusita Pengganti", name: "Mohammad Syukri" },
];

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
  it("pertanyaan memakai sebutan pihak, sebagaimana BAS sungguhan", async () => {
    // BAS PA Donggala berbunyi "Apakah saksi kenal dengan Pemohon I dan
    // Pemohon II?" - sebutan, bukan nama. Sebelum ini #0046# diisi nama,
    // sehingga pertanyaannya menyebut nama lengkap di tempat yang seharusnya
    // berbunyi "Penggugat".
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });

    expect(lembar.ok).toBe(true);
    expect(lembar.baris[0].pertanyaan).toBe("Apakah saudara kenal dengan Penggugat?");
    expect(lembar.baris[1].pertanyaan).toBe("Apakah saudara kenal dengan Tergugat?");
  });

  it("namanya tetap terisi lewat penanda namanya sendiri", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    expect(lembar.baris[3].pertanyaan).toBe("Sebutkan nama lengkap Penggugat: Reka Febrianti binti Rajab.");
  });

  it("jawaban bawaan ikut terisi, bukan hanya pertanyaannya", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    expect(lembar.baris[1].jawabanBawaan).toContain("sebagai isteri/suami Penggugat");
    expect(lembar.baris[3].jawabanBawaan).toContain("Namanya Reka Febrianti binti Rajab");
  });

  it("nilai yang terisi membawa asal-usulnya", async () => {
    jawab();
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });

    // Asal harus menyebut sistem DAN tabelnya, supaya dapat ditelusuri kembali
    // tanpa menebak - "dari SIPP" saja tidak cukup untuk memeriksa satu nilai.
    const nama = lembar.terisi.find((x) => x.noVar === "0098");
    expect(nama?.nama).toBe("Nama #0046#");
    expect(nama?.asal).toBe("SIPP - perkara_pihak1.nama");

    // Sebutan tidak berasal dari tabel pihak - ia dihitung dari jenis
    // perkaranya, dan asalnya harus mengatakan begitu.
    const sebutan = lembar.terisi.find((x) => x.noVar === "0046");
    expect(sebutan?.nama).toBe("Pemohon/ Penggugat");
    expect(sebutan?.asal).toContain("sebutan menurut jenis perkara");
  });

  it("peran dicocokkan longgar - SIPP menulis \"Penggugat/Pemohon\" dalam satu kolom", async () => {
    jawab({ pihak: [{ role: "PEMOHON", name: "Siti Aminah" }] });
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });
    expect(lembar.baris[3].pertanyaan).toContain("Siti Aminah");
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

  it("para pihak tidak terbaca: namanya dibiarkan utuh, dan sebabnya disebut", async () => {
    jawab({ pihak: [] });
    const lembar = await susunLembarTanyaJawab({ perkaraId: "10096", kode: "A1a" });

    expect(lembar.baris[3].pertanyaan).toContain("#0098#");
    expect(lembar.kosong.find((x) => x.noVar === "0098")?.sebab).toMatch(/tidak terbaca dari SIPP/i);

    // Sebutannya TETAP terisi: "Penggugat" tidak bergantung pada siapa
    // pihaknya, melainkan pada jenis perkaranya - sama seperti di ABT, yang
    // membacanya dari tabel perkara, bukan tabel pihak.
    expect(lembar.baris[0].pertanyaan).toBe("Apakah saudara kenal dengan Penggugat?");
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
    // #0046# dan #0047# adalah SEBUTAN; namanya dibawa #0098# dan #0102#.
    expect(peta.get("0046")?.nilai).toBe("Penggugat");
    expect(peta.get("0047")?.nilai).toBe("Tergugat");
    expect(peta.get("0098")?.nilai).toBe("Reka Febrianti binti Rajab");
    expect(peta.get("0102")?.nilai).toBe("Andi Saputra bin Hamzah");
    expect(peta.get("0098")?.asal).toMatch(/SIPP/);
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
    expect(peta.has("0098")).toBe(false);
    expect(peta.has("0102")).toBe(false);

    // Sebutannya tetap terisi - ia tidak bergantung pada pihaknya.
    expect(peta.get("0046")?.nilai).toBe("Penggugat");
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

  /**
   * ==========================================================================
   * SEBUTAN DAN NAMA TIDAK BOLEH TERTUKAR
   * ==========================================================================
   *
   * Ini cacat termahal yang pernah ditemukan pada pemetaan ini, dan uji di
   * bawah ada supaya ia tidak dapat kembali.
   *
   * #0046# muncul 12.935 kali di pustaka blangko - tersering dari seluruh 749
   * kode - dan #0047# 5.137 kali. Keduanya SEBUTAN. Sebelumnya keduanya diisi
   * nama pihak, sehingga kalimat "Ketua Majelis memeriksa identitas #0046#"
   * tercetak dengan nama lengkap di tempat yang seharusnya berbunyi
   * "Penggugat".
   *
   * Buktinya ada pada dokumen rujukan PA Donggala sendiri: blangko berbunyi
   * "#0098#, NIK #0335#, ... sebagai #0046#;" dan hasil jadinya berbunyi
   * "Muhammad Ilham bin Aco Daude, NIK 7203040912000003, ... sebagai
   * Pemohon I;". Nama variabel #0098# di ABT pun berbunyi "Nama #0046#", yang
   * mustahil kalau #0046# juga nama.
   */
  it("sebutan pihak bukan nama pihak - keduanya penanda yang berbeda", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0046")?.nilai).toBe("Penggugat");
    expect(peta.get("0047")?.nilai).toBe("Tergugat");
    expect(peta.get("0098")?.nilai).toBe("Reka Febrianti binti Rajab");
    expect(peta.get("0102")?.nilai).toBe("Andi Saputra bin Hamzah");

    // Yang dijaga bukan sekadar nilainya benar, melainkan keduanya TIDAK SAMA.
    expect(peta.get("0046")?.nilai).not.toBe(peta.get("0098")?.nilai);
    expect(peta.get("0047")?.nilai).not.toBe(peta.get("0102")?.nilai);
  });

  it("perkara permohonan memakai sebutan Pemohon dan Termohon", async () => {
    jawab({ detail: { nomorPerkara: "206/Pdt.P/2026/PA.Dgl", jenisPerkara: "Itsbat Nikah" } });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0046")?.nilai).toBe("Pemohon");
    expect(peta.get("0047")?.nilai).toBe("Termohon");
  });

  it("majelis, panitera, dan jurusita: sebutan dan jabatan, bukan nama", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    // #0690# adalah sebutan susunan hakim - dua kata, bukan daftar nama.
    // Sebelumnya diisi seluruh nama hakim yang digabung koma, sehingga
    // "diucapkan oleh Majelis Hakim" menjadi "diucapkan oleh Sudarmin
    // H.I.M. Tang, Idris". Muncul 913 kali di pustaka blangko.
    expect(peta.get("0690")?.nilai).toBe("Majelis Hakim");

    // #6033# nama panitera, #6034# JABATANNYA. Sebelumnya keduanya diisi nama
    // yang sama, sehingga blangko "#6033# sebagai #6034#" tercetak
    // "Unun Fidiyasari Patangai, S.H. sebagai Unun Fidiyasari Patangai, S.H.".
    expect(peta.get("6033")?.nilai).toBe("Unun Fidiyasari Patangai, S.H.");
    expect(peta.get("0015")?.nilai).toBe("Unun Fidiyasari Patangai, S.H.");
    expect(peta.get("6034")?.nilai).toBe("Panitera Pengganti");
    expect(peta.get("6034")?.nilai).not.toBe(peta.get("6033")?.nilai);

    // #6032# jabatan jurusita, bukan namanya.
    expect(peta.get("6032")?.nilai).toBe("Jurusita Pengganti");
  });

  it("jabatan yang tidak tercatat SIPP dibiarkan kosong, tidak ditebak", async () => {
    // Menyebut Panitera sebagai Panitera Pengganti pada naskah yang
    // ditandatangani adalah menuliskan jabatan yang keliru - lebih buruk
    // daripada penanda yang masih terlihat. Label seragam "Jurusita/Jurusita
    // Pengganti" pun tidak boleh dipakai: garis miringnya akan ikut tercetak.
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail")
        return { ok: true, data: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" } };
      if (operasi === "case.panitera")
        return { ok: true, data: [{ role: "Panitera Pengganti", jabatan: "", name: "Tanpa Jabatan" }] };
      if (operasi === "case.jurusita")
        return { ok: true, data: [{ role: "Jurusita/Jurusita Pengganti", jabatan: "", name: "Juga Tanpa" }] };
      return { ok: true, data: [] };
    });

    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.has("6034")).toBe(false);
    expect(peta.has("6032")).toBe(false);
    // Namanya tetap terisi - yang tidak diketahui hanya jabatannya.
    expect(peta.get("6033")?.nilai).toBe("Tanpa Jabatan");
  });

  it("tanggal daftar menjadi \"tersebut\" bila sama dengan tanggal surat", async () => {
    // ABT #0306#: bila keduanya sama, yang dicetak kata "tersebut" supaya
    // kalimat tidak mengulang tanggal yang sama dua kali dalam satu napas.
    jawab({
      detail: {
        nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
        tanggalDaftar: "2026-09-02T00:00:00.000Z",
        tanggalSurat: "2026-09-02T00:00:00.000Z",
      },
    });
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));

    expect(peta.get("0306")?.nilai).toBe("tersebut");
    expect(peta.get("1061")?.nilai).toBe("2 September 2026");
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
  it("nama ketua majelis diambil menurut jabatannya, bukan urutan pertama", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    // #0012# NAMANYA - di ABT bernama "Nama #0668#".
    expect(peta.get("0012")?.nilai).toBe("Sudarmin H.I.M. Tang, S.H.I.,M.H");
    expect(peta.get("0012")?.asal).toContain("Hakim Ketua");
  });

  it("#4004# dan #0668# adalah sebutan pemimpin sidang, bukan namanya", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("4004")?.nilai).toBe("Ketua Majelis");
    expect(peta.get("0668")?.nilai).toBe("Ketua Majelis");
    expect(peta.get("4004")?.nilai).not.toBe(peta.get("0012")?.nilai);
  });

  it("hakim tunggal disebut \"Hakim\", bukan \"Majelis Hakim\"", async () => {
    // Susunan yang tidak tercatat tidak boleh dinyatakan majelis: naskah resmi
    // akan menyebut susunan persidangan yang tidak pernah ada.
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail")
        return { ok: true, data: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" } };
      if (operasi === "case.judges")
        return { ok: true, data: [{ role: "Hakim", jabatan: "", name: "Hakim Tanpa Jabatan" }] };
      return { ok: true, data: [] };
    });

    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    // Namanya tetap tidak ditebak - jabatan ketua tidak tercatat.
    expect(peta.has("0012")).toBe(false);
    expect(peta.get("0690")?.nilai).toBe("Hakim");
    expect(peta.get("4004")?.nilai).toBe("Hakim");
  });

  it("tanpa satu pun hakim, sebutannya tidak ditebak", async () => {
    panggil.mockImplementation(async (operasi: string) => {
      if (operasi === "case.detail")
        return { ok: true, data: { nomorPerkara: "545/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat" } };
      return { ok: true, data: [] };
    });

    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.has("0690")).toBe(false);
    expect(peta.has("4004")).toBe(false);
    expect(peta.has("0668")).toBe(false);
  });

  it("zona waktu dan nama satker berasal dari pengaturan", async () => {
    jawab();
    const peta = petaPenanda(await rakitBerkasPerkara("10096"));
    expect(peta.get("0150")?.nilai).toBe("WITA");
    expect(peta.get("8008")?.nilai).toBe("Pengadilan Agama Donggala");
  });
});
