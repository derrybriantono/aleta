"use client";

import { Gauge } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { apiPath } from "@/lib/base-path";
import {
  ATRIBUT_MODE_RINGAN,
  KETERANGAN_SEBAB_RINGAN,
  KUNCI_MODE_RINGAN,
  PERISTIWA_MODE_RINGAN,
  bersihkanPilihanRingan,
  perangkatTua,
  putuskanModeRingan,
  type PilihanModeRingan,
} from "@/lib/mode-ringan";
import { cn } from "@/lib/utils";

/**
 * Mode ringan portal (K16, 25 Okt 2026). Satu hook, dua komponen:
 *   - PenandaModeRingan (di layout, tidak menggambar apa pun) memasang atribut
 *     data-aleta-ringan di <html>; globals.css mematikan animasi/transisi/kabur latar.
 *   - TombolModeRingan (di bilah atas, di samping tema) hanya tampil bila Super Admin
 *     menyalakan saklar otomatis ATAU pengguna sudah memilih sendiri; memutar
 *     otomatis -> nyala -> mati.
 * Saklar mati dan pilihan "otomatis" (bawaan) = tidak ada yang berubah dan tidak ada tombol.
 */

let janjiSaklar: Promise<boolean> | null = null;
function ambilSaklarSekali(): Promise<boolean> {
  if (!janjiSaklar) {
    janjiSaklar = (async () => {
      try {
        const jawab = await fetch(apiPath("/api/aleta-ecourt/ekstensi/kinerja"), { cache: "no-store" });
        if (!jawab.ok) return false;
        const luar = (await jawab.json()) as { data?: { saklar?: { modeRinganOtomatis?: unknown } } } | null;
        return luar?.data?.saklar?.modeRinganOtomatis === true;
      } catch {
        return false;
      }
    })();
  }
  return janjiSaklar;
}
/** Hanya untuk uji. */
export function setelUlangSaklarRinganUntukUji() {
  janjiSaklar = null;
}

function bacaPilihan(): PilihanModeRingan {
  try {
    return bersihkanPilihanRingan(window.localStorage.getItem(KUNCI_MODE_RINGAN));
  } catch {
    return "otomatis";
  }
}

function langgananPilihan(beri: () => void) {
  window.addEventListener(PERISTIWA_MODE_RINGAN, beri);
  window.addEventListener("storage", beri);
  return () => {
    window.removeEventListener(PERISTIWA_MODE_RINGAN, beri);
    window.removeEventListener("storage", beri);
  };
}
const tanpaLangganan = () => () => undefined;
const bacaTua = () => perangkatTua(typeof navigator === "undefined" ? null : (navigator as unknown as Record<string, unknown>));

export function useModeRingan() {
  // Dibaca lewat useSyncExternalStore: server dan render pertama memakai bawaan (otomatis, bukan tua), lalu nilai asli
  // peramban - tidak ada ketidakcocokan hidrasi dan tidak ada setState di dalam efek.
  const pilihan = useSyncExternalStore(langgananPilihan, bacaPilihan, () => "otomatis" as PilihanModeRingan);
  const tua = useSyncExternalStore(tanpaLangganan, bacaTua, () => false);
  const [saklar, setSaklar] = useState(false);

  useEffect(() => {
    let batal = false;
    void ambilSaklarSekali().then((s) => {
      if (!batal) setSaklar(s);
    });
    return () => {
      batal = true;
    };
  }, []);

  const setPilihan = useCallback((p: PilihanModeRingan) => {
    try {
      if (p === "otomatis") window.localStorage.removeItem(KUNCI_MODE_RINGAN);
      else window.localStorage.setItem(KUNCI_MODE_RINGAN, p);
    } catch {
      /* penyimpanan diblokir: berlaku untuk tab ini saja */
    }
    window.dispatchEvent(new Event(PERISTIWA_MODE_RINGAN));
  }, []);

  const putusan = putuskanModeRingan({ pilihan, saklarOtomatis: saklar, tua });
  return { pilihan, setPilihan, saklar, tua, ...putusan };
}

export function PenandaModeRingan() {
  const { ringan } = useModeRingan();
  useEffect(() => {
    const akar = document.documentElement;
    if (ringan) akar.setAttribute(ATRIBUT_MODE_RINGAN, "1");
    else akar.removeAttribute(ATRIBUT_MODE_RINGAN);
  }, [ringan]);
  return null;
}

const URUTAN: PilihanModeRingan[] = ["otomatis", "nyala", "mati"];
const LABEL: Record<PilihanModeRingan, string> = { otomatis: "otomatis", nyala: "nyala", mati: "mati" };

export function TombolModeRingan() {
  const { pilihan, setPilihan, saklar, ringan, sebab } = useModeRingan();
  if (!saklar && pilihan === "otomatis") return null;
  const berikut = URUTAN[(URUTAN.indexOf(pilihan) + 1) % URUTAN.length];
  const judul = `Mode ringan: ${LABEL[pilihan]}${ringan ? " (sedang ringan)" : ""}. ${KETERANGAN_SEBAB_RINGAN[sebab]} Tekan untuk beralih ke ${LABEL[berikut]}.`;
  return (
    <button
      type="button"
      aria-label={`Mode ringan: ${LABEL[pilihan]}`}
      title={judul}
      data-mode-ringan={pilihan}
      onClick={() => setPilihan(berikut)}
      className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-muted/80 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Gauge aria-hidden="true" className={cn("h-4 w-4", ringan ? "text-foreground" : "text-muted-foreground")} />
      <span className="absolute bottom-1 text-[11.5px] leading-none text-muted-foreground">{pilihan === "otomatis" ? "oto" : pilihan}</span>
    </button>
  );
}
