"use client";

/**
 * Halaman ALETA e-Court untuk seluruh pegawai.
 *
 * Isinya sengaja sedikit: menjelaskan apa yang dikerjakan penghubung ini,
 * menyediakan unduhan ekstensi, dan menunjukkan apakah penghubungnya sedang
 * bekerja. Tidak ada satu pun pengaturan di sini - itu ada di menu admin.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  ArrowLeft,
  CalendarDays,
  Handshake,
  FileSearch,
  FolderCheck,
  History,
  LayoutDashboard,
  PenLine,
  MoveHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Search,
} from "lucide-react";

import { CatatanEkstensiDaftar } from "@/components/portal/catatan-ekstensi-daftar";
import { EcourtStatusPenarikan } from "@/components/portal/ecourt-status-penarikan";
import { AletaEcourtTte } from "@/components/portal/aleta-ecourt-tte";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { apiPath, withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { getEffectiveRoleId } from "@/lib/permissions";
import { bolehAksi, tabEcourtTampil, type TabEcourt } from "@/lib/matriks-peran";
import {
  KELAS_LEBAR_ECOURT,
  KUNCI_SIMPAN_LEBAR_ECOURT,
  bacaLebarEcourt,
  type LebarEcourt,
} from "@/lib/jadwal-sidang-2okt";
import Link from "next/link";

/*
 * ============================================================================
 * EMPAT LAYAR TERBERAT DIMUAT SAAT DIBUKA, BUKAN SAAT PORTAL DIBUKA
 * ============================================================================
 *
 * Keempatnya dirender bergantian menurut menu - hanya satu terpasang pada
 * satu waktu. Impor statis tetap menyeret keempatnya ke dalam muatan awal,
 * sehingga petugas yang hanya membuka jadwal sidang tetap menunggu peramban
 * mengurai layar status perkara, mediasi, dan arsip berkas lebih dulu.
 *
 * ssr:false disengaja: keempatnya mengambil datanya sendiri sesudah
 * terpasang, jadi menggambarnya di server tidak menghasilkan apa pun selain
 * kerangka kosong yang sama.
 *
 * Kerangka penunggu dibuat setinggi kira-kira layar aslinya supaya isi
 * halaman tidak melompat saat muatannya tiba.
 */
const AletaEcourtSidang = dynamic(
  () => import("@/components/portal/aleta-ecourt-sidang").then((m) => m.AletaEcourtSidang),
  { ssr: false, loading: () => <div className="min-h-[28rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

const AletaEcourtStatusPerkara = dynamic(
  () => import("@/components/portal/aleta-ecourt-status-perkara").then((m) => m.AletaEcourtStatusPerkara),
  { ssr: false, loading: () => <div className="min-h-[24rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

const AletaEcourtMediasi = dynamic(
  () => import("@/components/portal/aleta-ecourt-mediasi").then((m) => m.AletaEcourtMediasi),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

const AletaEcourtTandaTangan = dynamic(
  () => import("@/components/portal/aleta-ecourt-tanda-tangan").then((m) => m.AletaEcourtTandaTangan),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

const AletaEcourtRiwayat = dynamic(
  () => import("@/components/portal/aleta-ecourt-riwayat").then((m) => m.AletaEcourtRiwayat),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

const AletaEcourtArsipBerkas = dynamic(
  () => import("@/components/portal/aleta-ecourt-arsip-berkas").then((m) => m.AletaEcourtArsipBerkas),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

// ============================================================================
// LEBAR HALAMAN - PILIHAN PER PERAMBAN (perbaikan 2 Okt 2026, butir 12)
// ============================================================================

/** Cadangan bila penyimpanan peramban tertutup - berlaku selama halaman hidup. */
let lebarMemori: LebarEcourt = "nyaman";
const PERISTIWA_LEBAR = "aleta-ecourt-lebar";

function bacaLebarTersimpan(): LebarEcourt {
  try {
    const nilai = window.localStorage.getItem(KUNCI_SIMPAN_LEBAR_ECOURT);
    return nilai === null ? lebarMemori : bacaLebarEcourt(nilai);
  } catch {
    return lebarMemori;
  }
}

function simpanLebarEcourt(nilai: LebarEcourt) {
  lebarMemori = nilai;
  try {
    window.localStorage.setItem(KUNCI_SIMPAN_LEBAR_ECOURT, nilai);
  } catch {
    // tidak diingat - tetap berlaku lewat lebarMemori
  }
  window.dispatchEvent(new Event(PERISTIWA_LEBAR));
}

function langgananLebarEcourt(berubah: () => void) {
  window.addEventListener(PERISTIWA_LEBAR, berubah);
  window.addEventListener("storage", berubah);
  return () => {
    window.removeEventListener(PERISTIWA_LEBAR, berubah);
    window.removeEventListener("storage", berubah);
  };
}

type Keadaan = {
  aktif: boolean;
  sesiBerlaku: boolean | null;
  dokumenTersimpan: number;
  menungguMajelis: number;
};

function Angka({ nilai, label, keterangan }: { nilai: number | string; label: string; keterangan: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{nilai}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  );
}

export function AletaEcourtPengguna() {
  const { currentUser, institutionIdentity } = usePortal();
  const peran = getEffectiveRoleId(currentUser);
  // Pengaturannya - termasuk login e-Court - sengaja TIDAK ditaruh di halaman
  // ini. Halaman ini terbuka untuk seluruh pegawai, dan sandi akun e-Court
  // pengadilan bukan sesuatu yang pantas ada di layar yang semua orang buka.
  // Yang ditambahkan hanya jalan pintas bagi yang memang berhak.
  const bolehMengatur = peran === "super-admin" || peran === "admin";
  // Halaman ini melayani dua keperluan yang berbeda: memasang ekstensi
  // (sekali saja, lalu tidak dibuka lagi) dan memeriksa keadaan berkas
  // (berulang, setiap hari). Menumpuk keduanya dalam satu halaman panjang
  // membuat yang sering dipakai selalu berada di bawah yang jarang dipakai.
  // Juru sita melihat tombol Cetak relaas di Jadwal Sidang; admin dan super
  // admin ikut melihatnya - diminta pengguna 25 September 2026, "keliatan juga
  // di superadmin dan admin". BUKAN tab tersendiri: "jangan buat tab baru di
  // aleta e-court, cukup tambahkan tombol cetak relaas di antrian aleta sidang".
  // HAK-PERAN 12 Okt: lewat matriks peran - Jurusita PENGGANTI (jabatan) ikut.
  const bolehRelaasMassal = bolehAksi(currentUser, "sidang.cetak-relaas") || bolehMengatur;
  /* === HAK-PERAN 12 Okt === */
  // Tab per golongan (TAB_ECOURT di src/lib/matriks-peran.ts). Mediasi
  // tertutup untuk umum; Riwayat ALETA menuntut kemampuan penunjukan.
  const tabBoleh = (tab: TabEcourt) => tabEcourtTampil(currentUser, tab);
  /* === AKHIR HAK-PERAN === */
  // 12 Okt 2026: halaman bawaan = Jadwal Sidang (tab "semua" golongan, jadi
  // selalu boleh); Dasbor tetap satu klik di bilah samping.
  const [menu, setMenu] = useState<
    "dasbor" | "sidang" | "mediasi" | "status" | "berkas" | "riwayat" | "ttd" | "ekstensi"
  >("sidang");
  const [sidebarCiut, setSidebarCiut] = useState(false);
  // Lebar halaman (butir 12, 2 Okt 2026): "nyaman" bawaan, "penuh" = lebar
  // J3 1.177.0. Diingat per peramban; penyimpanan yang tertutup (jendela
  // pribadi) jatuh ke bawaan tanpa error.
  // useSyncExternalStore, bukan setState di dalam efek: server selalu
  // menggambar "nyaman", peramban membaca simpanannya tanpa lukisan ganda.
  const lebar = useSyncExternalStore(langgananLebarEcourt, bacaLebarTersimpan, () => "nyaman" as LebarEcourt);
  const gantiLebar = useCallback(() => {
    simpanLebarEcourt(lebar === "penuh" ? "nyaman" : "penuh");
  }, [lebar]);
  const [cariMenu, setCariMenu] = useState("");
  // Nomor perkara yang diminta dibuka dari layar Jadwal Sidang. Halaman
  // induk yang berpindah menu - komponen jadwal tidak tahu menu apa saja
  // yang ada, dan tidak seharusnya tahu.
  const [perkaraDibuka, setPerkaraDibuka] = useState("");
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [mengunduh, setMengunduh] = useState(false);
  const [catatan, setCatatan] = useState("");
  // ==========================================================================
  // NOMOR PATCH EKSTENSI YANG SEDANG DISAJIKAN PORTAL
  // ==========================================================================
  //
  // Ekstensi Chrome yang dipasang lewat Load unpacked TIDAK PERNAH memperbarui
  // dirinya sendiri - Chrome memang tidak menyediakannya. Akibatnya petugas
  // dapat berhari-hari memakai versi lama tanpa satu pun tanda, dan gejalanya
  // tampak seperti kerusakan portal. Itu benar-benar terjadi.
  //
  // Karena itu nomornya disebut di halaman unduhan: yang membandingkannya
  // dengan nomor di chrome://extensions langsung tahu perlu mengunduh ulang
  // atau tidak. Angkanya dibaca dari manifest yang ditanam, bukan ditulis
  // ulang di sini - dua tempat pasti berselisih, dan yang kedua pasti terlupa.
  const [versiEkstensi, setVersiEkstensi] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/ecourt"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available || !isi?.status) {
        setPesan(isi?.message || "Penghubung e-Court belum dapat dihubungi.");
        setKeadaan(null);
      } else {
        setPesan("");
        setKeadaan({
          aktif: isi.status.aktif === true,
          sesiBerlaku: null,
          dokumenTersimpan: isi.status.dokumen?.total ?? 0,
          menungguMajelis: isi.status.dokumen?.belumVerifikasi ?? 0,
        });
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca keadaan.");
      setKeadaan(null);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  // ==========================================================================
  // ?perkara=<nomor> MEMBUKA STATUS PERKARA ITU
  // ==========================================================================
  //
  // Alamat itu disusun tombol "Salin tautan" di bilah alat Status Perkara dan
  // oleh daftar perkara pada halaman rekap petugas - tetapi sampai 27
  // September 2026 tidak ada yang membacanya: tautan yang disalin selalu
  // mendarat di Dasbor, dan penerimanya harus mencari ulang nomornya sendiri.
  //
  // Dibaca SEKALI sesudah terpasang, bukan pada nilai awal useState: halaman
  // ini juga digambar di peladen, dan nilai awal yang berbeda antara peladen
  // dan peramban melahirkan salah hidrasi.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let nomor = "";
      try {
        nomor = String(new URLSearchParams(window.location.search).get("perkara") ?? "").trim();
      } catch {
        nomor = "";
      }
      if (!nomor) return;
      setPerkaraDibuka(nomor);
      setMenu("status");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // ==========================================================================
  // #ttd MEMBUKA MENU TANDA TANGAN
  // ==========================================================================
  //
  // Tautan "Berkas tanda tangan" di Peta penetapan, panel ekstensi, dan
  // jawaban rute peta edoc (TAUTAN_BERKAS_TANDA_TANGAN) semuanya menuju
  // /aleta-ecourt#ttd - tetapi sampai 9 Oktober 2026 tidak ada yang membaca
  // jangkarnya: tautan itu selalu mendarat di Dasbor. "#tanda-tangan" ikut
  // dikenali karena cadangan ekstensi memakai sebutan itu.
  //
  // Hanya bagi yang memang boleh membuka menunya; yang lain tetap di Dasbor.
  // Bergantung pada bolehMengatur: sesi portal dapat terbaca sesudah halaman
  // terpasang, dan jangkar yang dibaca sebelum itu akan diabaikan selamanya.
  useEffect(() => {
    if (!bolehMengatur) return;
    const timer = window.setTimeout(() => {
      let jangkar = "";
      try {
        jangkar = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
      } catch {
        jangkar = "";
      }
      if (jangkar === "ttd" || jangkar === "tanda-tangan") setMenu("ttd");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bolehMengatur]);

  // 1.189.x: #kasir (pengingat setor PNBP di checklist milestone/widget)
  // membuka Jadwal Sidang; dialog Kasir harian membuka dirinya sendiri.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let jangkar = "";
      try {
        jangkar = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase();
      } catch {
        jangkar = "";
      }
      if (jangkar === "kasir") setMenu("sidang");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Dibaca sekali saat menu ekstensi dibuka, bukan saat portal dibuka.
  // Sebagian besar orang tidak pernah membuka menu ini sama sekali.
  useEffect(() => {
    if (menu !== "ekstensi" || versiEkstensi) return;
    let hidup = true;
    void (async () => {
      try {
        const respons = await fetch(apiPath("/api/aleta-ecourt/ekstensi?info=versi"), {
          cache: "no-store",
        });
        if (!respons.ok) return;
        const isi = await respons.json();
        const data = isi?.data ?? isi;
        if (hidup && data?.versi) setVersiEkstensi(String(data.versi));
      } catch {
        // Nomornya tidak muncul, dan itu saja. Halaman unduhan tetap utuh -
        // yang datang ke sini datang untuk mengunduh, bukan membaca nomor.
      }
    })();
    return () => {
      hidup = false;
    };
  }, [menu, versiEkstensi]);

  /**
   * Mengunduh ekstensi.
   *
   * Berkasnya diambil lewat fetch lalu disimpan dari blob, bukan lewat tautan
   * biasa. Tautan biasa membuka jendela unduhan tanpa membawa sesi pada
   * sebagian penyiapan, sehingga petugas menerima halaman login alih-alih
   * berkasnya - tanpa penjelasan apa pun.
   */
  const unduhEkstensi = useCallback(async () => {
    setMengunduh(true);
    setCatatan("");
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/ekstensi"), { cache: "no-store" });
      if (!respons.ok) {
        // Bentuk galat portal { ok: false, error: { message } } - pesannya di
        // dalam error, bukan di sebelahnya. Yang dibaca dulu galat.message,
        // yang tidak pernah ada; sebab yang sudah disiapkan peladen karena itu
        // tidak pernah sampai ke layar, dan yang terbaca hanya nomor HTTP.
        const galat = (await respons.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setCatatan(galat?.error?.message || `Gagal mengunduh (HTTP ${respons.status}).`);
        return;
      }

      const blob = await respons.blob();
      const alamat = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = alamat;
      tautan.download = "aleta-ekstensi-sipp.zip";
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      URL.revokeObjectURL(alamat);

      setCatatan("Ekstensi terunduh. Ikuti langkah pemasangan di bawah.");
    } catch (error) {
      setCatatan(error instanceof Error ? error.message : "Gagal mengunduh ekstensi.");
    } finally {
      setMengunduh(false);
    }
  }, []);

  const menuItem = [
    { id: "dasbor" as const, label: "Dasbor", keterangan: "Keadaan penghubung", ikon: LayoutDashboard },
    // Jadwal sebelum Kendali Berkas: yang ditanya petugas tiap pagi adalah
    // "hari ini sidang apa saja", bukan "berkas mana yang belum lengkap".
    { id: "sidang" as const, label: "Jadwal Sidang", keterangan: "Perkara yang bersidang", ikon: CalendarDays },
    // Status Perkara setelah Jadwal: yang satu menjawab "hari ini sidang apa
    // saja", yang ini menjawab "perkara nomor sekian bagaimana keadaannya".
    // Jadwal Mediasi tepat setelah Jadwal Sidang: keduanya dibaca pada pagi
    // yang sama oleh orang yang sama, dan pertemuan mediasi TIDAK pernah
    // muncul di jadwal sidang - ia tersimpan di tabel SIPP sendiri.
    {
      id: "mediasi" as const,
      label: "Jadwal Mediasi",
      keterangan: "Pertemuan dan tenggangnya",
      ikon: Handshake,
    },
    { id: "status" as const, label: "Status Perkara", keterangan: "Telusuri satu perkara", ikon: FileSearch },
    { id: "berkas" as const, label: "Kendali Berkas", keterangan: "Arsip per perkara", ikon: FolderCheck },
    // Riwayat sesudah Kendali Berkas dan sebelum Ekstensi: ia dibaca
    // berulang seperti keduanya yang di atas, sedangkan Ekstensi dibuka
    // sekali lalu tidak lagi.
    {
      id: "riwayat" as const,
      label: "Riwayat ALETA",
      keterangan: "Yang dituliskan ke SIPP",
      ikon: History,
    },
    // Hanya bagi admin - menamai tanda tangan pejabat berlaku untuk seluruh
    // satuan kerja dan untuk semua perkara sesudahnya, dan itu bukan
    // keputusan petugas meja.
    ...(bolehMengatur
      ? [
          {
            id: "ttd" as const,
            label: "Tanda Tangan",
            keterangan: "Bubuhan pada penetapan",
            ikon: PenLine,
          },
        ]
      : []),
    { id: "ekstensi" as const, label: "Ekstensi SIPP", keterangan: "Pasang di peramban", ikon: Puzzle },
  ];
  // HAK-PERAN 12 Okt: hanya tab yang diberikan matriks peran.
  const menuItemPeran = menuItem.filter((item) => tabBoleh(item.id));
  // Menu yang cocok dengan pencarian. Label dan keterangannya sama-sama
  // dicari: petugas mengingat "arsip", bukan "Kendali Berkas".
  const menuTampil = cariMenu.trim()
    ? menuItemPeran.filter((item) =>
        `${item.label} ${item.keterangan}`.toLowerCase().includes(cariMenu.trim().toLowerCase())
      )
    : menuItemPeran;

  return (
    // ==================================================================
    // KEPALA HALAMAN DIBUANG, DAN JARAKNYA DIRAPATKAN
    // ==================================================================
    //
    // "ALETA e-Court" beserta keterangannya menempati hampir seperempat
    // tinggi layar dan hanya dibaca sekali seumur hidup pemakainya. Nama
    // aplikasinya sudah tertulis di sidebar dan di judul tab peramban;
    // menuliskannya sekali lagi di dalam halaman memakan ruang yang justru
    // dibutuhkan jadwal sidang - dan pada layar laptop, tiap seperempat
    // layar adalah lima baris sidang yang tidak terlihat.
    // Padding ATAS dipangkas, samping dan bawah dibiarkan. Jarak dari tepi
    // kepala halaman ke judul jadwal terukur 64 px pada sm ke atas, dan pada
    // layar laptop tiap seperempat layar adalah lima baris sidang yang tidak
    // terlihat. Yang dipangkas hanya ruang kosong di atas - bukan jarak antar
    // kartu di bawahnya, yang justru memisahkan bagian.
    //
    // Padding SAMPING dibuang (28 September 2026). Diminta pengguna: kolom
    // antrian sidang "sampai hampir mentok layar (mengikuti header dan footer
    // juga lebarnya), tapi jangan terlalu mentok". p-5 membuat menu dan kartu
    // jadwal menjorok 20 px dari tepi kepala dan kaki halaman di kedua sisi -
    // tepinya tidak pernah sejajar, dan 40 px itu diambil dari tabel yang
    // justru kekurangan lebar. Jarak ke tepi layar sudah diberikan bagan luar
    // portal (px-6 dan max-w-[1600px]); menambah jarak kedua di sini hanya
    // membuat tiga tepi yang berbeda.
    //
    // ==================================================================
    // LEBIH LEBAR DI LAYAR LEBAR - PERBAIKAN 1 OKTOBER 2026 (J3)
    // ==================================================================
    //
    // Bagan luar portal memaku isi pada max-w-[1600px]. Pada layar 1920 px
    // itu 160 px kosong di tiap sisi sementara jadwal sidang berdesakan.
    // Halaman ini tidak punya sidebar portal (konteks "default"), jadi
    // pembungkus ini boleh MELEBAR keluar dari 1600 px ke kedua sisi -
    // simetris, dengan jarak 1,5 rem ke tepi jendela, paling lebar 2400 px.
    //
    // Hanya margin dan lebar - BUKAN transform. transform menjadikan
    // pembungkus bingkai bagi anak ber-position fixed: layar penuh Jadwal
    // Sidang (J4), Kalender, dan dialog akan terkurung di dalamnya.
    //
    // Fit-to-size tetap: di bawah 1600 px tidak ada yang berubah, dan tabel
    // jadwal tetap menyesuaikan lebarnya (min-w-0 pada xl) - hanya ruangnya
    // yang bertambah.
    //
    // ==================================================================
    // LEBAR NYAMAN SEBAGAI BAWAAN - PERBAIKAN 2 OKTOBER 2026 (butir 12)
    // ==================================================================
    //
    // Lebar J3 dikeluhkan terlalu lebar (1.872 px pada layar 1920). Bawaannya
    // kini paling lebar 1.680 px - rumusnya sama, hanya batasnya - dan lebar
    // J3 tetap dapat dipilih lewat tombol "Lebar penuh" di kaki sidebar.
    // Lihat KELAS_LEBAR_ECOURT di @/lib/jadwal-sidang-2okt.
    <div data-lebar-ecourt={lebar} className={KELAS_LEBAR_ECOURT[lebar]}>
    <div className="space-y-4 px-0 pb-4 pt-1 sm:pb-5">
      {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

      <div
        className={cn(
          // grid-cols-1 = minmax(0,1fr). Tanpa kolom eksplisit, di bawah lg
          // kolomnya selebar isi terlebar - deret menu yang dapat digeser -
          // dan seluruh kartu e-Court melebar 1.036 px di layar ponsel,
          // memotong tabel Detail dan tombol Cetak Status Perkara (terukur
          // 26 September 2026 pada 320/375/768 px).
          "grid grid-cols-1 gap-4 transition-all duration-300",
          // Sidebar dipersempit dari 264px menjadi 216px: menunya bernama
          // pendek dan tidak pernah memakai selebar itu, sedangkan jadwal
          // sidang di sebelahnya punya sepuluh kolom yang selalu kurang ruang.
          // Kolom isi minmax(0,1fr): 1fr biasa berbatas bawah selebar isinya.
          sidebarCiut ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[216px_minmax(0,1fr)]"
        )}
      >
        {/* Sidebar ini mengikuti sidebar utama ALETA - lihat portal-shell-v2.
            Menyalin bentuk dan perilakunya, bukan merancang yang kedua: dua
            sidebar yang mirip tetapi tidak sama terbaca sebagai kekeliruan. */}
        {/* ====================================================================
            SIDEBAR MENEMPEL, DAN MENGGULUNG SENDIRI BILA KEPANJANGAN
            ====================================================================

            Sebelumnya sidebar ini ikut tergulung bersama halaman. Layar seperti
            Jadwal Sidang dan Status Perkara panjangnya berkali-kali tinggi
            layar, sehingga begitu digulung ke bawah menunya hilang sama sekali
            dan pemakainya harus menggulung balik ke atas hanya untuk berpindah
            layar.

            sticky top-4 membuatnya berhenti 16px dari tepi atas - sejajar
            dengan py-4 bagan luar portal - lalu bertahan di sana. Ia menempel
            pada bagan grid-nya sendiri, dan bagan itu setinggi baris grid,
            yakni setinggi isi di sebelahnya; itulah sebabnya ia ikut sampai
            ke ujung bawah halaman.

            Menempel saja belum cukup: sidebar yang lebih tinggi dari layar
            akan TERPOTONG di bawah dan butir terbawahnya tidak pernah dapat
            diklik. max-h dan overflow-y-auto membuatnya menggulung di dalam
            dirinya sendiri. Tingginya dikurangi 2rem - 1rem untuk top-4 dan
            1rem lagi agar tepi bawahnya tidak menempel ke tepi layar.

            Hanya pada lg ke atas. Di bawah itu sidebar berada di ATAS isinya,
            bukan di sampingnya, dan menempelkannya akan menutupi isi yang
            justru sedang dibaca.

            Yang sama sudah dipakai sidebar utama portal - lihat
            portal-shell-v2 "sticky top-0 h-screen". Bentuknya sengaja
            disamakan. */}
        <nav
          aria-label="Menu ALETA e-Court"
          className={cn(
            "flex h-fit min-w-0 flex-col gap-3 rounded-[2rem] border border-primary/20 bg-[linear-gradient(180deg,rgba(5,20,34,0.98),rgba(8,38,58,0.96))] text-slate-100 shadow-panel backdrop-blur transition-all duration-300",
            // ============================================================
            // overflow-y-auto SENDIRIAN MEMBUAT BILAH GULIR MENDATAR
            // ============================================================
            //
            // Menyetel overflow-y ke selain visible memaksa overflow-x yang
            // masih "visible" dihitung sebagai "auto" - itu aturan CSS, bukan
            // kekhilafan peramban. Akibatnya, begitu isi sidebar lebih lebar
            // satu piksel saja dari bagannya - dan pada keadaan ciut selebar
            // 68px itu mudah terjadi karena tombol di dalamnya 44px ditambah
            // padding - muncul bilah gulir mendatar di kaki sidebar.
            //
            // Bilah itu tidak menggulung apa pun yang berguna; ia hanya
            // bilah. overflow-x-hidden menutupnya tanpa mengubah gulir
            // menurunnya, yang memang dibutuhkan saat menunya panjang.
            "lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain",
            sidebarCiut ? "px-3 py-5" : "p-5"
          )}
        >
          {/* ==================================================================
              TULISAN TOMBOL INI PERNAH KELUAR DARI BAGANNYA
              ==================================================================

              Sidebar lebarnya 216px, dan dengan padding 20px di kedua sisi
              tersisa 176px. Tombol ciutkan mengambil 40px dan jaraknya 8px,
              sehingga tombol ini hanya punya 128px - sedangkan "Kembali ke
              Portal" beserta ikon dan padding bawaan tombol menuntut lebih.
              Tanpa min-w-0, flex-1 menolak menyusut di bawah lebar isinya, dan
              tulisannya menembus keluar bagan menimpa tombol di sebelahnya.

              Tiga hal yang menahannya sekarang: min-w-0 membolehkan menyusut,
              truncate memotong dengan elipsis alih-alih meluber, dan padding
              yang lebih rapat memberi ruang bagi tulisannya. Judul lengkapnya
              tetap ada di title, sehingga yang terpotong masih dapat dibaca. */}
          <div className={cn("flex gap-2", sidebarCiut ? "justify-center" : "items-center")}>
            <Button
              asChild
              variant="secondary"
              size={sidebarCiut ? "icon" : "default"}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white",
                sidebarCiut ? "h-11 w-11 shrink-0" : "min-w-0 flex-1 justify-start px-3"
              )}
            >
              <Link href={apiPath("/portal")} title="Kembali ke Portal ALETA">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                {!sidebarCiut ? (
                  <span className="ml-2 truncate">Kembali ke Portal</span>
                ) : null}
              </Link>
            </Button>

            {!sidebarCiut ? (
              <Button
                variant="secondary"
                size="icon"
                aria-label="Ciutkan sidebar"
                title="Ciutkan sidebar"
                onClick={() => setSidebarCiut(true)}
                className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {sidebarCiut ? (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Lebarkan sidebar"
              title="Lebarkan sidebar"
              onClick={() => setSidebarCiut(false)}
              className="h-11 w-11 self-center rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : null}

          {!sidebarCiut ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                  Penghubung e-Court
                </p>
                <p className="mt-0.5 text-sm font-semibold">ALETA e-Court</p>
              </div>

              {/* Pencarian menu: sidebar ini masih pendek, tetapi disamakan
                  dengan sidebar utama supaya kebiasaannya tidak berbeda antar
                  halaman. */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={cariMenu}
                  onChange={(peristiwa) => setCariMenu(peristiwa.target.value)}
                  placeholder="Cari menu e-Court..."
                  aria-label="Cari menu e-Court"
                  className="rounded-2xl border-white/10 bg-white/[0.04] pl-9 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:ring-white/20"
                />
              </div>
            </>
          ) : null}

          {/* ==================================================================
              DI BAWAH lg MENUNYA BERJEJER, BUKAN BERTUMPUK
              ==================================================================

              Pada layar sempit sidebar ini pindah ke ATAS isinya. Tujuh butir
              menu yang bertumpuk menurun berarti tujuh kotak setinggi 60px
              yang harus dilewati sebelum jadwal sidangnya terlihat sama
              sekali - di ponsel itu satu layar penuh berisi menu.

              Dijejerkan mendatar dengan gulir sendiri, butirnya menyusut jadi
              satu baris: ikon dan namanya saja, keterangannya disembunyikan.
              Bentuk yang sama dipakai bilah tab di mana-mana, jadi tidak perlu
              dipelajari.

              Dari lg ke atas tidak ada yang berubah - di situ sidebar memang
              berdiri di samping dan punya ruang menurun. */}
          <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:snap-none lg:flex-col lg:overflow-x-visible lg:px-0 lg:pb-0">
            {menuTampil.map((item) => {
              const Icon = item.ikon;
              const aktif = menu === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMenu(item.id)}
                  aria-current={aktif ? "page" : undefined}
                  title={sidebarCiut ? item.label : undefined}
                  className={cn(
                    "relative flex shrink-0 snap-start overflow-hidden rounded-2xl border transition lg:shrink",
                    sidebarCiut
                      ? "justify-center px-3 py-3 lg:px-0"
                      : "items-center gap-2 px-3 py-2 text-left lg:items-start lg:gap-3 lg:px-3.5 lg:py-2.5",
                    aktif
                      ? cn(
                          "border-sky-300/55 bg-sky-300 text-slate-950 shadow-[0_16px_34px_rgba(56,189,248,0.2)]",
                          !sidebarCiut &&
                            "before:absolute before:bottom-3 before:left-1.5 before:top-3 before:w-1 before:rounded-full before:bg-white/90"
                        )
                      : "border-transparent text-slate-100 hover:border-white/10 hover:bg-white/10"
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 shrink-0 rounded-xl p-2",
                      aktif ? "bg-white/30 text-slate-950" : "bg-white/10 text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  {!sidebarCiut ? (
                    <span className="relative z-10 min-w-0 space-y-0.5">
                      <span className="block truncate whitespace-nowrap text-sm font-semibold lg:whitespace-normal">
                        {item.label}
                      </span>
                      {/* Keterangannya hanya muat pada sidebar tegak. Di bilah
                          mendatar ia akan memanjangkan tiap butir sampai
                          separuh layar. */}
                      <span
                        className={cn(
                          "hidden text-[12px] leading-5 lg:block",
                          aktif ? "text-slate-900/75" : "text-slate-300"
                        )}
                      >
                        {item.keterangan}
                      </span>
                    </span>
                  ) : (
                    <span className="sr-only">{item.label}</span>
                  )}
                </button>
              );
            })}

            {/* Pencarian yang tidak menemukan apa pun HARUS mengatakannya.
                Sidebar yang mendadak kosong terbaca sebagai kerusakan. */}
            {!sidebarCiut && menuTampil.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-slate-300">
                Menu tidak ditemukan.
              </p>
            ) : null}
          </div>

          {/* Lebar halaman (butir 12, 2 Okt 2026) - hanya berarti pada
              jendela 1600 px ke atas, jadi hanya tampil di sana. */}
          <button
            type="button"
            onClick={gantiLebar}
            aria-pressed={lebar === "penuh"}
            data-tombol-lebar-ecourt=""
            title={
              lebar === "penuh"
                ? "Lebar penuh (paling lebar 2.400 px). Tekan untuk kembali ke lebar nyaman (paling lebar 1.680 px)."
                : "Lebar nyaman (paling lebar 1.680 px). Tekan untuk lebar penuh hampir sampai tepi layar."
            }
            className={cn(
              "hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-xs text-slate-300 transition hover:bg-white/10 hover:text-white min-[1600px]:flex",
              sidebarCiut ? "h-11 w-11 justify-center self-center" : "px-3 py-2"
            )}
          >
            <MoveHorizontal className="h-4 w-4 shrink-0" />
            {!sidebarCiut ? <span>{lebar === "penuh" ? "Lebar penuh" : "Lebar nyaman"}</span> : <span className="sr-only">Lebar halaman</span>}
          </button>
        </nav>

        <div className="min-w-0 space-y-4">
          {menu === "sidang" ? (
            <AletaEcourtSidang
              onBukaStatus={(nomorPerkara) => {
                setPerkaraDibuka(nomorPerkara);
                setMenu("status");
              }}
              // Halaman tersendiri, bukan panel di dalam layar ini: yang
              // ditulisnya SIPP sungguhan, dan halaman yang berdiri sendiri
              // punya alamat yang dapat dibagikan, ditinggalkan, lalu dibuka
              // lagi tanpa kehilangan tempat.
              onBukaTunda={({ sidangId }) => {
                window.location.assign(withBasePath(`/sidang-tunda/${encodeURIComponent(sidangId)}`));
              }}
              // Tombol Cetak relaas - panggilan sidang dan pemberitahuan
              // putusan yang lahir pada hari itu, dicetak lewat ekstensi.
              bolehCetakRelaas={bolehRelaasMassal}
            />
          ) : null}

          {menu === "mediasi" && tabBoleh("mediasi") ? (
            <AletaEcourtMediasi
              onBukaStatus={(nomorPerkara) => {
                setPerkaraDibuka(nomorPerkara);
                setMenu("status");
              }}
              // Tombol hasil mediasi (.rtf) - hanya mediator perkara itu dan
              // Super Admin; namanya dicocokkan dengan mediator di SIPP.
              pengguna={
                currentUser
                  ? {
                      nama: currentUser.name,
                      peran: String(peran || ""),
                      peranTambahan: currentUser.additionalRoleIds ?? [],
                      namaPengadilan: institutionIdentity?.courtName ?? "",
                    }
                  : null
              }
            />
          ) : null}

          {menu === "status" ? (
            <AletaEcourtStatusPerkara
              // key memaksa komponen disusun ulang saat perkara lain diminta,
              // sehingga isian pencarian dan hasil sebelumnya tidak tertinggal.
              key={perkaraDibuka || "kosong"}
              nomorAwal={perkaraDibuka}
            />
          ) : null}

          {menu === "berkas" ? (
            <AletaEcourtArsipBerkas
              onBukaPerkara={(nomorPerkara) => {
                setPerkaraDibuka(nomorPerkara);
                setMenu("status");
              }}
            />
          ) : null}

          {menu === "riwayat" && tabBoleh("riwayat") ? <AletaEcourtRiwayat /> : null}

          {menu === "ttd" && bolehMengatur ? <AletaEcourtTandaTangan /> : null}

          {menu === "ekstensi" ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Ekstensi peramban untuk SIPP
            {/* Nomor patch di sebelah judul, bukan di kaki halaman: yang datang
                ke sini untuk memeriksa versinya tidak perlu menggulung. */}
            {versiEkstensi ? <Badge variant="muted">Patch {versiEkstensi}</Badge> : null}
          </CardTitle>
          <CardDescription>
            Menempelkan keterangan ALETA ke halaman perkara SIPP, dan mengerjakan penetapan atas
            nama pejabat yang berwenang. Halaman SIPP tidak diubah tampilannya, kecuali tema gelap
            yang dapat dimatikan kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* ================================================================
              UNDUHAN PALING ATAS

              Ini satu-satunya tindakan di halaman ini. Menaruhnya di bawah
              penjelasan berarti setiap orang yang sudah tahu harus menggulung
              melewati penjelasan yang tidak lagi ia perlukan.
              ================================================================ */}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={mengunduh} onClick={() => void unduhEkstensi()}>
              {mengunduh ? "Menyiapkan…" : "Unduh Ekstensi"}
            </Button>

            {/* ==============================================================
                JALAN PINTAS KE PENGATURAN KEWENANGANNYA

                Siapa boleh memakai bagian mana dari ekstensi diatur per PERAN,
                dan pengaturannya ada di halaman Integrasi e-Court - tiga
                gulungan di bawah, di tengah tumpukan kartu.

                Selama tidak ada tautan dari sini, yang memasang ekstensi lalu
                mendapati sebagian menunya mati tidak punya cara menemukan
                sebabnya: halaman ini menerangkan APA yang dikerjakan ekstensi,
                tanpa menyebut bahwa sebagiannya dapat dimatikan per peran.

                Hanya digambar bagi yang memang dapat membukanya. Tombol yang
                berakhir pada penolakan mengajari orang bahwa aplikasinya
                rusak, padahal ia sedang bekerja sebagaimana mestinya.
                ============================================================== */}
            {bolehMengatur ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/aleta-ecourt#pengaturan-ekstensi">
                  Atur kewenangan ekstensi
                </Link>
              </Button>
            ) : null}
            {versiEkstensi ? (
              <p className="text-xs text-muted-foreground">
                Yang tersedia sekarang <strong className="text-foreground">{versiEkstensi}</strong>.
                Bandingkan dengan nomor di <code className="rounded bg-muted px-1">chrome://extensions</code>;
                bila berbeda, unduh lalu muat ulang ekstensinya.
              </p>
            ) : null}
          </div>

          {/* ================================================================
              APA YANG BERUBAH, DAN KAPAN

              Yang membandingkan nomor di chrome://extensions dengan yang
              tersedia perlu tahu apa yang ia lewatkan - dan jam rilisnya,
              sebab dalam sehari bisa ada tiga rilis. Daftarnya sama persis
              dengan Patch Notes dan Update Manager: satu sumber.
              ================================================================ */}
          <div>
            <p className="text-sm font-semibold">Catatan pembaruan ekstensi</p>
            <div className="mt-2">
              <CatatanEkstensiDaftar batas={4} />
            </div>
          </div>

          {/* ================================================================
              TAHAP KERJA

              Ditulis sebagai urutan waktu, bukan daftar fitur. Yang pertama
              kali memasang ekstensi tidak bertanya "apa saja fiturnya" - ia
              bertanya "sesudah ini saya harus apa", dan daftar fitur tidak
              pernah menjawab pertanyaan itu.
              ================================================================ */}
          <div>
            <p className="text-sm font-semibold">Tahap kerjanya — sekali pasang, lalu berjalan sendiri</p>
            <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">1. Pasang di Chrome.</strong> Unduh, ekstrak,
                lalu Load unpacked. Cukup sekali; langkah rincinya ada di kotak bawah.
              </li>
              <li>
                <strong className="text-foreground">2. Masuk ALETA di peramban yang sama.</strong>{" "}
                Ekstensi menumpang sesi portal Anda — tidak ada sandi yang disimpan di peramban.
                Tanpa login, panelnya muncul tetapi kosong dan mengajak Anda masuk.
              </li>
              <li>
                <strong className="text-foreground">3. Buka SIPP seperti biasa.</strong> Panel ALETA
                muncul melayang di sisi kanan. Boleh digeser, diubah ukurannya, diciutkan jadi logo,
                atau dibuat layar penuh.
              </li>
              <li>
                <strong className="text-foreground">4. Buka satu perkara.</strong> Panel langsung
                terisi keterangan perkara itu, dan baris-baris di daftar perkara diberi penanda
                keadaan.
              </li>
              <li>
                <strong className="text-foreground">5. Tekan Kerjakan bila perlu.</strong> Nama
                pejabat yang akan tercatat ditampilkan lebih dulu, tepat di atas tombolnya — supaya
                terlihat siapa yang menginput sebelum, bukan sesudah.
              </li>
            </ol>
          </div>

          {/* ================================================================
              FUNGSINYA, DIPISAH MENURUT AKIBATNYA

              Membaca dan menulis dipisah dengan sengaja. Keduanya sangat
              berbeda akibatnya bagi data SIPP, dan menggabungkannya dalam satu
              daftar membuat perbedaan itu hilang justru bagi orang yang paling
              perlu mengetahuinya.
              ================================================================ */}
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">1. Membaca — keterangan yang tidak ada di SIPP</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Batas waktu unggah e-Court dan sisa harinya</li>
                <li>Berkas e-Court per perkara, sekaligus unduhannya</li>
                <li>Arsip perkara dan penilaian kelengkapannya</li>
                <li>Tahapan perkara dan kesiapan sidang</li>
                <li>Selisih antara catatan ALETA dan keadaan e-Court</li>
              </ul>
            </div>
            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">2. Menandai — keadaan yang mengubah cara kerja</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Pihak ghaib</strong> — panggilan lewat
                  pengumuman, tenggat 120 atau 180 hari
                </li>
                <li>
                  <strong className="text-foreground">Izin atasan</strong> — pihak PNS, TNI, atau
                  Polri
                </li>
                <li>Verzet, prodeo, dan perkara yang memakai kuasa hukum</li>
                <li>Diduga mafqud — dugaan dari pola tundaan, bukan keterangan resmi</li>
                <li>Panjar menipis sebelum perkara diputus</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Penandanya muncul di bawah nomor perkara pada daftar, dan di sebelah judul pada
                halaman perkara.
              </p>
            </div>
            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">3. Mengerjakan — menulis ke SIPP</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Usulan majelis, PP, dan juru sita menurut giliran dan bobot perkara</li>
                <li>PMH, PPP, PJS, PHS, dan Data Umum dituliskan ke SIPP</li>
                <li>Tercatat atas nama pejabat yang berwenang, termasuk pada jejak auditnya</li>
                <li>Hari sidang dihindarkan dari tanggal yang sudah penuh dan hari libur</li>
              </ul>
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                Hanya bagian inilah yang mengubah data. Selebihnya membaca saja.
              </p>
            </div>
          </div>

          {/* ================================================================
              HALAMAN BLANGKO ABT - SETENGAH YANG SELAMA INI TIDAK DISEBUT

              Seluruh keterangan di atas berbicara tentang SIPP. Ekstensi yang
              sama juga bekerja di halaman blangko ABT, dan yang dikerjakannya
              di sana sama besarnya - tetapi tidak pernah disebutkan di mana
              pun. Petugas yang membaca halaman ini menyimpulkan ekstensinya
              tidak menyentuh ABT sama sekali, lalu mengerjakan dengan tangan
              apa yang sudah ada tombolnya.
              ================================================================ */}
          <div className="rounded border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Di halaman blangko ABT</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Panel yang sama muncul di halaman blangko — dapat digeser, diubah ukurannya,
              diciutkan jadi logo, dan bertema sama dengan panel SIPP.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Penjaga CETAK</strong> — memeriksa baris
                variabel sebelum dicetak, dan menahan yang isinya ternyata bunyi error mesin.
                Kalimat semacam itu tampak seperti keterangan dan tercetak sebagai pertimbangan
                hukum.
              </li>
              <li>
                <strong className="text-foreground">Menyunting variabel</strong> — lewat jalur
                penyuntingan milik ABT sendiri, bukan menulis ke basis datanya.
              </li>
              <li>
                <strong className="text-foreground">Membersihkan keterangan saksi</strong> —
                kalimat penutup yang berulang dibuang, dan sidang tempat saksi itu diperiksa
                dicari sendiri.
              </li>
              <li>
                <strong className="text-foreground">Alasan-Alasan Cerai</strong> — yang diusulkan
                hanya yang BERSESUAIAN antara kedua saksi dan yang memang didalilkan gugatan.
                Alasan yang hanya diketahui satu saksi disebut terpisah, tidak dicampurkan.
              </li>
              <li>
                <strong className="text-foreground">Merapikan posita</strong> — dirapikan di kolom
                posita SIPP-nya, sehingga berubah pula di ABT. Isinya dijaga: yang berbeda satu
                huruf pun ditolak.
              </li>
              <li>
                <strong className="text-foreground">CETAK</strong> — satu tekanan menghasilkan tiga
                berkas sekaligus: naskah, naskah anonim, dan PDF-nya.
              </li>
            </ul>
          </div>

          {/* ================================================================
              APA YANG TETAP JALAN KETIKA ALETA MATI

              Ditulis di sini karena satu sebab yang terukur: ketika ALETA
              tidak terjangkau, yang disimpulkan petugas SELALU sama - ekstensinya
              rusak. Lalu panelnya ditutup, dan sesudah beberapa kali begitu ia
              berhenti memakainya, padahal bagian terbesar ekstensi ini tidak
              pernah menyentuh ALETA sama sekali.

              Daftar yang sama diucapkan pesan galat ekstensi. Keduanya HARUS
              sama - halaman yang menjanjikan sesuatu tetap jalan sementara
              pesan galatnya berkata lain lebih membingungkan daripada tidak
              ada keterangan sama sekali. Kesamaannya dijaga pengujian.
              ================================================================ */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                Tetap jalan walau ALETA mati
              </p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                <li>Tema gelap dan terang</li>
                <li>Panel — geser, ukuran, lencana, posisi tersimpan</li>
                <li>Penandaan halaman</li>
                <li>Penjaga CETAK</li>
                <li>Sunting variabel ABT</li>
                <li>Pembersih keterangan saksi</li>
                <li>CETAK naskah dan anonimnya</li>
              </ul>
            </div>
            <div className="rounded border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Menunggu ALETA
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                <li>Usulan dari keterangan saksi</li>
                <li>Huruf alasan</li>
                <li>Perapian posita</li>
                <li>PDF</li>
                <li>Penunjukan</li>
                <li>Data Umum</li>
              </ul>
              <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-200/70">
                Keenam inilah yang memang lewat portal, dan tidak ada jalan lain. Pesan error
                ekstensi menyebutkan daftar yang sama.
              </p>
            </div>
          </div>

          {/* ================================================================
              BATASNYA DISEBUT SENDIRI

              Lapisan yang menempel di aplikasi orang lain harus menyatakan
              batasnya sendiri. Yang tidak menyatakannya akan dicurigai
              melakukan lebih daripada yang benar-benar dilakukannya.
              ================================================================ */}
          <div className="rounded border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Yang tidak dilakukannya</p>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              <li>Tidak menyimpan sandi — SIPP maupun ALETA</li>
              <li>Tidak mengubah tampilan SIPP, kecuali tema gelap yang dapat dimatikan</li>
              <li>Tidak pernah ikut tercetak pada relaas maupun dokumen SIPP</li>
              <li>Tidak menghapus apa pun di SIPP</li>
            </ul>
          </div>

          <div className="rounded border border-border bg-muted/30 p-3">
            <p className="text-sm font-medium">Cara memasang</p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>
                1. Unduh, lalu <strong className="text-foreground">Extract All</strong> berkas ZIP-nya
              </li>
              <li>
                2. Buka <code className="rounded bg-background px-1">chrome://extensions</code>
              </li>
              <li>3. Nyalakan Developer mode</li>
              <li>
                4. <strong className="text-foreground">Load unpacked</strong>, pilih folder hasil
                ekstrak
              </li>
              <li>
                5. Untuk memperbarui: unduh yang baru, ekstrak menimpa folder lama, lalu tekan{" "}
                <strong className="text-foreground">Muat ulang</strong> pada kartu ekstensinya
              </li>
            </ol>
            <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              Menyeret berkas ZIP ke halaman Extensions tidak akan berhasil - Chrome tidak dapat
              memasang ekstensi dari ZIP. Berkasnya harus diekstrak lebih dulu.
              <br />
              Di Windows, klik dua kali ZIP hanya <em>menampilkan</em> isinya seperti folder tanpa
              mengekstrak, dan Load unpacked pada tampilan itu akan ditolak. Gunakan klik kanan →
              Extract All.
              <br />
              Setelah diekstrak, folder hasilnya boleh diseret langsung ke halaman Extensions -
              itu berhasil.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Panduan lengkap ada di dalam berkas ZIP (PASANG.md), termasuk penyebab bila panelnya tidak muncul.
            Ikon ekstensi di pojok peramban menyebut versi yang terpasang serta akun ALETA dan SIPP
            yang sedang masuk — periksa di situ lebih dulu bila ada yang terasa tidak beres.
          </p>
        </CardContent>
      </Card>
          ) : null}

          {menu === "dasbor" ? (
            <>
      {/* Butir 12 (13 Okt 2026): status penarikan data e-Court - paling atas,
          sebab tanpa penarikan seluruh angka di bawah tidak bertambah. */}
      <EcourtStatusPenarikan />
      {/* 19 Okt 2026: pejabat yang tanda tangannya tertaut ke akunnya melihat pengaturan TTE-nya sendiri. */}
      {!bolehMengatur ? <AletaEcourtTte mode="saya" /> : null}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Keadaan penghubung
              {memuat ? null : keadaan ? (
                <Badge variant={keadaan.aktif ? "default" : "muted"}>
                  {keadaan.aktif ? "Pemberitahuan aktif" : "Pemberitahuan dimatikan"}
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>Hanya untuk dilihat. Pengaturannya ada di menu Integrasi e-Court.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {bolehMengatur ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/aleta-ecourt">Buka Integrasi e-Court</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void muat()}>
              Muat Ulang
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {memuat ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : pesan ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              {pesan}
            </p>
          ) : keadaan ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Angka
                nilai={keadaan.dokumenTersimpan}
                label="Dokumen tersimpan"
                keterangan="Berkas e-Litigasi yang sudah ditarik ALETA."
              />
              <Angka
                nilai={keadaan.menungguMajelis}
                label="Menunggu verifikasi majelis"
                keterangan="Belum dapat diberitahukan ke pihak lawan."
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yang perlu diketahui</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Ekstensi tidak mengubah SIPP.</span> Ia hanya menambah
            keterangan di layar. Petugas yang tidak memasangnya melihat SIPP persis seperti biasa — jadi dua orang
            dapat melihat isi berbeda pada perkara yang sama.
          </p>
          <p>
            <span className="font-medium text-foreground">Nomor pihak ditampilkan tersamar.</span> Layar SIPP dapat
            terlihat orang lain, dan nomor pihak berperkara bukan keterangan yang perlu dipajang.
          </p>
          <p>
            <span className="font-medium text-foreground">Pemberitahuan WhatsApp bukan panggilan resmi.</span>{" "}
            Pemberitahuan yang sah secara hukum tetap yang disampaikan jurusita.
          </p>
        </CardContent>
      </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
    </div>
  );
}
