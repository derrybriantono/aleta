"use client";

import { useCallback, useEffect, useState } from "react";

import { ChevronDown } from "lucide-react";

import { TombolUnduh } from "@/components/portal/aleta-ecourt-sidang";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

/**
 * Status satu perkara.
 *
 * ============================================================================
 * MENCARI DULU, BARU MEMBUKA
 * ============================================================================
 *
 * Petugas mengingat "419", bukan nomor lengkapnya. Angka itu dapat cocok pada
 * beberapa perkara - Pdt.G, Pdt.P, tahun berbeda - jadi pencarian menampilkan
 * daftarnya untuk dipilih. Membuka yang pertama begitu saja berarti menampilkan
 * perkara yang keliru tanpa ada yang menyadarinya.
 */

/** Saringan pencarian. Kosong seluruhnya berarti belum ada yang dicari. */
type Saringan = {
  cari: string;
  jenisPerkara: string;
  status: string;
  tahun: string;
  alurPerkaraId: number;
  namaPihak: string;
  petugas: string;
  // --- pencarian mendalam ---
  hakim: string;
  panitera: string;
  jurusita: string;
  statusPutusan: string;
  pertimbangan: string;
  amar: string;
  verstek: string;
  alamatPihak: string;
  kua: string;
  relaas: string;
  putusSejak: string;
  putusSampai: string;
  umur: string;
  ecourt: string;
};

const SARINGAN_KOSONG: Saringan = {
  cari: "",
  jenisPerkara: "",
  status: "",
  tahun: "",
  alurPerkaraId: 0,
  namaPihak: "",
  petugas: "",
  hakim: "",
  panitera: "",
  jurusita: "",
  statusPutusan: "",
  pertimbangan: "",
  amar: "",
  verstek: "",
  alamatPihak: "",
  kua: "",
  relaas: "",
  putusSejak: "",
  putusSampai: "",
  umur: "",
  ecourt: "",
};

/**
 * Keadaan relaas. Kuncinya harus sama persis dengan yang dikenali bot -
 * kunci yang tidak dikenali akan diabaikan diam-diam, dan petugas melihat
 * hasil yang sama seolah saringannya tidak berpengaruh.
 */
const PILIHAN_RELAAS = [
  { kunci: "retur", label: "Relaas retur" },
  { kunci: "gagal", label: "Pemanggilan gagal" },
  { kunci: "ghaib", label: "Dipanggil sebagai ghaib" },
  { kunci: "bertemu", label: "Bertemu langsung" },
  { kunci: "tanpa_relaas", label: "Belum ada relaas" },
];

/**
 * Umur perkara yang belum putus. Lima bulan adalah ambang SEMA 2/2014 -
 * pertanyaan yang ditanyakan pengawasan tiap bulan.
 */
const PILIHAN_UMUR = [
  { kunci: "lewat3bulan", label: "Belum putus, lewat 3 bulan" },
  { kunci: "lewat5bulan", label: "Belum putus, lewat 5 bulan (SEMA 2/2014)" },
];

/** Jenis putusan yang benar-benar ada di register. */
const PILIHAN_PUTUSAN = [
  "Dikabulkan",
  "Ditolak",
  "Tidak Dapat Diterima",
  "Dicabut",
  "Digugurkan",
  "Dicoret dari Register",
];

/** Kunci status yang dikenali bot - disalin agar layar dapat menampilkannya. */
const PILIHAN_STATUS = [
  { kunci: "berjalan", label: "Masih berjalan" },
  { kunci: "putus", label: "Sudah putus" },
  { kunci: "belum_minutasi", label: "Putus, belum diminutasi" },
  { kunci: "sudah_minutasi", label: "Sudah diminutasi" },
  { kunci: "belum_bht", label: "Putus, belum BHT" },
  { kunci: "sudah_bht", label: "Sudah BHT" },
  { kunci: "cabut", label: "Dicabut" },
  { kunci: "gugur", label: "Gugur" },
];

const PILIHAN_ALUR = [
  { id: 15, label: "Gugatan (Pdt.G)" },
  { id: 16, label: "Permohonan (Pdt.P)" },
  { id: 17, label: "Gugatan Sederhana (Pdt.G.S)" },
  { id: 122, label: "Jinayah (JN)" },
];
type Ditemukan = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  sudahPutus: boolean;
  tanggalPutusan: string;
  tanggalMinutasi?: string;
  tanggalBht?: string;
  statusPutusan?: string;
  /**
   * Mengapa perkara ini muncul.
   *
   * Saat yang dicari nama juru sita, alamat desa, atau sebuah kalimat di
   * pertimbangan hukum, tidak satu pun keterangan lain di kartu ini
   * menyebut kata yang diketik - dan daftar berisi dua puluh nomor perkara
   * tidak dapat dibedakan satu sama lain.
   */
  cocok?: Array<{ medan: string; nilai: string }>;
};

type ButirNilai = {
  kunci: string;
  label: string;
  keterangan: string;
  dasar: string;
  bobot: number;
  bagian: number;
  nilai: number;
  catatan: string;
  belumDinilai: boolean;
  /**
   * Butir yang BELUM WAKTUNYA dinilai - perkara belum diputus, sidang belum
   * ada yang berlalu. Tidak ikut membagi skor, dan tidak boleh ditampilkan
   * sebagai kekurangan: yang merah di sini akan dibaca sebagai kesalahan
   * pengadilan atas pekerjaan yang belum jatuh tempo.
   *
   * Boleh tidak ada - bot versi lama belum mengirimkannya.
   */
  dihitung?: boolean;
  belumBerlaku?: boolean;
};

type Status = {
  identitas: {
    perkaraId: string;
    nomorPerkara: string;
    jenisPerkara: string;
    jenisPerkaraLengkap: string;
    tanggalDaftar: string;
  };
  umur: {
    hariBersih: number | null;
    hariMediasi: number;
    hariBerjalan: number | null;
    bulanBerjalan: number | null;
    sudahPutus: boolean;
    /**
     * "putus", "dicabut", atau "gugur". Ketiganya sama-sama berakhir dengan
     * tanggal putusan - yang berbeda hanya sebutannya bagi yang membaca.
     *
     * Boleh tidak ada - bot versi lama belum mengirimkannya.
     */
    sebabSelesai?: string;
    hariMinutasi: number | null;
  };
  majelis: Array<{ kode: string; nama: string; jabatan: string }>;
  panitera: Array<{ kode: string; nama: string }>;
  jurusita: Array<{ kode: string; nama: string }>;
  saksi: { ada: boolean; jumlahSaksi: number; jumlahKeterangan: number };
  pihak: Array<{ nama: string; pihakKe: number | null; jenis: string; adaNomor: boolean; nomorSamar: string }>;
  identitasPihak: {
    jenisPerkara: string;
    kumulasi: string[];
    adaKumulasi: boolean;
    adaKuasa: boolean;
    kuasaPenggugat: boolean;
    kuasaTergugat: boolean;
  } | null;
  jadwal: Array<{
    sidangId: string;
    tanggalSidang: string;
    jamSidang: string;
    agenda: string;
    ruangan: string;
    ditunda: boolean;
    alasanDitunda: string;
    urutanSidang: number;
    adaBas: boolean;
  }>;
  penundaan: Array<{ tanggalSidang: string; agenda: string; alasanDitunda: string }>;
  putusan: {
    sudahPutus: boolean;
    tanggalPutusan: string;
    statusPutusan: string;
    verstek: boolean;
    tanggalMinutasi: string;
    tanggalBht: string;
    adaBerkasPutusan: boolean;
    adaBerkasAnonim: boolean;
    aktaCerai: { nomor: string; tanggal: string; diserahkanPihak1: string; diserahkanPihak2: string } | null;
    upayaHukum: Array<{ jenis: string; tanggal: string }>;
  } | null;
  biaya: {
    panjar: number;
    terpakai: number;
    sisa: number;
    rincian: Array<{ jenis: string; uraian: string; jumlah: number; tanggal: string }>;
  };
  dokumenEcourt: Array<{ documentKey: string; judulDokumen: string; statusVerifikasi: string }>;
  petitum: { ada: boolean; berkas?: string };
  // Relaas pelaksanaan panggilan pada perkara ini, apa adanya dari SIPP.
  // Berbeda dari nilaiRelaas yang sudah diolah untuk penilaian SK.
  relaas: Array<{
    id: string;
    sidangId: string;
    tanggalSidang: string;
    namaPihak: string;
    peran: string;
    tanggalRelaas: string;
    adaDokumen: boolean;
    adaResi: boolean;
  }>;
  dokumenSipp: Array<{ id: string; namaDokumen: string }>;
  lewatEcourt: boolean;
  penilaian: {
    skor: number;
    keadaan: "baik" | "perhatian" | "kurang";
    totalBobot: number;
    rinci: ButirNilai[];
    catatan: string;
  };
  /**
   * Garis waktu, jeda antar sidang, ketepatan input, dan ringkasan - dirakit
   * bot dari data yang sudah ada, tanpa kueri tambahan ke SIPP.
   *
   * Boleh tidak ada: bot versi lama belum mengirimkannya, dan layar tetap utuh
   * tanpa bagian ini.
   */
  analisa?: {
    garisWaktu: {
      terbaca: boolean;
      alasan: string;
      mulai?: string;
      akhir?: string;
      sebabAkhir?: string;
      totalHari?: number;
      panjangHari?: number;
      ambangHari?: number;
      ambangTampak?: boolean;
      titik: Array<{
        kunci: string;
        label: string;
        tanggal: string;
        hariKe: number;
        jenis: string;
        agenda?: string;
        ditunda?: boolean;
      }>;
    };
    jedaSidang: {
      terbaca: boolean;
      alasan: string;
      baris: Array<{ dari: string; ke: string; hari: number; alasan: string; jenis: string }>;
      rata: number | null;
      terpanjang: { dari: string; ke: string; hari: number; alasan: string; jenis: string } | null;
    };
    ketepatanInput: {
      terbaca: boolean;
      alasan: string;
      dasar?: string;
      terlambat: number;
      baris: Array<{
        kunci: string;
        label: string;
        tanggal: string;
        diinput: string;
        selisih: number;
        poin: number;
        poinMaksimal: number;
        sebutan: string;
      }>;
    };
    ringkasan: string[];
  };
  penanda: {
    ghaib: boolean | null;
    sumberGhaib: string[];
    instansi: Array<{
      kunci: string;
      label: string;
      pihak: Array<{ nama: string; peran: string; pekerjaan: string }>;
    }>;
    perluIzinAtasan: boolean;
    mafqud: boolean | null;
    tundaanPanjang: Array<{ dari: string; ke: string; hari: number; agenda: string }>;
    ambangMafqud: { hari: number; kali: number };
  };
  penetapanKembali: {
    terbaca: boolean;
    adaPenggantian: boolean;
    baris: Array<{
      jenis: string;
      penggantian: Array<{
        nama: string;
        masihAktif: boolean;
        tanggalTidakAktif: string;
        diperbaharuiPada: string;
        diperbaharuiOleh: string;
      }>;
    }>;
  };
  durasiMediasi: { terbaca: boolean; hari: number; alasan: string };
  nilaiRelaas: {
    terbaca: boolean;
    alasan: string;
    sumber: string;
    dariAudit?: boolean;
    nilaiLangsung?: number;
  };
  saksiRinci: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      nama: string;
      keterangan: string;
      diajukanOleh: string;
      alamat: string;
      isianTerisi: number;
      isianKurang: string[];
    }>;
    dikecualikan?: boolean;
  };
  ikrarTalak: {
    terbaca: boolean;
    alasan: string;
    ada: boolean;
    ikrarId?: string;
    penetapanMajelis?: string;
    majelis?: string;
    penetapanPp?: string;
    panitera?: string;
    penetapanJs?: string;
    jurusita?: string;
    penetapanSidang?: string;
    sidangPertama?: string;
    tanggalIkrar?: string;
    amar?: string;
    nomorSk?: string;
    adaBerkas?: boolean;
    statusId?: number | null;
    status?: string;
    sudahDiucapkan?: boolean;
  };
  putusanLengkap: {
    terbaca: boolean;
    ada: boolean;
    alasan?: string;
    tanggalPutusan?: string;
    statusPutusan?: string;
    amar?: string;
    amarAnonim?: string;
    sumberHukum?: string;
    faktorPrimer?: string;
    faktorSekunder?: string;
    qoblaBada?: string;
    statusNusyuz?: string;
  };
  arsipKeterangan: {
    terbaca: boolean;
    alasan: string;
    sudahDiarsipkan: boolean;
    berkasTerbaca?: boolean;
    baris: Array<{
      arsipId: string;
      tanggalInput: string;
      nomor: string;
      keterangan: string;
      oleh: string;
      adaBerkas: boolean;
    }>;
  };
  // Apakah putusannya benar-benar terbit di e-Court. null bila belum putus.
  putusanEcourt: {
    keadaan: string;
    sebutan: string;
    perluTindakan: boolean;
    keterangan: string;
    ecourt: {
      adaTab: boolean;
      adaBaris: boolean;
      nomorPutusan: string;
      nomorSalinan: string;
      tanggalPutusanTeks: string;
      tanggalBhtTeks: string;
      dokumenAda: boolean;
      dokumenJudul: string;
      diunggahOleh: string;
      tanggalUnggahTeks: string;
      paniteraNama: string;
      paniteraTte: boolean;
      paniteraTanggalTte: string;
      diperiksaPada: string;
    } | null;
  } | null;
  konseptor: {
    terbaca: boolean;
    alasan: string;
    // Terisi bila namanya berasal dari jejak audit, bukan dari tahapan
    // putusan - atau bila keduanya tidak menjawab.
    catatan?: string;
    dariAudit?: boolean;
    baris: Array<{
      pengguna: string;
      nama: string;
      namaTerbaca: boolean;
      tanggal: string;
      dariAudit?: boolean;
    }>;
  };
  delegasiMasuk: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      asal: string;
      tanggalDiunggah: string;
      tanggalDiterima: string;
      hariSampaiTerima: number | null;
    }>;
  };
  delegasiKeluar: {
    terbaca: boolean;
    alasan: string;
    baris: Array<{
      tujuan: string;
      tanggalPermohonan: string;
      tanggalSelesai: string;
      tanggalSidang: string;
      tanggalResi: string;
      hariSebelumSidang: number | null;
      panggilan: boolean;
      nilai: number | null;
      pelaksanaan: { tanggalRelaas: string; jurusita: string } | null;
    }>;
  };
  mediasi: {
    terbaca: boolean;
    alasan: string;
    jadwal?: Array<{
      tanggal: string;
      jam: string;
      sampaiJam: string;
      tempat: string;
      dihadiri: string;
      ditunda: boolean;
    }>;
    mediator?: Array<{
      nama: string;
      tanggalPenetapan: string;
      nomorSk: string;
      status: string;
      masihAktif: boolean;
    }>;
    kolomTersedia?: string[];
    baris: Array<{
      mediator: string;
      hasil: string;
      tanggalMulai: string;
      tanggalSelesai: string;
      lamaHari: number | null;
      lewatTenggang: boolean | null;
      jumlahPertemuan: number | null;
      jenisPenetapan: string;
      tanggalPenetapan: string;
      tanggalLaporan: string;
      tanggalKesepakatan: string;
      isiKesepakatan: string;
      nomorSk: string;
      statusMediator: string;
      kodeHasil: string;
      berhasil: boolean;
      lamaDariView: boolean;
      catatan: string;
      tanggalKeputusan: string;
    }>;
    lamaHariView?: number | null;
  };
  tahapan: {
    terbaca: boolean;
    alasan: string;
    tahap: TahapPerkara[];
  };
  upayaHukum: Array<{
    jenis: string;
    sebutan: string;
    tanggalPermohonan: string;
    tanggalPutusan: string;
    nomorPerkara: string;
    dicabut: boolean;
    gugur: boolean;
    tahapan: Array<{ kunci: string; label: string; tanggal: string; adaKolom: boolean }>;
    keterangan: {
      nomorPerkara?: string;
      pemohon?: string;
      statusPutusan?: string;
      keadaan?: string;
      majelis?: string;
      paniteraPengganti?: string;
      amar?: string;
      catatan?: string;
    };
    tahapTakDikenali: string[];
    kolomTersedia: string[];
  }>;
  penilaianSk: {
    rinci: UnsurSk[];
    unsurBelumTersambung: Array<{ kunci: string; label: string; catatan: string }>;
    dasar: string;
    catatan: string;
  };
};

/** Satu tahap perkara: kapan terjadi, dan kapan diinput ke SIPP. */
type TahapPerkara = {
  kunci: string;
  label: string;
  dasar: string;
  tanggal: string;
  diinput: string;
  terbaca: boolean;
  inputTerbaca: boolean;
  alasan: string;
  alasanInput: string;
  hariSejakAcuan: number | null;
  hariSampaiInput: number | null;
  acuan: string;
  dokumenId: string;
  adaBerkas: boolean;
  diinputOleh: string;
};

/** Satu unsur penilaian menurut SK Dirjen Badilag 048/2024. */
type UnsurSk = {
  kunci: string;
  label: string;
  aspek: "kinerja" | "input" | "kelengkapan" | "kesesuaian";
  pengurang: boolean;
  bobot: number;
  dasar: string;
  keterangan: string;
  poin: number | null;
  terbaca: boolean;
  catatan: string;
};

const ASPEK_SK: Array<{ kunci: UnsurSk["aspek"]; label: string; bobot: string }> = [
  { kunci: "kinerja", label: "Kinerja penanganan perkara", bobot: "50%" },
  { kunci: "input", label: "Input data SIPP", bobot: "40%" },
  { kunci: "kelengkapan", label: "Kelengkapan dokumen", bobot: "10%" },
  { kunci: "kesesuaian", label: "Kesesuaian (pengurang)", bobot: "-10%" },
];

function rupiah(nilai: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    nilai || 0
  );
}

/** Kartu angka besar - dipakai jajaran ringkasan di atas. */
function Angka({
  label,
  nilai,
  keterangan,
  nada,
}: {
  label: string;
  nilai: string;
  keterangan?: string;
  nada?: "baik" | "perhatian" | "kurang";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        nada === "baik"
          ? "border-emerald-300/60 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : nada === "perhatian"
            ? "border-amber-300/60 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10"
            : nada === "kurang"
              ? "border-rose-300/60 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10"
              : "bg-card"
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{nilai}</p>
      {keterangan ? <p className="text-sm text-muted-foreground">{keterangan}</p> : null}
    </div>
  );
}

/**
 * Satu bagian keterangan, dapat diciutkan.
 *
 * ============================================================================
 * KENAPA DAPAT DICIUTKAN
 * ============================================================================
 *
 * Layar ini memuat belasan bagian, dan tidak ada satu orang pun yang
 * memerlukan semuanya sekaligus. Panitera memeriksa berkas; kasir memeriksa
 * panjar; hakim memeriksa tahapan. Yang tidak sedang dipakai hanya membuat
 * yang dipakai berada jauh di bawah.
 *
 * Keadaan ciut disimpan di peramban masing-masing, sehingga tiap orang
 * mendapatkan susunan yang ia tinggalkan - bukan susunan orang lain.
 */
function Bagian({
  judul,
  children,
  kunci,
  ciutBawaan = false,
  keterangan = "",
}: {
  judul: string;
  children: React.ReactNode;
  kunci?: string;
  ciutBawaan?: boolean;
  keterangan?: string;
}) {
  const kunciSimpan = kunci ? `aleta.status-perkara.ciut.${kunci}` : "";

  const [ciut, setCiut] = useState(() => {
    if (!kunciSimpan) return ciutBawaan;
    try {
      const tersimpan = window.localStorage.getItem(kunciSimpan);
      return tersimpan === null ? ciutBawaan : tersimpan === "1";
    } catch {
      // Peramban yang memblokir penyimpanan situs tetap harus dapat memakai
      // layar ini - hanya keadaan ciutnya yang tidak diingat.
      return ciutBawaan;
    }
  });

  const ganti = () => {
    const baru = !ciut;
    setCiut(baru);
    if (!kunciSimpan) return;
    try {
      window.localStorage.setItem(kunciSimpan, baru ? "1" : "0");
    } catch {
      /* lihat catatan di atas */
    }
  };

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={ganti}
        aria-expanded={!ciut}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-muted/40"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            ciut && "-rotate-90"
          )}
          aria-hidden="true"
        />
        <h5 className="flex-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {judul}
        </h5>
        {keterangan ? (
          <span className="text-sm font-normal normal-case text-muted-foreground">{keterangan}</span>
        ) : null}
      </button>
      {ciut ? null : <div className="border-t px-3 py-2.5">{children}</div>}
    </section>
  );
}

/**
 * @param nomorAwal perkara yang langsung dibuka, dikirim layar Jadwal Sidang.
 */
export function AletaEcourtStatusPerkara({ nomorAwal = "" }: { nomorAwal?: string } = {}) {
  const [cari, setCari] = useState(nomorAwal);
  const [saringan, setSaringan] = useState<Saringan>(SARINGAN_KOSONG);
  const [saringanTampil, setSaringanTampil] = useState(false);
  const [hasilCari, setHasilCari] = useState<Ditemukan[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const buka = useCallback(async (nomorPerkara: string) => {
    setMemuat(true);
    setGalat("");
    setPesan("");
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca status perkara."));

      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }
      if (!data.status) {
        setGalat(
          String(data.alasan) === "perkara_tidak_ditemukan"
            ? "Perkara tidak ditemukan di SIPP."
            : String(data.alasan || "Tidak dapat dibaca.")
        );
        return;
      }
      setStatus(data.status as Status);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca status perkara.");
    } finally {
      setMemuat(false);
    }
  }, []);

  // Datang dari layar Jadwal Sidang dengan nomor perkara: langsung dibuka,
  // tanpa menunggu penggunanya menekan Cari lagi.
  useEffect(() => {
    if (!nomorAwal) return;
    const timer = window.setTimeout(() => {
      void buka(nomorAwal);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nomorAwal, buka]);

  const jalankanCari = useCallback(async () => {
    const kata = cari.trim();

    // Pencarian berjalan bila ADA salah satu isian. Menuntut kata cari membuat
    // "cerai gugat 2025 yang belum putus" mustahil ditanyakan - padahal itu
    // justru pertanyaan yang sering datang dari pimpinan.
    const kueri = new URLSearchParams();
    if (kata) kueri.set("cari", kata);
    if (saringan.jenisPerkara.trim()) kueri.set("jenisPerkara", saringan.jenisPerkara.trim());
    if (saringan.status) kueri.set("status", saringan.status);
    if (saringan.tahun.trim()) kueri.set("tahun", saringan.tahun.trim());
    if (saringan.alurPerkaraId > 0) kueri.set("alurPerkaraId", String(saringan.alurPerkaraId));
    if (saringan.namaPihak.trim()) kueri.set("namaPihak", saringan.namaPihak.trim());
    if (saringan.petugas.trim()) kueri.set("petugas", saringan.petugas.trim());
    if (saringan.hakim.trim()) kueri.set("hakim", saringan.hakim.trim());
    if (saringan.panitera.trim()) kueri.set("panitera", saringan.panitera.trim());
    if (saringan.jurusita.trim()) kueri.set("jurusita", saringan.jurusita.trim());
    if (saringan.statusPutusan.trim()) kueri.set("statusPutusan", saringan.statusPutusan.trim());
    if (saringan.pertimbangan.trim()) kueri.set("pertimbangan", saringan.pertimbangan.trim());
    if (saringan.amar.trim()) kueri.set("amar", saringan.amar.trim());
    if (saringan.verstek.trim()) kueri.set("verstek", saringan.verstek.trim());
    if (saringan.alamatPihak.trim()) kueri.set("alamatPihak", saringan.alamatPihak.trim());
    if (saringan.kua.trim()) kueri.set("kua", saringan.kua.trim());
    if (saringan.relaas.trim()) kueri.set("relaas", saringan.relaas.trim());
    if (saringan.putusSejak.trim()) kueri.set("putusSejak", saringan.putusSejak.trim());
    if (saringan.putusSampai.trim()) kueri.set("putusSampai", saringan.putusSampai.trim());
    if (saringan.umur.trim()) kueri.set("umur", saringan.umur.trim());
    if (saringan.ecourt.trim()) kueri.set("ecourt", saringan.ecourt.trim());
    kueri.set("batas", "100");

    // Hanya batas yang terisi berarti tidak ada satu pun syarat.
    if ([...kueri.keys()].length <= 1) {
      setPesan("Isi sekurangnya satu kotak pencarian atau satu saringan.");
      return;
    }

    setMemuat(true);
    setGalat("");
    setPesan("");
    setStatus(null);
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?${kueri.toString()}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal mencari perkara."));

      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }

      const daftar = (data.perkara ?? []) as Ditemukan[];
      setHasilCari(daftar);

      if (daftar.length === 0) {
        setPesan("Tidak ada perkara yang cocok dengan pencarian ini.");
      } else if (daftar.length === 1) {
        // Hanya satu yang cocok: tidak ada yang perlu dipilih.
        await buka(daftar[0].nomorPerkara);
      }
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mencari perkara.");
    } finally {
      setMemuat(false);
    }
  }, [cari, saringan, buka]);


  return (
    <Card>
      {/* ==================================================================
          KEPALA DIRAPATKAN
          ==================================================================

          Judul halaman di atas kartu ini sudah menyebutkan ALETA e-Court
          beserta keterangannya. Kepala setinggi bawaan mengulang ruang itu
          sekali lagi, dan keterangan tiga baris di sini mendorong kotak
          pencarian - satu-satunya hal yang dipakai orang di layar ini -
          hampir keluar dari lipatan layar.

          Keterangannya TIDAK dipotong, hanya dikecilkan: yang baru pertama
          membuka layar ini tetap perlu tahu bahwa nomornya boleh diketik
          angkanya saja, dan sejauh mana isinya. */}
      <CardHeader className="gap-1 p-4 pb-2 sm:p-5 sm:pb-2">
        <CardTitle className="text-base sm:text-lg">Status Perkara</CardTitle>
        <CardDescription className="text-sm">
          Masukkan nomor perkara — cukup angkanya saja, atau cari dengan nama pihak dan jenis
          perkara lewat Saringan lain. Seluruh keadaan perkara ditampilkan: sejak didaftarkan,
          siapa yang menanganinya, sudah sampai mana, sampai produk pengadilannya.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5 text-[11px] font-medium">
            Nomor perkara
            <Input
              placeholder="419, 419/Pdt.G/2026/PA.Dgl, atau nama pihak"
              value={cari}
              onChange={(peristiwa) => setCari(peristiwa.target.value)}
              onKeyDown={(peristiwa) => {
                if (peristiwa.key === "Enter") void jalankanCari();
              }}
              className="w-72"
            />
          </label>
          <Button size="sm" disabled={memuat} onClick={() => void jalankanCari()}>
            {memuat ? "Mencari…" : "Cari"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSaringanTampil((sebelumnya) => !sebelumnya)}
          >
            {saringanTampil ? "Sembunyikan saringan" : "Saringan lain"}
          </Button>
          {saringanTampil ? (
            <Button size="sm" variant="ghost" onClick={() => setSaringan(SARINGAN_KOSONG)}>
              Kosongkan
            </Button>
          ) : null}
        </div>

        {/* ==================================================================
            SARINGAN LAIN
            ==================================================================

            Disembunyikan sampai diminta. Yang datang ke layar ini sembilan dari
            sepuluh kali hanya membawa nomor perkara; menghadapkan mereka pada
            tujuh kotak sekaligus memperlambat pekerjaan yang paling sering.

            Seluruh saringan boleh dipakai TANPA nomor perkara - itulah cara
            menjawab "cerai gugat 2025 yang belum putus ada berapa". */}
        {saringanTampil ? (
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Nama pihak
              <Input
                placeholder="nama penggugat, tergugat, pemohon…"
                value={saringan.namaPihak}
                onChange={(e) => setSaringan((x) => ({ ...x, namaPihak: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Jenis perkara
              <Input
                placeholder="Cerai Gugat, Isbat Nikah…"
                value={saringan.jenisPerkara}
                onChange={(e) => setSaringan((x) => ({ ...x, jenisPerkara: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Keadaan perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.status}
                onChange={(e) => setSaringan((x) => ({ ...x, status: e.target.value }))}
              >
                <option value="">Semua keadaan</option>
                {PILIHAN_STATUS.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Alur perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={String(saringan.alurPerkaraId || "")}
                onChange={(e) =>
                  setSaringan((x) => ({ ...x, alurPerkaraId: Number(e.target.value) || 0 }))
                }
              >
                <option value="">Semua alur</option>
                {PILIHAN_ALUR.map((pilihan) => (
                  <option key={pilihan.id} value={String(pilihan.id)}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Tahun pendaftaran
              <Input
                placeholder="2025"
                inputMode="numeric"
                value={saringan.tahun}
                onChange={(e) => setSaringan((x) => ({ ...x, tahun: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
              Petugas (hakim, panitera, atau juru sita)
              <Input
                placeholder="nama petugas"
                value={saringan.petugas}
                onChange={(e) => setSaringan((x) => ({ ...x, petugas: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            {/* ================================================================
                PENCARIAN MENDALAM
                ================================================================

                Dipisahkan garis dan judulnya sendiri, bukan disambung ke
                grid di atas. Enam belas kotak sederajat tanpa pengelompokan
                membuat yang paling sering dipakai - nama pihak, jenis
                perkara - tenggelam di antara yang paling jarang.

                "Ba'da dukhul" dan "qabla dukhul" TIDAK punya kolom sendiri
                di SIPP, dan tidak satu pun muncul di amar putusan. Keduanya
                tertulis di dalam pertimbangan hukum - karena itu dicari
                lewat isian isi pertimbangan, bukan lewat saklar tersendiri
                yang hasilnya selalu kosong. */}
            <div className="sm:col-span-2 xl:col-span-4">
              <p className="border-t pt-3 text-sm font-semibold text-muted-foreground">
                Pencarian mendalam
              </p>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Hakim
              <Input
                placeholder="nama hakim"
                value={saringan.hakim}
                onChange={(e) => setSaringan((x) => ({ ...x, hakim: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Panitera Pengganti
              <Input
                placeholder="nama panitera pengganti"
                value={saringan.panitera}
                onChange={(e) => setSaringan((x) => ({ ...x, panitera: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Juru Sita
              <Input
                placeholder="nama juru sita"
                value={saringan.jurusita}
                onChange={(e) => setSaringan((x) => ({ ...x, jurusita: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Alamat pihak
              <Input
                placeholder="desa, kecamatan…"
                value={saringan.alamatPihak}
                onChange={(e) => setSaringan((x) => ({ ...x, alamatPihak: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              KUA tempat nikah
              <Input
                placeholder="KUA Banawa…"
                value={saringan.kua}
                onChange={(e) => setSaringan((x) => ({ ...x, kua: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Isi pertimbangan hukum
              <Input
                placeholder="ba'da dukhul, nusyuz…"
                value={saringan.pertimbangan}
                onChange={(e) => setSaringan((x) => ({ ...x, pertimbangan: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Isi amar putusan
              <Input
                placeholder="kata dalam amar…"
                value={saringan.amar}
                onChange={(e) => setSaringan((x) => ({ ...x, amar: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jalankanCari();
                }}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Jenis putusan
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.statusPutusan}
                onChange={(e) => setSaringan((x) => ({ ...x, statusPutusan: e.target.value }))}
              >
                <option value="">Semua jenis putusan</option>
                {PILIHAN_PUTUSAN.map((nama) => (
                  <option key={nama} value={nama}>
                    {nama}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Verstek
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.verstek}
                onChange={(e) => setSaringan((x) => ({ ...x, verstek: e.target.value }))}
              >
                <option value="">Verstek maupun bukan</option>
                <option value="ya">Putusan verstek</option>
                <option value="tidak">Bukan verstek</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Keadaan relaas
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.relaas}
                onChange={(e) => setSaringan((x) => ({ ...x, relaas: e.target.value }))}
              >
                <option value="">Semua keadaan relaas</option>
                {PILIHAN_RELAAS.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Rentang tanggal PUTUSAN - terpisah dari rentang pendaftaran.
                "Perkara yang diputus bulan ini" ditanyakan tiap awal bulan
                untuk laporan, dan sebelumnya tidak dapat ditanyakan sama
                sekali. */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Putus sejak
              <Input
                type="date"
                value={saringan.putusSejak}
                onChange={(e) => setSaringan((x) => ({ ...x, putusSejak: e.target.value }))}
              />
            </label>

            {/* Umur perkara - pertanyaan pengawasan yang paling sering, dan
                sebelumnya tidak dapat ditanyakan sama sekali. */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Umur perkara
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.umur}
                onChange={(e) => setSaringan((x) => ({ ...x, umur: e.target.value }))}
              >
                <option value="">Semua umur</option>
                {PILIHAN_UMUR.map((pilihan) => (
                  <option key={pilihan.kunci} value={pilihan.kunci}>
                    {pilihan.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Cara pendaftaran
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={saringan.ecourt}
                onChange={(e) => setSaringan((x) => ({ ...x, ecourt: e.target.value }))}
              >
                <option value="">e-Court maupun meja</option>
                <option value="ya">Lewat e-Court</option>
                <option value="tidak">Didaftarkan di meja</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              Putus sampai
              <Input
                type="date"
                value={saringan.putusSampai}
                onChange={(e) => setSaringan((x) => ({ ...x, putusSampai: e.target.value }))}
              />
            </label>
          </div>
        ) : null}

        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}

        {/* Daftar pilihan hanya muncul bila memang ada lebih dari satu. */}
        {hasilCari.length > 1 && !status ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {hasilCari.length} perkara cocok — pilih salah satu:
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {hasilCari.map((item) => (
                <button
                  key={item.nomorPerkara}
                  type="button"
                  onClick={() => void buka(item.nomorPerkara)}
                  className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <p className="font-medium">{item.nomorPerkara}</p>
                  <p className="text-sm text-muted-foreground">{item.jenisPerkara}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Daftar {item.tanggalDaftar || "—"}
                    {item.sudahPutus ? ` · putus ${item.tanggalPutusan}` : " · belum putus"}
                  </p>

                  {/* APA yang cocok, bukan sekadar bahwa ia cocok.

                      Tanpa ini, mencari nama juru sita menghasilkan dua
                      puluh kartu yang tidak satu pun menyebut nama itu -
                      dan satu-satunya cara memastikan adalah membuka
                      perkaranya satu per satu. */}
                  {item.cocok && item.cocok.length > 0 ? (
                    <div className="mt-2 space-y-1 border-t pt-2">
                      {item.cocok.map((satu) => (
                        <p key={satu.medan} className="text-xs leading-snug">
                          <span className="font-medium text-muted-foreground">{satu.medan}: </span>
                          <span className="text-foreground">{satu.nilai}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {status ? <IsiStatus status={status} onKembali={() => setStatus(null)} /> : null}
      </CardContent>
    </Card>
  );
}

function IsiStatus({ status, onKembali }: { status: Status; onKembali: () => void }) {
  const sidangBerikut = status.jadwal.find(
    (x) => x.tanggalSidang >= new Date().toISOString().slice(0, 10)
  );
  const sidangTerakhir = status.jadwal[status.jadwal.length - 1];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{status.identitas.nomorPerkara}</h3>
          <p className="text-sm text-muted-foreground">
            {status.identitas.jenisPerkaraLengkap || status.identitas.jenisPerkara}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onKembali}>
          Cari perkara lain
        </Button>
      </div>

      {/* ==================================================================
          PENANDA PERKARA
          ==================================================================

          Deretan penanda ringkas, bukan kartu besar. Yang dibaca orang di
          sini adalah SIFAT perkaranya - lewat e-Court atau tidak, sudah putus
          atau belum, ghaib atau tidak - dan sifat tidak memerlukan ruang
          seperempat layar untuk disampaikan. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={status.lewatEcourt ? "default" : "muted"}>
          {status.lewatEcourt ? "e-Court" : "perkara biasa"}
        </Badge>

        {status.putusan?.sudahPutus ? (
          <Badge variant="success">
            Putus {status.putusan.tanggalPutusan}
            {status.putusan.statusPutusan ? ` · ${status.putusan.statusPutusan}` : ""}
          </Badge>
        ) : (
          <Badge variant="warning">Masih berjalan</Badge>
        )}

        {status.putusan?.verstek ? <Badge variant="muted">verstek</Badge> : null}

        {/* Ghaib mengubah cara perkara dinilai - SK memotong 120 hari dari
            waktu putusnya - dan cara ia dipanggil. Sumbernya disebutkan pada
            keterangan tombolnya supaya panitera dapat menilai sendiri apakah
            penandanya masuk akal. */}
        {status.penanda?.ghaib === true ? (
          <Badge
            variant="warning"
            title={`Dikenali dari: ${status.penanda.sumberGhaib.join("; ")}`}
          >
            ghaib
          </Badge>
        ) : null}

        {/* Mafqud tidak punya kolomnya sendiri di SIPP - yang dihitung
            pencirinya menurut SK: tundaan sidang 3 x 90 hari. Karena itu
            tertulis "terindikasi", dan tundaannya dirinci pada bagian
            Perjalanan sidang. */}
        {status.penanda?.mafqud === true ? (
          <Badge
            variant="warning"
            title={`Terindikasi dari ${status.penanda.tundaanPanjang.length} kali tundaan ${status.penanda.ambangMafqud.hari} hari atau lebih`}
          >
            mafqud (terindikasi)
          </Badge>
        ) : null}

        {(status.penanda?.instansi ?? []).map((x) => (
          <Badge
            key={x.kunci}
            variant="warning"
            title={x.pihak.map((y) => `${y.nama} (${y.pekerjaan})`).join("; ")}
          >
            {x.label}
          </Badge>
        ))}

        {status.identitasPihak?.adaKumulasi ? (
          <Badge variant="muted" title={status.identitasPihak.kumulasi.join(", ")}>
            kumulasi
          </Badge>
        ) : null}

        <Badge variant="muted">
          {status.identitasPihak?.adaKuasa ? "dengan kuasa" : "tanpa kuasa"}
        </Badge>
      </div>

      {/* --- Jajaran angka --- */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* ==================================================================
            LAMA PERKARA: YANG DINILAI DI ATAS, YANG MENTAH DI BAWAH
            ==================================================================

            Yang menentukan nilai adalah lama BERSIH - hari pendaftaran ikut
            dihitung, lalu lama mediasi dipotong. Itulah yang ditampilkan
            besar.

            Selisih mentah dari pendaftaran ke putusan tetap disebutkan dalam
            kurung: itu yang dapat dicocokkan langsung dengan tanggal pada
            berkas, dan tanpa itu angka besarnya tampak tidak berdasar. */}
        <Angka
          label="Lama perkara"
          nilai={
            status.umur.hariBersih === null
              ? "—"
              : `${status.umur.hariBersih} hari`
          }
          keterangan={
            status.umur.hariBerjalan === null
              ? "Tanggal pendaftaran belum tercatat."
              : `(${status.umur.hariBerjalan} hari daftar sampai ${
                  status.umur.sudahPutus ? status.umur.sebabSelesai || "putus" : "hari ini"
                }${status.umur.hariMediasi > 0 ? `, mediasi ${status.umur.hariMediasi} hari` : ""})`
          }
          nada={
            status.umur.hariBersih === null
              ? undefined
              : status.umur.hariBersih <= 90
                ? "baik"
                : status.umur.hariBersih <= 150
                  ? "perhatian"
                  : "kurang"
          }
        />
        <Angka
          label="Nilai kelengkapan"
          nilai={`${status.penilaian.skor}`}
          keterangan={`dari 100 · ${status.penilaian.keadaan}`}
          nada={status.penilaian.keadaan === "baik" ? "baik" : status.penilaian.keadaan === "perhatian" ? "perhatian" : "kurang"}
        />
        <Angka
          label="Sidang"
          nilai={`${status.jadwal.length}`}
          keterangan={
            status.penundaan.length > 0 ? `${status.penundaan.length} kali ditunda` : "tanpa penundaan"
          }
        />
        <Angka
          label="Sisa panjar"
          nilai={rupiah(status.biaya.sisa)}
          keterangan={`panjar ${rupiah(status.biaya.panjar)}`}
          nada={status.biaya.sisa < 0 ? "kurang" : undefined}
        />
      </div>

        {/* ==================================================================
          TAHAPAN PERKARA
          ==================================================================

          Dari pendaftaran sampai penetapan hari sidang, beserta KAPAN masing-
          masing diinput ke SIPP. Selisih harinya ditampilkan karena itulah
          yang dinilai SK - bukan sekadar ada tidaknya tanggalnya.

          Tahapan yang kolomnya tidak ada pada SIPP versi ini disebutkan apa
          adanya. "Kolomnya tidak ada" sangat berbeda dari "belum dikerjakan",
          dan menyamarkan keduanya akan menuduh pengadilan atas pekerjaan yang
          sebenarnya sudah selesai. */}
      <Bagian judul="Tahapan perkara dan waktu penginputannya" kunci="tahapan">
        {status.tahapan.terbaca ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-sm uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Tahap</th>
                  <th className="py-1 text-left font-medium">Tanggal</th>
                  <th className="py-1 text-right font-medium">Selisih</th>
                  <th className="py-1 text-left font-medium">Diinput</th>
                  <th className="py-1 text-right font-medium">Jeda input</th>
                  <th className="py-1 text-right font-medium">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {status.tahapan.tahap.map((tahap) => (
                  <tr key={tahap.kunci} className="border-t">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium" title={tahap.dasar}>
                        {tahap.label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {!tahap.terbaca ? (
                        <span className="text-sm text-amber-700" title={tahap.alasan}>
                          kolom tidak ada
                        </span>
                      ) : tahap.tanggal ? (
                        tahap.tanggal
                      ) : (
                        <span className="text-amber-700">belum</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {/* Pendaftaran adalah titik nol - tidak ada acuan sebelumnya,
                          jadi selisihnya 0 hari, bukan tidak diketahui. Yang
                          benar-benar tidak diketahui hanya tahap yang tanggalnya
                          belum ada. */}
                      {tahap.hariSejakAcuan !== null
                        ? `${tahap.hariSejakAcuan} hari`
                        : !tahap.acuan && tahap.tanggal
                          ? "0 hari"
                          : "—"}
                    </td>
                    <td className="py-1.5 pr-2">
                      {!tahap.inputTerbaca ? (
                        <span className="text-sm text-amber-700" title={tahap.alasanInput}>
                          kolom tidak ada
                        </span>
                      ) : tahap.diinput ? (
                        tahap.diinput
                      ) : (
                        <span className="text-amber-700">belum</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                      {tahap.hariSampaiInput === null ? "—" : `${tahap.hariSampaiInput} hari`}
                    </td>
                    <td className="py-1.5 text-right">
                      {/* Berkas pindaian penetapannya, bila memang sudah
                          diunggah. Tombol yang menghasilkan galat lebih buruk
                          daripada tidak ada tombol. */}
                      {tahap.adaBerkas && tahap.dokumenId ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=penetapan&id=${encodeURIComponent(
                            tahap.dokumenId
                          )}`}
                          label="Unduh"
                          namaCadangan={`${tahap.kunci}-${status.identitas.nomorPerkara}.pdf`}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Penetapan kembali TIDAK mengurangi nilai - hakim mutasi bukan
                kesalahan siapa-siapa. Ia disebutkan supaya jelas mengapa ada
                lebih dari satu penetapan, dan mengapa yang dinilai yang
                pertama. */}
            {status.penetapanKembali.adaPenggantian ? (
              <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">Pernah ada penetapan kembali</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {status.penetapanKembali.baris.map((baris) => (
                    <li key={baris.jenis}>
                      <span className="font-medium">{baris.jenis}:</span>{" "}
                      {baris.penggantian
                        .map((x) =>
                          `${x.nama || "tanpa nama"}${x.masihAktif ? "" : " (diganti"}${
                            !x.masihAktif && x.tanggalTidakAktif ? ` ${x.tanggalTidakAktif}` : ""
                          }${x.masihAktif ? "" : ")"}`
                        )
                        .join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  Yang dinilai tetap penetapan pertama - penetapan kembali tidak dihitung.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {status.tahapan.alasan} Jalankan{" "}
            <code className="rounded bg-amber-100 px-1">scripts/sipp-periksa-kolom.js</code> di server
            untuk melihat nama kolom yang sebenarnya.
          </p>
        )}
      </Bagian>

      {/* ==================================================================
          UPAYA HUKUM
          ==================================================================

          Dipisah per tingkat - banding, kasasi, peninjauan kembali - karena
          ketiganya perkara yang berbeda dengan nomor sendiri, dan mencampur
          tahapannya dalam satu tabel membuat "pemberitahuan putusan" muncul
          tiga kali tanpa keterangan itu putusan yang mana.

          Di dalam tiap tingkat, tahapannya disusun menurut urutan acara -
          permohonan, pemberitahuan, memori, kontra memori, inzage, pengiriman
          berkas, putusan, salinan, pemberitahuan putusan - dan yang BELUM
          terjadi tetap disebut. Justru itulah yang dicari saat berkas
          diperiksa: mana yang belum dikerjakan. */}
      {/* Pada perkara yang SUDAH PUTUS, ketiadaan upaya hukum disebutkan
          apa adanya - bukan dengan menghilangkan bagiannya. Bagian yang hilang
          tidak dapat membedakan "tidak ada banding" dari "tabel bandingnya
          tidak terbaca", dan keduanya menuntut tindakan yang berbeda. */}
      {status.upayaHukum.length === 0 && status.putusan?.sudahPutus ? (
        <Bagian judul="Upaya hukum" kunci="upaya" ciutBawaan>
          <p className="text-sm text-muted-foreground">
            Tidak ada banding, kasasi, maupun peninjauan kembali yang tercatat
            untuk perkara ini.
          </p>
        </Bagian>
      ) : null}

      {status.upayaHukum.length > 0 ? (
        <Bagian
          judul="Upaya hukum"
          kunci="upaya"
          keterangan={status.upayaHukum.map((x) => x.jenis).join(", ")}
        >
          <div className="space-y-3">
            {status.upayaHukum.map((upaya, urutan) => {
              const sudah = upaya.tahapan.filter((t) => t.tanggal).length;
              const dapatDibaca = upaya.tahapan.filter((t) => t.adaKolom).length;
              return (
                <div
                  key={`${upaya.sebutan}-${urutan}`}
                  className="rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1.5">
                    <h4 className="text-sm font-semibold">
                      {upaya.jenis}
                      {upaya.nomorPerkara ? (
                        <span className="ml-2 font-normal text-muted-foreground">
                          {upaya.nomorPerkara}
                        </span>
                      ) : null}
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {upaya.dicabut
                        ? "dicabut"
                        : upaya.gugur
                          ? "gugur"
                          : upaya.tanggalPutusan
                            ? `diputus ${upaya.tanggalPutusan}`
                            : upaya.keterangan.keadaan || "belum diputus"}
                      {dapatDibaca > 0 ? ` \u00b7 ${sudah}/${dapatDibaca} tahap` : ""}
                    </span>
                  </div>

                  {/* Keterangan yang bukan tanggal. Hanya yang terisi -
                      deretan label bergaris tidak menolong siapa pun. */}
                  {[
                    ["Diajukan oleh", upaya.keterangan.pemohon],
                    ["Status putusan", upaya.keterangan.statusPutusan],
                    ["Keadaan berkas", upaya.keterangan.keadaan],
                    ["Majelis hakim", upaya.keterangan.majelis],
                    ["Panitera pengganti", upaya.keterangan.paniteraPengganti],
                    ["Catatan", upaya.keterangan.catatan],
                  ].some(([, nilai]) => nilai) ? (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ["Diajukan oleh", upaya.keterangan.pemohon],
                          ["Status putusan", upaya.keterangan.statusPutusan],
                          ["Keadaan berkas", upaya.keterangan.keadaan],
                          ["Majelis hakim", upaya.keterangan.majelis],
                          ["Panitera pengganti", upaya.keterangan.paniteraPengganti],
                          ["Catatan", upaya.keterangan.catatan],
                        ] as Array<[string, string | undefined]>
                      )
                        .filter(([, nilai]) => nilai)
                        .map(([label, nilai]) => (
                          <div key={label}>
                            <dt className="text-sm text-muted-foreground">{label}</dt>
                            <dd>{nilai}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : null}
                  <ol className="mt-2 space-y-0.5 text-sm">
                    {upaya.tahapan.map((tahap) => (
                      <li
                        key={tahap.kunci}
                        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-dashed py-0.5 last:border-0"
                      >
                        <span className={tahap.tanggal ? "" : "text-muted-foreground"}>
                          {tahap.label}
                        </span>
                        {tahap.tanggal ? (
                          <span className="shrink-0 tabular-nums">{tahap.tanggal}</span>
                        ) : tahap.adaKolom ? (
                          <span className="shrink-0 text-sm text-amber-700 dark:text-amber-400">
                            belum
                          </span>
                        ) : (
                          // Tidak sama dengan "belum": kolomnya memang tidak
                          // ada pada SIPP versi ini, jadi tidak ada yang
                          // perlu ditagih kepada siapa pun.
                          <span
                            className="shrink-0 text-sm text-muted-foreground"
                            title="Kolom untuk tahap ini tidak ada pada SIPP versi ini."
                          >
                            tidak tersedia
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>

                  {upaya.keterangan.amar ? (
                    <details className="mt-2 rounded-md border bg-background p-2">
                      <summary className="cursor-pointer text-sm font-semibold">
                        Amar putusan {upaya.jenis.toLowerCase()}
                      </summary>
                      {/* Teks dari basis data ditampilkan sebagai teks, tidak
                          dirender sebagai markup. */}
                      <div className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                        {upaya.keterangan.amar
                          .replace(/<li>/gi, "\n\u2022 ")
                          .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                          .replace(/<[^>]*>/g, " ")
                          .replace(/[ \t]+/g, " ")
                          .replace(/\n{3,}/g, "\n\n")
                          .trim()}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Nama kolom yang belum dikenali disebutkan berikut kolom yang
              benar-benar ada, supaya dapat dilengkapi tanpa membuka basis
              datanya. */}
          {status.upayaHukum.some((x) => x.tahapTakDikenali.length > 0) ? (
            <details className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm">
              <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-400">
                Sebagian tahap tidak tersedia pada SIPP versi ini
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {status.upayaHukum
                  .filter((x) => x.tahapTakDikenali.length > 0)
                  .map((x, i) => (
                    <div key={`${x.sebutan}-tak-${i}`}>
                      <p className="font-medium">{x.jenis}</p>
                      <p className="text-muted-foreground">
                        Belum dikenali: {x.tahapTakDikenali.join(", ")}
                      </p>
                      {x.kolomTersedia.length > 0 ? (
                        <p className="text-muted-foreground">
                          Kolom yang ada: {x.kolomTersedia.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}
      {/* ==================================================================
          MEDIASI
          ==================================================================

          PERMA 1/2016 Pasal 24: mediasi paling lama 30 hari sejak mediator
          ditetapkan. Yang lewat ditandai - bukan untuk menyalahkan, melainkan
          supaya terlihat saat berkas diperiksa. */}
      <Bagian
        judul="Mediasi"
        kunci="mediasi"
        keterangan={
          status.mediasi.terbaca && status.mediasi.baris.length > 0
            ? `${status.mediasi.baris.length} catatan`
            : ""
        }
      >
        {!status.mediasi.terbaca ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p>{status.mediasi.alasan}</p>
            {/* Nama kolom yang sebenarnya ada, langsung di layar. Tanpa ini,
                menemukan nama yang benar menuntut membuka Navicat. */}
            {status.mediasi.kolomTersedia && status.mediasi.kolomTersedia.length > 0 ? (
              <p className="mt-1 text-sm">
                Tambahkan nama yang sesuai ke daftar calon pada
                <code className="mx-1 rounded bg-amber-100 px-1">services/sippSkemaService.js</code>
                lalu nyalakan ulang bot.
              </p>
            ) : null}
          </div>
        ) : status.mediasi.baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada catatan mediasi pada perkara ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {status.mediasi.baris.map((baris, urutan) => (
              <li key={`${baris.mediator}-${urutan}`} className="rounded-md border bg-muted/20 p-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{baris.mediator || "Mediator belum tercatat"}</span>
                  {/* Hasil mediasi diberi warna menurut berhasil atau tidak -
                      itulah yang dicari mata saat memeriksa berkas. */}
                  {baris.hasil ? (
                    <Badge
                      variant={baris.berhasil ? "success" : "warning"}
                      title={baris.kodeHasil ? `Kode SIPP: ${baris.kodeHasil}` : ""}
                    >
                      {baris.hasil}
                    </Badge>
                  ) : (
                    <Badge variant="muted">hasil belum dicatat</Badge>
                  )}
                </div>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
                  {baris.jenisPenetapan ? (
                    <div>
                      <dt className="inline text-muted-foreground">Jenis penetapan: </dt>
                      <dd className="inline">{baris.jenisPenetapan}</dd>
                    </div>
                  ) : null}
                  {baris.nomorSk ? (
                    <div>
                      <dt className="inline text-muted-foreground">Nomor SK: </dt>
                      <dd className="inline">{baris.nomorSk}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-muted-foreground">Penetapan mediator: </dt>
                    <dd className="inline">{baris.tanggalPenetapan || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Mulai: </dt>
                    <dd className="inline">{baris.tanggalMulai || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Selesai: </dt>
                    <dd className="inline">{baris.tanggalSelesai || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Laporan mediator: </dt>
                    <dd className="inline">{baris.tanggalLaporan || "—"}</dd>
                  </div>
                  {baris.tanggalKesepakatan ? (
                    <div>
                      <dt className="inline text-muted-foreground">Kesepakatan perdamaian: </dt>
                      <dd className="inline">{baris.tanggalKesepakatan}</dd>
                    </div>
                  ) : null}
                  {baris.jumlahPertemuan !== null ? (
                    <div>
                      <dt className="inline text-muted-foreground">Pertemuan: </dt>
                      <dd className="inline">{baris.jumlahPertemuan} kali</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline text-muted-foreground">Lama: </dt>
                    <dd className="inline">
                      {baris.lamaHari === null ? "—" : `${baris.lamaHari} hari`}

                      {baris.lewatTenggang ? (
                        <span className="ml-1 text-amber-700">lewat 30 hari (PERMA 1/2016)</span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {/* Isi kesepakatan dibawa utuh - inilah yang dibaca saat
                    berkas diperiksa, dan memotongnya menghilangkan bagian
                    yang mungkin justru sedang dicari. */}
                {/* Isi kesepakatan perdamaian panjang dan bertanda HTML.
                    Diciutkan secara bawaan: yang membacanya hanya saat berkas
                    perdamaian diperiksa, sedangkan yang lain cukup tahu
                    hasilnya. Ditampilkan sebagai TEKS, bukan dirender - isi
                    dari basis data tidak boleh menjadi markup di halaman. */}
                {baris.isiKesepakatan ? (
                  <details className="mt-1.5 rounded border bg-card p-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Isi kesepakatan perdamaian
                    </summary>
                    <div className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {baris.isiKesepakatan
                        .replace(/<li>/gi, "\n• ")
                        .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                        .replace(/<[^>]*>/g, " ")
                        .replace(/[ \t]+/g, " ")
                        .replace(/\n{3,}/g, "\n\n")
                        .trim()}
                    </div>
                  </details>
                ) : null}

                {baris.catatan ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium">Catatan: </span>
                    {baris.catatan.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Jadwal pertemuan mediasi, bila SIPP mencatatnya tersendiri. */}
        {status.mediasi.jadwal && status.mediasi.jadwal.length > 0 ? (
          <div className="mt-2">
            <p className="mb-1 text-sm font-medium">Jadwal pertemuan</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {status.mediasi.jadwal.map((x, urutan) => (
                <li key={`${x.tanggal}-${urutan}`}>
                  {x.tanggal}
                  {x.jam ? ` ${x.jam}` : ""}
                  {x.sampaiJam ? `-${x.sampaiJam}` : ""}
                  {x.tempat ? ` — ${x.tempat}` : ""}
                  {/* ditunda = T pada SIPP berarti pertemuan itu tidak jadi. */}
                  {x.ditunda ? <span className="ml-1 text-amber-700">ditunda</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Bagian>

      {/* ==================================================================
          SAKSI
          ==================================================================

          Hubungan saksi dengan para pihak lazimnya tidak punya kolomnya
          sendiri - panitera menuliskannya pada keterangan. Karena itu
          keterangannya ditampilkan UTUH, bukan diurai jadi kategori.
          Menguraikannya berarti menebak, dan menebak hubungan keluarga pada
          berkas perkara tidak termaafkan. */}
      <Bagian
        judul="Saksi"
        kunci="saksi"
        keterangan={
          status.saksiRinci.terbaca && status.saksiRinci.baris.length > 0
            ? `${status.saksiRinci.baris.length} saksi`
            : ""
        }
      >
        {!status.saksiRinci.terbaca ? (
          <p className="text-sm text-amber-700">{status.saksiRinci.alasan}</p>
        ) : status.saksiRinci.baris.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada keterangan saksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-sm uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Nama</th>
                  <th className="py-1 text-left font-medium">Diajukan</th>
                  <th className="py-1 text-left font-medium">Hubungan / keterangan</th>
                  <th className="py-1 text-right font-medium">Identitas</th>
                </tr>
              </thead>
              <tbody>
                {status.saksiRinci.baris.map((baris, urutan) => (
                  <tr key={`${baris.nama}-${urutan}`} className="border-t align-top">
                    <td className="py-1.5 pr-2 font-medium">{baris.nama || "—"}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{baris.diajukanOleh || "—"}</td>
                    <td className="py-1.5 pr-2">{baris.keterangan || "—"}</td>
                    <td className="py-1.5 text-right text-sm tabular-nums text-muted-foreground">
                      {baris.isianTerisi} dari 3
                      {/* Apa yang belum diisi - supaya jelas apa yang harus
                          dilengkapi, bukan sekadar tahu nilainya kurang. */}
                      {baris.isianKurang && baris.isianKurang.length > 0 ? (
                        <div className="text-amber-700">belum: {baris.isianKurang.join(", ")}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>
      {/* ==================================================================
          PUTUSAN LENGKAP
          ==================================================================

          Yang ditanyakan saat berkas diperiksa, dan selama ini harus dibuka
          satu per satu di SIPP: amarnya, sumber hukumnya, faktor penyebab
          perceraiannya, qobla atau bada dukhul, dan status nusyuz. */}
      {/* Bagian ini muncul pada setiap perkara yang SUDAH PUTUS, bukan hanya
          saat keterangannya terbaca. Menyembunyikannya membuat dua keadaan
          yang sangat berbeda - belum putus, dan sudah putus tetapi tidak
          terbaca - tampak persis sama: bagiannya hilang. Konseptor pun tinggal
          di dalam sini, sehingga menyembunyikannya ikut menyembunyikan
          konseptor pada perkara yang justru perlu ditelusuri. */}
      {status.putusanLengkap.ada || status.putusan?.sudahPutus ? (
        <Bagian judul="Keterangan putusan" kunci="putusan-lengkap">
          {!status.putusanLengkap.ada ? (
            <p className="mb-2 rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-sm text-amber-700 dark:text-amber-400">
              Perkara ini sudah putus, tetapi keterangan putusannya belum dapat
              dibaca dari SIPP
              {status.putusanLengkap.terbaca === false && status.putusanLengkap.alasan
                ? `: ${status.putusanLengkap.alasan}`
                : "."}
            </p>
          ) : null}
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Tanggal putusan</dt>
              <dd className="font-medium">{status.putusanLengkap.tanggalPutusan || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status putusan</dt>
              <dd className="font-medium">{status.putusanLengkap.statusPutusan || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Jenis putusan</dt>
              <dd className="font-medium">
                {status.putusan?.verstek ? "Verstek" : "Contradictoir"}
              </dd>
            </div>
            {status.putusanLengkap.sumberHukum ? (
              <div>
                <dt className="text-sm text-muted-foreground">Sumber hukum</dt>
                <dd>{status.putusanLengkap.sumberHukum}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.faktorPrimer ? (
              <div>
                <dt className="text-sm text-muted-foreground">Faktor perceraian (primer)</dt>
                <dd>{status.putusanLengkap.faktorPrimer}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.faktorSekunder ? (
              <div>
                <dt className="text-sm text-muted-foreground">Faktor perceraian (sekunder)</dt>
                <dd>{status.putusanLengkap.faktorSekunder}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.qoblaBada ? (
              <div>
                <dt className="text-sm text-muted-foreground">Qobla / Bada dukhul</dt>
                <dd>{status.putusanLengkap.qoblaBada}</dd>
              </div>
            ) : null}
            {status.putusanLengkap.statusNusyuz ? (
              <div>
                <dt className="text-sm text-muted-foreground">Status nusyuz</dt>
                <dd>{status.putusanLengkap.statusNusyuz}</dd>
              </div>
            ) : null}

            {/* ==============================================================
                KONSEPTOR SELALU DISEBUT, WALAU KOSONG
                ==============================================================

                Siapa yang mengerjakan konsep putusannya. Tidak punya kolom
                sendiri di SIPP - dibaca dari jejak proses tahapan putusan,
                lalu nama penggunanya diterjemahkan jadi nama orangnya.

                Sebelumnya bagian ini HILANG saat tidak terbaca, sehingga yang
                mencarinya menyimpulkan fiturnya tidak ada. Sekarang kolomnya
                tetap muncul dan menerangkan sendiri mengapa kosong. */}
            <div>
              <dt className="text-sm text-muted-foreground">Konseptor</dt>
              <dd>
                {status.konseptor.baris.length > 0 ? (
                  <>
                    {status.konseptor.baris.map((x, urutan) => (
                      <span key={x.pengguna}>
                        {urutan > 0 ? ", " : ""}
                        <span title={x.namaTerbaca ? `pengguna: ${x.pengguna}` : ""}>{x.nama}</span>
                      </span>
                    ))}
                    {status.konseptor.dariAudit ? (
                      <span
                        className="ml-1 text-sm text-muted-foreground"
                        title={status.konseptor.catatan || ""}
                      >
                        (pencatat)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              {/* Sebabnya disebut apa adanya: tidak terbaca berbeda dari tidak
                  ada, dan menyamakan keduanya membuat orang menelusuri hal
                  yang salah. */}
              {status.konseptor.baris.length === 0 ? (
                <dd className="text-sm text-muted-foreground">
                  {status.konseptor.terbaca
                    ? status.konseptor.catatan ||
                      "Tahapan putusan tidak tercatat pada perkara_proses untuk perkara ini."
                    : status.konseptor.alasan || "Konseptor tidak dapat dibaca dari SIPP."}
                </dd>
              ) : null}
            </div>
          </dl>

          {/* Amar disimpan SIPP sebagai teks bertanda HTML. Ditampilkan
              sebagai teks biasa, bukan dirender - isi dari basis data tidak
              boleh menjadi markup di halaman ini. */}
          {status.putusanLengkap.amar ? (
            <details className="mt-2 rounded-md border bg-muted/20 p-2">
              <summary className="cursor-pointer text-sm font-semibold">Amar putusan</summary>
              <div className="mt-1.5 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {/* Rantai yang sama dengan amar ikrar talak dan isi
                    kesepakatan mediasi. Sebelumnya di sini hanya dua
                    langkah, dan langkah keduanya salah tulis: DUA garis
                    miring terbalik membuatnya mencari garis miring
                    terbalik diikuti huruf s - bukan spasi. Akibatnya sisa
                    spasi bekas tag HTML tidak pernah dirapatkan, dan
                    penanda daftar hilang sama sekali. */}
                {status.putusanLengkap.amar
                  .replace(/<li>/gi, "\n\u2022 ")
                  .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/[ \t]+/g, " ")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim()}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {/* ==================================================================
          PUTUSAN DI E-COURT
          ==================================================================

          Putusan yang sudah dijatuhkan belum tentu terbit di e-Court, dan
          tiga hal dapat gagal berturut-turut tanpa satu pun peringatan:
          barisnya tidak terbentuk, salinannya belum diunggah, atau Panitera
          belum menandatanganinya.

          Ketiganya baru ketahuan saat para pihak datang menanyakan salinan
          putusannya - kerap berminggu-minggu sesudahnya. Bagian ini muncul
          pada setiap perkara yang sudah putus, bukan hanya saat bermasalah:
          "sudah lengkap" pun perlu terlihat, supaya diamnya bagian ini tidak
          disalahartikan sebagai belum diperiksa. */}
      {status.putusanEcourt ? (
        <Bagian
          judul="Putusan di e-Court"
          kunci="putusanEcourt"
          keterangan={status.putusanEcourt.sebutan}
        >
          <div
            className={`mb-2 rounded-md border px-3 py-2 text-sm ${
              status.putusanEcourt.keadaan === "putusan_ecourt_error"
                ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                : status.putusanEcourt.perluTindakan
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            <p className="font-semibold">{status.putusanEcourt.sebutan}</p>
            {status.putusanEcourt.keterangan ? (
              <p className="mt-0.5 text-sm">{status.putusanEcourt.keterangan}</p>
            ) : null}
          </div>

          {status.putusanEcourt.ecourt ? (
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {status.putusanEcourt.ecourt.nomorPutusan ? (
                <div>
                  <dt className="text-sm text-muted-foreground">Nomor putusan di e-Court</dt>
                  <dd>{status.putusanEcourt.ecourt.nomorPutusan}</dd>
                </div>
              ) : null}
              {status.putusanEcourt.ecourt.tanggalPutusanTeks ? (
                <div>
                  <dt className="text-sm text-muted-foreground">Tanggal putusan</dt>
                  <dd>{status.putusanEcourt.ecourt.tanggalPutusanTeks}</dd>
                </div>
              ) : null}
              {status.putusanEcourt.ecourt.tanggalBhtTeks ? (
                <div>
                  <dt className="text-sm text-muted-foreground">Tanggal BHT</dt>
                  <dd>{status.putusanEcourt.ecourt.tanggalBhtTeks}</dd>
                </div>
              ) : null}

              <div>
                <dt className="text-sm text-muted-foreground">Dokumen salinan putusan</dt>
                <dd
                  className={
                    status.putusanEcourt.ecourt.dokumenAda
                      ? ""
                      : "text-amber-700 dark:text-amber-400"
                  }
                >
                  {status.putusanEcourt.ecourt.dokumenAda
                    ? status.putusanEcourt.ecourt.dokumenJudul || "sudah diunggah"
                    : "belum diunggah"}
                </dd>
              </div>

              {/* Siapa yang mengunggah dan kapan - dua pertanyaan yang selalu
                  menyusul begitu salinannya dipersoalkan. */}
              <div>
                <dt className="text-sm text-muted-foreground">Diupload oleh</dt>
                <dd className={status.putusanEcourt.ecourt.diunggahOleh ? "" : "text-muted-foreground"}>
                  {status.putusanEcourt.ecourt.diunggahOleh || "\u2014"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Tanggal upload</dt>
                <dd
                  className={
                    status.putusanEcourt.ecourt.tanggalUnggahTeks ? "" : "text-muted-foreground"
                  }
                >
                  {status.putusanEcourt.ecourt.tanggalUnggahTeks || "\u2014"}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Panitera</dt>
                <dd>
                  {status.putusanEcourt.ecourt.paniteraNama || "\u2014"}
                  {status.putusanEcourt.ecourt.paniteraTte ? (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Sudah di-TTE oleh Panitera
                      {status.putusanEcourt.ecourt.paniteraTanggalTte
                        ? ` \u00b7 ${status.putusanEcourt.ecourt.paniteraTanggalTte}`
                        : ""}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                      Belum TTE oleh Panitera
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keadaan e-Court untuk perkara ini belum pernah dibaca ALETA. Jalankan penarikan
              e-Court lebih dulu.
            </p>
          )}

          {status.putusanEcourt.ecourt && status.putusanEcourt.ecourt.diperiksaPada ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Keadaan ini menurut penarikan e-Court terakhir. Yang berubah sesudahnya belum
              terbaca di sini.
            </p>
          ) : null}
        </Bagian>
      ) : null}

      {/* ==================================================================
          IKRAR TALAK
          ==================================================================

          Pada cerai talak, putusan hanya MEMBERI IZIN pemohon mengucapkan
          ikrar. Perceraiannya baru terjadi saat ikrar itu diucapkan di depan
          sidang - dan bila tidak diucapkan dalam enam bulan, putusannya
          kehilangan kekuatan.

          Karena itu sidang ikrar punya penetapan majelis, panitera pengganti,
          dan juru sitanya sendiri. */}
      {status.ikrarTalak.ada ? (
        <Bagian
          judul="Ikrar talak"
          kunci="ikrar"
          keterangan={status.ikrarTalak.status || ""}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {status.ikrarTalak.status ? (
              <Badge
                variant={
                  status.ikrarTalak.statusId === 1
                    ? "success"
                    : status.ikrarTalak.statusId === 3
                      ? "muted"
                      : "warning"
                }
              >
                {status.ikrarTalak.status}
              </Badge>
            ) : null}
            {!status.ikrarTalak.sudahDiucapkan ? (
              <Badge variant="warning">ikrar belum diucapkan</Badge>
            ) : null}
            {status.ikrarTalak.adaBerkas && status.ikrarTalak.ikrarId ? (
              <TombolUnduh
                alamat={`/api/aleta-ecourt/berkas-sipp?jenis=ikrar-talak&id=${encodeURIComponent(
                  status.ikrarTalak.ikrarId
                )}`}
                label="Unduh penetapan"
                namaCadangan={`ikrar-talak-${status.identitas.nomorPerkara}.pdf`}
              />
            ) : null}
          </div>

          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Penetapan majelis hakim</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanMajelis || "—"}</dd>
              {status.ikrarTalak.majelis ? (
                <dd className="text-sm text-muted-foreground">{status.ikrarTalak.majelis}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Penunjukan panitera pengganti</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanPp || "—"}</dd>
              {status.ikrarTalak.panitera ? (
                <dd className="text-sm text-muted-foreground">{status.ikrarTalak.panitera}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Penunjukan juru sita</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanJs || "—"}</dd>
              {status.ikrarTalak.jurusita ? (
                <dd className="text-sm text-muted-foreground">{status.ikrarTalak.jurusita}</dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Penetapan sidang ikrar talak</dt>
              <dd className="font-medium">{status.ikrarTalak.penetapanSidang || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Tanggal ikrar talak</dt>
              <dd className="font-medium">
                {status.ikrarTalak.tanggalIkrar || (
                  <span className="text-amber-700">belum diucapkan</span>
                )}
              </dd>
            </div>
            {status.ikrarTalak.nomorSk ? (
              <div>
                <dt className="text-sm text-muted-foreground">Nomor penetapan</dt>
                <dd>{status.ikrarTalak.nomorSk}</dd>
              </div>
            ) : null}
          </dl>

          {/* Amar penetapan ikrar - ditampilkan sebagai teks, bukan dirender. */}
          {status.ikrarTalak.amar ? (
            <details className="mt-2 rounded-md border bg-muted/20 p-2">
              <summary className="cursor-pointer text-sm font-semibold">
                Amar penetapan ikrar talak
              </summary>
              <div className="mt-1.5 max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {status.ikrarTalak.amar
                  .replace(/<li>/gi, "\n• ")
                  .replace(/<\/(p|div|li|ol|ul)>/gi, "\n")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/[ \t]+/g, " ")
                  .replace(/\n{3,}/g, "\n\n")
                  .trim()}
              </div>
            </details>
          ) : null}
        </Bagian>
      ) : null}

      {status.delegasiMasuk.baris.length > 0 || status.delegasiKeluar.baris.length > 0 ? (
        <Bagian judul="Delegasi" kunci="delegasi">
          {status.delegasiMasuk.baris.length > 0 ? (
            <div className="mb-2">
              <p className="mb-1 text-sm font-medium">Masuk - dilaksanakan pengadilan ini</p>
              <ul className="space-y-0.5 text-sm">
                {status.delegasiMasuk.baris.map((x, urutan) => (
                  <li key={`masuk-${urutan}`} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{x.asal || "tanpa keterangan asal"}</span>
                    <span className="text-muted-foreground">
                      diunggah {x.tanggalDiunggah || "—"}, diterima {x.tanggalDiterima || "—"}
                      {x.hariSampaiTerima !== null ? ` (${x.hariSampaiTerima} hari)` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {status.delegasiKeluar.baris.length > 0 ? (
            <div>
              <p className="mb-1 text-sm font-medium">
                Keluar (tabayun) - diminta ke pengadilan lain
              </p>
              <ul className="space-y-0.5 text-sm">
                {status.delegasiKeluar.baris.map((x, urutan) => (
                  <li key={`keluar-${urutan}`} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{x.tujuan || "tanpa keterangan tujuan"}</span>
                    <span className="text-muted-foreground">
                      dimohon {x.tanggalPermohonan || "—"}
                      {x.tanggalSidang ? `, untuk sidang ${x.tanggalSidang}` : ""}
                      {x.hariSebelumSidang !== null ? ` (${x.hariSebelumSidang} hari sebelumnya)` : ""}
                    </span>
                    {/* SK III.3: kurang dari 6 hari sebelum sidang mengurangi
                        nilai - relaasnya berisiko tidak sampai tepat waktu. */}
                    {x.panggilan && x.nilai !== null && x.nilai < 0 ? (
                      <span className="text-amber-700">nilai {x.nilai}</span>
                    ) : null}
                    {!x.panggilan ? (
                      <span className="text-muted-foreground">pemberitahuan - tidak dinilai</span>
                    ) : null}
                    {x.pelaksanaan && x.pelaksanaan.tanggalRelaas ? (
                      <span className="w-full text-muted-foreground">
                        relaas {x.pelaksanaan.tanggalRelaas}
                        {x.pelaksanaan.jurusita ? ` oleh ${x.pelaksanaan.jurusita}` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Bagian>
      ) : null}

      <Bagian
        judul="Arsip berkas"
        kunci="arsip"
        keterangan={status.arsipKeterangan.sudahDiarsipkan ? "sudah diarsipkan" : ""}
      >
        {!status.arsipKeterangan.terbaca ? (
          <p className="text-sm text-amber-700">{status.arsipKeterangan.alasan}</p>
        ) : !status.arsipKeterangan.sudahDiarsipkan ? (
          <p className="text-sm text-muted-foreground">Berkas perkara ini belum diarsipkan.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {status.arsipKeterangan.baris.map((x, urutan) => (
              <li key={`arsip-${urutan}`} className="rounded-md border bg-muted/20 px-2.5 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{x.nomor || "tanpa nomor box"}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      diinput {x.tanggalInput || "—"}
                      {x.oleh ? ` oleh ${x.oleh}` : ""}
                    </span>
                    {x.adaBerkas && x.arsipId ? (
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=arsip&id=${encodeURIComponent(
                          x.arsipId
                        )}`}
                        label="Unduh"
                        namaCadangan={`arsip-${status.identitas.nomorPerkara}.pdf`}
                      />
                    ) : null}
                  </span>
                </div>
                {x.keterangan ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{x.keterangan}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Tidak adanya tombol unduh bukan karena berkasnya hilang - kolom
            berkasnya memang tidak ada pada SIPP versi ini. */}
        {status.arsipKeterangan.sudahDiarsipkan && status.arsipKeterangan.berkasTerbaca === false ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Kolom berkas arsip tidak ada pada SIPP versi ini, sehingga tidak ada yang dapat diunduh.
          </p>
        ) : null}
      </Bagian>
      {/* --- Penilaian --- */}
      <Bagian judul="Penilaian kelengkapan perkara" kunci="rubrik" ciutBawaan>
        <div className="space-y-1.5">
          {status.penilaian.rinci.map((butir) => (
            <div key={butir.kunci} className="flex flex-wrap items-center gap-2 text-sm">
              <div className="min-w-[13rem] flex-1">
                <span className="font-medium">{butir.label}</span>
                <div className="text-sm text-muted-foreground">{butir.catatan}</div>
              </div>

              <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                {/* Butir yang belum waktunya dibiarkan KOSONG, bukan merah.
                    Batang merah penuh untuk perkara yang belum diputus akan
                    dibaca sebagai kelalaian atas pekerjaan yang belum jatuh
                    tempo - dan papan yang selalu merah berhenti dibaca. */}
                {butir.belumBerlaku ? null : (
                  <div
                    className={cn(
                      "h-full rounded-full",
                      butir.bagian >= 0.85
                        ? "bg-emerald-500"
                        : butir.bagian >= 0.5
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    )}
                    style={{ width: `${Math.round(butir.bagian * 100)}%` }}
                  />
                )}
              </div>

              <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">
                {butir.belumBerlaku ? "belum waktunya" : `${butir.nilai} / ${butir.bobot}`}
              </span>
            </div>
          ))}
        </div>

        {/* Batasnya disebutkan di layar, bukan disembunyikan. */}
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {status.penilaian.catatan} Butir bertanda &quot;belum waktunya&quot; - sidang belum ada yang
          berlalu, perkara belum diputus - tidak ikut membagi nilai, sehingga perkara yang baru
          berjalan dinilai atas apa yang sudah menjadi kewajibannya. Bobot dan ambangnya diubah di
          menu Integrasi e-Court.
        </p>
      </Bagian>

      {/* ==================================================================
          PENILAIAN MENURUT SK - terpisah dari rubrik ALETA di atas
          ==================================================================

          Poin yang ditampilkan poin SATU PERKARA menurut Tabel 2 SK. Nilai
          akhir SK dihitung atas seluruh perkara putus satu satuan kerja,
          bukan atas satu perkara - karena itu di sini tidak ada persentase
          maupun predikat bintang, supaya tidak dikira nilai satker. */}
      <Bagian judul="Penilaian SIPP menurut SK Dirjen Badilag 048/2024" kunci="sk" ciutBawaan>
        <div className="space-y-3">
          {ASPEK_SK.map((aspek) => {
            const unsur = status.penilaianSk.rinci.filter((x) => x.aspek === aspek.kunci);
            if (unsur.length === 0) return null;
            return (
              <div key={aspek.kunci} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold">{aspek.label}</h4>
                  <span className="text-sm tabular-nums text-muted-foreground">bobot {aspek.bobot}</span>
                </div>
                <ul className="space-y-1">
                  {unsur.map((x) => (
                    <li key={x.kunci} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <div className="min-w-[14rem] flex-1">
                        <span className={cn(!x.terbaca && "text-muted-foreground")} title={x.dasar}>
                          {x.label}
                        </span>
                        <div className="text-sm text-muted-foreground">{x.catatan}</div>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        bobot {x.bobot}%
                      </span>
                      {x.terbaca ? (
                        <span
                          className={cn(
                            "w-16 shrink-0 rounded px-1.5 py-0.5 text-right text-sm font-semibold tabular-nums",
                            x.pengurang
                              ? (x.poin ?? 0) === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                              : (x.poin ?? 0) >= 5
                                ? "bg-emerald-100 text-emerald-800"
                                : (x.poin ?? 0) >= 2
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                          )}
                        >
                          {x.poin} / {x.pengurang ? 0 : 5}
                        </span>
                      ) : (
                        <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">belum</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {status.penilaianSk.catatan} Dasar: {status.penilaianSk.dasar}
        </p>

        {/* Dari mana angka-angka yang tidak punya kolom resminya sendiri
            berasal. Nilai yang datang dari catatan pengadilan dan nilai yang
            ditelusuri dari jejak audit tidak boleh tampak sama. */}
        <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          {status.nilaiRelaas.sumber ? (
            <li>
              Nilai relaas dari: <span className="font-medium">{status.nilaiRelaas.sumber}</span>
              {status.nilaiRelaas.dariAudit ? (
                <span className="ml-1 text-amber-700">
                  (ditelusuri dari jejak audit, bukan kolom resmi)
                </span>
              ) : null}
            </li>
          ) : status.nilaiRelaas.alasan ? (
            <li className="text-amber-700">{status.nilaiRelaas.alasan}</li>
          ) : null}
          {status.durasiMediasi.terbaca && status.durasiMediasi.hari > 0 ? (
            <li>
              Waktu putus dikurangi{" "}
              <span className="font-medium">{status.durasiMediasi.hari} hari mediasi</span>.
            </li>
          ) : null}
          {status.penetapanKembali.adaPenggantian ? (
            <li>Penetapan pertama yang dinilai - penetapan kembali tidak dihitung.</li>
          ) : null}
        </ul>

        {status.penilaianSk.unsurBelumTersambung.length > 0 ? (
          <details className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <summary className="cursor-pointer font-semibold">
              {status.penilaianSk.unsurBelumTersambung.length} unsur belum dapat dinilai
            </summary>
            <ul className="mt-1.5 space-y-0.5">
              {status.penilaianSk.unsurBelumTersambung.map((x) => (
                <li key={x.kunci}>
                  <span className="font-medium">{x.label}</span> - {x.catatan}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Bagian>

      <div className="grid gap-3 lg:grid-cols-2">
        <Bagian judul="Majelis dan petugas" kunci="majelis">
          {status.majelis.length > 0 ? (
            <ul className="space-y-0.5 text-sm">
              {status.majelis.map((orang) => (
                <li key={orang.kode + orang.nama}>
                  <span className="font-mono text-sm">{orang.kode || "—"}</span>{" "}
                  <span className="font-medium">{orang.nama}</span>
                  {orang.jabatan ? (
                    <span className="text-sm text-muted-foreground"> · {orang.jabatan}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Majelis belum ditetapkan.</p>
          )}
          <p className="mt-2 text-sm">
            <span className="text-sm text-muted-foreground">Panitera: </span>
            {status.panitera.map((x) => x.nama).join(", ") || "—"}
          </p>
          <p className="text-sm">
            <span className="text-sm text-muted-foreground">Jurusita: </span>
            {status.jurusita.map((x) => x.nama).join(", ") || "—"}
          </p>
        </Bagian>

        <Bagian judul="Para pihak" kunci="pihak">
          {status.pihak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pihak belum tercatat.</p>
          ) : (
            <ul className="space-y-0.5 text-sm">
              {status.pihak.map((orang, urutan) => (
                <li key={`${orang.nama}-${urutan}`}>
                  <span className="font-medium">{orang.nama}</span>
                  <span className="text-sm text-muted-foreground">
                    {" · "}
                    {orang.jenis === "kuasa"
                      ? "kuasa hukum"
                      : orang.pihakKe === 1
                        ? "penggugat/pemohon"
                        : orang.pihakKe === 2
                          ? "tergugat/termohon"
                          : "pihak"}
                    {orang.adaNomor ? ` · ${orang.nomorSamar}` : " · tanpa nomor"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bagian>
      </div>

      <Bagian judul="Perjalanan sidang" kunci="sidang">
        {status.jadwal.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada jadwal sidang tercatat.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-2 text-sm">
              {sidangBerikut ? (
                <Badge variant="default">
                  Sidang berikut: {sidangBerikut.tanggalSidang} {sidangBerikut.jamSidang} —{" "}
                  {sidangBerikut.agenda || "tanpa agenda"}
                </Badge>
              ) : sidangTerakhir ? (
                <Badge variant="muted">Sidang terakhir: {sidangTerakhir.tanggalSidang}</Badge>
              ) : null}
            </div>

            <ol className="space-y-1 text-sm">
              {status.jadwal.map((sidang) => (
                <li key={sidang.sidangId} className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-border pl-2">
                  <span className="font-medium">{sidang.tanggalSidang}</span>
                  {sidang.jamSidang ? (
                    <span className="text-sm tabular-nums text-muted-foreground">{sidang.jamSidang}</span>
                  ) : null}
                  <span className="text-sm">{sidang.agenda || "tanpa agenda"}</span>
                  {sidang.ruangan ? (
                    <span className="text-sm text-muted-foreground">Ruang {sidang.ruangan}</span>
                  ) : null}
                  {sidang.ditunda ? (
                    <Badge variant="warning">
                      ditunda{sidang.alasanDitunda ? `: ${sidang.alasanDitunda}` : ""}
                    </Badge>
                  ) : null}
                  {/* BAS bukan sekadar penanda - ia berkas yang perlu dibuka.
                      Penanda yang tidak dapat ditekan memaksa orang membuka
                      SIPP hanya untuk mengunduh satu berkas. */}
                  {sidang.adaBas && sidang.sidangId ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(
                        sidang.sidangId
                      )}`}
                      label="BAS"
                      namaCadangan={`bas-${status.identitas.nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        )}
      </Bagian>

      {status.putusan?.sudahPutus ? (
        <Bagian judul="Putusan dan tindak lanjutnya" kunci="putusan">
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Minutasi</dt>
              <dd className="font-medium">
                {status.putusan.tanggalMinutasi || (
                  <span className="text-amber-700 dark:text-amber-300">belum</span>
                )}
                {status.umur.hariMinutasi !== null ? (
                  <div className="text-sm font-normal text-muted-foreground">
                    {status.umur.hariMinutasi} hari setelah putus
                  </div>
                ) : null}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Berkekuatan hukum tetap</dt>
              <dd className="font-medium">
                {status.putusan.tanggalBht || (
                  <span className="text-amber-700 dark:text-amber-300">belum</span>
                )}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Akta cerai</dt>
              <dd className="font-medium">
                {status.putusan.aktaCerai?.nomor || (
                  <span className="text-muted-foreground">belum terbit</span>
                )}
              </dd>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <dt className="text-sm text-muted-foreground">Upaya hukum</dt>
              <dd className="font-medium">
                {status.putusan.upayaHukum.length > 0
                  ? status.putusan.upayaHukum.map((x) => x.jenis).join(", ")
                  : "tidak ada"}
              </dd>
            </div>
          </dl>
        </Bagian>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ==============================================================
            BERKAS
            ==============================================================

            Yang dicari orang di sini tiga hal: gugatan atau permohonannya,
            relaas panggilannya, dan berita acara sidangnya. Sebelumnya bagian
            ini hanya menghitung jumlah dokumen lalu menampilkan isi
            perkara_dokumen - berkas LAMPIRAN - dan ketiganya justru tidak ada
            di sana: gugatan pada kolom petitum perkara, relaas pada tabel
            relaas, BAS pada jadwal sidang.

            Susunannya disamakan dengan layar jadwal sidang supaya yang
            dicari ada di tempat yang sama pada kedua layar. */}
        <Bagian judul="Berkas" kunci="berkas">
          <div className="space-y-3">
            {/* --- Gugatan / permohonan --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">Gugatan / permohonan</p>
              {status.petitum?.ada ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Surat gugatan/permohonan</span>
                  <TombolUnduh
                    alamat={`/api/aleta-ecourt/berkas-sipp?jenis=petitum&id=${encodeURIComponent(
                      status.identitas.perkaraId
                    )}`}
                    label="Unduh"
                    namaCadangan={`gugatan-${status.identitas.nomorPerkara}.pdf`}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum diunggah ke SIPP.</p>
              )}
            </div>

            {/* --- Relaas panggilan --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">
                Relaas panggilan
                {status.relaas.length > 0 ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({status.relaas.filter((x) => x.adaDokumen).length} dari {status.relaas.length}{" "}
                    berdokumen)
                  </span>
                ) : null}
              </p>
              {status.relaas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada relaas tercatat.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {status.relaas.map((baris) => (
                    <li key={baris.id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate" title={baris.namaPihak}>
                        {baris.namaPihak || "tanpa nama pihak"}
                        {/* Daftar ini memuat relaas SELURUH sidang perkara,
                            jadi sidang mana yang dipanggil harus disebut -
                            tanpa itu ia hanya deretan nama berulang. */}
                        {baris.tanggalSidang ? (
                          <span className="ml-1 text-sm text-muted-foreground">
                            untuk sidang {baris.tanggalSidang}
                          </span>
                        ) : null}
                        {baris.tanggalRelaas ? (
                          <span className="ml-1 text-sm text-muted-foreground">
                            &middot; relaas {baris.tanggalRelaas}
                          </span>
                        ) : null}
                      </span>
                      {baris.adaDokumen ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=relaas&id=${encodeURIComponent(
                            baris.id
                          )}`}
                          label="Relaas"
                          namaCadangan={`relaas-${baris.id}.pdf`}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">relaas belum diunggah</span>
                      )}
                      {baris.adaResi ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=resi&id=${encodeURIComponent(
                            baris.id
                          )}`}
                          label="Resi"
                          namaCadangan={`resi-${baris.id}.pdf`}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* --- Berita acara sidang --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">
                Berita Acara Sidang
                {status.jadwal.length > 0 ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({status.jadwal.filter((x) => x.adaBas).length} dari {status.jadwal.length} sidang)
                  </span>
                ) : null}
              </p>
              {status.jadwal.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada sidang tercatat.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {status.jadwal.map((sidang) => (
                    <li key={sidang.sidangId} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        {sidang.tanggalSidang}
                        <span className="ml-1 text-sm text-muted-foreground">
                          {sidang.agenda || "tanpa agenda"}
                        </span>
                      </span>
                      {sidang.adaBas ? (
                        <TombolUnduh
                          alamat={`/api/aleta-ecourt/berkas-sipp?jenis=bas&id=${encodeURIComponent(
                            sidang.sidangId
                          )}`}
                          label="BAS"
                          namaCadangan={`bas-${status.identitas.nomorPerkara}-${sidang.tanggalSidang}.pdf`}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">BAS belum diunggah</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* --- Putusan --- */}
            {status.putusan?.adaBerkasPutusan || status.putusan?.adaBerkasAnonim ? (
              <div>
                <p className="mb-1 text-sm font-semibold">Putusan</p>
                <div className="flex flex-wrap gap-2">
                  {status.putusan?.adaBerkasPutusan ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan&id=${encodeURIComponent(
                        status.identitas.perkaraId
                      )}`}
                      label="Unduh putusan"
                      namaCadangan={`putusan-${status.identitas.nomorPerkara}.pdf`}
                    />
                  ) : null}
                  {status.putusan?.adaBerkasAnonim ? (
                    <TombolUnduh
                      alamat={`/api/aleta-ecourt/berkas-sipp?jenis=putusan-anonim&id=${encodeURIComponent(
                        status.identitas.perkaraId
                      )}`}
                      label="Unduh putusan anonim"
                      namaCadangan={`putusan-anonim-${status.identitas.nomorPerkara}.pdf`}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* --- Lampiran lain --- */}
            <div>
              <p className="mb-1 text-sm font-semibold">
                Lampiran lain
                <span className="ml-1 font-normal text-muted-foreground">
                  ({status.dokumenSipp.length} dari SIPP, {status.dokumenEcourt.length} dari e-Court
                  {status.dokumenEcourt.length > 0
                    ? `, ${status.dokumenEcourt.filter((d) => d.statusVerifikasi === "belum").length} menunggu majelis`
                    : ""}
                  )
                </span>
              </p>
              {status.dokumenSipp.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada lampiran SIPP.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {status.dokumenSipp.map((dokumen) => (
                    <li
                      key={dokumen.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0 flex-1 truncate" title={dokumen.namaDokumen}>
                        {dokumen.namaDokumen}
                      </span>
                      <TombolUnduh
                        alamat={`/api/aleta-ecourt/berkas-sipp?jenis=dokumen&id=${encodeURIComponent(
                          dokumen.id
                        )}`}
                        label="Unduh"
                        namaCadangan={dokumen.namaDokumen || "dokumen.pdf"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-sm">
              <span className="text-sm text-muted-foreground">Keterangan saksi: </span>
              {status.saksi.ada
                ? `${status.saksi.jumlahSaksi} saksi, ${status.saksi.jumlahKeterangan} keterangan`
                : "belum ada"}
            </p>
          </div>
        </Bagian>
        <Bagian judul="Biaya perkara" kunci="biaya">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Panjar masuk</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.panjar)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Terpakai</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.terpakai)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-medium">
              <dt>Sisa</dt>
              <dd className="tabular-nums">{rupiah(status.biaya.sisa)}</dd>
            </div>
          </dl>
          {/* Rinciannya - "terpakai Rp 179.500" tidak memberi tahu untuk apa,
              dan justru rincian itulah yang ditanya kasir dan para pihak. */}
          {status.biaya.rincian.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                Rincian {status.biaya.rincian.length} transaksi
              </summary>
              <ul className="mt-1 space-y-0.5">
                {status.biaya.rincian.map((x, urutan) => (
                  <li key={`biaya-${urutan}`} className="flex justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground">{x.tanggal || "—"} </span>
                      {x.uraian || (x.jenis === "masuk" ? "Penerimaan" : "Pengeluaran")}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        x.jenis === "masuk" ? "text-emerald-600" : "text-muted-foreground"
                      )}
                    >
                      {x.jenis === "masuk" ? "+" : "−"}
                      {rupiah(x.jumlah)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {status.biaya.sisa < 0 ? (
            <p className="mt-1 text-sm text-rose-600">
              Pengeluaran melebihi panjar — perlu tambah panjar.
            </p>
          ) : null}
        </Bagian>
      </div>

      {/* ====================================================================
          ANALISA PERKARA
          ====================================================================

          Ditaruh paling bawah dan melebar penuh, bukan di dalam kisi dua
          kolom: garis waktunya perlu lebar, dan yang membacanya biasanya sudah
          melewati seluruh angka di atas lalu bertanya "jadi kenapa perkara ini
          begini". Itu pertanyaan penutup, dan tempatnya memang di penutup.

          Ringkasan diletakkan PALING ATAS di antara keempatnya. Untuk petugas
          yang punya sepuluh detik, kalimatlah yang terbaca; gambarnya dibuka
          kalau kalimatnya bikin penasaran. */}
      {status.analisa ? (
        <Bagian
          judul="Analisa perkara"
          kunci="analisa"
          keterangan="Disusun dari data yang sudah ada di layar ini - tidak ada pembacaan tambahan ke SIPP."
        >
          <div className="space-y-4">
            {/* --- ringkasan --- */}
            {status.analisa.ringkasan.length > 0 ? (
              <ul className="space-y-1">
                {status.analisa.ringkasan.map((kalimat, urutan) => (
                  <li key={`ringkas-${urutan}`} className="flex gap-2 text-sm">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{kalimat}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* --- garis waktu --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Garis waktu
              </h4>
              {status.analisa.garisWaktu.terbaca ? (
                <GarisWaktu garisWaktu={status.analisa.garisWaktu} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.analisa.garisWaktu.alasan}
                </p>
              )}
            </div>

            {/* --- jeda antar sidang --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Jeda antar sidang
              </h4>
              {status.analisa.jedaSidang.terbaca ? (
                <JedaSidang jeda={status.analisa.jedaSidang} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{status.analisa.jedaSidang.alasan}</p>
              )}
            </div>

            {/* --- ketepatan input --- */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Ketepatan input ke SIPP
              </h4>
              {status.analisa.ketepatanInput.terbaca ? (
                <KetepatanInput ketepatan={status.analisa.ketepatanInput} />
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  {status.analisa.ketepatanInput.alasan}
                </p>
              )}
            </div>
          </div>
        </Bagian>
      ) : null}
    </div>
  );
}

/**
 * ============================================================================
 * GARIS WAKTU
 * ============================================================================
 *
 * Digambar dengan div biasa, bukan pustaka chart. Portal ini tidak punya satu
 * pun pustaka semacam itu, dan menambahkannya demi satu batang mendatar berarti
 * menanggung paket baru beserta pembaruannya seumur hidup aplikasi - di server
 * yang tidak selalu punya internet.
 *
 * Tiap titik duduk pada jaraknya yang sebenarnya. Daftarnya di bawah gambar,
 * bukan label yang ditempel di atas titik: pada perkara dengan sepuluh sidang
 * label yang ditempel akan saling menimpa sampai tidak terbaca satu pun.
 */
function GarisWaktu({
  garisWaktu,
}: {
  garisWaktu: NonNullable<Status["analisa"]>["garisWaktu"];
}) {
  const panjang = Math.max(1, Number(garisWaktu.panjangHari) || 1);
  const persen = (hari: number) => Math.min(100, Math.max(0, (hari / panjang) * 100));

  const warna: Record<string, string> = {
    awal: "bg-slate-500",
    penetapan: "bg-sky-500",
    sidang: "bg-amber-500",
    akhir: "bg-emerald-600",
  };

  return (
    <div className="mt-2">
      <div className="relative h-8">
        {/* Batangnya sendiri. */}
        <div className="absolute inset-x-0 top-3.5 h-1.5 rounded-full bg-muted" />

        {/* Bagian yang sudah berjalan sampai akhir - sisanya (minutasi, BHT)
            sengaja dibiarkan berwarna muda supaya terlihat bahwa ia SESUDAH
            perkara itu sendiri berakhir. */}
        <div
          className="absolute top-3.5 h-1.5 rounded-full bg-muted-foreground/30"
          style={{ left: 0, width: `${persen(Number(garisWaktu.totalHari) || 0)}%` }}
        />

        {/* Garis ambang - hanya bila ia memang jatuh di dalam gambarnya. */}
        {garisWaktu.ambangTampak ? (
          <div
            className="absolute top-1 h-6 border-l-2 border-dashed border-rose-400"
            style={{ left: `${persen(Number(garisWaktu.ambangHari) || 0)}%` }}
            title={`Ambang ${garisWaktu.ambangHari} hari`}
          />
        ) : null}

        {garisWaktu.titik.map((satu) => (
          <div
            key={satu.kunci}
            className={cn(
              "absolute top-2.5 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-background",
              warna[satu.jenis] || "bg-slate-400"
            )}
            style={{ left: `${persen(satu.hariKe)}%` }}
            title={`${satu.label} — ${satu.tanggal} (hari ke-${satu.hariKe})`}
          />
        ))}
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{garisWaktu.mulai}</span>
        <span>
          {garisWaktu.totalHari} hari
          {garisWaktu.ambangTampak ? ` · ambang ${garisWaktu.ambangHari} hari` : ""}
        </span>
        <span>{garisWaktu.akhir}</span>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {garisWaktu.titik.map((satu) => (
          <li key={`daftar-${satu.kunci}`} className="flex items-center gap-1.5">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", warna[satu.jenis] || "bg-slate-400")}
            />
            <span className="font-medium">{satu.label}</span>
            <span className="text-muted-foreground">
              {satu.tanggal} · hari ke-{satu.hariKe}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Jeda antar sidang - batang mendatar, panjangnya sebanding harinya.
 *
 * Alasan tundaan ikut ditulis pada barisnya. Tanpa alasan, deretan angka ini
 * hanya memberitahu perkaranya lama; DENGAN alasan, ia memberitahu kenapa.
 */
function JedaSidang({ jeda }: { jeda: NonNullable<Status["analisa"]>["jedaSidang"] }) {
  const terpanjang = Math.max(1, ...jeda.baris.map((x) => x.hari));

  const warna: Record<string, string> = {
    pendaftaran: "bg-slate-400",
    sidang: "bg-amber-500",
    berjalan: "bg-rose-500",
    akhir: "bg-emerald-600",
  };

  return (
    <div className="mt-2 space-y-1">
      {jeda.baris.map((satu, urutan) => (
        <div key={`jeda-${urutan}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-[9rem] text-sm text-muted-foreground">
            {satu.dari} → {satu.ke}
          </span>
          <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", warna[satu.jenis] || "bg-slate-400")}
              style={{ width: `${Math.max(2, (satu.hari / terpanjang) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums">{satu.hari} hari</span>
          {satu.alasan ? (
            <span className="w-full pl-[9rem] text-sm text-muted-foreground sm:w-auto sm:pl-0">
              {satu.alasan}
            </span>
          ) : null}
        </div>
      ))}
      {jeda.rata !== null ? (
        <p className="pt-1 text-sm text-muted-foreground">
          Rata-rata antar sidang {jeda.rata} hari
          {jeda.terpanjang ? ` · terpanjang ${jeda.terpanjang.hari} hari` : ""}.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Ketepatan input ke SIPP.
 *
 * Angka ini sudah dipakai menilai perkara menurut SK, tetapi selama ini
 * terkubur di dalam daftar unsur. Ia satu-satunya bagian nilai yang dapat
 * diperbaiki SEKARANG - tanggalnya sudah lewat, tetapi kebiasaan menginputnya
 * masih dapat diubah untuk perkara berikutnya.
 */
function KetepatanInput({
  ketepatan,
}: {
  ketepatan: NonNullable<Status["analisa"]>["ketepatanInput"];
}) {
  return (
    <div className="mt-2 space-y-1">
      {ketepatan.baris.map((satu) => (
        <div key={`input-${satu.kunci}`} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="min-w-[9rem] flex-1">
            <span className="font-medium">{satu.label}</span>{" "}
            <span className="text-sm text-muted-foreground">
              {satu.tanggal} → {satu.diinput}
            </span>
          </span>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                satu.poin >= 5
                  ? "bg-emerald-500"
                  : satu.poin >= 2
                    ? "bg-amber-500"
                    : "bg-rose-500"
              )}
              style={{ width: `${(satu.poin / satu.poinMaksimal) * 100}%` }}
            />
          </div>
          <span className="w-32 shrink-0 text-right text-sm text-muted-foreground">
            {satu.sebutan}
          </span>
        </div>
      ))}
      {ketepatan.dasar ? (
        <p className="pt-1 text-sm text-muted-foreground">{ketepatan.dasar}</p>
      ) : null}
    </div>
  );
}
