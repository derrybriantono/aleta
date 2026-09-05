"use client";

/**
 * Pengaturan integrasi e-Court, SIPP, dan ALETA Bot.
 *
 * ============================================================================
 * SATU TEMPAT UNTUK TIGA SISTEM
 * ============================================================================
 *
 * Penghubung ini menyentuh tiga sistem dengan sifat yang sangat berbeda:
 *
 *   e-Court  - sistem resmi Mahkamah Agung. Hanya dibaca, dan ditulis hanya
 *              ketika hakim sudah memutuskan verifikasi.
 *   SIPP     - sistem induk perkara. HANYA DIBACA, tidak pernah ditulis.
 *   ALETA    - milik pengadilan sendiri. Di sinilah seluruh data disimpan.
 *
 * Halaman ini menyatukan pengaturannya supaya admin tidak perlu menebak
 * pengaturan mana berpengaruh ke sistem mana.
 */

import { useCallback, useEffect, useState } from "react";

import { AletaBotEcourtLogin } from "@/components/portal/aleta-bot-ecourt-login";
import { AletaBotEcourtPengaturan } from "@/components/portal/aleta-bot-ecourt-pengaturan";
import { AletaEcourtAksesPeran } from "@/components/portal/aleta-ecourt-akses-peran";
import { AletaEcourtArsip } from "@/components/portal/aleta-ecourt-arsip";
import { AletaEcourtAkun } from "@/components/portal/aleta-ecourt-akun";
import { AletaEcourtPanggilanPengaturan } from "@/components/portal/aleta-ecourt-panggilan-pengaturan";
import { AletaEcourtPenarikan } from "@/components/portal/aleta-ecourt-penarikan";
import { AletaEcourtJadwal } from "@/components/portal/aleta-ecourt-jadwal";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";

type Status = {
  aktif: boolean;
  dokumen: { total: number; belumVerifikasi: number; belumDiberitahukan: number; sudahDiberitahukan: number };
  verifikasi: {
    keputusanTersimpan: number;
    belumDiteruskan: number;
    /** Keputusan tertua yang masih mengantre. Boleh tidak ada pada bot lama. */
    tertua?: { nomorPerkara: string; umurHari: number | null } | null;
  };
  nomor: { terverifikasi: number; menunggu: number; ditolak: number };
  rekonsiliasi: { ringkasan: { bertentangan: number; penerusanGagal: number } } | null;
};

function Angka({
  nilai,
  label,
  keterangan,
  nada = "netral",
}: {
  nilai: number;
  label: string;
  keterangan: string;
  nada?: "netral" | "perhatian" | "genting";
}) {
  const warna =
    nada === "genting"
      ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
      : nada === "perhatian"
        ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
        : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-4 ${warna}`}>
      <p className="text-2xl font-semibold tabular-nums">{nilai}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{keterangan}</p>
    </div>
  );
}

/** Satu baris pada peta alur data. */
function Alur({ dari, ke, sifat, isi }: { dari: string; ke: string; sifat: string; isi: string }) {
  const nadaSifat =
    sifat === "hanya baca" ? "success" : sifat === "membaca & menulis" ? "warning" : "muted";

  return (
    <div className="flex flex-wrap items-start gap-2 border-t border-border py-3 first:border-t-0">
      <span className="font-mono text-xs text-muted-foreground">{dari}</span>
      <span className="text-muted-foreground">→</span>
      <span className="font-mono text-xs text-muted-foreground">{ke}</span>
      <Badge variant={nadaSifat as "success" | "warning" | "muted"}>{sifat}</Badge>
      <p className="w-full text-sm text-muted-foreground">{isi}</p>
    </div>
  );
}

export function AletaEcourtAdmin() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const respons = await fetch(apiPath("/api/aleta-bot/ecourt"), { cache: "no-store" });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;
      if (!isi?.available || !isi?.status) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setStatus(null);
      } else {
        setPesan("");
        setStatus(isi.status);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca keadaan.");
      setStatus(null);
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

  const genting = status?.rekonsiliasi
    ? status.rekonsiliasi.ringkasan.bertentangan + status.rekonsiliasi.ringkasan.penerusanGagal
    : 0;

  return (
    <div className="space-y-4 p-6">
      <PageIntro
        eyebrow="Pengaturan"
        title="Integrasi e-Court"
        description="Pengaturan penghubung e-Court, SIPP, dan pemberitahuan WhatsApp ALETA Bot."
      />

      {/* Login paling atas: tanpa sesi e-Court yang berlaku, seluruh angka di
          bawahnya tidak akan pernah bertambah. */}
      <AletaBotEcourtLogin />

      {/* Tepat setelah login: penjadwal hanya berjalan selama sesinya hidup,
          jadi keduanya dibaca bersama. */}
      <AletaEcourtJadwal />

      {/* Akun tepat setelah jadwal: penjadwal memilih akun mana yang dipakai,
          dan tanpa akun bersesi ia tidak akan menarik apa pun. */}
      <AletaEcourtAkun />

      {/* Setelah penjadwal: penarikan berhenti sendiri bila ruang menipis,
          jadi keduanya dibaca berurutan. */}
      <AletaEcourtArsip />
      {/* Penarikan tepat setelah arsip: keduanya menjawab pertanyaan yang
          sama - berkas mana yang belum ada, dan bagaimana melengkapinya. */}
      <AletaEcourtPenarikan />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Keadaan penghubung
              {status ? (
                <Badge variant={status.aktif ? "default" : "muted"}>
                  {status.aktif ? "Pemberitahuan aktif" : "Pemberitahuan dimatikan"}
                </Badge>
              ) : null}
              {genting > 0 ? <Badge variant="danger">{genting} perlu diperiksa</Badge> : null}
            </CardTitle>
            <CardDescription>Ringkasan angka. Rinciannya ada di tab e-Court pada halaman ALETA Bot.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void muat()}>
            Muat Ulang
          </Button>
        </CardHeader>
        <CardContent>
          {memuat ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : pesan ? (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
              {pesan}
            </p>
          ) : status ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Angka
                nilai={status.dokumen.total}
                label="Dokumen tersimpan"
                keterangan="Ditarik dari e-Court."
              />
              <Angka
                nilai={status.dokumen.belumVerifikasi}
                label="Menunggu majelis"
                keterangan="Belum dapat diberitahukan."
                nada={status.dokumen.belumVerifikasi > 0 ? "perhatian" : "netral"}
              />
              {/* Umurnya ikut disebut: jumlah saja tidak membedakan keputusan
                  yang masuk pagi ini dari keputusan yang mengendap tiga
                  minggu, padahal yang kedua itulah yang perlu dikejar. */}
              <Angka
                nilai={status.verifikasi.belumDiteruskan}
                label="Belum diteruskan"
                keterangan={
                  status.verifikasi.tertua && status.verifikasi.tertua.umurHari !== null
                    ? `Menunggu dikirim ke e-Court. Tertua ${status.verifikasi.tertua.umurHari} hari — ${status.verifikasi.tertua.nomorPerkara}.`
                    : "Keputusan hakim menunggu dikirim ke e-Court."
                }
                nada={
                  status.verifikasi.tertua && (status.verifikasi.tertua.umurHari ?? 0) >= 7
                    ? "genting"
                    : status.verifikasi.belumDiteruskan > 0
                      ? "perhatian"
                      : "netral"
                }
              />
              <Angka
                nilai={genting}
                label="Tidak cocok dengan e-Court"
                keterangan="Perlu diperiksa manual."
                nada={genting > 0 ? "genting" : "netral"}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kaitan dengan pemberitahuan WhatsApp</CardTitle>
          <CardDescription>
            Dokumen e-Court yang sudah diverifikasi majelis memicu pemberitahuan ke pihak lawan lewat ALETA Bot.
            Angka di bawah menunjukkan sejauh mana rantai itu berjalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Angka
                nilai={status.dokumen.belumDiberitahukan}
                label="Siap diberitahukan"
                keterangan="Sudah valid, pesan belum dikirim."
              />
              <Angka
                nilai={status.dokumen.sudahDiberitahukan}
                label="Sudah diberitahukan"
                keterangan="Pesan sudah diantrekan."
              />
              <Angka
                nilai={status.nomor.menunggu}
                label="Nomor belum menjawab"
                keterangan="Berkas ditahan sampai dikonfirmasi."
                nada={status.nomor.menunggu > 0 ? "perhatian" : "netral"}
              />
              <Angka
                nilai={status.nomor.ditolak}
                label="Nomor salah alamat"
                keterangan="Data SIPP perlu diperbaiki."
                nada={status.nomor.ditolak > 0 ? "genting" : "netral"}
              />
            </div>
          ) : null}

          <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Rantai penuhnya</p>
            <p className="mt-1">
              Dokumen masuk e-Court → ditarik jembatan → diverifikasi majelis → pihak lawan diberitahu WhatsApp →
              keputusan diteruskan balik ke e-Court.
            </p>
            <p className="mt-2">
              Rantai ini berhenti sendiri di titik mana pun bila ada yang tidak dapat dipastikan — dan berhenti
              adalah perilaku yang benar. Angka yang menumpuk di satu kolom menunjukkan di mana rantainya tertahan.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Apa yang disentuh tiap sistem</CardTitle>
          <CardDescription>
            Dibuat tegas supaya tidak ada yang keliru menduga ALETA menulis ke SIPP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alur
            dari="SIPP"
            ke="ALETA"
            sifat="hanya baca"
            isi="Data perkara, para pihak, majelis hakim, dan jadwal sidang dibaca dari SIPP. Tidak ada satu pun tabel SIPP yang ditulis ALETA."
          />
          <Alur
            dari="e-Court"
            ke="ALETA"
            sifat="hanya baca"
            isi="Dokumen e-Litigasi beserta status verifikasi dan batas waktu unggahnya ditarik lewat jembatan."
          />
          <Alur
            dari="ALETA"
            ke="e-Court"
            sifat="membaca & menulis"
            isi="Hanya keputusan verifikasi hakim yang dikirim balik, dijalankan petugas dengan konfirmasi di layar. Tidak pernah otomatis."
          />
          <Alur
            dari="ALETA"
            ke="WhatsApp"
            sifat="mengirim"
            isi="Pemberitahuan ke pihak berperkara, setelah nomornya dikonfirmasi pemiliknya sendiri."
          />
          <Alur
            dari="Ekstensi"
            ke="SIPP"
            sifat="hanya menampilkan"
            isi="Menambah keterangan di layar petugas. Tidak mengisi formulir, tidak menekan tombol, tidak mengubah satu pun elemen SIPP."
          />
        </CardContent>
      </Card>

      {/* Panel pengaturan yang sudah ada dipakai ulang apa adanya, supaya
          aturan pemberitahuan dan ambang hari tidak punya dua tempat
          penyuntingan yang bisa berbeda isinya. */}
      {/* Akses peran sebelum pengaturan pemberitahuan: siapa yang boleh
          memakai ekstensi menentukan siapa yang melihat seluruh isi di
          atasnya, jadi ia dibaca lebih dulu. */}
      {/* Tenggang panggilan sebelum akses peran: angkanya menentukan apa
          yang ditandai cacat di layar Jadwal Sidang, dan itu lebih sering
          ditengok daripada daftar kewenangan. */}
      <AletaEcourtPanggilanPengaturan />

      <AletaEcourtAksesPeran />

      <AletaBotEcourtPengaturan />
    </div>
  );
}
