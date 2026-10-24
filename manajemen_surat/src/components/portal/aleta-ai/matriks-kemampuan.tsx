"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";
import { GOLONGAN_PERAN, LABEL_GOLONGAN, type GolonganPeran } from "@/lib/matriks-peran";

/**
 * ALETA Ai - tabel matriks kemampuan per peran (rencana v2 10.3) di
 * Pengaturan ALETA Ai. Membaca dan menyimpan lewat GET/PUT
 * /api/aleta-ai/kemampuan; PUT hanya diterima server dari Super Admin, dan
 * penegakannya tetap di server (mesin & alat), bukan di layar ini.
 * Admin & Super Admin selalu boleh, jadi tidak tampil sebagai kolom.
 */

type BarisMatriks = { kemampuan: string; label: string; golongan: string[]; bawaan: boolean };
type JawabKemampuan = { matriks?: BarisMatriks[] };

export const KOLOM_GOLONGAN: GolonganPeran[] = GOLONGAN_PERAN.filter((g) => g !== "super-admin" && g !== "admin");

export function MatriksKemampuanAi() {
  const [baris, setBaris] = useState<BarisMatriks[] | null>(null);
  const [ubahan, setUbahan] = useState<Record<string, string[] | null>>({});
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const r = await ambil<JawabKemampuan>("/api/aleta-ai/kemampuan");
    if (!r.ok) {
      setPesan(r.galat);
      return;
    }
    if (!r.data.matriks) {
      setPesan("Matriks kemampuan hanya dapat diatur Super Admin.");
      return;
    }
    setBaris(r.data.matriks);
    setUbahan({});
  }, []);

  useEffect(() => {
    void Promise.resolve().then(muat);
  }, [muat]);

  const golonganBerlaku = (b: BarisMatriks) => (b.kemampuan in ubahan ? (ubahan[b.kemampuan] ?? null) : b.golongan);

  function centang(b: BarisMatriks, g: string, nilai: boolean) {
    const kini = golonganBerlaku(b) ?? b.golongan;
    const baru = nilai ? [...new Set([...kini, g])] : kini.filter((x) => x !== g);
    setUbahan((u) => ({ ...u, [b.kemampuan]: baru }));
    setPesan("");
  }

  async function simpan() {
    if (!Object.keys(ubahan).length) return;
    setSibuk(true);
    const r = await kirimJson<JawabKemampuan>("/api/aleta-ai/kemampuan", "PUT", { matriks: ubahan });
    setSibuk(false);
    if (!r.ok) {
      setPesan(r.galat);
      return;
    }
    setBaris(r.data.matriks ?? baris);
    setUbahan({});
    setPesan("Matriks kemampuan tersimpan dan langsung berlaku.");
  }

  if (!baris) {
    return pesan ? (
      <p role="status" className="text-sm text-muted-foreground">
        {pesan}
      </p>
    ) : (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Memuat matriks kemampuan...
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="matriks-kemampuan-ai">
      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[960px] text-sm">
          <caption className="sr-only">Matriks kemampuan ALETA Ai per peran</caption>
          <thead className="bg-muted/40 text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Kemampuan
              </th>
              {KOLOM_GOLONGAN.map((g) => (
                <th key={g} scope="col" className="px-2 py-2 text-center text-xs font-medium">
                  {LABEL_GOLONGAN[g]}
                </th>
              ))}
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Bawaan</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const berlaku = golonganBerlaku(b);
              const kembaliBawaan = b.kemampuan in ubahan && ubahan[b.kemampuan] === null;
              return (
                <tr key={b.kemampuan} className="border-t border-border/60">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {b.label}
                    {b.bawaan && !(b.kemampuan in ubahan) ? <span className="ml-1 text-xs text-muted-foreground">(bawaan)</span> : null}
                    {kembaliBawaan ? <span className="ml-1 text-xs text-muted-foreground">(kembali ke bawaan saat disimpan)</span> : null}
                  </th>
                  {KOLOM_GOLONGAN.map((g) => (
                    <td key={g} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label={`${b.label} - ${LABEL_GOLONGAN[g]}`}
                        checked={(berlaku ?? b.golongan).includes(g)}
                        disabled={kembaliBawaan}
                        onChange={(e) => centang(b, g, e.target.checked)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={b.bawaan && !(b.kemampuan in ubahan)}
                      onClick={() => setUbahan((u) => ({ ...u, [b.kemampuan]: null }))}
                      aria-label={`Kembalikan ${b.label} ke bawaan`}
                    >
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Admin dan Super Admin selalu boleh. Penolakan ditegakkan di server pada setiap permintaan dan tercatat di jejak audit.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void simpan()} disabled={sibuk || !Object.keys(ubahan).length}>
          {sibuk ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          Simpan matriks
        </Button>
        {pesan ? (
          <p role="status" className="text-sm">
            {pesan}
          </p>
        ) : null}
      </div>
    </div>
  );
}
