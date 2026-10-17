"use client";

import { useEffect, useMemo, useState } from "react";

import { LembarSkpPegawai } from "@/components/portal/skp-lembar";
import { DaftarPegawaiSkp } from "@/components/portal/skp-pegawai";
import { PemetaanSkp } from "@/components/portal/skp-pemetaan";
import { PenetapanSkp } from "@/components/portal/skp-penetapan";
import { TargetSkp } from "@/components/portal/skp-target";
import {
  KotakPesan,
  Memuat,
  SEBUTAN_PERAN_AKTOR,
  ambilSkp,
  pesanGalat,
  type JawabanPegawaiSkp,
} from "@/components/portal/skp-umum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Halaman SKP: tab menyesuaikan hak. Hak dibaca dari rute (aktor dan daftar
 * bawahan), bukan ditebak dari nama peran di layar - sama dengan yang dipakai
 * server saat menolak permintaan.
 */

type KunciTab = "saya" | "bawahan" | "semua" | "penetapan" | "pemetaan" | "target";

const JUDUL_TAB: Record<KunciTab, string> = {
  saya: "SKP Saya",
  bawahan: "Bawahan",
  semua: "Seluruh pegawai",
  penetapan: "Penetapan",
  pemetaan: "Pemetaan akun & jabatan",
  target: "Target & RHK",
};

export function SkpHalaman() {
  const [tab, setTab] = useState<KunciTab>("saya");
  const [ulang, setUlang] = useState(0);
  const [hasil, setHasil] = useState<{
    ulang: number;
    saya: JawabanPegawaiSkp | null;
    jumlahBawahan: number;
    galat: string;
  } | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      let saya: JawabanPegawaiSkp | null = null;
      let jumlahBawahan = 0;
      let galat = "";
      try {
        saya = await ambilSkp<JawabanPegawaiSkp>("/api/skp/pegawai?lingkup=saya");
        // Daftar bawahan hanya menentukan tab; kegagalannya tidak menutup layar.
        const bawahan = await ambilSkp<JawabanPegawaiSkp>("/api/skp/pegawai?lingkup=bawahan").catch(() => null);
        jumlahBawahan = bawahan?.pegawai.length ?? 0;
      } catch (e) {
        galat = pesanGalat(e);
      }
      if (!batal) setHasil({ ulang, saya, jumlahBawahan, galat });
    })();
    return () => {
      batal = true;
    };
  }, [ulang]);

  // Memuat = permintaan terakhir belum menjawab (diturunkan, bukan disimpan).
  const memuat = hasil === null || hasil.ulang !== ulang;
  const saya = hasil?.saya ?? null;
  const jumlahBawahan = hasil?.jumlahBawahan ?? 0;
  const galat = hasil && hasil.ulang === ulang ? hasil.galat : "";

  const bolehLihatSemua = saya?.aktor.bolehLihatSemua === true;
  const tabTersedia = useMemo<KunciTab[]>(() => {
    if (!saya) return [];
    const daftar: KunciTab[] = ["saya"];
    if (jumlahBawahan > 0) daftar.push("bawahan");
    if (bolehLihatSemua) daftar.push("semua");
    if (bolehLihatSemua || jumlahBawahan > 0) daftar.push("penetapan");
    if (bolehLihatSemua) daftar.push("pemetaan", "target");
    return daftar;
  }, [saya, jumlahBawahan, bolehLihatSemua]);

  const tabAktif: KunciTab = tabTersedia.includes(tab) ? tab : "saya";

  if (memuat && !saya) return <Memuat teks="Memuat SKP…" />;
  if (galat || !saya) {
    return (
      <div className="flex flex-col gap-2">
        <KotakPesan jenis="galat">{galat || "SKP belum dapat dibuka."}</KotakPesan>
        <div>
          <Button type="button" size="sm" variant="outline" onClick={() => setUlang((n) => n + 1)}>
            Coba lagi
          </Button>
        </div>
      </div>
    );
  }

  const baris = saya.pegawai[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Dibuka sebagai</span>
        <Badge variant="outline">{SEBUTAN_PERAN_AKTOR[saya.aktor.peran]}</Badge>
      </div>

      <div
        role="tablist"
        aria-label="Bagian SKP"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-1"
      >
        {tabTersedia.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-skp-${k}`}
            aria-selected={tabAktif === k}
            aria-controls={`panel-skp-${k}`}
            tabIndex={tabAktif === k ? 0 : -1}
            onClick={() => setTab(k)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const i = tabTersedia.indexOf(k);
              const berikut = tabTersedia[(i + (e.key === "ArrowRight" ? 1 : tabTersedia.length - 1)) % tabTersedia.length];
              setTab(berikut);
              document.getElementById(`tab-skp-${berikut}`)?.focus();
            }}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tabAktif === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            {JUDUL_TAB[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-skp-${tabAktif}`} aria-labelledby={`tab-skp-${tabAktif}`}>
        {tabAktif === "saya" ? (
          baris ? (
            <LembarSkpPegawai key={baris.userId} pegawaiUserId={baris.userId} jenisTersedia={baris.jenisTersedia} sendiri />
          ) : (
            <KotakPesan jenis="info">Akun Anda belum tercatat sebagai pegawai di data SKP. Minta administrator memeriksanya.</KotakPesan>
          )
        ) : null}
        {tabAktif === "bawahan" ? (
          <DaftarPegawaiSkp lingkup="bawahan" kosong="Tidak ada pegawai yang Anda catat sebagai atasan langsungnya." />
        ) : null}
        {tabAktif === "semua" ? <DaftarPegawaiSkp lingkup="semua" kosong="Belum ada pegawai aktif yang dapat ditampilkan." /> : null}
        {tabAktif === "penetapan" ? <PenetapanSkp lingkup={bolehLihatSemua ? "semua" : "bawahan"} /> : null}
        {tabAktif === "pemetaan" ? <PemetaanSkp /> : null}
        {tabAktif === "target" ? <TargetSkp /> : null}
      </div>
    </div>
  );
}
