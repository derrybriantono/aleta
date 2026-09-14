import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  KalenderPerkara,
  RelaasPanggilan,
  susunPeristiwa,
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
    expect(screen.getByText(/Perkara ini berjalan 1 Juli 2026 – 1 Desember 2026/)).toBeTruthy();
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
    const tombol = screen.getByLabelText(/^9 September 2026:/);
    fireEvent.click(tombol);
    expect(screen.getByText(/Rab, 9 September 2026/)).toBeTruthy();
    expect(screen.getByText("Pembacaan Putusan")).toBeTruthy();
    fireEvent.click(tombol);
    expect(screen.queryByText(/Rab, 9 September 2026/)).toBeNull();
  });

  it("tanggal tanpa peristiwa tidak membuka apa pun", () => {
    render(<KalenderPerkara status={status()} />);
    fireEvent.click(screen.getByLabelText(/^2 September 2026: tanpa peristiwa/));
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
    expect(screen.getByText("lewat tanpa sidang")).toBeTruthy();
    expect(screen.getByText("menunggu dijadwalkan")).toBeTruthy();
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
    expect(kepala[0]).toContain("5 Agustus 2026");
    expect(kepala[1]).toContain("Sidang ke-2");
    expect(kepala[1]).toContain("9 September 2026");
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
    expect(screen.getByText(/dikirim pos 2026-07-25 · resi RESI-77/)).toBeTruthy();
    expect(screen.getByText("surat RETUR")).toBeTruthy();
    expect(screen.getByText("Disampaikan lewat Kepala Desa")).toBeTruthy();
    expect(screen.getByText("bertemu orangnya")).toBeTruthy();
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
    expect(screen.getByText(/dikirim setelah hari sidang/)).toBeTruthy();
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
});
