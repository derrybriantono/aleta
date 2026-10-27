"use client";

/**
 * ============================================================================
 * JADWALKAN TUNDAAN SIDANG - DI LAYAR HASIL SIDANG (27 Okt 2026)
 * ============================================================================
 *
 * Permintaan hakim/Super Admin: "upload BAS terjadwal dan tundaan terjadwal (seperti putusan
 * terjadwal)". Di layar Hasil Sidang, form tunda yang sudah terisi dapat DITULIS SEKARANG (tombol
 * lama, tidak berubah) atau DIJADWALKAN: server yang menuliskannya ke SIPP pada jam yang dipilih,
 * hari sidang itu juga (keputusan 22 Okt: tundaan tidak pernah pindah ke hari berikutnya). Isian
 * form yang dikirim PERSIS isian form yang sama - tidak ada isian kedua yang bisa berbeda.
 *
 * Komponen ini hanya MENYUSUN jadwal dan memperlihatkan butir terjadwal sidang itu dengan tombol
 * Batal. Tidak ada tulisan ke SIPP dari sini; pelaksananya di server.
 */
import { Clock, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";

export const API_SIDANG_TERJADWAL = "/api/aleta-ecourt/sidang-terjadwal";

/** Isian form tunda yang dibawa ke jadwal - sama dengan yang dikirim tombol "Tulis ke SIPP". */
export type IsianTundaTerjadwal = {
  jadwalId: number | string;
  perkaraId: number | string;
  nomorPerkara: string;
  /** Tanggal sidang yang sedang ditunda (YYYY-MM-DD...). */
  tanggalSidang: string;
  alasanTunda: string;
  tanggalBerikut: string;
  jamBerikut: string;
  agendaBerikut: string;
  dihadiriOleh?: number;
  ruangId?: number;
};

export type ButirTerjadwalRingkas = {
  id: string;
  jenis: string;
  nomorPerkara: string;
  waktuWita: string;
  status: string;
  namaStatus?: string;
  hasilRingkas?: string;
  ringkasMuatan?: string;
  bolehBatal?: boolean;
};

/** Tanggal + jam WITA saat ini: { tanggal: "YYYY-MM-DD", jam: "HH:mm" }. */
export function sekarangWita(ms: number = Date.now()): { tanggal: string; jam: string } {
  const b: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms))) {
    b[x.type] = x.value;
  }
  return { tanggal: `${b.year}-${b.month}-${b.day}`, jam: `${b.hour}:${b.minute}` };
}

/** Jam bawaan: 15 menit lagi, dibulatkan ke atas per 5 menit; "" bila sudah lewat tengah malam hari itu. */
export function jamTulisBawaan(ms: number = Date.now()): string {
  const { jam } = sekarangWita(ms);
  const menit = Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5)) + 15;
  const bulat = Math.ceil(menit / 5) * 5;
  if (bulat >= 24 * 60) return "";
  return `${String(Math.floor(bulat / 60)).padStart(2, "0")}:${String(bulat % 60).padStart(2, "0")}`;
}

/** Alasan jadwal belum boleh dibuat, atau "" bila boleh. Murni. */
export function sebabBelumBolehJadwal(tanggalSidang: string, jamTulis: string, ms: number = Date.now()): string {
  const hariSidang = String(tanggalSidang || "").slice(0, 10);
  const { tanggal, jam } = sekarangWita(ms);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hariSidang)) return "Tanggal sidang belum terbaca.";
  if (hariSidang !== tanggal) {
    return hariSidang < tanggal
      ? "Sidang ini sudah lewat harinya, jadi penundaannya tidak dapat dijadwalkan lagi."
      : "Penundaan hanya dapat dijadwalkan pada hari sidangnya sendiri.";
  }
  if (!/^\d{2}:\d{2}$/.test(jamTulis)) return "Pilih jam penulisan.";
  if (jamTulis < jam) return "Jam yang dipilih sudah lewat; pilih jam yang masih akan datang hari ini.";
  return "";
}

/** Badan POST jadwal tunda sesuai kontrak server. Murni. */
export function susunBadanTundaTerjadwal(isian: IsianTundaTerjadwal, jamTulis: string) {
  const hariSidang = String(isian.tanggalSidang || "").slice(0, 10);
  return {
    jenis: "tunda" as const,
    mulai: `${hariSidang} ${jamTulis}`,
    butir: [
      {
        jadwalId: isian.jadwalId,
        perkaraId: isian.perkaraId,
        nomorPerkara: isian.nomorPerkara,
        tanggalSidang: hariSidang,
        alasanTunda: isian.alasanTunda,
        tanggalBerikut: isian.tanggalBerikut,
        jamBerikut: isian.jamBerikut,
        agendaBerikut: isian.agendaBerikut,
        ...(isian.dihadiriOleh != null ? { dihadiriOleh: isian.dihadiriOleh } : {}),
        ...(isian.ruangId != null ? { ruangId: isian.ruangId } : {}),
      },
    ],
  };
}

async function bacaBalasan(balasan: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  let luar: unknown = null;
  try {
    luar = await balasan.json();
  } catch {
    luar = null;
  }
  const bungkus = luar && typeof luar === "object" ? (luar as Record<string, unknown>) : {};
  const data = (bungkus.data && typeof bungkus.data === "object" ? bungkus.data : bungkus) as Record<string, unknown>;
  let sebab = String(data.sebab || data.alasan || data.pesan || "");
  if (!sebab && bungkus.error) {
    sebab = typeof bungkus.error === "object" ? String((bungkus.error as { message?: string }).message || "") : String(bungkus.error);
  }
  return { ok: balasan.ok && data.ok !== false && !bungkus.error, data: { ...data, sebab } };
}

const NAMA_STATUS: Record<string, string> = {
  menunggu: "Menunggu waktunya",
  jalan: "Sedang dikerjakan",
  selesai: "Sudah ditulis ke SIPP",
  dilewati: "Dilewati (sudah tercatat di SIPP)",
  gagal: "Gagal",
  dibatalkan: "Dibatalkan",
  kedaluwarsa: "Lewat waktunya",
};

export function JadwalkanTundaSidang({
  isian,
  lengkap,
  sudahTertulis,
}: {
  isian: IsianTundaTerjadwal;
  lengkap: boolean;
  sudahTertulis: boolean;
}) {
  const [jam, setJam] = useState(() => jamTulisBawaan());
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ jenis: "sukses" | "galat"; teks: string } | null>(null);
  const [butir, setButir] = useState<ButirTerjadwalRingkas[]>([]);
  const [pelaksanaNyala, setPelaksanaNyala] = useState(true);

  const muat = useCallback(async () => {
    try {
      const balasan = await fetch(
        apiPath(`${API_SIDANG_TERJADWAL}?jenis=tunda&jadwalId=${encodeURIComponent(String(isian.jadwalId))}`),
        { cache: "no-store" }
      );
      const { ok, data } = await bacaBalasan(balasan);
      if (!ok) return;
      setButir(Array.isArray(data.butir) ? (data.butir as ButirTerjadwalRingkas[]) : []);
      if (typeof data.pelaksanaNyala === "boolean") setPelaksanaNyala(data.pelaksanaNyala);
    } catch {
      /* daftar hanya tambahan; galatnya tidak menahan form */
    }
  }, [isian.jadwalId]);

  useEffect(() => {
    // Pembacaan daftar butir sidang ini saat kartu muncul (sumber luar); setState hanya sesudah balasan datang.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void muat();
  }, [muat]);

  const sebab = useMemo(() => sebabBelumBolehJadwal(isian.tanggalSidang, jam), [isian.tanggalSidang, jam]);
  const menungguAda = butir.some((b) => b.status === "menunggu" || b.status === "jalan");

  const jadwalkan = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      const balasan = await fetch(apiPath(API_SIDANG_TERJADWAL), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(susunBadanTundaTerjadwal(isian, jam)),
      });
      const { ok, data } = await bacaBalasan(balasan);
      if (!ok) {
        const tolak = Array.isArray(data.tolak) ? (data.tolak as Array<{ sebab?: string }>).map((t) => t.sebab).filter(Boolean) : [];
        setPesan({ jenis: "galat", teks: [String(data.sebab || "Jadwal belum dapat dibuat."), ...tolak].join(" ") });
        return;
      }
      const pertama = Array.isArray(data.butir) ? (data.butir as Array<{ waktuWita?: string }>)[0] : undefined;
      setPesan({
        jenis: "sukses",
        teks: `Penundaan dijadwalkan${pertama && pertama.waktuWita ? ` pukul ${String(pertama.waktuWita).slice(-5)} WITA` : ""}. Server yang menuliskannya ke SIPP pada waktunya.`,
      });
      await muat();
    } catch (e) {
      setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
      setSibuk(false);
    }
  };

  const batalkan = async (id: string) => {
    setSibuk(true);
    setPesan(null);
    try {
      const balasan = await fetch(apiPath(API_SIDANG_TERJADWAL), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aksi: "batal", id }),
      });
      const { ok, data } = await bacaBalasan(balasan);
      setPesan(ok ? { jenis: "sukses", teks: "Jadwal penundaan dibatalkan." } : { jenis: "galat", teks: String(data.sebab || "Belum dapat dibatalkan.") });
      await muat();
    } catch (e) {
      setPesan({ jenis: "galat", teks: e instanceof Error ? e.message : "Permintaan gagal." });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Card data-jadwalkan-tunda="">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" aria-hidden />
          Jadwalkan penundaan
        </CardTitle>
        <CardDescription>
          Isian di atas ditulis ke SIPP oleh server pada jam yang dipilih, hari ini juga. Layar ini tidak perlu tetap terbuka.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[8rem] flex-col gap-1 text-xs text-muted-foreground">
            Jam penulisan (WITA)
            <input
              type="time"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
              aria-label="Jam penulisan"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!lengkap || sibuk || sudahTertulis || sebab !== ""}
            onClick={() => void jadwalkan()}
            title={sebab || (lengkap ? undefined : "Lengkapi form tunda lebih dahulu")}
          >
            <Clock className="mr-1.5 h-4 w-4" aria-hidden />
            Jadwalkan
          </Button>
        </div>
        {sebab ? <p className="text-xs text-muted-foreground">{sebab}</p> : null}
        {menungguAda && !pelaksanaNyala ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Pengerjaan terjadwal di server sedang dimatikan, jadi jadwal ini belum akan dikerjakan sampai dinyalakan lagi.
          </p>
        ) : null}
        {pesan ? (
          <p
            role={pesan.jenis === "galat" ? "alert" : "status"}
            className={pesan.jenis === "galat" ? "text-xs text-destructive" : "text-xs text-emerald-700 dark:text-emerald-400"}
          >
            {pesan.teks}
          </p>
        ) : null}
        {butir.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Penundaan terjadwal sidang ini">
            {butir.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
                <span>
                  <strong>{String(b.waktuWita || "").slice(-5)} WITA</strong> · {b.namaStatus || NAMA_STATUS[b.status] || b.status}
                  {b.hasilRingkas ? ` · ${b.hasilRingkas}` : ""}
                </span>
                {b.bolehBatal && b.status === "menunggu" ? (
                  <Button type="button" size="sm" variant="ghost" disabled={sibuk} onClick={() => void batalkan(b.id)}>
                    <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Batal
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
