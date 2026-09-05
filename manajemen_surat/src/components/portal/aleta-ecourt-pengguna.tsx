"use client";

/**
 * Halaman ALETA e-Court untuk seluruh pegawai.
 *
 * Isinya sengaja sedikit: menjelaskan apa yang dikerjakan penghubung ini,
 * menyediakan unduhan ekstensi, dan menunjukkan apakah penghubungnya sedang
 * bekerja. Tidak ada satu pun pengaturan di sini - itu ada di menu admin.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  Handshake,
  FileSearch,
  FolderCheck,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Puzzle,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { getEffectiveRoleId } from "@/lib/permissions";
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

const AletaEcourtArsipBerkas = dynamic(
  () => import("@/components/portal/aleta-ecourt-arsip-berkas").then((m) => m.AletaEcourtArsipBerkas),
  { ssr: false, loading: () => <div className="min-h-[20rem] animate-pulse rounded-[1.4rem] border border-border bg-muted/30" /> }
);

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
  const { currentUser } = usePortal();
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
  const [menu, setMenu] = useState<
    "dasbor" | "sidang" | "mediasi" | "status" | "berkas" | "ekstensi"
  >("dasbor");
  const [sidebarCiut, setSidebarCiut] = useState(false);
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
        const galat = await respons.json().catch(() => null);
        setCatatan(galat?.message || `Gagal mengunduh (HTTP ${respons.status}).`);
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
    { id: "ekstensi" as const, label: "Ekstensi SIPP", keterangan: "Pasang di peramban", ikon: Puzzle },
  ];
  // Menu yang cocok dengan pencarian. Label dan keterangannya sama-sama
  // dicari: petugas mengingat "arsip", bukan "Kendali Berkas".
  const menuTampil = cariMenu.trim()
    ? menuItem.filter((item) =>
        `${item.label} ${item.keterangan}`.toLowerCase().includes(cariMenu.trim().toLowerCase())
      )
    : menuItem;

  return (
    <div className="space-y-4 p-6">
      <PageIntro
        eyebrow="Penghubung e-Court"
        title="ALETA e-Court"
        description="Menghubungkan dokumen e-Litigasi dari e-Court ke SIPP dan ke pemberitahuan WhatsApp, tanpa mengubah keduanya."
      />

      {catatan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{catatan}</p> : null}

      <div
        className={cn(
          "grid gap-4 transition-all duration-300",
          sidebarCiut ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[264px_1fr]"
        )}
      >
        {/* Sidebar ini mengikuti sidebar utama ALETA - lihat portal-shell-v2.
            Menyalin bentuk dan perilakunya, bukan merancang yang kedua: dua
            sidebar yang mirip tetapi tidak sama terbaca sebagai kekeliruan. */}
        <nav
          aria-label="Menu ALETA e-Court"
          className={cn(
            "flex h-fit flex-col gap-3 rounded-[2rem] border border-primary/20 bg-[linear-gradient(180deg,rgba(5,20,34,0.98),rgba(8,38,58,0.96))] text-slate-100 shadow-panel backdrop-blur transition-all duration-300",
            sidebarCiut ? "px-3 py-5" : "p-5"
          )}
        >
          <div className={cn("flex gap-2", sidebarCiut ? "justify-center" : "items-center")}>
            <Button
              asChild
              variant="secondary"
              size={sidebarCiut ? "icon" : "default"}
              className={cn(
                "rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15 hover:text-white",
                sidebarCiut ? "h-11 w-11 shrink-0" : "flex-1 justify-start"
              )}
            >
              <Link href={apiPath("/portal")} title={sidebarCiut ? "Kembali ke Portal ALETA" : undefined}>
                <ArrowLeft className="h-4 w-4" />
                {!sidebarCiut ? <span className="ml-2">Kembali ke Portal</span> : null}
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

          <div className="flex flex-col gap-2">
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
                    "relative flex overflow-hidden rounded-2xl border transition",
                    sidebarCiut ? "justify-center px-0 py-3" : "items-start gap-3 px-3.5 py-2.5 text-left",
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
                      <span className="block truncate text-sm font-semibold">{item.label}</span>
                      <span
                        className={cn(
                          "block text-[12px] leading-5",
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
        </nav>

        <div className="space-y-4">
          {menu === "sidang" ? (
            <AletaEcourtSidang
              onBukaStatus={(nomorPerkara) => {
                setPerkaraDibuka(nomorPerkara);
                setMenu("status");
              }}
            />
          ) : null}

          {menu === "mediasi" ? (
            <AletaEcourtMediasi
              onBukaStatus={(nomorPerkara) => {
                setPerkaraDibuka(nomorPerkara);
                setMenu("status");
              }}
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

          {menu === "ekstensi" ? (
      <Card>
        <CardHeader>
          <CardTitle>Ekstensi peramban untuk SIPP</CardTitle>
          <CardDescription>
            Menempelkan keterangan ALETA ke halaman perkara SIPP: batas waktu unggah e-Court, status pemberitahuan
            pihak, dan selisih data. SIPP sendiri tidak diubah sama sekali.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-border bg-muted/30 p-3">
              <p className="text-sm font-medium">Yang ditampilkan di SIPP</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>Batas waktu unggah e-Court — tidak ada di SIPP</li>
                <li>Pihak sudah diberi tahu atau belum</li>
                <li>Nomor pihak salah alamat</li>
                <li>Catatan ALETA yang tidak cocok dengan e-Court</li>
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
          </div>

          <Button size="sm" disabled={mengunduh} onClick={() => void unduhEkstensi()}>
            {mengunduh ? "Menyiapkan…" : "Unduh Ekstensi"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Panduan lengkap ada di dalam berkas ZIP (PASANG.md), termasuk penyebab bila panelnya tidak muncul.
            Ekstensi hanya bekerja setelah Anda login ALETA, dan tidak menyimpan sandi apa pun.
          </p>
        </CardContent>
      </Card>
          ) : null}

          {menu === "dasbor" ? (
            <>
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
  );
}
