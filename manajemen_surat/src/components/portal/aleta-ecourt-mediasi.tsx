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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { tanggalHariPendek } from "@/lib/tanggal-indonesia";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { GalatJawaban, bacaJsonAman, botTakTerjangkau, useCobaLagiOtomatis } from "@/lib/coba-lagi-otomatis";
import { usePesanSementara } from "@/lib/pesan-sementara";
import { cn } from "@/lib/utils";
import { BannerGangguan } from "@/components/portal/banner-gangguan";
import { TombolTutupPesan } from "@/components/portal/tombol-tutup-pesan";
import {
  adaMediatorHakim,
  adaMediatorNonHakim,
  daftarMediator,
  namaTiapMediator,
  sebutanMediator,
  statusMediatorBelumTercatat,
} from "@/lib/sebutan-mediator";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";
import { NamaDapatDipanggil, PengaturanPanggil, golonganSisi } from "@/components/portal/panggil-petugas";
import { LencanaStatusMediasi, TombolStatusMediasi, kelasBarisMediasi, useStatusMediasi } from "@/components/portal/status-mediasi";
import { ChevronDown, ChevronUp, FileText, Filter, SlidersHorizontal, X } from "lucide-react";
import { HasilMediasiDialog } from "@/components/portal/hasil-mediasi-dialog";
import { bolehBuatHasilMediasi, type PenggunaHasilMediasi } from "@/lib/hasil-mediasi";
import { usePenggunaAktifOpsional } from "@/lib/app-state";
import { bolehAksiLayar } from "@/lib/matriks-peran";
import {
  KUNCI_SIMPANAN_TAMPILAN_MEDIASI,
  SAKLAR_TAMPILAN_MEDIASI,
  bacaTampilanMediasi,
  tampilMediasi,
  tampilanMediasiBawaan,
  type PilihanTampilanMediasi,
} from "@/lib/tampilan-jadwal-mediasi";
/* === 12OKT-A: kumulasi perkara === */
import { JenisDenganKumulasi, RincianKumulasi, useSaklarKumulasi } from "@/components/portal/kumulasi-perkara";
import { namaJenisDenganKumulasi, type KumulasiPerkara } from "@/lib/kumulasi-perkara";
/* === AKHIR 12OKT-A === */

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
  /* === 12OKT-A: kumulasi perkara === */
  /** Kumulasi dari SIPP atau petitum (bot 12 Okt 2026); null = tidak ada. */
  kumulasi?: KumulasiPerkara | null;
  kumulasiTerbaca?: boolean;
  /* === AKHIR 12OKT-A === */
  /** Bahan sebutan pihak; bot lama tidak mengirimnya - lihat susunanPihak. */
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  pihak: {
    /** pihak_ke 1 - Penggugat/Pemohon. */
    penggugat: string[];
    /** pihak_ke 2 - Tergugat/Termohon. */
    tergugat: string[];
    /** pihak_ke 4, dipisah bot sejak 27 Sep 2026; bot lama menaruhnya di tergugat. */
    turutTergugat?: string[];
    /** pihak_ke 3 (perkara_pihak3) - butir 23, 6 Okt 2026. */
    intervensi?: string[];
    saksi?: string[];
    lain?: string[];
  };
};

/**
 * ============================================================================
 * PARA PIHAK BERSUSUN, DENGAN SEBUTAN MENURUT PERKARANYA
 * ============================================================================
 *
 * Dulu satu baris "Penggugat lawan Tergugat" yang dipotong elipsis: nama
 * lengkap tidak pernah terbaca, dan pihak kedua kerap hilang seluruhnya.
 * Sekarang tiap sisi satu baris - pihak pertama lebih dulu - dengan seluruh
 * namanya.
 *
 * Sebutannya dari sebutanPihakPerkara, SATU sumber untuk seluruh aplikasi,
 * dengan alur_perkara_id dan jenis_perkara_id dari bot. Itu yang membuat
 * cerai talak (346) dan izin poligami (341) bersebutan Pemohon/Termohon walau
 * nomornya /Pdt.G/ - 268 dari 752 perkara bermediasi di sipp_donggala.
 * Bot lama yang belum mengirim kedua angka itu membuatnya turun ke nama jenis
 * perkara, cadangan yang sudah dijaga ejaan SIPP-nya.
 *
 * Nama ruasnya lurus: penggugat = pihak_ke 1, tergugat = pihak_ke 2. Tidak
 * ada pelaku/lawan di sini - pasangan yang sudah dua kali tertukar di proyek
 * ini.
 */
function susunanPihak(baris: Mediasi): Array<{ kunci: string; sebutan: string; nama: string[] }> {
  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: baris.alurPerkaraId,
    jenisPerkaraId: baris.jenisPerkaraId,
    jenisPerkaraNama: baris.jenisPerkara,
    nomorPerkara: baris.nomorPerkara,
  });
  return [
    { kunci: "pihak-pertama", sebutan: sebutan.satu, nama: baris.pihak.penggugat ?? [] },
    { kunci: "pihak-kedua", sebutan: sebutan.dua, nama: baris.pihak.tergugat ?? [] },
    // Butir 23 (6 Okt 2026): disingkat "Turut T" dan "Int", sama dengan Jadwal Sidang.
    { kunci: "turut", sebutan: `Turut ${sebutan.dua.charAt(0).toUpperCase()}`, nama: baris.pihak.turutTergugat ?? [] },
    { kunci: "intervensi", sebutan: "Int", nama: baris.pihak.intervensi ?? [] },
  ].filter((sisi) => sisi.nama.length > 0);
}

/** Seluruh nama pihak yang dapat dicari - termasuk turut tergugat. */
function namaPihakSemua(baris: Mediasi): string[] {
  return [
    ...(baris.pihak.penggugat ?? []),
    ...(baris.pihak.tergugat ?? []),
    ...(baris.pihak.turutTergugat ?? []),
    ...(baris.pihak.intervensi ?? []),
  ];
}

/**
 * Empat kedudukan yang dicatat kehadirannya.
 *
 * Disalin dari server/modules/aleta-ecourt/kehadiran-mediasi.ts. Kuncinya HARUS
 * sama - kunci yang tidak dikenali ditolak rutenya, dan penolakan itu memang
 * disengaja supaya nilai asing tidak tersimpan diam-diam.
 */
const KEDUDUKAN_MEDIASI = [
  { kunci: "penggugat", label: "Penggugat / Pemohon" },
  { kunci: "kuasa_penggugat", label: "Kuasa penggugat / pemohon" },
  { kunci: "tergugat", label: "Tergugat / Termohon" },
  { kunci: "kuasa_tergugat", label: "Kuasa tergugat / termohon" },
] as const;

type BarisKehadiran = {
  kedudukan: string;
  label: string;
  hadir: boolean;
  nama: string;
  alasan: string;
  catatan: string;
  dicatatOleh: string;
  dicatatAt: string;
  belumDicatat: boolean;
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
 * Rincian satu pertemuan mediasi, beserta pencatatan kehadirannya.
 *
 * ============================================================================
 * DUA ASAL YANG DIPISAH DENGAN JELAS
 * ============================================================================
 *
 *   dari SIPP    jadwal, mediator, penetapan, laporan, hasil - hanya dibaca,
 *                dan tidak pernah dapat diubah dari sini;
 *   dari ALETA   kehadiran menurut empat kedudukan - ditulis di sini, dan
 *                tidak pernah ditulis balik ke SIPP.
 *
 * Pemisahan itu ditulis di layar, bukan hanya di kode: yang membacanya perlu
 * tahu ruas mana yang dapat diperbaiki di sini dan mana yang harus diperbaiki
 * di SIPP.
 */
function RincianMediasi({ baris, bolehCatat = true }: { baris: Mediasi; bolehCatat?: boolean }) {
  const [kehadiran, setKehadiran] = useState<BarisKehadiran[] | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Butir 3 (5 Okt 2026): "Tersimpan N catatan" hilang sendiri; yang gagal menetap.
  const [pesan, setPesan] = usePesanSementara();
  const [putaran, setPutaran] = useState(0);
  /* === 12OKT-A: kumulasi perkara === */
  // Saklar "Kumulasi perkara" milik panel Tampilan Jadwal Sidang.
  const saklarKumulasi = useSaklarKumulasi();
  /* === AKHIR 12OKT-A === */

  useEffect(() => {
    let batal = false;
    const ambil = async () => {
      setGalat("");
      try {
        const alamat = `${apiPath("/api/aleta-ecourt/kehadiran-mediasi")}?mediasiId=${encodeURIComponent(
          baris.mediasiId
        )}&tanggal=${encodeURIComponent(baris.tanggal)}`;
        const jawaban = await fetch(alamat);
        const isi = (await jawaban.json()) as {
          baris?: BarisKehadiran[];
          data?: { baris?: BarisKehadiran[] };
        };
        if (batal) return;
        setKehadiran((isi.data?.baris ?? isi.baris) || []);
      } catch (kesalahan) {
        if (!batal) setGalat(pesanGalatPortal(kesalahan, "Kehadiran mediasi tidak dapat dibaca."));
      }
    };
    void ambil();
    return () => {
      batal = true;
    };
  }, [baris.mediasiId, baris.tanggal, putaran]);

  const ubah = (kedudukan: string, ubahan: Partial<BarisKehadiran>) => {
    setKehadiran((lama) =>
      (lama ?? []).map((x) => (x.kedudukan === kedudukan ? { ...x, ...ubahan } : x))
    );
  };

  const simpan = async () => {
    if (!kehadiran) return;
    setSibuk(true);
    setPesan(null);
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/kehadiran-mediasi"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediasiId: baris.mediasiId,
          perkaraId: baris.perkaraId,
          nomorPerkara: baris.nomorPerkara,
          tanggalPertemuan: baris.tanggal,
          isian: kehadiran.map((x) => ({
            kedudukan: x.kedudukan,
            hadir: x.hadir,
            nama: x.nama,
            alasan: x.alasan,
            catatan: x.catatan,
          })),
        }),
      });
      const isi = (await jawaban.json()) as {
        ok?: boolean;
        jumlahDisimpan?: number;
        sebab?: string;
        data?: { ok?: boolean; jumlahDisimpan?: number; sebab?: string };
      };
      const hasil = isi.data ?? isi;
      if (!hasil.ok) {
        setPesan({ ok: false, teks: hasil.sebab || "Kehadiran belum dapat disimpan." });
        return;
      }
      setPesan({ ok: true, teks: `Tersimpan ${hasil.jumlahDisimpan ?? 0} catatan kehadiran.` });
      setPutaran((n) => n + 1);
    } catch (kesalahan) {
      setPesan({ ok: false, teks: pesanGalatPortal(kesalahan, "Kehadiran belum dapat disimpan.") });
    } finally {
      setSibuk(false);
    }
  };

  const keterangan: Array<[string, string]> = [
    ["Nomor perkara", baris.nomorPerkara || "—"],
    /* === 12OKT-A: kumulasi perkara === */
    ["Jenis perkara", saklarKumulasi ? namaJenisDenganKumulasi(baris.jenisPerkara, baris.kumulasi) : baris.jenisPerkara || "—"],
    /* === AKHIR 12OKT-A === */
    ["Tanggal pertemuan", baris.tanggal || "—"],
    [
      "Waktu",
      baris.jam ? `${baris.jam}${baris.sampaiJam ? ` s.d. ${baris.sampaiJam}` : ""}` : "—",
    ],
    ["Tempat", baris.tempat || "—"],
    // Nama tanpa pemisah <br/> SIPP, dan status sebagai SEBUTAN - bukan
    // huruf H mentah. Lihat lib/sebutan-mediator.ts.
    ["Mediator", namaTiapMediator(baris.mediator).join("; ") || "—"],
    [
      "Status mediator",
      baris.mediator || baris.statusMediator ? sebutanMediator(baris.statusMediator) : "—",
    ],
    ["Jenis mediasi", baris.jenisMediasi || "—"],
    ["Nomor SK mediator", baris.nomorSk || "—"],
    ["Tanggal penetapan mediator", baris.penetapanMediator || "belum ditetapkan"],
    ["Batas 30 hari (PERMA 1/2016 Pasal 24)", baris.tenggatPerma || "belum berjalan"],
    [
      "Sisa tenggang",
      baris.selesai
        ? "tidak dihitung lagi - laporan sudah masuk"
        : baris.sisaHariTenggat === null
          ? "belum dapat dihitung"
          : `${baris.sisaHariTenggat} hari`,
    ],
    ["Lama mediasi", baris.lamaHari === null ? "—" : `${baris.lamaHari} hari`],
    ["Laporan mediator", baris.laporanMediator || "belum masuk"],
    ["Hasil mediasi", baris.hasilTeks || "belum ada hasil"],
    ["Pertemuan ditunda", baris.ditunda ? "ya" : "tidak"],
    ["Kehadiran menurut SIPP", baris.dihadiri || "tidak tercatat"],
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Keterangan mediasi — dari SIPP, hanya dibaca
        </h5>
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {keterangan.map(([judul, nilai]) => (
            <div key={judul}>
              <dt className="text-xs text-muted-foreground">{judul}</dt>
              <dd className="font-medium">{nilai}</dd>
            </div>
          ))}
        </dl>

        {/* === 12OKT-A: kumulasi perkara === */}
        {saklarKumulasi ? (
          <div className="mt-2">
            <RincianKumulasi kumulasi={baris.kumulasi} />
          </div>
        ) : null}
        {/* === AKHIR 12OKT-A === */}

        {/* Sebutan tiap sisi menurut perkaranya, sama dengan sel tabel -
            bukan "Penggugat / Pemohon" yang membiarkan pembaca menebak. */}
        {susunanPihak(baris).length > 0 ? (
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {susunanPihak(baris).map((sisi) => (
              <div key={sisi.kunci}>
                <p className="text-xs text-muted-foreground">{sisi.sebutan}</p>
                <p className="font-medium">{sisi.nama.join("; ")}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* ====================================================================
          KEHADIRAN - MILIK ALETA
          ====================================================================

          SIPP hanya menyimpan satu ruas bebas ("dihadiri 2"), dan angka itu
          tidak membedakan dua PIHAK yang hadir sendiri dari dua KUASA yang
          hadir tanpa pihaknya - padahal PERMA 1/2016 Pasal 7 ayat (1) menuntut
          para pihak hadir SECARA LANGSUNG, dan akibat hukum keduanya berbeda.

          Yang dicatat di sini fakta kehadirannya saja. Kesimpulan iktikad baik
          menurut Pasal 6 adalah kewenangan mediator dan majelis, dan sengaja
          TIDAK dihitung layar ini. */}
      <section className="rounded-lg border bg-card p-3">
        <h5 className="mb-2 border-b pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Kehadiran pertemuan — dicatat di ALETA
        </h5>

        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : !kehadiran ? (
          <p className="text-xs text-muted-foreground">Memuat kehadiran…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1 font-medium">Kedudukan</th>
                    <th className="py-1 font-medium">Hadir</th>
                    <th className="py-1 font-medium">Nama yang hadir</th>
                    <th className="py-1 font-medium">Alasan bila tidak hadir</th>
                  </tr>
                </thead>
                <tbody>
                  {KEDUDUKAN_MEDIASI.map((kedudukan) => {
                    const isi = kehadiran.find((x) => x.kedudukan === kedudukan.kunci);
                    if (!isi) return null;
                    return (
                      <tr key={kedudukan.kunci} className="border-t align-top">
                        <td className="py-1.5 pr-2">
                          <span className="font-medium">{kedudukan.label}</span>
                          {isi.belumDicatat ? (
                            <div className="text-xs text-muted-foreground">belum dicatat</div>
                          ) : isi.dicatatOleh ? (
                            <div className="text-xs text-muted-foreground">
                              oleh {isi.dicatatOleh}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-1.5 pr-2">
                          <label className="inline-flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={isi.hadir}
                              onChange={(e) =>
                                ubah(kedudukan.kunci, {
                                  hadir: e.target.checked,
                                  // Alasan dikosongkan begitu ditandai hadir:
                                  // alasan ketidakhadiran pada orang yang datang
                                  // adalah keterangan yang bertentangan sendiri.
                                  alasan: e.target.checked ? "" : isi.alasan,
                                })
                              }
                              className="h-4 w-4"
                            />
                            <span className="text-xs text-muted-foreground">hadir</span>
                          </label>
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            value={isi.nama}
                            onChange={(e) => ubah(kedudukan.kunci, { nama: e.target.value })}
                            placeholder="nama yang benar-benar hadir"
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="py-1.5">
                          <Input
                            value={isi.alasan}
                            onChange={(e) => ubah(kedudukan.kunci, { alasan: e.target.value })}
                            placeholder={isi.hadir ? "—" : "alasan tidak hadir"}
                            disabled={isi.hadir}
                            className="h-8 text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* HAK-PERAN 12 Okt: simpan kehadiran hanya mediasi.catat; rute juga 403. */}
              {bolehCatat ? (
              <Button size="sm" disabled={sibuk} onClick={() => void simpan()}>
                {sibuk ? "Menyimpan…" : "Simpan kehadiran"}
              </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Kehadiran dicatat mediator/kepaniteraan perkara ini.</span>
              )}
              {pesan ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    pesan.ok ? "text-muted-foreground" : "text-rose-600"
                  )}
                >
                  {pesan.teks}
                  {!pesan.ok ? <TombolTutupPesan onTutup={() => setPesan(null)} className="h-4 w-4" /> : null}
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Yang dicatat hanya fakta kehadiran. Penilaian iktikad baik menurut PERMA 1/2016
              Pasal 6 adalah kewenangan mediator dan majelis, dan tidak dihitung layar ini.
            </p>
          </>
        )}
      </section>
    </div>
  );
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
      // Namanya tanpa <br/> SIPP: mediasi bermediator dua tidak boleh
      // terurut menurut tanda HTML-nya.
      return namaTiapMediator(baris.mediator).join("; ");
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

// ============================================================================
// HAKIM ATAU NON HAKIM - DARI SANDI SIPP, BUKAN DARI KATA
// ============================================================================
//
// Aturan lama di sini menguji /hakim/i atas status_mediator. SIPP menyimpan
// SANDI "H", dan "H" tidak pernah memuat kata "hakim" - sehingga setiap
// mediator hakim terhitung "non-hakim" (chip: 0 hakim, 1 non-hakim untuk
// perkara berstatus H). Penggolongannya kini satu sumber, lib/sebutan-mediator:
// H = Mediator Hakim, selainnya = Mediator Non Hakim, KOSONG = belum tercatat.

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
  /**
   * Disembunyikan selama jumlahnya nol dan tidak sedang dinyalakan. Untuk
   * keadaan yang semestinya langka - kotak nol yang selalu tampil hanya
   * menambah deretan yang harus dilewati mata.
   */
  sembunyiBilaNol?: boolean;
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
  // Tiga kotak mediator memakai sebutan yang SAMA dengan sel tabel dan
  // rincian - lib/sebutan-mediator. Mediasi bermediator dua yang campuran
  // (H,N) terhitung di kedua kotak: memang ada hakim DAN non-hakim di sana.
  {
    kunci: "hakim-mediator",
    label: "Mediator Hakim",
    nada: "sejuk",
    judul: "Status mediator di SIPP berkode H - mediatornya hakim.",
    cocok: (x) => adaMediatorHakim(x.statusMediator),
  },
  {
    kunci: "mediator-non-hakim",
    label: "Mediator Non Hakim",
    nada: "sejuk",
    judul: "Status mediator di SIPP berkode selain H - mediatornya bukan hakim.",
    cocok: (x) => adaMediatorNonHakim(x.statusMediator),
  },
  {
    // Kosong BUKAN non-hakim: dulu kotak non-hakim menelan baris ini, sehingga
    // mediator yang statusnya lupa diisi terlaporkan sebagai mediator luar.
    kunci: "status-mediator-kosong",
    label: "Status mediator belum tercatat",
    nada: "awas",
    judul:
      "Mediatornya tercatat, tetapi status hakim/non hakimnya kosong di SIPP - lengkapi di SIPP. " +
      "Tidak dihitung sebagai hakim maupun non hakim.",
    cocok: (x) =>
      namaTiapMediator(x.mediator).length > 0 && statusMediatorBelumTercatat(x.statusMediator),
    sembunyiBilaNol: true,
  },
  {
    kunci: "tanpa-mediator",
    label: "Mediator belum ada",
    nada: "bahaya",
    judul: "Mediatornya belum tercatat, padahal pertemuannya sudah dijadwalkan.",
    cocok: (x) => namaTiapMediator(x.mediator).length === 0,
  },
];

/** Medan pencarian lanjutan untuk jadwal mediasi. */
const MEDAN_CARI_MEDIASI = [
  { kunci: "nomor", label: "Nomor perkara", petunjuk: "506/Pdt.G/2026" },
  { kunci: "pihak", label: "Nama pihak", petunjuk: "penggugat atau tergugat" },
  { kunci: "jenis", label: "Jenis perkara", petunjuk: "Harta Bersama" },
  { kunci: "mediator", label: "Mediator", petunjuk: "nama, atau Mediator Hakim / Non Hakim" },
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
  const pihak = namaPihakSemua(baris).join(" ");
  // Yang dicari adalah yang TERTULIS di layar: nama tanpa <br/> dan sebutan
  // "Mediator Hakim"/"Mediator Non Hakim" - bukan huruf H yang tidak tampak
  // di mana pun.
  const mediator = `${namaTiapMediator(baris.mediator).join(" ")} ${
    baris.mediator || baris.statusMediator ? sebutanMediator(baris.statusMediator) : ""
  }`;

  return (
    cocokTeks(baris.nomorPerkara, isian.nomor ?? "") &&
    cocokTeks(pihak, isian.pihak ?? "") &&
    cocokTeks(baris.jenisPerkara, isian.jenis ?? "") &&
    cocokTeks(mediator, isian.mediator ?? "") &&
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
    /* === 12OKT-A: kumulasi perkara === */
    ...(baris.kumulasi?.daftar ?? []).map((x) => x.nama),
    /* === AKHIR 12OKT-A === */
    ...namaTiapMediator(baris.mediator),
    baris.mediator || baris.statusMediator ? sebutanMediator(baris.statusMediator) : "",
    baris.tempat,
    baris.hasilTeks,
    baris.nomorSk,
    baris.jam,
    ...namaPihakSemua(baris),
  ].join(" ");
  return cocokTeks(semua, kata);
}

export function AletaEcourtMediasi({
  onBukaStatus,
  pengguna = null,
}: {
  onBukaStatus?: (nomorPerkara: string) => void;
  /**
   * Akun yang masuk - untuk tombol "Buat hasil mediasi (.rtf)" yang HANYA
   * tampil bagi mediator perkara itu dan Super Admin (7 Okt 2026). Tanpa
   * ini (uji lama, layar lain) tombolnya tidak pernah tampil.
   */
  pengguna?: (PenggunaHasilMediasi & { namaPengadilan?: string }) | null;
} = {}) {
  // HAK-PERAN 12 Okt: catat kehadiran/status mediasi hanya golongan mediasi.catat.
  const penggunaAktif = usePenggunaAktifOpsional();
  const bolehCatatMediasi = bolehAksiLayar(penggunaAktif, "mediasi.catat");
  /* === 12OKT-A: kumulasi perkara === */
  const saklarKumulasi = useSaklarKumulasi();
  /* === AKHIR 12OKT-A === */
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

  // Satu baris terbuka pada satu waktu. Membuka yang kedua menutup yang
  // pertama: dua panel rincian sekaligus mendorong daftarnya sedemikian jauh
  // sehingga barisnya sendiri tidak lagi terlihat.
  const [dibuka, setDibuka] = useState("");
  // Butir 35 (5 Okt 2026): sedang berjalan / selesai, tersimpan di basis data ALETA.
  const statusMediasi = useStatusMediasi(dari, sampai, mediasi);

  // ==========================================================================
  // HASIL MEDIASI (.rtf) - 7 Okt 2026
  // ==========================================================================
  // Tombolnya hanya bagi mediator perkara itu dan Super Admin
  // (bolehBuatHasilMediasi), dan punya saklar Tampilan sendiri - "setiap
  // fitur baru punya centang". Rute memeriksa ulang mediatornya dari SIPP.
  const [hasilDibuka, setHasilDibuka] = useState<{ nomorPerkara: string; mediasiId: string } | null>(null);
  const [tampilan, setTampilan] = useState<PilihanTampilanMediasi>(() => tampilanMediasiBawaan());
  const [panelTampilan, setPanelTampilan] = useState(false);
  useEffect(() => {
    // Dibaca sesudah gambar pertama: peladen tidak punya localStorage.
    const tugas = window.setTimeout(() => {
      try {
        setTampilan(bacaTampilanMediasi(window.localStorage.getItem(KUNCI_SIMPANAN_TAMPILAN_MEDIASI)));
      } catch {
        // Penyimpanan tertutup (jendela pribadi) - bawaan berlaku.
      }
    }, 0);
    return () => window.clearTimeout(tugas);
  }, []);
  const ubahTampilan = (kunci: string, menyala: boolean) => {
    setTampilan((lama) => {
      const baru = { ...lama, [kunci]: menyala };
      try {
        window.localStorage.setItem(KUNCI_SIMPANAN_TAMPILAN_MEDIASI, JSON.stringify(baru));
      } catch {
        // Tidak tersimpan - berlaku sampai halaman ditutup.
      }
      return baru;
    });
  };
  const tombolHasilTampil = tampilMediasi(tampilan, "tombol-hasil-mediasi");
  // 18 Okt 2026: saklar baru. Saringan yang tidak tampil juga tidak dipakai, supaya daftar
  // tidak tersaring oleh isian yang tak terlihat.
  const saringKeadaanTampil = tampilMediasi(tampilan, "saring-keadaan");
  const pencarianTampil = tampilMediasi(tampilan, "pencarian-mediasi");

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
  // ==========================================================================
  // BUTIR 14 (5 Okt 2026) - GANGGUAN JARINGAN DICOBA LAGI SENDIRI
  // ==========================================================================
  // Sampai 1.183.0 tiap kegagalan mengosongkan tabel (setMediasi([])) dan
  // meninggalkan "Failed to fetch". Kini: gangguan jaringan / 502-504 /
  // jawaban bukan JSON -> banner kuning + hitung mundur, data lama tetap.
  // Data rentang LAIN tetap dikosongkan (pertemuan hari lain di bawah judul
  // hari ini lebih menyesatkan daripada tabel kosong).
  const permintaanTerakhir = useRef<{ mulai: string; akhir: string; kata: string } | null>(null);
  const rentangTampil = useRef("");
  const muatRentangRef = useRef<((mulai: string, akhir: string, kata: string) => Promise<void>) | null>(null);
  const cobaLagiMediasi = useCobaLagiOtomatis(() => {
    const p = permintaanTerakhir.current;
    return p && muatRentangRef.current ? muatRentangRef.current(p.mulai, p.akhir, p.kata) : undefined;
  });
  const { laporGagal: laporGagalMediasi, laporBerhasil: laporBerhasilMediasi } = cobaLagiMediasi;

  const muatRentang = useCallback(
    async (mulai: string, akhir: string, kata: string) => {
      if (sedangMuat.current) return;
      sedangMuat.current = true;
      permintaanTerakhir.current = { mulai, akhir, kata };
      const rentang = `${mulai}|${akhir}|${kata}`;
      const kosongkanBilaLain = () => {
        if (rentangTampil.current !== rentang) {
          setMediasi([]);
          rentangTampil.current = "";
        }
      };
      setMemuat(true);
      setPesan("");
      try {
        const params = new URLSearchParams({ dari: mulai, sampai: akhir, cari: kata });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/jadwal-mediasi?${params.toString()}`), {
          cache: "no-store",
        });
        // Status diperiksa sebelum badan dibaca sebagai JSON.
        const isi = (await bacaJsonAman(jawaban)) as Record<string, unknown> & { data?: Record<string, unknown> };
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Jadwal mediasi gagal dimuat."));

        const data = (isi?.data ?? isi) as Record<string, unknown>;
        if (data?.available === false) {
          const pesanBot = String(data.message || "ALETA Bot belum dapat dihubungi.");
          if (botTakTerjangkau(pesanBot)) {
            laporGagalMediasi(new GalatJawaban(pesanBot, 503, true), 503, `${pesanBot} ALETA akan mencoba memuat lagi sendiri.`);
          } else {
            // Bot menjawab tetapi tidak dapat membaca: pesannya apa adanya, seperti semula.
            laporBerhasilMediasi();
            setPesan(pesanBot);
          }
          kosongkanBilaLain();
          return;
        }
        laporBerhasilMediasi();
        setAlasan(String(data?.alasan || ""));
        setMediasi(Array.isArray(data?.mediasi) ? (data.mediasi as Mediasi[]) : []);
        rentangTampil.current = rentang;
      } catch (galat) {
        if (!laporGagalMediasi(galat)) {
          setPesan(galat instanceof Error ? galat.message : String(galat));
          kosongkanBilaLain();
        }
      } finally {
        sedangMuat.current = false;
        setMemuat(false);
      }
    },
    [laporGagalMediasi, laporBerhasilMediasi]
  );
  useEffect(() => {
    muatRentangRef.current = muatRentang;
  }, [muatRentang]);

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

    if (saringKeadaanTampil && keadaanTerpilih.length > 0) {
      const dipilih = KEADAAN_MEDIASI.filter((x) => keadaanTerpilih.includes(x.kunci));
      // "Atau", bukan "dan": menyalakan lewat tenggang dan ditunda sekaligus
      // berarti "tunjukkan yang bermasalah". Menggabungnya dengan "dan"
      // hampir selalu menghasilkan daftar kosong.
      hasil = hasil.filter((baris) => dipilih.some((keadaan) => keadaan.cocok(baris)));
    }

    if (pencarianTampil && cariCepat.trim()) {
      hasil = hasil.filter((baris) => cocokCariCepatMediasi(baris, cariCepat));
    }

    if (pencarianTampil && cariLanjut.jumlahAktif > 0) {
      hasil = hasil.filter((baris) => cocokCariLanjutMediasi(baris, cariLanjut.isian));
    }

    return urutkan(hasil, urutTabel, nilaiUrutMediasi);
  }, [mediasi, keadaanTerpilih, cariCepat, cariLanjut.isian, cariLanjut.jumlahAktif, urutTabel, saringKeadaanTampil, pencarianTampil]);

  const adaPenyaringTabel =
    (saringKeadaanTampil && keadaanTerpilih.length > 0) ||
    (pencarianTampil && (cariCepat.trim() !== "" || cariLanjut.jumlahAktif > 0));

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
        <PengaturanPanggil />
        <div className="mt-1">
          <Button
            size="sm"
            variant={panelTampilan ? "default" : "outline"}
            onClick={() => setPanelTampilan((x) => !x)}
            aria-expanded={panelTampilan}
            data-tampilan-mediasi=""
          >
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            Tampilan
          </Button>
          {panelTampilan ? (
            <div className="mt-2 rounded-lg border bg-card p-2">
              <p className="mb-1.5 text-xs text-muted-foreground">
                Tersimpan di peramban ini saja dan tidak mengubah data apa pun - yang dimatikan hanya tidak digambar.
              </p>
              <ul className="space-y-1">
                {SAKLAR_TAMPILAN_MEDIASI.map((saklar) => (
                  <li key={saklar.kunci}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm" title={saklar.keterangan}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 accent-primary"
                        checked={tampilMediasi(tampilan, saklar.kunci)}
                        onChange={(e) => ubahTampilan(saklar.kunci, e.target.checked)}
                        data-saklar-mediasi={saklar.kunci}
                      />
                      <span className="leading-tight">
                        {saklar.label}
                        <span className="block text-xs text-muted-foreground">{saklar.keterangan}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
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

        <BannerGangguan keadaan={cobaLagiMediasi.keadaan} onCobaSekarang={cobaLagiMediasi.cobaSekarang} />
        {/* Pesan di sini selalu kegagalan - menetap sampai pemuatan berikutnya atau ditutup. */}
        {pesan ? (
          <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            <span className="min-w-0 flex-1">{pesan}</span>
            <TombolTutupPesan onTutup={() => setPesan("")} />
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
        {tampilMediasi(tampilan, "kartu-ringkasan") ? (
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
        ) : null}

        {/* ==================================================================
            KOTAK KEADAAN
            ==================================================================

            Warnanya menyebut arti: yang menuntut tindakan merah, yang perlu
            diperhatikan kuning, yang sudah beres hijau.

            "Berhasil" dan "Tidak berhasil" dipisah dari "Laporan sudah
            masuk" karena keduanya pertanyaan berbeda - yang satu tentang
            beban kerja, yang lain tentang angka keberhasilan yang
            dilaporkan tiap bulan. */}
        {saringKeadaanTampil && mediasi.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Kotak yang sedang dinyalakan tidak pernah disembunyikan, walau
                jumlahnya jatuh ke nol sesudah dimuat ulang - saringan aktif
                yang tidak terlihat tidak dapat dilepas. */}
            {KEADAAN_MEDIASI.filter(
              (keadaan) =>
                !keadaan.sembunyiBilaNol ||
                (jumlahKeadaan[keadaan.kunci] ?? 0) > 0 ||
                keadaanTerpilih.includes(keadaan.kunci)
            ).map((keadaan) => (
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
        {pencarianTampil && mediasi.length > 0 ? (
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

        {pencarianTampil && lanjutTerbuka && mediasi.length > 0 ? (
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
                  {/* Kolom tombol Rincian - tanpa judul, karena judulnya tidak
                      menerangkan apa pun yang belum diterangkan tombolnya. */}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {mediasiTampil.map((baris, urutan) => {
                  const kunciBaris = `${baris.mediasiId}|${baris.tanggal}`;
                  return (
                  <Fragment key={`${kunciBaris}-${baris.jam}-${urutan}`}>
                  <tr className={`border-t align-top ${tampilMediasi(tampilan, "lencana-status-mediasi") ? kelasBarisMediasi(statusMediasi.peta[kunciBaris]) : ""}`}>
                    <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {urutan + 1}
                    </td>

                    <td className="px-2 py-2">
                      <div className="font-semibold tabular-nums">{baris.jam || "—"}</div>
                      {baris.sampaiJam ? (
                        <div className="text-xs text-muted-foreground">s.d. {baris.sampaiJam}</div>
                      ) : null}
                      {baris.tanggal !== dari ? (
                        <div className="text-xs text-muted-foreground">
                          {tanggalHariPendek(baris.tanggal, baris.tanggal)}
                        </div>
                      ) : null}
                      {baris.ditunda && tampilMediasi(tampilan, "lencana-ditunda") ? (
                        <div className="mt-1">
                          <Badge variant="warning">ditunda</Badge>
                        </div>
                      ) : null}
                      {tampilMediasi(tampilan, "lencana-status-mediasi") ? (
                        <LencanaStatusMediasi status={statusMediasi.peta[kunciBaris]} />
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
                      {/* Bersusun dan UTUH: satu baris per sisi, pihak pertama
                          dulu, seluruh nama tanpa elipsis - boleh melipat
                          baris. Dulu "A lawan B" dipotong pada 22rem, dan
                          pihak kedua kerap tidak terbaca sama sekali. */}
                      {susunanPihak(baris).length > 0 ? (
                        <dl className="mt-1 max-w-[26rem] space-y-0.5 text-xs">
                          {susunanPihak(baris).map((sisi) => (
                            <div key={sisi.kunci} data-sisi={sisi.kunci}>
                              <dt className="inline text-muted-foreground">{sisi.sebutan}: </dt>
                              <dd className="inline break-words font-medium">
                                <NamaDapatDipanggil golongan={golonganSisi(sisi.kunci)} perkaraId={String(baris.perkaraId)} tanggal={baris.tanggal} nomorPerkara={baris.nomorPerkara} ruang={baris.tempat} konteks="mediasi" mediasiId={String(baris.mediasiId)}>{sisi.nama.join("; ")}</NamaDapatDipanggil>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {/* === 12OKT-A: kumulasi perkara === */}
                        {saklarKumulasi ? (
                          <JenisDenganKumulasi jenis={baris.jenisPerkara} kumulasi={baris.kumulasi} />
                        ) : (
                          baris.jenisPerkara || "—"
                        )}
                        {/* === AKHIR 12OKT-A === */}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-xs">
                      {/* Tiap mediator dengan sebutannya sendiri - "Mediator
                          Hakim" / "Mediator Non Hakim", bukan huruf H mentah.
                          Status kosong disebut belum tercatat, berwarna awas:
                          yang harus dilengkapi SIPP-nya. */}
                      {daftarMediator(baris.mediator, baris.statusMediator).length === 0 ? (
                        <div className="font-medium">—</div>
                      ) : (
                        daftarMediator(baris.mediator, baris.statusMediator).map((orang, ke) => (
                          <div key={`${orang.nama}-${ke}`} className={ke > 0 ? "mt-1" : undefined}>
                            <div className="font-medium"><NamaDapatDipanggil golongan={orang.nama ? "mediator" : null} perkaraId={String(baris.perkaraId)} tanggal={baris.tanggal} nomorPerkara={baris.nomorPerkara} ruang={baris.tempat} konteks="mediasi" mediasiId={String(baris.mediasiId)}>{orang.nama || "Nama mediator belum tercatat"}</NamaDapatDipanggil></div>
                            <div
                              className={
                                orang.golongan === "belum-tercatat"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-muted-foreground"
                              }
                            >
                              {orang.sebutan}
                            </div>
                          </div>
                        ))
                      )}
                      {tampilMediasi(tampilan, "penetapan-mediator") && baris.penetapanMediator ? (
                        <div className="text-muted-foreground">
                          ditetapkan{" "}
                          {tanggalHariPendek(baris.penetapanMediator, baris.penetapanMediator)}
                        </div>
                      ) : null}
                      {tampilMediasi(tampilan, "penetapan-mediator") && baris.nomorSk ? (
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
                          batas {tanggalHariPendek(baris.tenggatPerma, baris.tenggatPerma)}
                        </div>
                      ) : null}
                      {baris.laporanMediator ? (
                        <div className="mt-0.5 text-muted-foreground">
                          laporan{" "}
                          {tanggalHariPendek(baris.laporanMediator, baris.laporanMediator)}
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

                    {/* ==================================================
                        TOMBOL RINCIAN DI UJUNG KANAN
                        ==================================================

                        Barisnya sendiri TIDAK dapat ditekan - sama seperti
                        jadwal sidang. Di dalam baris sudah ada tautan nomor
                        perkara, dan baris yang ikut menanggapi tekanan
                        membuka rincian yang tidak diminta. */}
                    <td className="px-2 py-2 text-right">
                      {/* Hasil mediasi (.rtf) - hanya mediator perkara ini dan Super Admin. */}
                      {tombolHasilTampil && bolehBuatHasilMediasi(pengguna, baris.mediator) ? (
                        <div className="mb-1">
                          <button
                            type="button"
                            onClick={() => setHasilDibuka({ nomorPerkara: baris.nomorPerkara, mediasiId: String(baris.mediasiId) })}
                            title="Buat laporan hasil mediasi dan kesepakatan perdamaian (.rtf) - hanya bagi mediator perkara ini"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
                            data-tombol-hasil-mediasi={baris.nomorPerkara}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Buat hasil mediasi (.rtf)
                          </button>
                        </div>
                      ) : null}
                      {bolehCatatMediasi && tampilMediasi(tampilan, "tombol-status-mediasi") ? (
                      <div className="mb-1">
                        <TombolStatusMediasi baris={{ mediasiId: String(baris.mediasiId), perkaraId: String(baris.perkaraId), nomorPerkara: baris.nomorPerkara, tanggal: baris.tanggal.slice(0, 10), tempat: baris.tempat }} status={statusMediasi.peta[kunciBaris]} onBerubah={statusMediasi.muatUlang} />
                      </div>
                      ) : null}
                      {/* Berwarna primer selama rinciannya terbuka, kembali ke
                          rupa semula begitu ditutup - rupanya sama dengan
                          tombol Rincian di Antrian Sidang, lihat catatan di
                          sana. Warnanya diturunkan dari dibuka === kunciBaris,
                          ungkapan yang sama yang menggambar panel rinciannya,
                          jadi tidak ada jalan menutup yang lupa memulihkannya.
                          Bentuk dan tebal hurufnya sengaja tidak berubah. */}
                      <button
                        type="button"
                        onClick={() => setDibuka((lama) => (lama === kunciBaris ? "" : kunciBaris))}
                        aria-expanded={dibuka === kunciBaris}
                        title={dibuka === kunciBaris ? "Tutup rincian mediasi" : "Buka rincian mediasi"}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                          dibuka === kunciBaris
                            ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {dibuka === kunciBaris ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        Rincian
                      </button>
                    </td>
                  </tr>

                  {dibuka === kunciBaris ? (
                    <tr className="border-t bg-muted/40">
                      <td colSpan={8} className="px-3 py-3">
                        <RincianMediasi baris={baris} bolehCatat={bolehCatatMediasi} />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasilDibuka ? (
          <HasilMediasiDialog
            nomorPerkara={hasilDibuka.nomorPerkara}
            mediasiId={hasilDibuka.mediasiId}
            namaPengadilan={pengguna?.namaPengadilan ?? ""}
            onTutup={() => setHasilDibuka(null)}
          />
        ) : null}

        {tampilMediasi(tampilan, "catatan-tenggang") ? (
          <p className="text-xs text-muted-foreground">
            Tenggang 30 hari dihitung sejak <strong>penetapan mediator</strong>, bukan sejak pertemuan
            pertama &mdash; itulah patokan PERMA 1/2016 Pasal 24, dan pertemuan pertama kerap jauh
            sesudahnya. Mediasi yang laporan mediatornya sudah masuk tidak lagi dihitung, berapa pun
            lamanya.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
