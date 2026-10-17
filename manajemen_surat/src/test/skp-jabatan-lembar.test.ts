// @vitest-environment node
import { describe, expect, it } from "vitest";

import { susunNaskahEvidenSkp } from "@/lib/eviden-skp-cetak";
import { DAFTAR_DOKUMEN_EVIDEN_SKP } from "@/lib/eviden-skp-katalog";
import type { DataEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import { namaBerkasEvidenSkp, namaZipEvidenSkp, susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import { hitungLembarSkp } from "@/lib/skp-jabatan-hitung";
import {
  KUNCI_LEMBAR_SKP,
  daftarDokumenSkpJabatan,
  kalimatRealisasiEkinerja,
  kunciBuktiSkp,
  sebutanOrangSkp,
  susunDokumenBuktiSkp,
  susunPaketSkpJabatan,
  susunPaketSkpPimpinan,
} from "@/lib/skp-jabatan-lembar";
import type { FaktaAkunSkp, KejadianSkp, PegawaiSkp } from "@/lib/skp-jabatan-tipe";
import { gambarDocxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-docx";
import { gambarPdfEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-pdf";
import { gambarXlsxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-xlsx";

import { bacaPdfUji, bacaZip } from "./eviden-skp-baca";
import { INSTANSI_CONTOH } from "./eviden-skp-contoh";

/**
 * ============================================================================
 * LEMBAR SKP, BUKTI DUKUNG, DAN SKP PIMPINAN DI PIPELINE CETAK YANG ADA
 * ============================================================================
 */

const PERIODE = susunPeriodeSkpJabatan("tw2", 2026);
const DIHITUNG = "2026-07-05T02:00:00.000Z";

const pegawai = (over: Partial<PegawaiSkp> = {}): PegawaiSkp => ({
  userId: "u-panitera",
  nama: "Panitera Uji, S.H.",
  nip: "197001012000031001",
  pangkatGolongan: "Pembina / IV.a",
  jabatanUtama: "panitera",
  jabatanTambahan: ["pp"],
  ...over,
});

const k = (over: Partial<KejadianSkp> = {}): KejadianSkp => ({
  perkaraId: "9",
  nomorPerkara: "9/Pdt.G/2026/PA.Dgl",
  tanggal: "2026-05-04",
  tanggalAcuan: "2026-05-04",
  nilai: null,
  keterangan: "Penunjukan PP dan JS",
  ...over,
});

const baca = (kunci: string, kejadian: KejadianSkp[]) => ({ kunci, terbaca: true, kejadian, galat: null });

const akunPanitera = (fakta: FaktaAkunSkp["fakta"]): FaktaAkunSkp => ({
  username: "panitera",
  userIdSipp: "81",
  nama: "Panitera Uji",
  grup: [30],
  jabatanDugaan: "panitera",
  aktif: true,
  fakta,
});

const PENILAI = { nama: "Ketua Uji, S.H.I.", nip: "197505052001121002", jabatan: "Ketua Pengadilan Agama Donggala" };

function hasilPanitera(sertakanTambahan = true) {
  return hitungLembarSkp({
    jenis: "panitera",
    periode: PERIODE,
    pegawai: pegawai(),
    pejabatPenilai: PENILAI,
    data: {
      ok: true,
      periode: PERIODE,
      jabatan: "panitera",
      akun: [
        akunPanitera([
          baca("pn-penunjukan-kuantitas", [k(), k({ tanggal: "2026-05-05", nomorPerkara: "10/Pdt.G/2026/PA.Dgl" })]),
          baca("pn-penunjukan-kualitas", [k(), k({ tanggal: "2026-05-05" })]),
        ]),
      ],
      catatan: ["Catatan bot uji."],
      galat: [],
      dihitungPada: DIHITUNG,
    },
    sertakanTambahan,
  });
}

describe("Lembar SKP jabatan perkara", () => {
  it("susunan paket: Lembar SKP dahulu, lalu bukti per RHK utama, lalu tambahan", () => {
    const paket = susunPaketSkpJabatan(hasilPanitera());
    expect(paket.dokumen.map((d) => d.kunci)).toEqual([
      KUNCI_LEMBAR_SKP,
      "bukti-pn-penunjukan",
      "bukti-pn-administrasi",
      "bukti-pp-sidang",
      "bukti-pp-putusan",
    ]);
    expect(paket.dokumen.every((d) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(d.kunci))).toBe(true);
    expect(paket.sebutanKanan).toBe("Pejabat Penilai Kinerja,");
    expect(paket.ketua).toMatchObject({ nama: "Ketua Uji, S.H.I.", jabatan: "Ketua Pengadilan Agama Donggala" });
    expect(paket.orang.jabatan).toBe("Panitera (merangkap Panitera Pengganti)");
    expect(paket.periode.labelPanjang).toBe("Triwulan II Tahun 2026");
  });

  it("blok tugas PP dapat dimatikan", () => {
    const tanpa = susunPaketSkpJabatan(hasilPanitera(false));
    expect(tanpa.dokumen.map((d) => d.kunci)).toEqual([KUNCI_LEMBAR_SKP, "bukti-pn-penunjukan", "bukti-pn-administrasi"]);
    expect(hasilPanitera(false).lembar.blokTambahan).toEqual([]);
    expect(hasilPanitera(true).lembar.blokTambahan.map((r) => r.kunci)).toEqual(["pp-sidang", "pp-putusan"]);
    expect(hasilPanitera(true).lembar.blokTambahan.every((r) => r.tambahan)).toBe(true);
  });

  it("tabel Lembar memuat RHK, target usulan, realisasi, dasar, perilaku kerja, dan predikat manual", () => {
    const lembar = susunPaketSkpJabatan(hasilPanitera()).dokumen[0];
    const baris = lembar.tabel.baris;
    expect(lembar.judul).toBe("LEMBAR SKP PANITERA");
    expect(lembar.judulLengkap).toBe("Lembar SKP Panitera Triwulan II Tahun 2026");
    const pertama = baris[0];
    expect(pertama.rhk).toContain("penunjukan panitera pengganti dan jurusita");
    expect(pertama.indikator.startsWith("Kuantitas:")).toBe(true);
    expect(pertama.realisasi).toBe("2 Penunjukan");
    expect(pertama.sumber).toBe("SIPP");
    expect(pertama.dasar).toContain("2 penunjukan panitera pengganti dan jurusita tercatat di SIPP");
    expect(pertama.target).toBe("Belum ada target");
    // Persen berpenyebut: 1 dari 2 pada hari yang sama.
    const kualitas = baris[1];
    expect(kualitas.realisasi).toBe("50%");
    expect(kualitas.target).toBe("100% (usulan)");

    expect(baris.some((b) => b.rhk.startsWith("Tugas tambahan - "))).toBe(true);
    const perilaku = baris.filter((b) => ["Berorientasi Pelayanan", "Akuntabel", "Kompeten", "Harmonis", "Loyal", "Adaptif", "Kolaboratif"].includes(b.indikator));
    expect(perilaku).toHaveLength(7);
    expect(perilaku.every((b) => b.realisasi.startsWith("....") && b.dasar === "Diisi pejabat penilai")).toBe(true);
    expect(baris.some((b) => b.rhk === "PREDIKAT KINERJA PERIODIK")).toBe(true);
    // Nomor berurutan tanpa celah.
    expect(baris.map((b) => b.no)).toEqual(baris.map((_, i) => String(i + 1)));
    expect(lembar.catatan.join(" ")).toContain("USULAN ALETA");
  });

  it("indikator tak terbaca tampil — di Lembar, tidak 0", () => {
    const lembar = susunPaketSkpJabatan(hasilPanitera()).dokumen[0];
    const waktu = lembar.tabel.baris.find((b) => b.indikator.startsWith("Waktu:") && b.rhk === "");
    expect(waktu).toBeDefined();
    const belumTerbaca = lembar.tabel.baris.filter((b) => b.sumber !== "Isian" && b.realisasi === "—");
    expect(belumTerbaca.length).toBeGreaterThan(0);
    expect(lembar.tabel.baris.some((b) => b.realisasi === "0" || b.realisasi === "0%")).toBe(false);
  });

  it("bukti dukung: daftar kejadian, kalimat realisasi e-Kinerja, judul berperiode", () => {
    const h = hasilPanitera();
    const bukti = susunDokumenBuktiSkp(h.rincian[0], h);
    expect(bukti.kunci).toBe(kunciBuktiSkp("pn-penunjukan"));
    expect(bukti.judulLengkap).toBe("Rekap Penunjukan Panitera Pengganti dan Jurusita Triwulan II Tahun 2026");
    expect(bukti.indikator.map((i) => i.aspek)).toEqual(["Kuantitas", "Kualitas", "Waktu"]);
    expect(bukti.tabel.baris[0]).toMatchObject({ no: "1", nomor: "9/Pdt.G/2026/PA.Dgl", tanggal: "04/05/2026", keterangan: "Penunjukan PP dan JS" });
    const kalimat = kalimatRealisasiEkinerja(h.rincian[0], "Triwulan II Tahun 2026");
    expect(kalimat).toBe(
      "Kuantitas 2 Penunjukan, Kualitas 50%, dan Waktu 0,5 Hari berdasarkan Rekap Penunjukan Panitera Pengganti dan Jurusita Triwulan II Tahun 2026."
    );
    expect(bukti.catatan[0]).toContain(kalimat);
  });

  it("bukti dukung indikator isian memuat bukti isian, dan tanpa kejadian memberi catatan", () => {
    const h = hitungLembarSkp({
      jenis: "panitera",
      periode: PERIODE,
      pegawai: pegawai({ jabatanTambahan: [] }),
      pejabatPenilai: null,
      data: null,
      isian: [
        {
          id: "i1",
          userId: "u-panitera",
          periode: "tw2",
          tahun: 2026,
          kunciRhk: "pn-administrasi",
          kunciIndikator: "pn-administrasi-kuantitas",
          nilai: 12,
          nilaiTeks: "",
          catatan: "Rapat koordinasi",
          bukti: [{ judul: "Notulen rapat", rujukan: "berkas-1", tanggal: "2026-05-02" }],
          status: "disetujui",
          diisiOlehId: "u-panitera",
          diajukanPada: null,
          ditinjauOlehId: null,
          ditinjauPada: null,
          catatanTinjauan: "",
          dibuatPada: "2026-06-01T00:00:00.000Z",
          diperbaruiPada: "2026-06-01T00:00:00.000Z",
        },
      ],
      dihitungPada: DIHITUNG,
    });
    const administrasi = susunDokumenBuktiSkp(h.rincian[1], h);
    expect(administrasi.indikator[0].realisasi).toBe("12 Kegiatan");
    expect(administrasi.tabel.baris[0]).toMatchObject({ nomor: "Notulen rapat", daftar: "Isian manual", keterangan: "Bukti isian: berkas-1" });
    const penunjukan = susunDokumenBuktiSkp(h.rincian[0], h);
    expect(penunjukan.tabel.baris).toHaveLength(0);
    expect(penunjukan.catatan.join(" ")).toContain("diisi manual pegawai");
    // Penilai kosong menjadi titik-titik, bukan tebakan.
    const paket = susunPaketSkpJabatan(h);
    expect(paket.identitasTambahan?.[0]).toEqual({ label: "Pejabat Penilai", nilai: ".................................." });
  });

  it("daftar dokumen untuk menu", () => {
    const daftar = daftarDokumenSkpJabatan(hasilPanitera());
    expect(daftar[0]).toEqual({ kunci: KUNCI_LEMBAR_SKP, judul: "Lembar SKP Panitera" });
    expect(daftar.map((d) => d.kunci)).toContain("bukti-pp-sidang");
  });
});

describe("naskah cetak Lembar SKP", () => {
  const opsi = { instansi: INSTANSI_CONTOH, tanggalTandaTangan: "2026-07-06", sebutanOrang: sebutanOrangSkp("panitera") };

  it("tanda tangan kiri pegawai, kanan Pejabat Penilai Kinerja; identitas memuat penilai", () => {
    const paket = susunPaketSkpJabatan(hasilPanitera());
    const naskah = susunNaskahEvidenSkp(paket, paket.dokumen[0], opsi);
    expect(naskah.tandaTangan.kanan.atas).toContain("Pejabat Penilai Kinerja,");
    expect(naskah.tandaTangan.kanan.atas).not.toContain("Mengetahui,");
    expect(naskah.tandaTangan.kanan.nama).toBe("Ketua Uji, S.H.I.");
    expect(naskah.tandaTangan.kanan.nip).toBe("NIP. 19750505 200112 1 002");
    expect(naskah.tandaTangan.kiri.atas.at(-1)).toBe("Pegawai yang bersangkutan,");
    expect(naskah.tandaTangan.kiri.nama).toBe("Panitera Uji, S.H.");
    const label = naskah.identitas.map((i) => i.label);
    expect(label).toEqual(["Nama", "NIP", "Pangkat/Golongan", "Jabatan", "Unit Kerja", "Pejabat Penilai", "NIP Pejabat Penilai", "Jabatan Penilai"]);
    expect(naskah.indikator).toBeNull();
    expect(naskah.tabel.kolom.length).toBe(7);
  });

  it("bukti dukung membawa RHK pada identitas dan kalimat realisasi pada catatan", () => {
    const h = hasilPanitera();
    const paket = susunPaketSkpJabatan(h);
    const naskah = susunNaskahEvidenSkp(paket, paket.dokumen[1], opsi);
    expect(naskah.identitas.at(-1)?.label).toBe("Rencana Hasil Kerja");
    expect(naskah.indikator?.baris).toHaveLength(3);
    expect(naskah.catatan[0]).toContain("berdasarkan Rekap Penunjukan Panitera Pengganti dan Jurusita Triwulan II Tahun 2026");
  });

  it("eviden hakim lama tidak berubah: tetap 'Mengetahui,' dan tanpa baris identitas tambahan", () => {
    const paket: PaketEvidenSkp = {
      periode: PERIODE,
      orang: { id: "31", nama: "Hakim Uji", nip: null, jabatan: "Hakim", pangkatGolongan: null },
      ketua: { nama: "Ketua Uji", nip: null, jabatan: "Ketua Pengadilan Agama Donggala", sumber: "uji" },
      dokumen: [],
      galat: [],
      dihitungPada: DIHITUNG,
    };
    const dokumen = susunPaketSkpJabatan(hasilPanitera()).dokumen[1];
    const naskah = susunNaskahEvidenSkp(paket, dokumen, { ...opsi, sebutanOrang: "Hakim" });
    expect(naskah.tandaTangan.kanan.atas).toContain("Mengetahui,");
    expect(naskah.identitas.map((i) => i.label)).toEqual(["Nama", "NIP", "Pangkat/Golongan", "Jabatan", "Unit Kerja", "Rencana Hasil Kerja"]);
  });

  it("nama berkas memakai label periode bulanan", () => {
    const bulan = susunPeriodeSkpJabatan("b03", 2026);
    const dokumen = { judulLengkap: "Lembar SKP Panitera Bulan Maret Tahun 2026" };
    expect(namaBerkasEvidenSkp({ periode: bulan, judulLengkap: dokumen.judulLengkap, nama: "Panitera Uji, S.H.", format: "pdf" })).toBe(
      "Eviden SKP 2026 - Maret - Lembar SKP Panitera - Panitera Uji, S.H.pdf"
    );
    expect(namaZipEvidenSkp({ periode: bulan, nama: "Panitera Uji", format: "xlsx" })).toBe(
      "Eviden SKP 2026 - Maret - Semua dokumen (Excel) - Panitera Uji.zip"
    );
  });
});

describe("Lembar SKP lewat penggambar PDF, Excel, dan Word yang ada", () => {
  it("ketiganya menghasilkan berkas yang dapat dibuka, dengan isi Lembar", async () => {
    const paket = susunPaketSkpJabatan(hasilPanitera());
    const naskah = susunNaskahEvidenSkp(paket, paket.dokumen[0], {
      instansi: INSTANSI_CONTOH,
      tanggalTandaTangan: "2026-07-06",
      sebutanOrang: "Pegawai",
    });
    const pdf = await gambarPdfEvidenSkp(naskah);
    const halaman = await bacaPdfUji(Buffer.from(pdf.berkas));
    const teks = halaman.map((h) => h.teks).join("\n");
    expect(teks).toContain("LEMBAR SKP PANITERA");
    expect(teks).toContain("Pejabat Penilai Kinerja");
    expect(teks).toContain("PERILAKU KERJA");

    const xlsx = bacaZip(Buffer.from(await gambarXlsxEvidenSkp(naskah)));
    expect([...xlsx.keys()].some((n) => n.startsWith("xl/worksheets/"))).toBe(true);
    const docx = bacaZip(Buffer.from(await gambarDocxEvidenSkp(naskah)));
    expect(docx.get("word/document.xml")?.toString("utf8")).toContain("Pejabat Penilai Kinerja");
  }, 60000);
});

describe("SKP Pimpinan = SKP Hakim + RHK pimpinan", () => {
  const dataHakim: DataEvidenSkp = {
    ok: true,
    peran: "hakim",
    periode: PERIODE,
    orang: { id: "85", nama: "Ketua Uji, S.H.I.", nip: "197505052001121002", jabatan: "Hakim Madya Pratama", pangkatGolongan: "Pembina / IV.a" },
    ketua: { nama: "Ketua Uji, S.H.I.", nip: "197505052001121002", jabatan: "Ketua Pengadilan Agama Donggala", sumber: "uji" },
    aturanPeriode: "Aturan periode uji.",
    baris: [],
    catatan: [],
    galat: [],
    dihitungPada: DIHITUNG,
  };

  const hasilKetua = () =>
    hitungLembarSkp({
      jenis: "pimpinan",
      periode: PERIODE,
      pegawai: pegawai({ userId: "u-ketua", nama: "Ketua Uji, S.H.I.", jabatanUtama: "ketua", jabatanTambahan: [] }),
      pejabatPenilai: { nama: "Ketua PTA Uji", nip: null, jabatan: "Ketua Pengadilan Tinggi Agama Palu" },
      data: {
        ok: true,
        periode: PERIODE,
        jabatan: "ketua",
        akun: [
          {
            username: "ketua",
            userIdSipp: "85",
            nama: "Ketua",
            grup: [10],
            jabatanDugaan: "ketua",
            aktif: true,
            fakta: [
              baca("pmh-kuantitas", [
                k({ tanggalAcuan: "2026-05-04", tanggal: "2026-05-04" }),
                k({ tanggalAcuan: "2026-05-04", tanggal: "2026-05-05" }),
              ]),
            ],
          },
        ],
        catatan: [],
        galat: [],
        dihitungPada: DIHITUNG,
      },
      dihitungPada: DIHITUNG,
    });

  it("memuat Lembar Pimpinan, seluruh dokumen hakim, lalu bukti RHK pimpinan; penilai di kanan", () => {
    const h = hasilKetua();
    expect(h.lembar.jenis).toBe("pimpinan");
    expect(h.lembar.rhk.map((r) => r.kunci)).toEqual(["pmh", "phs"]);
    const paket = susunPaketSkpPimpinan(h, dataHakim);
    const kunci = paket.dokumen.map((d) => d.kunci);
    expect(kunci[0]).toBe(KUNCI_LEMBAR_SKP);
    for (const d of DAFTAR_DOKUMEN_EVIDEN_SKP) expect(kunci).toContain(d.kunci);
    expect(kunci.slice(-2)).toEqual(["bukti-pmh", "bukti-phs"]);
    expect(paket.dokumen[0].judulLengkap).toBe("Lembar SKP Pimpinan Triwulan II Tahun 2026");
    expect(paket.orang.jabatan).toBe("Ketua");
    expect(paket.ketua?.nama).toBe("Ketua PTA Uji");
    expect(paket.sebutanKanan).toBe("Pejabat Penilai Kinerja,");

    const naskah = susunNaskahEvidenSkp(paket, paket.dokumen[0], {
      instansi: INSTANSI_CONTOH,
      tanggalTandaTangan: "2026-07-06",
      sebutanOrang: sebutanOrangSkp("pimpinan"),
    });
    expect(naskah.tandaTangan.kanan.nama).toBe("Ketua PTA Uji");
    expect(naskah.tandaTangan.kanan.atas).toContain("Pejabat Penilai Kinerja,");
    expect(naskah.tandaTangan.kiri.atas.at(-1)).toBe("Pimpinan yang bersangkutan,");
  });

  it("Lembar Pimpinan memuat RHK pimpinan (PMH/PHS) dan RHK hakim dari dokumen hakim", () => {
    const paket = susunPaketSkpPimpinan(hasilKetua(), dataHakim);
    const baris = paket.dokumen[0].tabel.baris;
    expect(baris[0].rhk).toContain("penunjukan majelis hakim");
    expect(baris[0].realisasi).toBe("2 Perkara");
    // PMH di hari pendaftaran: 1 dari 2.
    expect(baris[1].realisasi).toBe("50%");
    expect(baris[1].dasar).toContain("1 dari 2");
    // RHK hakim ikut (bunyi dari SKP_HAKIM_2026).
    expect(baris.some((b) => b.rhk.includes("Penyelesaian penerimaan perkara yang pasti"))).toBe(true);
    // PHS tanpa data terbaca = —, bukan 0.
    const phs = baris.find((b) => b.indikator.startsWith("Kuantitas: Jumlah penetapan hari sidang"));
    expect(phs?.realisasi).toBe("—");
  });

  it("Wakil Ketua memakai RHK pimpinan yang sama", () => {
    const h = hitungLembarSkp({
      jenis: "pimpinan",
      periode: PERIODE,
      pegawai: pegawai({ jabatanUtama: "wakil-ketua", jabatanTambahan: [] }),
      pejabatPenilai: null,
      data: null,
      dihitungPada: DIHITUNG,
    });
    expect(h.lembar.rhk.map((r) => r.kunci)).toEqual(["pmh", "phs"]);
    expect(susunPaketSkpPimpinan(h, dataHakim).orang.jabatan).toBe("Wakil Ketua");
  });
});
