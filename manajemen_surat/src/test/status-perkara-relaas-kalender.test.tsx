import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * CATATAN 25 SEPTEMBER 2026 - BENTUK TANGGAL YANG DIPAKU BERUBAH
 *
 * Butir 1 permintaan pengguna menyeragamkan tanggal layar e-Court menjadi
 * DD-MM-YYYY beserta nama harinya (src/lib/tanggal-indonesia.ts). Delapan uji
 * di berkas ini karena itu patah - bukan karena fungsinya rusak, melainkan
 * karena bentuk yang dipakunya sudah bukan bentuk yang digambar.
 *
 * Yang diubah HANYA nilai yang dipaku. Tidak satu regex pun dilonggarkan: ^ dan
 * kurungnya tetap di tempat yang sama, sebab justru ketatnya itulah yang
 * membuat uji ini menangkap perubahan bentuk hari ini.
 *
 * Judul bulan kalender ("September 2026", "Agustus 2026") TETAP berhuruf dan
 * tidak boleh diubah - itu judul bulan, bukan tanggal, dan tidak ada nama hari
 * yang masuk akal padanya.
 */

import {
  KalenderPerkara,
  RelaasPanggilan,
  petaNomorSidang,
  susunPeristiwa,
  urutkanMenurutNomorSidang,
  type Status,
} from "@/components/portal/aleta-ecourt-status-perkara";

/**
 * Relaas panggilan dan kalender perkara - DIGAMBAR, bukan dibaca dari sumbernya.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI ADALAH APA YANG SAMPAI KE MATA PETUGAS
 * ============================================================================
 *
 * Penjaga di status-perkara-susunan.test.ts menyisir teks berkasnya: ia
 * menangkap bagian yang tergeser dan ruas yang hilang dari tipe, tetapi tidak
 * dapat membedakan komponen yang menggambar dengan benar dari komponen yang
 * melempar galat pada baris pertamanya. Keduanya sama-sama "ada di berkas".
 *
 * Uji ini menjalankannya. Yang diperiksa hal-hal yang salahnya tidak berbunyi:
 *
 *   - relaas dikelompokkan pada sidang yang BENAR, bukan sekadar dikelompokkan;
 *   - relaas yang dilaksanakan SESUDAH hari sidang disebut begitu - bukan
 *     "−3 hari sebelum sidang", yang terbaca seperti panggilan yang patut;
 *   - kalender membuka bulan yang ADA ISINYA, bukan bulan berjalan;
 *   - muatan yang separuh kosong - bot versi lama, perkara yang belum
 *     bersidang - tidak menjatuhkan layarnya.
 *
 * Nama orang di sini karangan.
 */

const KOSONG = {
  terbaca: false,
  alasan: "",
} as const;

function status(ubahan: Partial<Status> = {}): Status {
  const dasar = {
    identitas: {
      perkaraId: "10049",
      nomorPerkara: "123/Pdt.G/2026/PA.Dgl",
      jenisPerkara: "Cerai Gugat",
      jenisPerkaraLengkap: "Cerai Gugat",
      tanggalDaftar: "2026-07-01",
    },
    umur: {
      hariBersih: 70,
      hariMediasi: 0,
      hariBerjalan: 69,
      bulanBerjalan: 2.3,
      sudahPutus: true,
      sebabSelesai: "putus",
      hariMinutasi: 3,
    },
    jadwal: [
      {
        sidangId: "1",
        tanggalSidang: "2026-08-05",
        jamSidang: "09:00",
        agenda: "Sidang Pertama",
        ruangan: "Ruang 1",
        ditunda: true,
        alasanDitunda: "Tergugat tidak hadir",
        urutanSidang: 1,
        adaBas: true,
      },
      {
        sidangId: "2",
        tanggalSidang: "2026-09-09",
        jamSidang: "09:30",
        agenda: "Pembacaan Putusan",
        ruangan: "Ruang 1",
        ditunda: false,
        alasanDitunda: "",
        urutanSidang: 2,
        adaBas: false,
      },
    ],
    penundaan: [],
    putusan: {
      sudahPutus: true,
      tanggalPutusan: "2026-09-09",
      statusPutusan: "Dikabulkan",
      verstek: true,
      tanggalMinutasi: "2026-09-12",
      tanggalBht: "2026-09-24",
      adaBerkasPutusan: true,
      adaBerkasAnonim: false,
      aktaCerai: { nomor: "0123/AC/2026/PA.Dgl", tanggal: "2026-09-30", diserahkanPihak1: "", diserahkanPihak2: "" },
      upayaHukum: [],
    },
    relaas: [
      {
        id: "r1",
        sidangId: "1",
        tanggalSidang: "2026-08-05",
        namaPihak: "Nurhayati binti Abdullah",
        peran: "Penggugat/Pemohon",
        pihakKe: 1,
        tanggalRelaas: "2026-07-29",
        tanggalKirimPos: "",
        statusPos: null,
        retur: false,
        ketHasilRelaas: "",
        bertemu: true,
        noResiPos: "",
        jurusitaNama: "Munir, S.H.",
        adaDokumen: true,
        adaResi: false,
      },
      {
        id: "r2",
        sidangId: "1",
        tanggalSidang: "2026-08-05",
        namaPihak: "Rahmat bin Sulaiman",
        peran: "Tergugat/Termohon",
        pihakKe: 2,
        tanggalRelaas: "2026-07-30",
        tanggalKirimPos: "2026-07-25",
        statusPos: 2,
        retur: true,
        ketHasilRelaas: "Disampaikan lewat Kepala Desa",
        bertemu: false,
        noResiPos: "RESI-77",
        jurusitaNama: "Munir, S.H.",
        adaDokumen: false,
        adaResi: true,
      },
      {
        // Relaas untuk sidang KEDUA, dan dilaksanakan SESUDAH hari sidangnya.
        id: "r3",
        sidangId: "2",
        tanggalSidang: "2026-09-09",
        namaPihak: "Rahmat bin Sulaiman",
        peran: "Tergugat/Termohon",
        pihakKe: 2,
        tanggalRelaas: "2026-09-11",
        tanggalKirimPos: "",
        statusPos: null,
        retur: false,
        ketHasilRelaas: "",
        bertemu: false,
        noResiPos: "",
        jurusitaNama: "",
        adaDokumen: false,
        adaResi: false,
      },
      {
        // sidang_id kosong di SIPP - keadaan yang perlu diperbaiki, bukan
        // disembunyikan.
        id: "r4",
        sidangId: "",
        tanggalSidang: "",
        namaPihak: "Saksi Satu",
        peran: "",
        pihakKe: null,
        tanggalRelaas: "2026-08-20",
        tanggalKirimPos: "",
        statusPos: null,
        retur: false,
        ketHasilRelaas: "",
        bertemu: false,
        noResiPos: "",
        jurusitaNama: "",
        adaDokumen: false,
        adaResi: false,
      },
    ],
    panggilan: {
      lewatEcourt: false,
      pihak: [
        {
          nama: "Nurhayati binti Abdullah",
          peran: "Penggugat/Pemohon",
          persetujuan: "belum",
          seharusnya: "biasa",
          terlaksana: "biasa",
          sudahDikirim: true,
          tidakPerluDipanggil: false,
          belumDipanggil: false,
          salahSaluran: false,
          tanggalPanggilan: "2026-07-29",
          diterima: true,
          buktiPenerimaan: "bertemu langsung",
          noResiPos: "",
          tanggalPelaksanaanRelaas: "2026-07-29",
          kepatutan: {
            ambang: 3,
            hariKerja: true,
            dasarHukum: "Pasal 122 HIR",
            jalur: "biasa",
            perluDiterima: false,
            dinilai: true,
            patut: true,
            selisih: 5,
            alasan: "",
          },
        },
        {
          nama: "Rahmat bin Sulaiman",
          peran: "Tergugat/Termohon",
          persetujuan: "belum",
          seharusnya: "biasa",
          terlaksana: "surat_tercatat",
          sudahDikirim: true,
          tidakPerluDipanggil: false,
          belumDipanggil: false,
          salahSaluran: true,
          tanggalPanggilan: "2026-09-11",
          diterima: null,
          buktiPenerimaan: "",
          noResiPos: "RESI-77",
          tanggalPelaksanaanRelaas: "2026-09-11",
          kepatutan: {
            ambang: 3,
            hariKerja: true,
            dasarHukum: "Pasal 122 HIR",
            jalur: "biasa",
            perluDiterima: false,
            dinilai: true,
            patut: false,
            selisih: -2,
            alasan: "dikirim_setelah_hari_sidang",
          },
        },
      ],
      ringkasan: {
        jumlahPihak: 2,
        belumDipanggil: 0,
        tidakPerluDipanggil: 0,
        salahSaluran: 1,
        tidakPatut: 1,
        penerimaanBelumTerbukti: 0,
        patut: 1,
      },
    },
    tahapan: {
      terbaca: true,
      alasan: "",
      tahap: [
        {
          kunci: "pmh",
          label: "Penetapan Majelis Hakim",
          dasar: "",
          tanggal: "2026-07-03",
          diinput: "2026-07-03",
          terbaca: true,
          inputTerbaca: true,
          alasan: "",
          alasanInput: "",
          hariSejakAcuan: 2,
          hariSampaiInput: 0,
          acuan: "",
          dokumenId: "",
          adaBerkas: false,
          diinputOleh: "operator1",
        },
        {
          // Pendaftaran juga ada di identitas - tidak boleh dihitung dua kali.
          kunci: "daftar",
          label: "Pendaftaran",
          dasar: "",
          tanggal: "2026-07-01",
          diinput: "2026-07-01",
          terbaca: true,
          inputTerbaca: true,
          alasan: "",
          alasanInput: "",
          hariSejakAcuan: 0,
          hariSampaiInput: 0,
          acuan: "",
          dokumenId: "",
          adaBerkas: false,
          diinputOleh: "",
        },
      ],
    },
    mediasi: {
      ...KOSONG,
      terbaca: true,
      jadwal: [{ tanggal: "2026-07-20", jam: "10:00", sampaiJam: "11:00", tempat: "Ruang Mediasi", dihadiri: "", ditunda: false }],
      baris: [],
    },
    courtCalendar: {
      terbaca: true,
      alasan: "",
      jumlah: 3,
      terlaksana: 1,
      terjadwal: 0,
      meleset: 1,
      menunggu: 1,
      baris: [
        // Direncanakan dan memang bersidang.
        { tanggal: "2026-08-05", jam: "09:00", agenda: "Sidang Pertama", keterangan: "Panggil Tergugat", diinputOleh: "operator1", diinputTanggal: "2026-07-03", adaSidang: true, keadaan: "terlaksana" },
        // Direncanakan, harinya lewat, TIDAK ada sidangnya - inilah yang dicari.
        { tanggal: "2026-08-19", jam: "09:00", agenda: "Pembuktian", keterangan: "", diinputOleh: "operator1", diinputTanggal: "2026-07-03", adaSidang: false, keadaan: "meleset" },
        // Direncanakan jauh di depan, belum dijadwalkan.
        { tanggal: "2026-12-01", jam: "10:00", agenda: "Sidang Lanjutan", keterangan: "", diinputOleh: "operator1", diinputTanggal: "2026-07-03", adaSidang: false, keadaan: "menunggu" },
      ],
    },
    ikrarTalak: { terbaca: true, alasan: "", ada: false },
  } as unknown as Status;

  return { ...dasar, ...ubahan } as Status;
}

// ===========================================================================
describe("peristiwa kalender disusun dari muatan yang sudah ada", () => {
  it("seluruh jenis peristiwa terkumpul dan terurut menaik", () => {
    const peristiwa = susunPeristiwa(status());
    const urut = peristiwa.map((x) => x.tanggal);
    expect([...urut].sort()).toEqual(urut);

    const jenis = peristiwa.map((x) => x.jenis);
    for (const satu of ["daftar", "penetapan", "mediasi", "relaas", "sidang", "putusan", "minutasi", "bht", "akta"]) {
      expect(jenis, satu).toContain(satu);
    }
  });

  it("pendaftaran hanya sekali, meski disebut identitas DAN tahapan", () => {
    const peristiwa = susunPeristiwa(status());
    expect(peristiwa.filter((x) => x.jenis === "daftar")).toHaveLength(1);
    expect(peristiwa.filter((x) => x.tanggal === "2026-07-01")).toHaveLength(1);
  });

  it("tanggal yang kosong atau tidak sah dilewati, bukan menjadi peristiwa tanpa tanggal", () => {
    const peristiwa = susunPeristiwa(
      status({
        putusan: {
          sudahPutus: false,
          tanggalPutusan: "",
          statusPutusan: "",
          verstek: false,
          tanggalMinutasi: "",
          tanggalBht: "bukan tanggal",
          adaBerkasPutusan: false,
          adaBerkasAnonim: false,
          aktaCerai: null,
          upayaHukum: [],
        },
      } as unknown as Partial<Status>)
    );
    expect(peristiwa.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal))).toBe(true);
    expect(peristiwa.some((x) => x.jenis === "putusan")).toBe(false);
  });

  it("muatan yang separuh kosong tidak menjatuhkannya", () => {
    // Bot versi lama tidak mengirim panggilan; perkara baru belum bersidang.
    const kurus = {
      identitas: { perkaraId: "1", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", jenisPerkara: "", jenisPerkaraLengkap: "", tanggalDaftar: "2026-09-01" },
      umur: { sebabSelesai: "" },
      jadwal: [],
      relaas: [],
      putusan: null,
    } as unknown as Status;
    expect(() => susunPeristiwa(kurus)).not.toThrow();
    expect(susunPeristiwa(kurus)).toHaveLength(1);
  });
});

// ===========================================================================
describe("kalender perkara digambar", () => {
  // Kalender membuka bulan BERJALAN bila perkara masih punya agenda di depan, jadi
  // hasilnya bergantung pada hari ini. Uji ini ditulis 30 Sep 2026 dan merah sejak
  // 1 Okt 2026 tanpa satu baris kode pun berubah - jamnya dikunci ke hari itu.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T10:00:00+08:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("membuka bulan peristiwa terakhir bila seluruhnya sudah lewat", () => {
    // Perkara contoh berakhir 30 September 2026 - jauh di belakang hari
    // pengujian mana pun sesudahnya. Kalender harus berdiri di sana, bukan di
    // bulan berjalan yang kosong.
    render(<KalenderPerkara status={status()} />);
    // Judul bulan saja - kalimat rentang perkara juga memuat "September 2026".
    expect(screen.getByText("September 2026")).toBeTruthy();
    // Rentangnya memuat rencana Court Calendar yang harinya belum tiba -
    // 1 Desember 2026. Menghentikannya pada peristiwa yang sudah terjadi
    // menyembunyikan bahwa perkara ini masih punya agenda di depan.
    expect(screen.getByText(/Perkara ini berjalan Rabu, 01-07-2026 – Selasa, 01-12-2026/)).toBeTruthy();
  });

  it("keterangan warna hanya memuat jenis yang ada pada bulan itu", () => {
    render(<KalenderPerkara status={status()} />);
    // September memuat sidang, relaas, putusan, minutasi, BHT, akta -
    // tetapi TIDAK memuat pendaftaran maupun mediasi (keduanya Juli).
    expect(screen.getByText("Putusan")).toBeTruthy();
    expect(screen.queryByText("Pendaftaran")).toBeNull();
    expect(screen.queryByText("Mediasi")).toBeNull();
  });

  it("menekan tanggal membuka peristiwanya; menekannya lagi menutupnya", () => {
    render(<KalenderPerkara status={status()} />);
    const tombol = screen.getByLabelText(/^Rabu, 09-09-2026:/);
    fireEvent.click(tombol);
    expect(screen.getByText(/Rabu, 09-09-2026/)).toBeTruthy();
    expect(screen.getByText("Pembacaan Putusan")).toBeTruthy();
    fireEvent.click(tombol);
    expect(screen.queryByText(/Rabu, 09-09-2026/)).toBeNull();
  });

  it("membuka perkara lain di komponen yang sama menyetel ulang bulan dan pilihannya", () => {
    // Komponennya tidak dibongkar saat perkara lain dibuka - hanya muatannya
    // berganti. Tanpa penyetelan ulang, kalender tetap berdiri di bulan dan
    // tanggal terpilih perkara sebelumnya.
    const { rerender } = render(<KalenderPerkara status={status()} />);
    fireEvent.click(screen.getByLabelText("Bulan sebelumnya"));
    expect(screen.getByText("Agustus 2026")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Rabu, 05-08-2026:/));
    // Kepala panelnya ditunjuk menurut JENIS ELEMENNYA, bukan dengan pola yang
    // dilonggarkan. Sejak bentuk tanggalnya seragam, kepala panel hari terpilih
    // dan satu baris peristiwa di dalamnya memuat teks yang sama persis - dua
    // elemen, satu tulisan - dan itu memang akibat yang dikehendaki butir 1.
    // Yang dimaksud uji ini kepalanya, dan kepalanya satu-satunya <p>.
    const kepalaHari = screen
      .getAllByText("Rabu, 05-08-2026")
      .filter((e) => e.tagName === "P");
    expect(kepalaHari, "kepala panel hari terpilih tidak tergambar").toHaveLength(1);

    const lain = status({
      identitas: { ...status().identitas, nomorPerkara: "124/Pdt.G/2026/PA.Dgl" },
    } as Partial<Status>);
    rerender(<KalenderPerkara status={lain} />);
    // Bulan awal perkara yang baru - bukan Agustus yang tadi dibuka.
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.queryByText("Agustus 2026")).toBeNull();
    // Yang harus lenyap KEPALA PANEL hari terpilih, bukan setiap kemunculan
    // tanggal itu di layar: bagian Court Calendar SIPP di bawahnya juga
    // menuliskannya (satu <span> per baris rencana) dan ia memang TIDAK disetel
    // ulang - ia mendaftar rencana perkaranya, bukan pilihan penggunanya.
    // Sebelum bentuk tanggalnya seragam, kedua tempat itu menuliskannya dengan
    // bentuk yang berbeda sehingga pola apa pun hanya menjaring satu; sekarang
    // keduanya sama, dan itu justru yang diminta butir 1.
    expect(
      screen.queryAllByText("Rabu, 05-08-2026").filter((e) => e.tagName === "P")
    ).toHaveLength(0);
  });

  it("tanggal tanpa peristiwa tidak membuka apa pun", () => {
    render(<KalenderPerkara status={status()} />);
    fireEvent.click(screen.getByLabelText(/^Rabu, 02-09-2026: tanpa peristiwa/));
    expect(screen.getByText(/Tekan satu tanggal untuk membaca peristiwanya/)).toBeTruthy();
  });

  it("berpindah bulan, lalu Kembali memulihkan bulan awalnya", () => {
    render(<KalenderPerkara status={status()} />);
    fireEvent.click(screen.getByLabelText("Bulan sebelumnya"));
    expect(screen.getByText("Agustus 2026")).toBeTruthy();
    fireEvent.click(screen.getByText("Kembali"));
    expect(screen.getByText("September 2026")).toBeTruthy();
  });

  it("Court Calendar SIPP tergambar beserta selisih rencana dan pelaksanaannya", () => {
    render(<KalenderPerkara status={status()} />);
    expect(screen.getByText("Court Calendar SIPP")).toBeTruthy();
    expect(screen.getByText("1 lewat tanpa sidang")).toBeTruthy();
    expect(screen.getByText("1 terlaksana")).toBeTruthy();
    expect(screen.getByText("1 menunggu")).toBeTruthy();
    // Ketiga rencana disebut, masing-masing dengan bunyi keadaannya.
    expect(screen.getByText("Lewat tanpa sidang")).toBeTruthy();
    expect(screen.getByText("Menunggu dijadwalkan")).toBeTruthy();
    expect(screen.getByText("Pembuktian")).toBeTruthy();
  });

  it("rencana ditampilkan runut menurut tanggal, apa pun urutan kirimnya", () => {
    // Kuerinya memang ORDER BY rencana_tanggal, tetapi bagian ini menjanjikan
    // urutan waktu kepada yang membacanya - dan janji yang bergantung pada
    // kerapian pemanggil akan diingkari pada hari pemanggilnya berubah.
    const acak = status({
      courtCalendar: {
        terbaca: true,
        alasan: "",
        baris: [
          { tanggal: "2026-12-01", jam: "", agenda: "Ketiga", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: false, keadaan: "menunggu" },
          { tanggal: "2026-08-05", jam: "", agenda: "Pertama", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: true, keadaan: "terlaksana" },
          { tanggal: "2026-08-19", jam: "", agenda: "Kedua", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: false, keadaan: "meleset" },
        ],
      },
    });
    const { container } = render(<KalenderPerkara status={acak} />);
    const daftar = container.querySelectorAll("ol > li");
    const urut = [...daftar].map((x) => x.textContent ?? "");
    expect(urut[0]).toContain("Pertama");
    expect(urut[1]).toContain("Kedua");
    expect(urut[2]).toContain("Ketiga");
  });

  it("rencana yang SUDAH bersidang tidak digambar dua kali di kotak tanggalnya", () => {
    // 98% rencana memang bersidang pada tanggalnya. Menggambar keduanya
    // membuat hampir tiap hari sidang memuat dua titik yang menyatakan hal
    // yang sama - dan yang satu itu, rencana yang lewat tanpa sidang,
    // tenggelam di antaranya.
    const peristiwa = susunPeristiwa(status());
    const rencana = peristiwa.filter((x) => x.jenis === "rencana");
    expect(rencana.map((x) => x.tanggal)).toEqual(["2026-08-19", "2026-12-01"]);
  });

  it("Court Calendar yang belum diisi disebut lazim, bukan dituduh cacat", () => {
    const tanpa = status({ courtCalendar: { terbaca: true, alasan: "", baris: [] } });
    render(<KalenderPerkara status={tanpa} />);
    expect(screen.getByText(/belum diisi di SIPP/)).toBeTruthy();
    expect(screen.getByText(/bukan tanda ada yang keliru/)).toBeTruthy();
  });

  it("bot lama yang tidak mengirim Court Calendar tidak menuliskan apa pun tentangnya", () => {
    render(<KalenderPerkara status={status({ courtCalendar: undefined })} />);
    expect(screen.queryByText("Court Calendar SIPP")).toBeNull();
    expect(screen.queryByText(/belum diisi di SIPP/)).toBeNull();
  });

  it("perkara tanpa satu pun tanggal mengatakannya", () => {
    const kosong = {
      identitas: { perkaraId: "1", nomorPerkara: "9/Pdt.G/2026/PA.Dgl", jenisPerkara: "", jenisPerkaraLengkap: "", tanggalDaftar: "" },
      umur: { sebabSelesai: "" },
      jadwal: [],
      relaas: [],
      putusan: null,
    } as unknown as Status;
    render(<KalenderPerkara status={kosong} />);
    expect(screen.getByText(/kalender tidak dapat disusun/)).toBeTruthy();
  });
});

// ===========================================================================
describe("relaas panggilan digambar runut per sidang", () => {
  it("tiap sidang menjadi satu kelompok, bernomor urut menaik", () => {
    render(<RelaasPanggilan status={status()} />);
    const kepala = screen.getAllByText(/^Sidang ke-\d+ ·/).map((x) => x.textContent ?? "");
    expect(kepala).toHaveLength(2);
    expect(kepala[0]).toContain("Sidang ke-1");
    expect(kepala[0]).toContain("Rabu, 05-08-2026");
    expect(kepala[1]).toContain("Sidang ke-2");
    expect(kepala[1]).toContain("Rabu, 09-09-2026");
  });

  it("relaas masuk ke kelompok sidangnya sendiri, bukan sekadar berkelompok", () => {
    const { container } = render(<RelaasPanggilan status={status()} />);
    const kelompok = container.querySelectorAll("ol > li");
    // Sidang pertama: dua relaas. Sidang kedua: satu. Lalu yang tanpa sidang.
    expect(within(kelompok[0] as HTMLElement).getAllByText(/binti|bin /)).toHaveLength(2);
    expect(within(kelompok[0] as HTMLElement).getByText("Sidang Pertama")).toBeTruthy();
    expect(within(kelompok[1] as HTMLElement).getAllByText(/bin /)).toHaveLength(1);
  });

  it("relaas yang dilaksanakan SESUDAH hari sidang disebut begitu", () => {
    // "−2 hari sebelum sidang" terbaca seperti panggilan yang patut. Yang
    // terjadi sebaliknya: panggilannya datang dua hari sesudah sidangnya.
    render(<RelaasPanggilan status={status()} />);
    expect(screen.getByText(/2 hari SESUDAH sidang/)).toBeTruthy();
    expect(screen.getByText(/7 hari sebelum sidang/)).toBeTruthy();
  });

  it("jejak pos, retur, dan hasil relaas ikut tergambar", () => {
    render(<RelaasPanggilan status={status()} />);
    expect(screen.getByText(/dikirim pos Sab, 25-07-2026 · resi RESI-77/)).toBeTruthy();
    // 22 Okt 2026: lencana retur menyebut sebabnya; status_pos 2 tanpa sebab tertulis = "Retur pos".
    expect(screen.getByText("Retur pos")).toBeTruthy();
    expect(screen.getByText("Disampaikan lewat Kepala Desa")).toBeTruthy();
    expect(screen.getByText("Bertemu orangnya")).toBeTruthy();
    // Dua relaas dilaksanakan jurusita yang sama - keduanya harus menyebutnya.
    expect(screen.getAllByText(/oleh Munir, S.H./)).toHaveLength(2);
  });

  it("relaas tanpa tautan sidang tetap tampil, di kelompoknya sendiri", () => {
    render(<RelaasPanggilan status={status()} />);
    expect(screen.getByText(/1 relaas tanpa tautan sidang/)).toBeTruthy();
    expect(screen.getByText("Saksi Satu")).toBeTruthy();
  });

  it("ringkasan kepatutan menyebut yang tidak patut dan yang salah saluran", () => {
    render(<RelaasPanggilan status={status()} />);
    expect(screen.getByText("1 tidak patut")).toBeTruthy();
    expect(screen.getByText("1 salah saluran")).toBeTruthy();
    expect(screen.getByText("1 patut")).toBeTruthy();
    expect(screen.getByText(/bukan penetapan sah tidaknya panggilan/)).toBeTruthy();
  });

  it("alasan kepatutan berbunyi kalimat, bukan kode", () => {
    render(<RelaasPanggilan status={status()} />);
    expect(screen.getByText(/dikirim setelah hari sidang/i)).toBeTruthy();
    expect(screen.queryByText(/dikirim_setelah_hari_sidang/)).toBeNull();
  });

  it("bot versi lama yang belum mengirim panggilan tidak menjatuhkan layarnya", () => {
    const tanpaPanggilan = status({ panggilan: undefined });
    expect(() => render(<RelaasPanggilan status={tanpaPanggilan} />)).not.toThrow();
    expect(screen.getAllByText(/^Sidang ke-\d+ ·/)).toHaveLength(2);
  });

  it("perkara tanpa relaas sama sekali mengatakannya", () => {
    render(<RelaasPanggilan status={status({ relaas: [], panggilan: undefined })} />);
    expect(screen.getByText(/Belum ada relaas tercatat pada perkara ini/)).toBeTruthy();
  });

  it("sandi E tanpa e-Summons tampil sebagai catatan, bukan salah saluran", () => {
    // 385/Pdt.G/2026/PA.Dgl: tergugat tanpa email di e-Court, dipanggil surat
    // tercatat, relaasnya bersandi E. Bot kini tidak menuduhnya salah saluran;
    // layar menampilkan catatannya tanpa lencana.
    const dasar = status();
    const p = dasar.panggilan!;
    const pihak = p.pihak.map((x, i) =>
      i === 1
        ? {
            ...x,
            seharusnya: "surat_tercatat",
            terlaksana: "",
            salahSaluran: false,
            catatanSaluran:
              "SIPP mencatat Panggilan Elektronik, tetapi pihak ini tidak punya email di e-Court dan e-Court tidak mencatat e-Summons kepadanya - sandi relaas di SIPP kemungkinan keliru.",
          }
        : x
    );
    render(
      <RelaasPanggilan
        status={status({
          panggilan: {
            ...p,
            tanggalSidang: "2026-09-09",
            pihak,
            ringkasan: { ...p.ringkasan, salahSaluran: 0, saluranBelumPasti: 1 },
          },
        })}
      />
    );
    expect(screen.getByText(/tidak punya email di e-Court/)).toBeTruthy();
    expect(screen.queryByText("1 salah saluran")).toBeNull();
    expect(screen.queryByText(/^dipakai /)).toBeNull();
    expect(screen.getByText("1 saluran belum pasti")).toBeTruthy();
    // Sidang yang dinilai disebut tanggalnya.
    expect(screen.getByText(/\(Rabu, 09-09-2026\), menurut/)).toBeTruthy();
  });

  it("bot lama tanpa ruas saluran: tidak ada lencana atau catatan tambahan", () => {
    render(<RelaasPanggilan status={status()} />);
    expect(screen.queryByText(/saluran belum pasti/)).toBeNull();
    expect(screen.queryByText(/tidak punya email di e-Court/)).toBeNull();
  });
});

// ===========================================================================
describe("nomor sidang diambil dari SIPP, bukan dari urutan baris", () => {
  /** Tiga sidang; relaas hanya untuk sidang ke-1 dan ke-3 - kasus 385/Pdt.G/2026. */
  function tigaSidang(): Status {
    const dasar = status();
    const [r1, r2] = dasar.relaas;
    const sidang = (sidangId: string, tanggalSidang: string, urutanSidang: number) => ({
      ...dasar.jadwal[0],
      sidangId,
      tanggalSidang,
      urutanSidang,
    });
    return status({
      jadwal: [sidang("1", "2026-08-05", 1), sidang("2", "2026-08-19", 2), sidang("3", "2026-09-09", 3)],
      relaas: [
        r1,
        { ...r2, id: "r3", sidangId: "3", tanggalSidang: "2026-09-09", tanggalRelaas: "2026-09-02" },
      ],
    });
  }

  it("nomor relaas diambil dari jadwal, bukan dari urutan kelompok", () => {
    render(<RelaasPanggilan status={tigaSidang()} />);
    const kepala = screen.getAllByText(/^Sidang ke-\d+ ·/).map((x) => x.textContent ?? "");
    expect(kepala).toHaveLength(2);
    expect(kepala[0]).toContain("Sidang ke-1 ·");
    // Dulu tertulis "Sidang ke-2" - posisi kelompoknya, bukan sidangnya.
    expect(kepala[1]).toContain("Sidang ke-3 ·");
    expect(screen.queryByText(/^Sidang ke-2 ·/)).toBeNull();
  });

  it("relaas yang sidangId-nya tidak ada di jadwal tidak diberi nomor karangan", () => {
    const dasar = tigaSidang();
    const [r1] = dasar.relaas;
    render(
      <RelaasPanggilan
        status={{
          ...dasar,
          relaas: [...dasar.relaas, { ...r1, id: "r99", sidangId: "99", tanggalSidang: "2026-10-01" }],
        }}
      />
    );
    expect(screen.getByText(/^Sidang · .*Kamis, 01-10-2026/)).toBeTruthy();
    expect(screen.queryByText(/^Sidang ke-\d+ · .*Kamis, 01-10-2026/)).toBeNull();
  });

  it("dua sidang pada hari yang sama: kedua nomornya disebut, bukan ditebak salah satunya", () => {
    const dasar = tigaSidang();
    const [r1] = dasar.relaas;
    render(
      <RelaasPanggilan
        status={{
          ...dasar,
          jadwal: [...dasar.jadwal, { ...dasar.jadwal[0], sidangId: "4", tanggalSidang: "2026-08-05", urutanSidang: 4 }],
          relaas: [...dasar.relaas, { ...r1, id: "r4", sidangId: "4" }],
        }}
      />
    );
    expect(screen.getByText(/^Sidang ke-1 & ke-4 ·/)).toBeTruthy();
  });

  it("Court Calendar bernomor 1..N menurut tanggal, apa pun urutan kirimnya", () => {
    const acak = status({
      courtCalendar: {
        terbaca: true,
        alasan: "",
        baris: [
          { tanggal: "2026-12-01", jam: "", agenda: "Ketiga", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: false, keadaan: "menunggu" },
          { tanggal: "2026-08-05", jam: "", agenda: "Pertama", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: true, keadaan: "terlaksana" },
          { tanggal: "2026-08-19", jam: "", agenda: "Kedua", keterangan: "", diinputOleh: "", diinputTanggal: "", adaSidang: false, keadaan: "meleset" },
        ],
      },
    });
    render(<KalenderPerkara status={acak} />);
    const ol = screen.getByText("Court Calendar SIPP").closest(".rounded-md")?.querySelector("ol") as HTMLElement;
    expect(ol).toBeTruthy();
    const daftar = [...ol.querySelectorAll(":scope > li")];
    expect(daftar.map((x) => (x.textContent ?? "").match(/Pertama|Kedua|Ketiga/)?.[0])).toEqual([
      "Pertama",
      "Kedua",
      "Ketiga",
    ]);
    expect(daftar.map((x) => x.querySelector('[title^="Rencana ke-"]')?.textContent)).toEqual(["1", "2", "3"]);
    expect(daftar.map((x) => x.querySelector('[title^="Rencana ke-"]')?.getAttribute("title"))).toEqual([
      "Rencana ke-1",
      "Rencana ke-2",
      "Rencana ke-3",
    ]);
    // Nomor rencana BUKAN nomor sidang - tidak boleh berbunyi "Sidang".
    expect(ol.querySelector('[title^="Sidang ke-"]')).toBeNull();
    // Rencana yang bersidang menyebut sidang SIPP yang melaksanakannya; yang
    // tidak bersidang tidak menyebut apa pun.
    expect(within(daftar[0] as HTMLElement).getByText("sidang ke-1")).toBeTruthy();
    expect(within(daftar[1] as HTMLElement).queryByText(/^sidang ke-/)).toBeNull();
    expect(within(daftar[2] as HTMLElement).queryByText(/^sidang ke-/)).toBeNull();
  });

  it("Court Calendar: hari berisi dua sidang tidak diberi keterangan sidang ke-", () => {
    const dasar = status();
    const duaSehari = status({
      jadwal: [...dasar.jadwal, { ...dasar.jadwal[0], sidangId: "9", jamSidang: "13:00", urutanSidang: 3 }],
    });
    render(<KalenderPerkara status={duaSehari} />);
    const ol = screen.getByText("Court Calendar SIPP").closest(".rounded-md")?.querySelector("ol") as HTMLElement;
    const baris = [...ol.querySelectorAll(":scope > li")].find((x) =>
      (x.textContent ?? "").includes("Panggil Tergugat")
    ) as HTMLElement;
    expect(baris).toBeTruthy();
    // Bersidang, tetapi harinya memuat dua sidang - nomor mana pun tebakan.
    expect(within(baris).getByText("Terlaksana")).toBeTruthy();
    expect(within(baris).queryByText(/^sidang ke-/)).toBeNull();
    // Pembanding: dengan satu sidang pada hari itu keterangannya ADA.
    cleanup();
    render(<KalenderPerkara status={status()} />);
    const olTunggal = screen.getByText("Court Calendar SIPP").closest(".rounded-md")?.querySelector("ol") as HTMLElement;
    expect(within(olTunggal).getByText("sidang ke-1")).toBeTruthy();
  });

  it("urutkanMenurutNomorSidang: menurut nomor, yang nol di bawah, masukan tidak diubah", () => {
    const masukan = [
      { sidangId: "c", urutanSidang: 3 },
      { sidangId: "x", urutanSidang: 0 },
      { sidangId: "a", urutanSidang: 1 },
      { sidangId: "y", urutanSidang: 0 },
      { sidangId: "b", urutanSidang: 2 },
    ];
    const salinan = masukan.map((x) => ({ ...x }));
    const hasil = urutkanMenurutNomorSidang(masukan);
    expect(hasil.map((x) => x.sidangId)).toEqual(["a", "b", "c", "x", "y"]);
    // Larik aslinya dibaca sidangBerikut, ringkasan, dan kalender.
    expect(masukan).toEqual(salinan);
    expect(hasil).not.toBe(masukan);
  });

  it("petaNomorSidang: sidangId kosong dan nomor nol dilewati", () => {
    const peta = petaNomorSidang([
      { sidangId: "1", urutanSidang: 1 },
      { sidangId: "", urutanSidang: 2 },
      { sidangId: "3", urutanSidang: 0 },
      { sidangId: "4", urutanSidang: 4 },
    ]);
    expect([...peta.entries()]).toEqual([
      ["1", 1],
      ["4", 4],
    ]);
  });
});
