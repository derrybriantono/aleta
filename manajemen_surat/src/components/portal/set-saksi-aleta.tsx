"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { isiTanda, semuaSetSaksi } from "@/lib/set-pertanyaan-saksi";

/**
 * Panduan pertanyaan saksi ALETA (F3.3) - BACA SAJA di Pengaturan SIPP & ABT,
 * bagian Template tanya jawab. Isinya tetap di ALETA (tidak ditulis ke tabel
 * template ABT); petugas memuatnya di Blangko Derry lewat "Set pertanyaan".
 * Ditampilkan agar hakim dapat menilai pertanyaan, unsur, dan dasar hukumnya.
 */
export function SetSaksiAleta() {
  const semua = useMemo(() => semuaSetSaksi(), []);
  const [id, setId] = useState(semua[0]?.id ?? "");
  const set = semua.find((s) => s.id === id) ?? semua[0];
  if (!set) return null;
  const jenis = set.jenis[0];
  const contoh = { sebutanP: jenis === "ct" || !["cg", "hb", "waris"].includes(jenis) ? "Pemohon" : "Penggugat", jumlahP: ["itsbat", "dk", "paw", "aua"].includes(jenis) ? 2 : 1 };
  const butir = set.tambahan ? set.inti : [...set.pembuka, ...set.inti, ...set.penutup];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Panduan pertanyaan saksi ALETA</CardTitle>
        <CardDescription>
          {semua.length} set pertanyaan saksi menurut jenis perkara dan alasan cerai. Blangko Derry menyarankan set yang cocok; petugas dapat mengubahnya
          sebelum disimpan. Panduan ini tidak mengubah template ABT di atas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <NativeSelect aria-label="Pilih set pertanyaan saksi" value={set.id} onChange={(e) => setId(e.target.value)}>
          {semua.map((s) => (
            <option key={s.id} value={s.id}>
              {s.judul} ({(s.tambahan ? s.inti : [...s.pembuka, ...s.inti, ...s.penutup]).length} pertanyaan)
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">{set.untuk}</p>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Dasar</p>
          <ul className="list-disc pl-5">
            {set.dasar.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {set.perluDicek.length ? (
            <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
              {set.perluDicek.map((d) => (
                <li key={d}>Perlu dicek: {d}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-muted-foreground">Kebiasaan di PA Donggala: {set.ukur.replace(/^ABT server:\s*/, "")}</p>
        </div>
        <ol className="space-y-2 text-sm">
          {butir.map((b, i) => (
            <li key={`${i}-${b.tanya}`} className="rounded-md border p-2">
              <p className="font-medium">
                {i + 1}. {isiTanda(b.tanya, jenis, contoh)}
              </p>
              <p className="text-muted-foreground">{isiTanda(b.jawab, jenis, contoh)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Yang dibuktikan: {b.unsur}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
