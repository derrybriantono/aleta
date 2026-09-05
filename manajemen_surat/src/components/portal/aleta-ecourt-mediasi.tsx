"use client";

/**
 * Jadwal pertemuan mediasi.
 *
 * ============================================================================
 * LAYAR SENDIRI, BUKAN SELIPAN DI JADWAL SIDANG
 * ============================================================================
 *
 * Pertemuan mediasi tersimpan di tabel SIPP sendiri dan tidak pernah ikut pada
 * jadwal sidang, sehingga layar Jadwal Sidang tidak memperlihatkannya sama
 * sekali - padahal mediasi berjalan pada jam kerja yang sama dan memakai
 * ruangan yang sama.
 *
 * Dipisah karena yang ditanyakan memang berbeda. Jadwal sidang ditanya "siapa
 * majelisnya, relaasnya sudah belum". Jadwal mediasi ditanya "siapa
 * mediatornya, dan berapa hari lagi tenggangnya habis" - PERMA 1/2016 Pasal 24
 * memberi paling lama 30 hari sejak mediator ditetapkan, dan tenggat itu tidak
 * muncul di mana pun pada SIPP.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { Filter, X } from "lucide-react";

import {
  ChipSaring,
  KepalaUrut,
  PanelCariLanjut,
  cocokTeks,
  dalamRentang,
  useCariLanjut,
  useUrutan,
  urutkan,
} from "@/components/portal/tabel-kendali";

type Mediasi = {
  mediasiId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggal: string;
  jam: string;
  sampaiJam: string;
  tempat: string;
  dihadiri: string;
  ditunda: boolean;
  mediator: string;
  statusMediator: string;
  jenisMediasi: string;
  nomorSk: string;
  penetapanMediator: string;
  laporanMediator: string;
  selesai: boolean;
  hasil: string;
  hasilTeks: string;
  lamaHari: number | null;
  tenggatPerma: string;
  sisaHariTenggat: number | null;
  lewatTenggang: boolean;
  pihak: { penggugat: string[]; tergugat: string[] };
};

function hariIni() {
  const t = new Date();
  const bulan = String(t.getMonth() + 1).padStart(2, "0");
  const hari = String(t.getDate()).padStart(2, "0");
  return `${t.getFullYear()}-${bulan}-${hari}`;
}

/** Menggeser tanggal ISO sebanyak n hari, tanpa tergelincir zona waktu. */
function geser(tanggalIso: string, jumlah: number) {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalIso);
  if (!cocok) return tanggalIso;
  const titik = new Date(Date.UTC(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3])));
  titik.setUTCDate(titik.getUTCDate() + jumlah);
  return titik.toISOString().slice(0, 10);
}

/**
 * Keterangan sisa tenggang.
 *
 * Mediasi yang laporannya SUDAH masuk tidak lagi menuntut apa pun, berapa pun
 * lamanya - menandainya merah hanya menyalakan peringatan atas pekerjaan yang
 * sudah beres.
 */
function KeteranganTenggang({ baris }: { baris: Mediasi }) {
  if (baris.selesai) {
    return (
      <Badge variant="success">
        selesai{baris.lamaHari ? ` · ${baris.lamaHari} hari` : ""}
      </Badge>
    );
  }
  if (baris.sisaHariTenggat === null) {
    return <span className="text-xs text-muted-foreground">tenggat belum terbaca</span>;
  }
  if (baris.sisaHariTenggat < 0) {
    return <Badge variant="danger">lewat {Math.abs(baris.sisaHariTenggat)} hari</Badge>;
  }
  if (baris.sisaHariTenggat <= 7) {
    return <Badge variant="warning">{baris.sisaHariTenggat} hari lagi</Badge>;
  }
  return <Badge variant="muted">{baris.sisaHariTenggat} hari lagi</Badge>;
}

/**
 * ============================================================================
 * NILAI YANG DIURUTKAN UNTUK TIAP KOLOM
 * ============================================================================
 *
 * Kolom Tenggang menampilkan lencana - "24 hari lagi", "lewat 3 hari",
 * "selesai · 26 hari". Yang diurutkan BUKAN tulisannya melainkan sisa harinya,
 * sebab mengurut tulisannya menaruh "9 hari lagi" sesudah "24 hari lagi".
 *
 * Mediasi yang sudah selesai dikembalikan kosong sehingga jatuh ke bawah:
 * yang dicari saat mengurut kolom ini adalah yang tenggangnya masih berjalan.
 */
function nilaiUrutMediasi(baris: Mediasi, kunci: string): unknown {
  switch (kunci) {
    case "waktu":
      // Tanggalnya ikut - rentang beberapa hari memuat jam yang sama dari
      // hari yang berbeda, dan mengurut jam saja mencampurnya.
      return `${baris.tanggal} ${baris.jam}`;
    case "perkara":
      return baris.nomorPerkara;
    case "mediator":
      return baris.mediator;
    case "tempat":
      return baris.tempat;
    case "tenggang":
      return baris.selesai ? "" : baris.sisaHariTenggat;
    case "hasil":
      return baris.hasilTeks;
    default:
      return "";
  }
}

/** Apakah mediatornya hakim - berbeda kewenangan dan berbeda pencatatannya. */
function mediatorHakim(baris: Mediasi) {
  return /hakim/i.test(baris.statusMediator || "");
}

/**
 * ============================================================================
 * KEADAAN YANG DAPAT DISARING
 * ============================================================================
 *
 * Pertanyaan yang benar-benar ditanya tentang mediasi: mana yang tenggangnya
 * sudah lewat, mana yang tinggal beberapa hari, mana yang laporannya belum
 * masuk padahal pertemuannya sudah lama.
 *
 * "Berhasil" dan "Tidak berhasil" dipisah dari "Selesai" karena keduanya
 * pertanyaan yang berbeda - yang satu tentang beban kerja, yang lain tentang
 * angka keberhasilan yang dilaporkan tiap bulan.
 */
type KeadaanMediasi = {
  kunci: string;
  label: string;
  nada: "bahaya" | "awas" | "aman" | "sejuk" | "netral";
  judul: string;
  cocok: (baris: Mediasi) => boolean;
};

const KEADAAN_MEDIASI: KeadaanMediasi[] = [
  {
    kunci: "lewat",
    label: "Lewat tenggang",
    nada: "bahaya",
    judul: "Sudah melewati 30 hari sejak mediator ditetapkan, dan laporannya belum masuk.",
    cocok: (x) => !x.selesai && x.lewatTenggang,
  },
  {
    kunci: "segera",
    label: "Tinggal ≤ 7 hari",
    nada: "awas",
    judul: "Tenggang 30 harinya tinggal sepekan atau kurang.",
    cocok: (x) =>
      !x.selesai &&
      x.sisaHariTenggat !== null &&
      x.sisaHariTenggat >= 0 &&
      x.sisaHariTenggat <= 7,
  },
  {
    kunci: "ditunda",
    label: "Ditunda",
    nada: "awas",
    judul: "Pertemuan mediasi ditunda.",
    cocok: (x) => x.ditunda,
  },
  {
    kunci: "belum-hasil",
    label: "Belum ada hasil",
    nada: "netral",
    judul: "Hasil mediasinya belum dicatat di SIPP.",
    cocok: (x) => !x.hasilTeks,
  },
  {
    kunci: "berhasil",
    label: "Berhasil",
    nada: "aman",
    judul: "Mediasi berhasil, seluruhnya maupun sebagian.",
    cocok: (x) => /berhasil/i.test(x.hasilTeks || "") && !/tidak/i.test(x.hasilTeks || ""),
  },
  {
    kunci: "tidak-berhasil",
    label: "Tidak berhasil",
    nada: "netral",
    judul: "Mediasi dinyatakan tidak berhasil atau tidak dapat dilaksanakan.",
    cocok: (x) => /tidak/i.test(x.hasilTeks || ""),
  },
  {
    kunci: "selesai",
    label: "Laporan sudah masuk",
    nada: "aman",
    judul: "Laporan mediator sudah diterima - tenggangnya tidak lagi dihitung.",
    cocok: (x) => x.selesai,
  },
  {
    kunci: "hakim-mediator",
    label: "Hakim mediator",
    nada: "sejuk",
    judul: "Mediatornya hakim pada pengadilan ini.",
    cocok: (x) => mediatorHakim(x),
  },
  {
    kunci: "mediator-luar",
    label: "Mediator non-hakim",
    nada: "sejuk",
    judul: "Mediatornya bukan hakim - mediator bersertifikat dari luar.",
    cocok: (x) => Boolean(x.mediator) && !mediatorHakim(x),
  },
  {
    kunci: "tanpa-mediator",
    label: "Mediator belum ada",
    nada: "bahaya",
    judul: "Mediatornya belum tercatat, padahal pertemuannya sudah dijadwalkan.",
    cocok: (x) => !x.mediator,
  },
];

/** Medan pencarian lanjutan untuk jadwal mediasi. */
const MEDAN_CARI_MEDIASI = [
  { kunci: "nomor", label: "Nomor perkara", petunjuk: "506/Pdt.G/2026" },
  { kunci: "pihak", label: "Nama pihak", petunjuk: "penggugat atau tergugat" },
  { kunci: "jenis", label: "Jenis perkara", petunjuk: "Harta Bersama" },
  { kunci: "mediator", label: "Mediator", petunjuk: "nama mediator" },
  { kunci: "tempat", label: "Tempat", petunjuk: "ruang mediasi" },
  { kunci: "hasil", label: "Hasil", petunjuk: "Berhasil Sebagian" },
  { kunci: "nomorSk", label: "Nomor SK penetapan", petunjuk: "nomor SK mediator" },
  { kunci: "sisaHari", label: "Sisa hari tenggang", jenis: "angka" as const },
];

/**
 * Menyaring satu baris dengan isian pencarian lanjutan.
 *
 * Seluruh medan digabung dengan "dan"; yang dikosongkan tidak ikut menyaring.
 */
function cocokCariLanjutMediasi(baris: Mediasi, isian: Record<string, string>) {
  const pihak = [...baris.pihak.penggugat, ...baris.pihak.tergugat].join(" ");

  return (
    cocokTeks(baris.nomorPerkara, isian.nomor ?? "") &&
    cocokTeks(pihak, isian.pihak ?? "") &&
    cocokTeks(baris.jenisPerkara, isian.jenis ?? "") &&
    cocokTeks(`${baris.mediator} ${baris.statusMediator}`, isian.mediator ?? "") &&
    cocokTeks(baris.tempat, isian.tempat ?? "") &&
    cocokTeks(baris.hasilTeks, isian.hasil ?? "") &&
    cocokTeks(baris.nomorSk, isian.nomorSk ?? "") &&
    dalamRentang(baris.sisaHariTenggat, isian.sisaHariDari ?? "", isian.sisaHariSampai ?? "")
  );
}

/** Pencarian cepat: satu kotak yang menyapu seluruh kolom sekaligus. */
function cocokCariCepatMediasi(baris: Mediasi, kata: string) {
  if (!kata.trim()) return true;
  const semua = [
    baris.nomorPerkara,
    baris.jenisPerkara,
    baris.mediator,
    baris.statusMediator,
    baris.tempat,
    baris.hasilTeks,
    baris.nomorSk,
    baris.jam,
    ...baris.pihak.penggugat,
    ...baris.pihak.tergugat,
  ].join(" ");
  return cocokTeks(semua, kata);
}

export function AletaEcourtMediasi({
  onBukaStatus,
}: {
  onBukaStatus?: (nomorPerkara: string) => void;
} = {}) {
  const [dari, setDari] = useState(hariIni());
  const [sampai, setSampai] = useState(hariIni());
  const [cari, setCari] = useState("");
  const [mediasi, setMediasi] = useState<Mediasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState("");
  const [alasan, setAlasan] = useState("");
  const sedangMuat = useRef(false);

  // ==========================================================================
  // URUT, SARING, CARI
  // ==========================================================================
  //
  // Ketiganya bekerja atas baris yang SUDAH termuat - tanpa satu pun kueri ke
  // SIPP. Itu sebabnya ia boleh berjalan pada tiap ketikan, berbeda dari kotak
  // Cari di atas yang dikirim ke SIPP dan menuntut tombol Tampilkan.
  // Dinamai urutTabel, bukan urutan: tiap tabel memetakan barisnya dengan
  // .map((baris, urutan) => ...), dan nama yang sama akan tertutupi indeks
  // baris di dalam map - keadaan pengurutan mendadak berarti nomor urut.
  const { urutan: urutTabel, tekan: tekanUrut } = useUrutan(null);
  const [keadaanTerpilih, setKeadaanTerpilih] = useState<string[]>([]);
  const [cariCepat, setCariCepat] = useState("");
  const [lanjutTerbuka, setLanjutTerbuka] = useState(false);
  const cariLanjut = useCariLanjut();

  const alihkanKeadaan = (kunci: string) =>
    setKeadaanTerpilih((sekarang) =>
      sekarang.includes(kunci) ? sekarang.filter((x) => x !== kunci) : [...sekarang, kunci]
    );

  /**
   * Memuat satu rentang, dengan tanggal DIKIRIM sebagai argumen.
   *
   * Tidak membaca dari state, sehingga dapat dipanggil pada putaran yang sama
   * dengan setDari - saat state-nya belum berubah.
   */
  const muatRentang = useCallback(
    async (mulai: string, akhir: string, kata: string) => {
      if (sedangMuat.current) return;
      sedangMuat.current = true;
      setMemuat(true);
      setPesan("");
      try {
        const params = new URLSearchParams({ dari: mulai, sampai: akhir, cari: kata });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/jadwal-mediasi?${params.toString()}`), {
          cache: "no-store",
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Jadwal mediasi gagal dimuat."));

        const data = isi?.data ?? isi;
        if (data?.available === false) {
          setPesan(String(data.message || "ALETA Bot belum dapat dihubungi."));
          setMediasi([]);
          return;
        }
        setAlasan(String(data?.alasan || ""));
        setMediasi(Array.isArray(data?.mediasi) ? data.mediasi : []);
      } catch (galat) {
        setPesan(galat instanceof Error ? galat.message : String(galat));
        setMediasi([]);
      } finally {
        sedangMuat.current = false;
        setMemuat(false);
      }
    },
    []
  );

  // Pemuatan pertama dilepas ke antrean tugas, mengikuti pola layar lain:
  // memanggil setState langsung di dalam efek melanggar aturan hook React.
  useEffect(() => {
    const tugas = window.setTimeout(() => {
      void muatRentang(hariIni(), hariIni(), "");
    }, 0);
    return () => window.clearTimeout(tugas);
  }, [muatRentang]);

  const geserHari = (jumlah: number) => {
    const baru = geser(dari, jumlah);
    setDari(baru);
    setSampai(baru);
    void muatRentang(baru, baru, cari);
  };

  const perluPerhatian = mediasi.filter((x) => !x.selesai && x.lewatTenggang).length;
  const ditunda = mediasi.filter((x) => x.ditunda).length;

  // Angka pada kotak keadaan dihitung dari SELURUH pertemuan pada rentang ini,
  // bukan dari yang sudah tersaring - kalau ikut menyusut, menyalakan satu
  // saringan membuat saringan lain tampak nol dan mustahil dilepas kembali.
  const jumlahKeadaan = useMemo(() => {
    const hitung: Record<string, number> = {};
    for (const keadaan of KEADAAN_MEDIASI) {
      hitung[keadaan.kunci] = mediasi.filter((baris) => keadaan.cocok(baris)).length;
    }
    return hitung;
  }, [mediasi]);

  const mediasiTampil = useMemo(() => {
    let hasil = mediasi;

    if (keadaanTerpilih.length > 0) {
      const dipilih = KEADAAN_MEDIASI.filter((x) => keadaanTerpilih.includes(x.kunci));
      // "Atau", bukan "dan": menyalakan lewat tenggang dan ditunda sekaligus
      // berarti "tunjukkan yang bermasalah". Menggabungnya dengan "dan"
      // hampir selalu menghasilkan daftar kosong.
      hasil = hasil.filter((baris) => dipilih.some((keadaan) => keadaan.cocok(baris)));
    }

    if (cariCepat.trim()) {
      hasil = hasil.filter((baris) => cocokCariCepatMediasi(baris, cariCepat));
    }

    if (cariLanjut.jumlahAktif > 0) {
      hasil = hasil.filter((baris) => cocokCariLanjutMediasi(baris, cariLanjut.isian));
    }

    return urutkan(hasil, urutTabel, nilaiUrutMediasi);
  }, [mediasi, keadaanTerpilih, cariCepat, cariLanjut.isian, cariLanjut.jumlahAktif, urutTabel]);

  const adaPenyaringTabel =
    keadaanTerpilih.length > 0 || cariCepat.trim() !== "" || cariLanjut.jumlahAktif > 0;

  const bersihkanTabel = () => {
    setKeadaanTerpilih([]);
    setCariCepat("");
    cariLanjut.bersihkan();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jadwal mediasi</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pertemuan mediasi tersimpan terpisah dari jadwal sidang di SIPP, sehingga tidak muncul di
          layar Jadwal Sidang. Tenggangnya 30 hari sejak mediator ditetapkan &mdash; PERMA 1/2016
          Pasal 24.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* --- Penelusuran tanggal --- */}
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" onClick={() => geserHari(-1)} title="Hari sebelumnya">
            ‹
          </Button>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Dari tanggal</span>
            <Input
              type="date"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
              className="w-40"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Sampai tanggal</span>
            <Input
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              className="w-40"
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => geserHari(1)} title="Hari berikutnya">
            ›
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDari(hariIni());
              setSampai(hariIni());
              void muatRentang(hariIni(), hariIni(), cari);
            }}
          >
            Hari ini
          </Button>

          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Cari</span>
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Nomor perkara atau jenis"
              className="w-56"
            />
          </label>
          <Button size="sm" onClick={() => void muatRentang(dari, sampai, cari)} disabled={memuat}>
            {memuat ? "Memuat…" : "Tampilkan"}
          </Button>
        </div>

        {pesan ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {pesan}
          </p>
        ) : null}

        {/* Kegagalan membaca skema disebutkan apa adanya - lengkap dengan nama
            kolom yang benar-benar ada, supaya dapat dilengkapi tanpa membuka
            basis datanya. */}
        {alasan ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {alasan}
          </p>
        ) : null}

        {/* --- Angka ringkas --- */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-2xl font-semibold tabular-nums">{mediasi.length}</div>
            <div className="text-xs text-muted-foreground">Pertemuan mediasi</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div
              className={`text-2xl font-semibold tabular-nums ${
                perluPerhatian > 0 ? "text-rose-600" : ""
              }`}
            >
              {perluPerhatian}
            </div>
            <div className="text-xs text-muted-foreground">Lewat tenggang 30 hari</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className={`text-2xl font-semibold tabular-nums ${ditunda > 0 ? "text-amber-600" : ""}`}>
              {ditunda}
            </div>
            <div className="text-xs text-muted-foreground">Pertemuan ditunda</div>
          </div>
        </div>

        {/* ==================================================================
            KOTAK KEADAAN
            ==================================================================

            Warnanya menyebut arti: yang menuntut tindakan merah, yang perlu
            diperhatikan kuning, yang sudah beres hijau.

            "Berhasil" dan "Tidak berhasil" dipisah dari "Laporan sudah
            masuk" karena keduanya pertanyaan berbeda - yang satu tentang
            beban kerja, yang lain tentang angka keberhasilan yang
            dilaporkan tiap bulan. */}
        {mediasi.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {KEADAAN_MEDIASI.map((keadaan) => (
              <ChipSaring
                key={keadaan.kunci}
                label={keadaan.label}
                jumlah={jumlahKeadaan[keadaan.kunci] ?? 0}
                nada={keadaan.nada}
                judul={keadaan.judul}
                aktif={keadaanTerpilih.includes(keadaan.kunci)}
                onTekan={() => alihkanKeadaan(keadaan.kunci)}
              />
            ))}
          </div>
        ) : null}

        {/* Terpisah dari kotak Cari di atas, dan sengaja: yang di atas dikirim
            ke SIPP dan menuntut tombol Tampilkan; yang ini menyaring baris yang
            sudah termuat, seketika, tanpa satu pun kueri. */}
        {mediasi.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={cariCepat}
              onChange={(e) => setCariCepat(e.target.value)}
              placeholder="Saring di dalam hasil: nomor, pihak, mediator, tempat, hasil…"
              className="h-8 max-w-md flex-1 text-sm"
            />
            <Button
              size="sm"
              variant={lanjutTerbuka || cariLanjut.jumlahAktif > 0 ? "default" : "outline"}
              onClick={() => setLanjutTerbuka((buka) => !buka)}
            >
              <Filter className="mr-1.5 h-4 w-4" />
              Pencarian lanjutan
              {cariLanjut.jumlahAktif > 0 ? ` (${cariLanjut.jumlahAktif})` : ""}
            </Button>

            {adaPenyaringTabel ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {mediasiTampil.length} dari {mediasi.length} pertemuan
                </span>
                <Button size="sm" variant="ghost" onClick={bersihkanTabel}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  Bersihkan
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {lanjutTerbuka && mediasi.length > 0 ? (
          <PanelCariLanjut
            medan={MEDAN_CARI_MEDIASI}
            isian={cariLanjut.isian}
            onUbah={cariLanjut.ubah}
            onBersihkan={cariLanjut.bersihkan}
            jumlahAktif={cariLanjut.jumlahAktif}
          />
        ) : null}

        {/* --- Daftar --- */}
        {mediasi.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {memuat ? "Memuat…" : "Tidak ada pertemuan mediasi pada rentang tanggal ini."}
          </p>
        ) : mediasiTampil.length === 0 ? (
          /* Dibedakan dari rentang yang memang kosong: yang satu menyuruh
             pindah tanggal, yang lain menyuruh melonggarkan saringannya.
             Menyamakan keduanya membuat orang mencari di tanggal lain padahal
             pertemuannya ada di depan mata. */
          <div className="rounded-md border border-dashed px-3 py-6 text-center">
            <p className="text-sm font-medium">
              Tidak ada pertemuan yang cocok dengan saringan ini.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mediasi.length} pertemuan pada rentang ini tidak satu pun cocok.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={bersihkanTabel}>
              Bersihkan saringan
            </Button>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide shadow-sm">
                {/* Tiap kepala dapat ditekan: naik, turun, lalu kembali ke
                    urutan asal. */}
                <tr>
                  <th className="px-2 py-2 text-right font-medium">No</th>
                  <KepalaUrut kunci="waktu" urutan={urutTabel} onTekan={tekanUrut} className="px-2">
                    Waktu
                  </KepalaUrut>
                  <KepalaUrut kunci="perkara" urutan={urutTabel} onTekan={tekanUrut}>
                    Perkara &amp; Para Pihak
                  </KepalaUrut>
                  <KepalaUrut kunci="mediator" urutan={urutTabel} onTekan={tekanUrut}>
                    Mediator
                  </KepalaUrut>
                  <KepalaUrut kunci="tempat" urutan={urutTabel} onTekan={tekanUrut}>
                    Tempat
                  </KepalaUrut>
                  <KepalaUrut
                    kunci="tenggang"
                    urutan={urutTabel}
                    onTekan={tekanUrut}
                    judul="Urutkan menurut sisa hari tenggang; yang laporannya sudah masuk jatuh ke bawah"
                  >
                    Tenggang
                  </KepalaUrut>
                  <KepalaUrut kunci="hasil" urutan={urutTabel} onTekan={tekanUrut}>
                    Hasil
                  </KepalaUrut>
                </tr>
              </thead>
              <tbody>
                {mediasiTampil.map((baris, urutan) => (
                  <tr
                    key={`${baris.mediasiId}-${baris.tanggal}-${baris.jam}-${urutan}`}
                    className="border-t align-top"
                  >
                    <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {urutan + 1}
                    </td>

                    <td className="px-2 py-2">
                      <div className="font-semibold tabular-nums">{baris.jam || "—"}</div>
                      {baris.sampaiJam ? (
                        <div className="text-xs text-muted-foreground">s.d. {baris.sampaiJam}</div>
                      ) : null}
                      {baris.tanggal !== dari ? (
                        <div className="text-xs text-muted-foreground">{baris.tanggal}</div>
                      ) : null}
                      {baris.ditunda ? (
                        <div className="mt-1">
                          <Badge variant="warning">ditunda</Badge>
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2">
                      {onBukaStatus ? (
                        <button
                          type="button"
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                          onClick={() => onBukaStatus(baris.nomorPerkara)}
                          title={`Buka status perkara ${baris.nomorPerkara}`}
                        >
                          {baris.nomorPerkara}
                        </button>
                      ) : (
                        <span className="font-semibold">{baris.nomorPerkara}</span>
                      )}
                      {baris.pihak.penggugat.length > 0 ? (
                        <div
                          className="mt-0.5 max-w-[22rem] truncate text-xs text-muted-foreground"
                          title={[...baris.pihak.penggugat, ...baris.pihak.tergugat].join(" · ")}
                        >
                          {baris.pihak.penggugat[0]}
                          {baris.pihak.tergugat.length > 0
                            ? ` lawan ${baris.pihak.tergugat[0]}`
                            : ""}
                        </div>
                      ) : null}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {baris.jenisPerkara || "—"}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-xs">
                      <div className="font-medium">{baris.mediator || "—"}</div>
                      {baris.statusMediator ? (
                        <div className="text-muted-foreground">{baris.statusMediator}</div>
                      ) : null}
                      {baris.penetapanMediator ? (
                        <div className="text-muted-foreground">
                          ditetapkan {baris.penetapanMediator}
                        </div>
                      ) : null}
                      {baris.nomorSk ? (
                        <div className="text-muted-foreground">SK {baris.nomorSk}</div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 text-xs">
                      {baris.tempat || "—"}
                      {baris.dihadiri ? (
                        <div className="text-muted-foreground">dihadiri {baris.dihadiri}</div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 text-xs">
                      <KeteranganTenggang baris={baris} />
                      {baris.tenggatPerma && !baris.selesai ? (
                        <div className="mt-0.5 text-muted-foreground">
                          batas {baris.tenggatPerma}
                        </div>
                      ) : null}
                      {baris.laporanMediator ? (
                        <div className="mt-0.5 text-muted-foreground">
                          laporan {baris.laporanMediator}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 text-xs">
                      {baris.hasilTeks ? (
                        <span
                          className={
                            /berhasil/i.test(baris.hasilTeks) && !/tidak/i.test(baris.hasilTeks)
                              ? "text-emerald-700 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {baris.hasilTeks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">belum ada hasil</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tenggang 30 hari dihitung sejak <strong>penetapan mediator</strong>, bukan sejak pertemuan
          pertama &mdash; itulah patokan PERMA 1/2016 Pasal 24, dan pertemuan pertama kerap jauh
          sesudahnya. Mediasi yang laporan mediatornya sudah masuk tidak lagi dihitung, berapa pun
          lamanya.
        </p>
      </CardContent>
    </Card>
  );
}
