"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Info, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MEMBANDINGKAN PERKARA DENGAN PERKARA LAIN
 * ============================================================================
 *
 * Pertanyaan yang tiap hari muncul di kepaniteraan dan tidak dapat dijawab
 * satu layar: "perkara ini kok lebih lama dari yang itu?", "majelisnya sama
 * tidak?", "yang itu berapa kali sidang?". Selama ini jawabannya menuntut dua
 * jendela SIPP dibuka berdampingan, lalu mata yang membandingkannya sendiri -
 * dan mata yang membandingkan dua layar berbeda kerap membandingkan baris yang
 * berbeda pula.
 *
 * ============================================================================
 * SUMBERNYA ALAMAT YANG SAMA, BUKAN ALAMAT BARU
 * ============================================================================
 *
 * Perkara pembanding dibaca lewat alamat status perkara yang SAMA dengan yang
 * sedang dibuka. Tidak ada kueri baru, tidak ada bentuk data kedua yang harus
 * dijaga tetap sejalan - dan itu penting: dua bentuk data yang menggambarkan
 * hal yang sama akan menyimpang diam-diam, dan yang menyimpang justru
 * perbandingannya.
 *
 * ============================================================================
 * DICARI DAHULU, BARU DIJAJARKAN - SAMA DENGAN KOTAK PENCARIAN DI ATASNYA
 * ============================================================================
 *
 * Kotak ini dahulu menuntut nomor perkara UTUH. Petugas yang mengetik "233" -
 * persis yang diterima kotak pencarian beberapa baris di atasnya - dijawab
 * "perkara tidak ditemukan", padahal perkaranya ada; begitu pula kata keadaan
 * seperti "verstek". Dua kotak yang berdampingan namun menerima isian berbeda
 * tidak dibaca orang sebagai dua kemampuan, melainkan sebagai satu yang rusak.
 *
 * Karena itu isian di sini melewati PENCARIAN yang sama lebih dahulu: nomor
 * urut saja, nomor utuh, kata keadaan, atau nama pihak. Satu yang cocok
 * langsung dijajarkan; lebih dari satu DITAWARKAN untuk dipilih - sebab "233"
 * dapat berarti Pdt.G maupun Pdt.P dan tahun yang berbeda, dan mengambil salah
 * satunya begitu saja berarti membandingkan perkara yang keliru tanpa ada yang
 * menyadarinya.
 *
 * ============================================================================
 * SELISIHNYA DIHITUNG, BUKAN DIBIARKAN DIHITUNG MATA
 * ============================================================================
 *
 * Kolom ketiga memuat SELISIHNYA. Dua angka berdampingan masih menuntut
 * pembacanya mengurangi sendiri - dan itulah pekerjaan yang sedang ia hindari
 * dengan membuka layar ini. Yang tidak berupa angka dibandingkan sebagai sama
 * atau berbeda, sebab "Majelis A" lawan "Majelis C1" tidak punya selisih.
 */

type Ringkas = {
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  tanggalPutusan: string;
  statusPutusan: string;
  sudahPutus: boolean;
  hariBerjalan: number | null;
  hariMinutasi: number | null;
  jumlahSidang: number;
  jumlahPenundaan: number;
  majelis: string;
  panitera: string;
  jumlahPihak: number;
  adaMediasi: boolean;
};

/**
 * Satu perkara pada DAFTAR hasil pencarian - bukan muatan status yang penuh.
 *
 * Bentuknya sengaja disalin dari layar Status Perkara, bukan dibagi lewat
 * berkas bersama: yang dipakai di sini hanya secukupnya untuk membedakan satu
 * kartu dari kartu lain, dan menyeret tipe besar ke sini justru mengikat
 * perbandingan pada medan yang tidak pernah ditampilkannya.
 */
type Ditemukan = {
  nomorPerkara: string;
  jenisPerkara?: string;
  tanggalDaftar?: string;
  sudahPutus?: boolean;
  tanggalPutusan?: string;
  /**
   * Mengapa perkara ini muncul.
   *
   * Saat yang diketik kata keadaan atau nama pihak, tidak satu pun keterangan
   * lain di kartu ini menyebut kata itu - dan daftar berisi dua puluh nomor
   * perkara tidak dapat dibedakan satu sama lain.
   */
  cocok?: Array<{ medan: string; nilai: string }>;
};

type StatusMentah = {
  identitas?: { nomorPerkara?: string; jenisPerkara?: string; tanggalDaftar?: string } | null;
  umur?: { hariBerjalan?: number | null; hariMinutasi?: number | null; sudahPutus?: boolean } | null;
  // Boleh null - perkara yang belum putus memulangkan putusan: null, bukan
  // obyek kosong. Tipe yang tidak mengakuinya menolak SELURUH muatan status.
  putusan?: { tanggalPutusan?: string; statusPutusan?: string; sudahPutus?: boolean } | null;
  majelis?: Array<{ kode?: string; nama?: string; jabatan?: string }> | null;
  panitera?: Array<{ nama?: string }> | null;
  jadwal?: Array<{ ditunda?: boolean }> | null;
  penundaan?: Array<unknown> | null;
  pihak?: Array<{ jenis?: string }> | null;
  mediasi?: {
    terbaca?: boolean;
    jadwal?: Array<unknown>;
    mediator?: Array<unknown>;
  } | null;
};

/** Menyusut muatan status yang besar menjadi yang sungguh dibandingkan. */
export function ringkasDariStatus(status: StatusMentah): Ringkas {
  const majelis = (status.majelis ?? [])
    .map((x) => String(x.kode || x.nama || "").trim())
    .filter(Boolean);
  return {
    nomorPerkara: String(status.identitas?.nomorPerkara || ""),
    jenisPerkara: String(status.identitas?.jenisPerkara || ""),
    tanggalDaftar: String(status.identitas?.tanggalDaftar || ""),
    tanggalPutusan: String(status.putusan?.tanggalPutusan || ""),
    statusPutusan: String(status.putusan?.statusPutusan || ""),
    sudahPutus: Boolean(status.putusan?.sudahPutus ?? status.umur?.sudahPutus),
    hariBerjalan:
      typeof status.umur?.hariBerjalan === "number" ? status.umur.hariBerjalan : null,
    hariMinutasi:
      typeof status.umur?.hariMinutasi === "number" ? status.umur.hariMinutasi : null,
    jumlahSidang: (status.jadwal ?? []).length,
    jumlahPenundaan: (status.penundaan ?? []).length,
    majelis: majelis.join(", "),
    panitera: (status.panitera ?? [])
      .map((x) => String(x.nama || "").trim())
      .filter(Boolean)
      .join(", "),
    // Saksi dan kuasa tidak dihitung sebagai pihak - yang dibandingkan
    // BANYAKNYA ORANG BERPERKARA, bukan banyaknya nama yang tercatat.
    jumlahPihak: (status.pihak ?? []).filter((x) => String(x.jenis || "") !== "kuasa").length,
    // Tidak ada kolom "ada mediasi" - yang ada jadwal dan mediatornya.
    // Salah satunya berisi sudah cukup menyatakan mediasinya berjalan.
    adaMediasi:
      (status.mediasi?.jadwal ?? []).length > 0 || (status.mediasi?.mediator ?? []).length > 0,
  };
}

/**
 * Paling banyak empat pembanding.
 *
 * Bukan angka yang dikarang: dengan kolom label, kolom perkara yang sedang
 * dibuka, dan kolom selisih, empat pembanding sudah membuat tabelnya berkolom
 * tujuh - dan tabel berkolom tujuh menuntut digulung ke samping pada layar
 * petugas. Perbandingan yang harus digulung bukan perbandingan lagi: yang
 * dibandingkan orang justru dua kolom yang tidak dapat dilihat bersamaan.
 */
const BATAS_BANDING = 4;

/**
 * Banyaknya perkara yang ditawarkan saat isiannya cocok pada lebih dari satu.
 *
 * Lebih kecil daripada pencarian utama yang meminta seratus: di sini daftarnya
 * bukan hasil yang dibaca, melainkan pilihan yang harus ditunjuk SEKARANG -
 * dan seratus kartu di bawah kotak isian bukan pilihan lagi, melainkan layar
 * kedua yang menutupi tabel perbandingan yang sedang dikerjakan orangnya.
 */
const BATAS_CARI = 25;

const angka = (n: number) => n.toLocaleString("id-ID");

/**
 * Hasil percobaan menambahkan satu perkara.
 *
 * Bukan sekadar kalimat galat: pemanggilnya perlu membedakan "tidak ada yang
 * cocok" - satu-satunya keadaan yang masih layak dicoba ulang sebagai nomor
 * utuh - dari sebab lain seperti gerbang yang mati. Membedakannya dengan
 * mencocokkan kalimat galat akan putus diam-diam begitu kalimatnya disunting.
 */
type HasilTambah = { ok: true } | { ok: false; tidakDitemukan: boolean; pesan: string };

/** Satu baris perbandingan - label, dua nilai, dan selisihnya. */
type Baris = {
  label: string;
  kiri: string;
  kanan: string;
  /** Selisih yang sudah berbentuk kalimat, atau kosong bila tidak sebanding. */
  selisih: string;
  /** Benar bila keduanya sama - dipakai meredupkan baris yang tidak menarik. */
  sama: boolean;
};

function bandingAngka(label: string, a: number | null, b: number | null, satuan: string): Baris {
  const kiri = a === null ? "—" : `${angka(a)} ${satuan}`;
  const kanan = b === null ? "—" : `${angka(b)} ${satuan}`;
  if (a === null || b === null) {
    return { label, kiri, kanan, selisih: "", sama: false };
  }
  const beda = b - a;
  return {
    label,
    kiri,
    kanan,
    selisih:
      beda === 0
        ? "sama"
        : `${beda > 0 ? "+" : "−"}${angka(Math.abs(beda))} ${satuan}`,
    sama: beda === 0,
  };
}

function bandingTeks(label: string, a: string, b: string): Baris {
  const kiri = a || "—";
  const kanan = b || "—";
  const sama = Boolean(a) && a === b;
  return {
    label,
    kiri,
    kanan,
    selisih: !a || !b ? "" : sama ? "sama" : "berbeda",
    sama,
  };
}

export function BandingPerkara({ sekarang }: { sekarang: Ringkas }) {
  const [nomor, setNomor] = useState("");
  /**
   * Perkara pembanding - JAMAK.
   *
   * Sengaja dibatasi empat. Tabel berkolom tujuh sudah menuntut digulung ke
   * samping pada layar petugas, dan perbandingan yang harus digulung bukan
   * perbandingan lagi.
   */
  const [lawan, setLawan] = useState<Ringkas[]>([]);
  /**
   * Perkara yang cocok pada isian, tetapi belum tentu yang dimaksud.
   *
   * Hanya terisi bila cocoknya LEBIH DARI SATU. Satu yang cocok tidak pernah
   * ditawarkan - menyuruh orang menunjuk satu-satunya pilihan yang ada adalah
   * ketukan yang tidak menjawab apa pun.
   */
  const [pilihan, setPilihan] = useState<Ditemukan[]>([]);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);

  const penuh = lawan.length >= BATAS_BANDING;

  /**
   * Membaca satu perkara dari nomornya yang UTUH, lalu menaruhnya di tabel.
   *
   * Pemeriksaan "sedang dibuka" dan "sudah ada" dijalankan di sini, bukan di
   * pemanggilnya: nomor dapat datang dari isian yang diketik maupun dari kartu
   * yang ditunjuk, dan dua salinan pemeriksaan yang sama akan menyimpang.
   */
  const tambahNomor = useCallback(
    async (nomorPerkara: string): Promise<HasilTambah> => {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?nomor=${encodeURIComponent(nomorPerkara)}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca perkara pembanding."));
      const data = isi?.data ?? isi;
      if (!data?.available) {
        return {
          ok: false,
          tidakDitemukan: false,
          pesan: String(data?.message || "ALETA Bot belum dapat dihubungi."),
        };
      }
      if (!data.status) {
        const tidakDitemukan = String(data.alasan) === "perkara_tidak_ditemukan";
        return {
          ok: false,
          tidakDitemukan,
          pesan: tidakDitemukan
            ? "Perkara pembanding tidak ditemukan di SIPP."
            : String(data.alasan || "Perkara pembanding tidak dapat dibaca."),
        };
      }
      const ringkas = ringkasDariStatus(data.status as StatusMentah);
      if (ringkas.nomorPerkara === sekarang.nomorPerkara) {
        return {
          ok: false,
          tidakDitemukan: false,
          pesan: "Itu perkara yang sedang dibuka — pilih perkara yang lain.",
        };
      }
      if (lawan.some((x) => x.nomorPerkara === ringkas.nomorPerkara)) {
        return {
          ok: false,
          tidakDitemukan: false,
          pesan: "Perkara itu sudah ada di dalam perbandingan.",
        };
      }
      setLawan((lama) => [...lama, ringkas]);
      setPilihan([]);
      setNomor("");
      return { ok: true };
    },
    [lawan, sekarang.nomorPerkara]
  );

  /**
   * Isian diselesaikan: dicari dahulu, baru dibaca.
   *
   * Urutannya penting. Yang diketik orang paling sering BUKAN nomor utuh
   * melainkan nomor urutnya saja, dan pencarianlah yang tahu nomor urut itu
   * milik perkara yang mana.
   */
  const ambil = useCallback(async () => {
    const dicari = nomor.trim();
    if (!dicari) return;
    if (penuh) {
      setGalat(`Paling banyak ${BATAS_BANDING} pembanding - hapus salah satu lebih dahulu.`);
      return;
    }
    setMemuat(true);
    setGalat("");
    setPilihan([]);
    try {
      const kueri = new URLSearchParams({ cari: dicari, batas: String(BATAS_CARI) });
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?${kueri.toString()}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal mencari perkara pembanding."));
      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }

      const ditemukan = ((data.perkara ?? []) as Ditemukan[]).filter((x) =>
        String(x?.nomorPerkara || "").trim()
      );

      // Yang sedang dibuka dan yang sudah dijajarkan dikeluarkan dari pilihan.
      // Membiarkannya berarti menawarkan ketukan yang pasti dijawab penolakan.
      const tersisa = ditemukan.filter(
        (x) =>
          x.nomorPerkara !== sekarang.nomorPerkara &&
          !lawan.some((l) => l.nomorPerkara === x.nomorPerkara)
      );

      if (tersisa.length > 1) {
        setPilihan(tersisa);
        return;
      }

      if (tersisa.length === 1) {
        const hasil = await tambahNomor(tersisa[0].nomorPerkara);
        if (!hasil.ok) setGalat(hasil.pesan);
        return;
      }

      // Cocok seluruhnya, tetapi tidak ada yang tersisa untuk ditambahkan.
      if (ditemukan.length > 0) {
        setGalat(
          ditemukan.length === 1
            ? "Perkara yang cocok itu sudah ada di dalam perbandingan."
            : "Seluruh perkara yang cocok sudah ada di dalam perbandingan."
        );
        return;
      }

      // Pencarian tidak mengenalinya. Masih dicoba sebagai nomor perkara utuh:
      // pencarian dan pembacaan satu perkara tidak selalu menjangkau register
      // yang persis sama, dan menyerah di sini akan menolak nomor yang sah.
      const hasil = await tambahNomor(dicari);
      if (!hasil.ok) {
        setGalat(
          hasil.tidakDitemukan
            ? `Tidak ada perkara yang cocok dengan "${dicari}".`
            : hasil.pesan
        );
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Perkara pembanding tidak dapat dibaca.");
    } finally {
      setMemuat(false);
    }
  }, [nomor, penuh, sekarang.nomorPerkara, lawan, tambahNomor]);

  /** Satu kartu pada daftar pilihan ditunjuk. */
  const pilih = useCallback(
    async (nomorPerkara: string) => {
      if (penuh) {
        setGalat(`Paling banyak ${BATAS_BANDING} pembanding - hapus salah satu lebih dahulu.`);
        return;
      }
      setMemuat(true);
      setGalat("");
      try {
        const hasil = await tambahNomor(nomorPerkara);
        if (!hasil.ok) setGalat(hasil.pesan);
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Perkara pembanding tidak dapat dibaca.");
      } finally {
        setMemuat(false);
      }
    },
    [penuh, tambahNomor]
  );

  /**
   * Baris perbandingan untuk SATU pembanding.
   *
   * Dipisah menjadi fungsi supaya kolom kedua, ketiga, dan keempat disusun
   * dengan aturan yang persis sama - bukan tiga salinan yang akan menyimpang
   * diam-diam begitu satu butir ditambahkan.
   */
  const barisUntuk = useCallback(
    (lawanSatu: Ringkas): Baris[] => [
      bandingTeks("Jenis perkara", sekarang.jenisPerkara, lawanSatu.jenisPerkara),
      bandingTeks("Tanggal daftar", sekarang.tanggalDaftar, lawanSatu.tanggalDaftar),
      bandingTeks("Tanggal putusan", sekarang.tanggalPutusan, lawanSatu.tanggalPutusan),
      bandingTeks("Status putusan", sekarang.statusPutusan, lawanSatu.statusPutusan),
      bandingAngka("Lama proses", sekarang.hariBerjalan, lawanSatu.hariBerjalan, "hari"),
      bandingAngka("Jeda minutasi", sekarang.hariMinutasi, lawanSatu.hariMinutasi, "hari"),
      bandingAngka("Jumlah sidang", sekarang.jumlahSidang, lawanSatu.jumlahSidang, "kali"),
      bandingAngka("Penundaan", sekarang.jumlahPenundaan, lawanSatu.jumlahPenundaan, "kali"),
      bandingAngka("Pihak berperkara", sekarang.jumlahPihak, lawanSatu.jumlahPihak, "orang"),
      bandingTeks("Majelis", sekarang.majelis, lawanSatu.majelis),
      bandingTeks("Panitera sidang", sekarang.panitera, lawanSatu.panitera),
      bandingTeks(
        "Mediasi",
        sekarang.adaMediasi ? "ada" : "tidak ada",
        lawanSatu.adaMediasi ? "ada" : "tidak ada"
      ),
    ],
    [sekarang]
  );

  /** Satu baris label, lalu satu kolom per pembanding. */
  const tabel = useMemo(() => {
    if (lawan.length === 0) return [];
    const kolom = lawan.map((l) => barisUntuk(l));
    return kolom[0].map((_, i) => ({
      label: kolom[0][i].label,
      kiri: kolom[0][i].kiri,
      kolom: kolom.map((k) => k[i]),
    }));
  }, [lawan, barisUntuk]);

  const berbeda = tabel.filter((b) => b.kolom.some((k) => !k.sama && k.selisih)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Nomor perkara pembanding
          <Input
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void ambil();
              }
            }}
            placeholder="473, 473/Pdt.G/2026/PA.Dgl, verstek, atau nama pihak"
          />
        </label>
        <Button type="button" onClick={() => void ambil()} disabled={memuat || !nomor.trim()}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {memuat ? "Membaca…" : lawan.length === 0 ? "Bandingkan" : "Tambah pembanding"}
        </Button>
        {lawan.length > 0 || pilihan.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLawan([]);
              setPilihan([]);
              setNomor("");
              setGalat("");
            }}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden />
            Bersihkan
          </Button>
        ) : null}
      </div>

      {galat ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{galat}</span>
        </p>
      ) : null}

      {/* Daftar pilihan hanya muncul bila memang ada lebih dari satu yang cocok.
          Satu yang cocok sudah langsung dijajarkan tanpa menuntut ketukan. */}
      {pilihan.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {pilihan.length} perkara cocok dengan yang diketik — pilih yang akan dibandingkan:
          </p>
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {pilihan.map((item) => (
              <button
                key={item.nomorPerkara}
                type="button"
                disabled={memuat}
                onClick={() => void pilih(item.nomorPerkara)}
                className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/50 disabled:opacity-60"
              >
                <p className="text-sm font-medium">{item.nomorPerkara}</p>
                <p className="text-xs text-muted-foreground">{item.jenisPerkara || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Daftar {item.tanggalDaftar || "—"}
                  {item.sudahPutus ? ` · putus ${item.tanggalPutusan || "—"}` : " · belum putus"}
                </p>

                {/* APA yang cocok, bukan sekadar bahwa ia cocok. Tanpa ini,
                    mengetik "verstek" menghasilkan dua puluh kartu yang tidak
                    satu pun menyebut kata itu. */}
                {item.cocok && item.cocok.length > 0 ? (
                  <div className="mt-2 space-y-0.5 border-t pt-2">
                    {item.cocok.map((satu) => (
                      <p key={satu.medan} className="text-[11px] leading-snug">
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

      {lawan.length === 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Isi perkara lain untuk menjajarkannya dengan perkara ini — sampai {BATAS_BANDING}{" "}
            sekaligus. Isiannya sama dengan kotak pencarian di atas: cukup nomor urutnya saja,
            nomor perkara utuh, kata keadaan seperti verstek, atau nama pihak; bila cocoknya lebih
            dari satu, perkaranya ditawarkan untuk dipilih. Yang dibandingkan jenisnya, tanggalnya,
            lama prosesnya, banyaknya sidang dan penundaan, majelis, panitera sidang, dan
            mediasinya — beserta selisihnya, supaya tidak perlu dikurangi sendiri.
          </span>
        </p>
      ) : (
        <>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {berbeda === 0
                ? "Seluruh butir yang dibandingkan sama."
                : `${berbeda} butir berbeda dari ${tabel.length} yang dibandingkan` +
                  (lawan.length > 1 ? ` pada ${lawan.length} pembanding.` : ".")}
            </span>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Butir</th>
                  <th className="px-3 py-2 font-medium">{sekarang.nomorPerkara}</th>
                  {lawan.map((l) => (
                    <th key={l.nomorPerkara} className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {l.nomorPerkara}
                        <button
                          type="button"
                          onClick={() =>
                            setLawan((lama) => lama.filter((x) => x.nomorPerkara !== l.nomorPerkara))
                          }
                          title="Keluarkan dari perbandingan"
                          className="text-muted-foreground transition hover:text-foreground"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {tabel.map((b) => {
                  const semuaSama = b.kolom.every((k) => k.sama);
                  return (
                    <tr
                      key={b.label}
                      className={cn(
                        "border-b border-border/60 last:border-0",
                        // Yang SAMA diredupkan, bukan disembunyikan: menghilangkannya
                        // membuat pembaca menyangka butirnya tidak diperiksa.
                        semuaSama && "text-muted-foreground"
                      )}
                    >
                      <td className="px-3 py-1.5">{b.label}</td>
                      <td className="px-3 py-1.5">{b.kiri}</td>
                      {b.kolom.map((k, i) => (
                        <td key={i} className="px-3 py-1.5">
                          {k.kanan}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {b.kolom
                          .map((k) => k.selisih || "—")
                          .join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Selisih selalu dihitung dari perkara INI ke tiap pembanding - bukan berantai dari
            kolom sebelahnya: yang dibandingkan orang adalah perkaranya sendiri dengan yang lain.
            Tanda tambah berarti pembandingnya lebih besar. Paling banyak {BATAS_BANDING}
            pembanding; tabel berkolom tujuh sudah menuntut digulung ke samping, dan perbandingan
            yang harus digulung bukan perbandingan lagi.
          </p>
        </>
      )}
    </div>
  );
}
