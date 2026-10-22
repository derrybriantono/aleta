"use client";

import { CalendarClock, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BagianPutusOtomatis } from "@/components/portal/putus-otomatis-bagian";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { KeputusanTundaOtomatis, SetelanTundaOtomatis } from "@/lib/tunda-otomatis";

/**
 * ============================================================================
 * TUNDA OTOMATIS 16.30 - TOMBOL DI KEPALA JADWAL SIDANG + DAFTAR HARIAN
 * ============================================================================
 *
 * Tombol kecil di kepala Jadwal Sidang (sebelah "Tautan jadwal") membuka daftar
 * hari itu: apa yang akan ditunda / sudah ditunda otomatis, ke tanggal berapa,
 * aturan mana, alasannya - plus usulan GUGUR / TIDAK DAPAT DITERIMA yang tidak
 * pernah ditulis. Tiap baris punya "Jangan tunda otomatis" (dan pembatalannya).
 * Saklar (Mati/Menyala, Mode kering) hanya dapat diubah Super Admin; aturannya
 * di @/lib/tunda-otomatis, penulisnya penulis tunda yang sudah ada.
 */

type Tulis = { status: string; pesan: string; atasNama?: string; dikerjakanPada?: string };
type Butir = {
  jadwalId: string;
  nomorPerkara: string;
  agenda: string;
  majelis: string;
  panitera: string;
  keliling: boolean;
  keputusan: KeputusanTundaOtomatis;
  tulis?: Tulis;
};
type Daftar = {
  tanggal: string;
  setelan: Omit<SetelanTundaOtomatis, "ip">;
  kalimatSetelan: string;
  jamPemicu: string;
  kelilingAktif: boolean;
  tahap: "pratinjau" | "jalan";
  jalan: { pada: string; mode: string; jam: string; galat: string } | null;
  butir: Butir[];
  galat: string;
  hariLibur: boolean;
  bolehUbahSetelan: boolean;
};

const LABEL_JENIS: Record<string, string> = {
  tunda: "Tunda",
  gugur: "Usulan gugur",
  "tidak-dapat-diterima": "Usulan tidak dapat diterima",
  lewati: "Dilewati",
};

const LABEL_TULIS: Record<string, string> = {
  "kering-lolos": "Mode kering - lolos, tidak ditulis",
  "kering-ditolak": "Mode kering - akan ditolak",
  diantrekan: "Diantrekan",
  tertulis: "Tertulis di SIPP",
  ditolak: "Ditolak - tidak ditulis",
  gagal: "Gagal - tidak ditulis",
  dibatalkan: "Dibatalkan",
  dilewati: "Tidak ditulis",
};

function warnaJenis(jenis: string) {
  if (jenis === "tunda") return "info" as const;
  if (jenis === "lewati") return "muted" as const;
  return "warning" as const;
}

export function TombolTundaOtomatis({ tanggal }: { tanggal: string }) {
  const [buka, setBuka] = useState(false);
  const [daftar, setDaftar] = useState<Daftar | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(
    async (segarkan = false) => {
      setSibuk("muat");
      try {
        const q = new URLSearchParams({ tanggal });
        if (segarkan) q.set("segarkan", "1");
        const r = await fetch(apiPath(`/api/aleta-ecourt/tunda-otomatis?${q.toString()}`), { cache: "no-store" });
        const mentah: unknown = await r.json().catch(() => null);
        const isi = ((mentah as { data?: unknown } | null)?.data ?? null) as (Daftar & { ada?: boolean }) | null;
        if (!r.ok || !isi?.ada) setPesan(pesanGalatPortal(mentah, "Daftar tunda otomatis tidak terbaca."));
        else setDaftar(isi);
      } catch {
        setPesan("Daftar tunda otomatis tidak terbaca.");
      } finally {
        setSibuk("");
      }
    },
    [tanggal]
  );

  const bukaDaftar = useCallback(() => {
    setBuka(true);
    void muat();
  }, [muat]);

  // Pemberitahuan tunda otomatis menaut ke #tunda-otomatis: daftarnya langsung dibuka (sekali).
  const hashDicek = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (hashDicek.current) return;
      hashDicek.current = true;
      try {
        if (String(window.location.hash || "").toLowerCase() === "#tunda-otomatis") bukaDaftar();
      } catch {
        /* tanpa jendela */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [bukaDaftar]);

  const kirim = async (badan: Record<string, unknown>, kunci: string) => {
    setSibuk(kunci);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/tunda-otomatis"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const mentah: unknown = await r.json().catch(() => null);
      const isi = ((mentah as { data?: unknown } | null)?.data ?? null) as { pesan?: string; kalimatSetelan?: string } | null;
      setPesan(r.ok ? String(isi?.pesan || isi?.kalimatSetelan || "Tersimpan.") : pesanGalatPortal(mentah, "Gagal disimpan."));
      await muat(true);
    } finally {
      setSibuk("");
    }
  };

  const hitung = daftar
    ? {
        tunda: daftar.butir.filter((b) => b.keputusan.jenis === "tunda").length,
        usul: daftar.butir.filter((b) => b.keputusan.jenis === "gugur" || b.keputusan.jenis === "tidak-dapat-diterima").length,
      }
    : null;

  return (
    <>
      <button
        type="button"
        data-tunda-otomatis=""
        onClick={bukaDaftar}
        className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Daftar sidang yang belum diberi hasil pada jam tunda otomatis: apa yang ditunda ke tanggal berapa, aturan mana, dan usulan gugur/tidak dapat diterima."
      >
        <CalendarClock className="h-3.5 w-3.5" />
        Tunda otomatis
      </button>
      {buka ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Tunda otomatis">
          <div className="w-full max-w-5xl rounded-xl border bg-card p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Tunda otomatis - {tanggal}</h2>
                <p className="text-xs text-muted-foreground">
                  {daftar ? daftar.kalimatSetelan : "Memuat..."}{" "}
                  {daftar ? `Jam pemicu hari ini ${daftar.jamPemicu.replace(":", ".")} WITA${daftar.kelilingAktif ? " (hari sidang keliling)" : ""}.` : ""}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setBuka(false)} aria-label="Tutup">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {daftar ? (
              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border p-3 text-sm">
                <label className="flex items-center gap-2">
                  <Switch
                    checked={daftar.setelan.nyala}
                    disabled={!daftar.bolehUbahSetelan || Boolean(sibuk)}
                    onCheckedChange={(v) => void kirim({ aksi: "setelan", nyala: v }, "setelan")}
                  />
                  Tunda otomatis {daftar.setelan.nyala ? "menyala" : "mati"}
                </label>
                <label className="flex items-center gap-2">
                  <Switch
                    checked={daftar.setelan.kering}
                    disabled={!daftar.bolehUbahSetelan || Boolean(sibuk)}
                    onCheckedChange={(v) => void kirim({ aksi: "setelan", kering: v }, "setelan")}
                  />
                  Mode kering (tidak menulis ke SIPP)
                </label>
                {daftar.bolehUbahSetelan && daftar.tahap === "pratinjau" && daftar.setelan.nyala ? (
                  <Button type="button" size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void kirim({ aksi: "jalankan", tanggal }, "jalankan")}>
                    Jalankan sekarang
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="ghost" disabled={Boolean(sibuk)} onClick={() => void muat(true)}>
                  Muat ulang
                </Button>
                {!daftar.bolehUbahSetelan ? <span className="text-xs text-muted-foreground">Saklar hanya dapat diubah Super Admin.</span> : null}
                {daftar.setelan.diubahOleh ? <span className="text-xs text-muted-foreground">Terakhir diubah {daftar.setelan.diubahOleh}.</span> : null}
              </div>
            ) : null}

            {pesan ? <p className="mt-2 text-sm">{pesan}</p> : null}

            {daftar ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {daftar.tahap === "jalan"
                  ? `Daftar dibekukan pukul ${new Date(daftar.jalan?.pada || "").toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" })} WITA (${daftar.jalan?.mode === "kering" ? "mode kering" : "menulis"}).`
                  : "Pratinjau - apa yang AKAN terjadi pada jam pemicu bila sidang ini masih belum diberi hasil."}{" "}
                {hitung ? `${hitung.tunda} tunda, ${hitung.usul} usulan putusan, ${daftar.butir.length - hitung.tunda - hitung.usul} dilewati.` : ""}
                {daftar.hariLibur ? " Hari ini hari libur - tidak ada jalan terjadwal." : ""}
                {daftar.galat ? ` ${daftar.galat}` : ""}
              </p>
            ) : null}

            <div className="mt-2 max-h-[65vh] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th className="p-2">Perkara</th>
                    <th className="p-2">Hasil</th>
                    <th className="p-2">Tanggal berikut</th>
                    <th className="p-2">Aturan dan alasan</th>
                    <th className="p-2">SIPP</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {(daftar?.butir ?? []).map((b) => {
                    const k = b.keputusan;
                    const dibatalkan = k.jenis === "lewati" && k.sebab === "dibatalkan-petugas";
                    const bisaBatal = k.jenis === "tunda" && (!b.tulis || b.tulis.status === "diantrekan");
                    return (
                      <tr key={b.jadwalId} className="border-b align-top" data-baris-tunda-otomatis={b.jadwalId}>
                        <td className="p-2">
                          <div className="font-medium">{b.nomorPerkara}</div>
                          <div className="text-muted-foreground">{b.agenda}</div>
                          {b.keliling ? <Badge variant="netral">Sidang keliling</Badge> : null}
                        </td>
                        <td className="p-2">
                          <Badge variant={warnaJenis(k.jenis)}>{LABEL_JENIS[k.jenis] || k.jenis}</Badge>
                        </td>
                        <td className="p-2">
                          {k.jenis === "tunda" ? (
                            <>
                              <div className="font-medium">
                                {k.tanggal} {k.jam}
                              </div>
                              <div className="text-muted-foreground">{k.agenda}</div>
                              {k.tanda.map((t) => (
                                <Badge key={t} variant="warning">
                                  {t}
                                </Badge>
                              ))}
                            </>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2">
                          {k.jenis === "lewati" ? k.penjelasan : `Aturan ${k.nomorAturan}: ${k.penjelasan}`}
                          {k.jenis === "tunda" ? <div className="text-muted-foreground">Alasan: {k.alasan}</div> : null}
                        </td>
                        <td className="p-2">
                          {b.tulis ? (
                            <>
                              <div className="font-medium">{LABEL_TULIS[b.tulis.status] || b.tulis.status}</div>
                              <div className="text-muted-foreground">{b.tulis.pesan}</div>
                              {b.tulis.atasNama ? <div className="text-muted-foreground">Atas nama PP: {b.tulis.atasNama}</div> : null}
                            </>
                          ) : k.jenis === "tunda" ? (
                            <span className="text-muted-foreground">Belum dijalankan</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="p-2">
                          {bisaBatal ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={Boolean(sibuk)}
                              onClick={() => void kirim({ aksi: "batal", tanggal, jadwalId: b.jadwalId }, `batal-${b.jadwalId}`)}
                            >
                              Jangan tunda otomatis
                            </Button>
                          ) : dibatalkan ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={Boolean(sibuk)}
                              onClick={() => void kirim({ aksi: "pulihkan", tanggal, jadwalId: b.jadwalId }, `pulihkan-${b.jadwalId}`)}
                            >
                              Ikutkan lagi
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {daftar && daftar.butir.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Tidak ada sidang pada tanggal ini.</p> : null}
            </div>
            <BagianPutusOtomatis tanggal={tanggal} />
            <p className="mt-3 text-[11px] text-muted-foreground">
              Gugur dan tidak dapat diterima tidak ditulis oleh tunda otomatis (lihat Putus otomatis di atas): di daftar tunda keduanya hanya diusulkan, tidak pernah ditulis ke SIPP. Tundaan
              ditulis atas nama panitera sidang perkara lewat penulis tunda yang sama dengan tombol Tunda, pada jam pemicu itu juga (walau
              di luar jam kerja - tidak pernah dipindah ke hari berikutnya), sesudah keadaan sidangnya diperiksa ulang.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
