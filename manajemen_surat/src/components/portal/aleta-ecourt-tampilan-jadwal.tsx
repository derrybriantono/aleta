"use client";

/**
 * ============================================================================
 * BAWAAN TAMPILAN JADWAL SIDANG - PENGATURAN INTEGRASI E-COURT (6 Okt 2026, butir 22)
 * ============================================================================
 *
 * Super Admin mengatur saklar Tampilan Jadwal Sidang bawaan untuk SEMUA
 * pengguna atau untuk SATU pengguna. Bawaan berlaku bagi yang belum mengatur
 * sendiri; "Terapkan ulang" menimpa pilihan yang tersimpan di peramban mereka
 * sekali, pada pembukaan berikutnya. Aturannya di
 * server/modules/aleta-ecourt/tampilan-jadwal-bawaan dan lib/tampilan-bawaan.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  kelompokTampilan,
  tampilanBawaan,
  type PilihanTampilan,
} from "@/lib/tampilan-antrian-sidang";

type Bawaan = { pilihan: PilihanTampilan; paksa: boolean; versi: string; diubahOleh: string; diubahPada: string };
type Halaman = {
  semua: Bawaan | null;
  perPengguna: Array<{ penggunaId: string; nama: string; bawaan: Bawaan }>;
  pengguna: Array<{ id: string; nama: string; username: string }>;
};

const ALAMAT = "/api/aleta-ecourt/sidang/tampilan-bawaan";

export function AletaEcourtTampilanJadwal() {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [sasaran, setSasaran] = useState("semua");
  const [pilihan, setPilihan] = useState<PilihanTampilan>(() => tampilanBawaan());
  const [paksa, setPaksa] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const jawab = await fetch(apiPath(`${ALAMAT}?admin=1`), { cache: "no-store" });
      const luar = (await jawab.json()) as { data?: Halaman; error?: { message?: string } };
      if (!jawab.ok || !luar.data) throw new Error(luar.error?.message || `Gagal memuat (${jawab.status}).`);
      setHalaman(luar.data);
      setGalat("");
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Bawaan tampilan Jadwal Sidang tidak dapat dimuat."));
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const tersimpan = useMemo<Bawaan | null>(() => {
    if (!halaman) return null;
    if (sasaran === "semua") return halaman.semua;
    return halaman.perPengguna.find((x) => x.penggunaId === sasaran)?.bawaan ?? null;
  }, [halaman, sasaran]);

  // Pindah sasaran = isi centang dengan yang tersimpan untuknya (atau bawaan sistem).
  useEffect(() => {
    setPilihan(tersimpan?.pilihan ?? tampilanBawaan());
    setPaksa(false);
  }, [tersimpan]);

  const kirim = async (hapus: boolean) => {
    setSibuk(true);
    setKabar("");
    try {
      const jawab = await fetch(apiPath(ALAMAT), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lingkup: sasaran === "semua" ? "semua" : "pengguna",
          penggunaId: sasaran === "semua" ? undefined : sasaran,
          pilihan: hapus ? null : pilihan,
          paksa,
        }),
      });
      const luar = (await jawab.json()) as { data?: Halaman; error?: { message?: string } };
      if (!jawab.ok || !luar.data) throw new Error(luar.error?.message || `Gagal menyimpan (${jawab.status}).`);
      setHalaman(luar.data);
      setKabar(hapus ? "Bawaan dihapus." : paksa ? "Tersimpan - diterapkan ulang pada pembukaan berikutnya." : "Tersimpan.");
    } catch (e) {
      setKabar(pesanGalatPortal(e, "Bawaan tidak dapat disimpan."));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Card id="tampilan-jadwal-sidang">
      <CardHeader>
        <CardTitle>Tampilan Jadwal Sidang - bawaan</CardTitle>
        <CardDescription>
          Saklar Tampilan bawaan untuk semua pengguna atau untuk satu pengguna. Berlaku bagi yang belum mengatur
          tampilannya sendiri; centang &ldquo;Terapkan ulang&rdquo; untuk menimpa pilihan yang sudah tersimpan di
          peramban mereka (sekali, pada pembukaan berikutnya). Bawaan pengguna mengalahkan bawaan semua pengguna.
          Hanya Super Admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {galat ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{galat}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Untuk</span>
          <NativeSelect value={sasaran} onChange={(e) => setSasaran(e.target.value)} className="max-w-xs" data-sasaran-bawaan="">
            <option value="semua">Semua pengguna</option>
            {(halaman?.pengguna ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama} ({u.username})
                {halaman?.perPengguna.some((x) => x.penggunaId === u.id) ? " - punya bawaan sendiri" : ""}
              </option>
            ))}
          </NativeSelect>
          {tersimpan ? (
            <Badge variant="muted">
              tersimpan {tersimpan.diubahPada.slice(0, 16).replace("T", " ")} oleh {tersimpan.diubahOleh}
            </Badge>
          ) : (
            <Badge variant="muted">belum diatur - memakai bawaan sistem</Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kelompokTampilan().map((k) => (
            <div key={k.kunci} className="rounded-lg border bg-card p-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <ul className="space-y-1">
                {k.anggota.map((s) => (
                  <li key={s.kunci}>
                    <label className="flex items-start gap-2 text-sm" title={s.keterangan}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 accent-primary"
                        checked={s.wajib ? true : pilihan[s.kunci] !== false}
                        disabled={s.wajib}
                        onChange={(e) => setPilihan((lama) => ({ ...lama, [s.kunci]: e.target.checked }))}
                      />
                      <span className="leading-tight">{s.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={paksa} onChange={(e) => setPaksa(e.target.checked)} />
          Terapkan ulang - timpa pilihan yang sudah tersimpan di peramban {sasaran === "semua" ? "semua pengguna" : "pengguna ini"}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={sibuk || !halaman} onClick={() => void kirim(false)}>
            Simpan bawaan
          </Button>
          {tersimpan ? (
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim(true)}>
              Hapus bawaan {sasaran === "semua" ? "semua pengguna" : "pengguna ini"}
            </Button>
          ) : null}
          {kabar ? <span className="text-sm text-muted-foreground">{kabar}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
