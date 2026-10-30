"use client";

/**
 * ============================================================================
 * PENANDA STATUS e-COURT BERSAMA (30 Okt 2026)
 * ============================================================================
 *
 * SATU simpanan di peramban untuk seluruh kartu di halaman: kartu Masuk
 * e-Court, Penarikan Berkala, Status penarikan, Akun e-Court, pemantau sesi.
 * Semuanya membaca /api/aleta-ecourt/status-akun lewat simpanan yang sama dan
 * berubah SERENTAK - sesudah masuk, keluar, atau periksa, cukup panggil
 * muatUlangStatusEcourt() (atau kirim peristiwa PERISTIWA_STATUS_ECOURT).
 *
 * Penyegaran berkala ringan: tiap 60 detik selama halaman terlihat. Rute itu
 * hanya meminta bot memeriksa ulang akun yang buktinya basi - tidak menyalakan
 * Chrome tiap kali dibuka.
 */

import { useEffect, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import {
  KOTAK_NADA,
  PERISTIWA_STATUS_ECOURT,
  statusBotMati,
  tampilanStatus,
  type TampilanStatusEcourt,
} from "@/lib/ecourt-status-akun";

export type DataStatusEcourt = {
  tersedia: boolean;
  dibaca: string;
  utama: string;
  ringkas: TampilanStatusEcourt;
  akun: TampilanStatusEcourt[];
  pesan?: string;
};

type Simpanan = { data: DataStatusEcourt | null; memuat: boolean; galat: string };

let simpanan: Simpanan = { data: null, memuat: false, galat: "" };
const pendengar = new Set<() => void>();
let sedangMuat: Promise<void> | null = null;
let pewaktu: number | null = null;

function kabari(baru: Partial<Simpanan>) {
  simpanan = { ...simpanan, ...baru };
  for (const p of pendengar) p();
}

/** Memuat ulang status untuk SEMUA kartu sekaligus. */
export function muatUlangStatusEcourt(): Promise<void> {
  if (sedangMuat) return sedangMuat;
  kabari({ memuat: true });
  sedangMuat = (async () => {
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/status-akun"), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      const data = (isi?.data ?? isi) as DataStatusEcourt | null;
      if (!jawaban.ok || !data || !data.ringkas) {
        kabari({
          data: { tersedia: false, dibaca: new Date().toISOString(), utama: "", ringkas: tampilanStatus(statusBotMati()), akun: [] },
          galat: String(isi?.error || isi?.message || "Status e-Court belum dapat dibaca."),
        });
      } else {
        kabari({ data, galat: data.pesan || "" });
      }
    } catch (e) {
      kabari({
        data: { tersedia: false, dibaca: new Date().toISOString(), utama: "", ringkas: tampilanStatus(statusBotMati()), akun: [] },
        galat: e instanceof Error ? e.message : "Status e-Court belum dapat dibaca.",
      });
    } finally {
      sedangMuat = null;
      kabari({ memuat: false });
    }
  })();
  return sedangMuat;
}

/** Simpan hasil yang sudah ada di tangan (mis. jawaban "Periksa sekarang") tanpa memuat ulang. */
export function pasangStatusEcourt(data: DataStatusEcourt) {
  if (data && data.ringkas) kabari({ data, galat: data.pesan || "" });
}

let lepasPeristiwa: (() => void) | null = null;

function langganan(cb: () => void) {
  pendengar.add(cb);
  if (pendengar.size === 1 && typeof window !== "undefined") {
    const dengar = () => void muatUlangStatusEcourt();
    window.addEventListener(PERISTIWA_STATUS_ECOURT, dengar);
    lepasPeristiwa = () => window.removeEventListener(PERISTIWA_STATUS_ECOURT, dengar);
    pewaktu = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void muatUlangStatusEcourt();
    }, 60_000);
  }
  return () => {
    pendengar.delete(cb);
    if (pendengar.size === 0 && typeof window !== "undefined") {
      if (pewaktu !== null) window.clearInterval(pewaktu);
      pewaktu = null;
      if (lepasPeristiwa) lepasPeristiwa();
      lepasPeristiwa = null;
    }
  };
}

const ambil = () => simpanan;
const ambilServer = () => simpanan;

/** Status e-Court bersama. Kartu mana pun yang memakainya berubah serentak. */
export function useStatusEcourt() {
  const s = useSyncExternalStore(langganan, ambil, ambilServer);
  useEffect(() => {
    if (!simpanan.data && !sedangMuat) void muatUlangStatusEcourt();
  }, []);
  return s;
}

/** Kabarkan perubahan (sesudah masuk/keluar/periksa) ke seluruh kartu. */
export function kabarkanStatusEcourtBerubah() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PERISTIWA_STATUS_ECOURT));
  else void muatUlangStatusEcourt();
}

/** Lencana keadaan: warna + judul; kalimat sebab di title. */
export function LencanaStatusEcourt({ t, awalan = "" }: { t: TampilanStatusEcourt | null | undefined; awalan?: string }) {
  if (!t) return null;
  return (
    <Badge variant={t.lencana} title={t.teks} data-ecourt-keadaan={t.keadaan} teksAsli>
      {awalan ? `${awalan}: ` : ""}
      {t.judul}
      {t.sedangMemeriksa && t.keadaan !== "memeriksa" ? " · memeriksa" : ""}
    </Badge>
  );
}

/** Kotak keterangan berwarna dengan tombol tindakan (Masuk lagi / Periksa sekarang). */
export function KeteranganStatusEcourt({
  t,
  onTindakan,
  sibuk = false,
  tampilkanAktif = false,
}: {
  t: TampilanStatusEcourt | null | undefined;
  onTindakan?: (t: TampilanStatusEcourt) => void;
  sibuk?: boolean;
  tampilkanAktif?: boolean;
}) {
  if (!t) return null;
  if (t.keadaan === "aktif" && !tampilkanAktif) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm ${KOTAK_NADA[t.nada]}`}
      data-ecourt-keadaan={t.keadaan}
    >
      <span>
        <span className="font-medium">{t.label ? `${t.label}: ` : ""}{t.judul}.</span> {t.teks}
      </span>
      {t.tindakan && onTindakan ? (
        <Button size="sm" variant="outline" disabled={sibuk} onClick={() => onTindakan(t)}>
          {t.labelTindakan}
        </Button>
      ) : null}
    </div>
  );
}
