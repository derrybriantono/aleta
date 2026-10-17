"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { type NilaiNomorSk, type PengaturanNomorSk } from "@/lib/nomor-sk";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";
import { menyebutAleta, pesanTandaAletaSipp } from "@/lib/tanda-aleta";

/**
 * Nomor SK penunjukan (17 Okt 2026) - kartu admin Integrasi e-Court.
 *
 * Nomor SK yang dikutip penetapan majelis hakim disimpan di sini (database
 * ALETA), bukan lagi tertulis tetap di blangko. Dua langkah: Simpan (ALETA saja)
 * lalu Terapkan ke ABT (menulis ke isian nomor SK di ABT, tercatat dan dapat
 * dikembalikan). Aturannya di lib/nomor-sk.ts; rutenya /api/pengaturan-sipp-abt.
 */

type Rencana = {
  kunci: string;
  bagian: "nomor" | "tanggal";
  label: string;
  keterangan: string;
  literal: string;
  ada: boolean;
  nilaiAbt: string;
  perlu: boolean;
  bisa: boolean;
  sebab: string;
};

type Jawaban = {
  nilai: PengaturanNomorSk;
  tersimpan: boolean;
  diubahOleh: string;
  diubahPada: string;
  butir: Array<{ kunci: string; noVar: string; noVarTanggal: string; label: string; keterangan: string }>;
  rencana: Rencana[];
  galatAbt: string;
  hak: { ubahBawaan: boolean };
};

type Riwayat = { id: string; ringkas: string; status: string; galat: string; pulihDari: string; olehNama: string; pada: string };

const ALAMAT = "/api/pengaturan-sipp-abt";

async function panggil<T>(alamat: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(alamat), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

const kirim = <T,>(badan: Record<string, unknown>) =>
  panggil<T>(ALAMAT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const jam = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

export function AletaEcourtNomorSk() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [draf, setDraf] = useState<PengaturanNomorSk>({});
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [yakin, setYakin] = useState("");

  const muat = useCallback(async () => {
    try {
      const d = await panggil<Jawaban>(`${ALAMAT}?bagian=nomor-sk`);
      setData(d);
      setDraf(d.nilai);
      const r = await panggil<{ riwayat: Riwayat[] }>(`${ALAMAT}?bagian=riwayat&jenis=nomor_sk&batas=5`).catch(() => ({ riwayat: [] as Riwayat[] }));
      setRiwayat(r.riwayat);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const boleh = data?.hak.ubahBawaan ?? false;
  const berubah = data ? data.butir.some((b) => JSON.stringify(draf[b.kunci] ?? null) !== JSON.stringify(data.nilai[b.kunci] ?? null)) : false;

  const ubah = (kunci: string, bagian: keyof NilaiNomorSk, nilai: string) =>
    setDraf((d) => ({ ...d, [kunci]: { ...(d[kunci] ?? { nomor: "", tanggal: "" }), [bagian]: nilai } }));

  async function jalankan(nama: string, kerja: () => Promise<string>) {
    setSibuk(nama);
    setGalat("");
    setInfo("");
    try {
      setInfo(await kerja());
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  const simpan = () =>
    jalankan("simpan", async () => {
      await kirim({ tindakan: "simpan-nomor-sk", nilai: draf });
      return "Nomor SK tersimpan di ALETA. Tekan \"Terapkan ke ABT\" agar dipakai di blangko.";
    });

  const terapkan = () =>
    jalankan("terapkan", async () => {
      const h = await kirim<{ hasil: Array<{ ok: boolean; dilewati?: boolean; pesan: string }> }>({ tindakan: "terapkan-nomor-sk" });
      const gagal = h.hasil.filter((x) => !x.ok);
      if (gagal.length) throw new Error(gagal.map((x) => x.pesan).join(" "));
      return h.hasil.every((x) => x.dilewati) ? "Nomor SK di ABT sudah sama - tidak ada yang diubah." : "Nomor SK sudah diterapkan ke ABT.";
    });

  const kembalikan = (id: string) =>
    jalankan("kembali-" + id, async () => {
      await kirim({ tindakan: "kembalikan", id });
      setYakin("");
      return "Nomor SK di ABT dikembalikan ke keadaan sebelumnya. Nilai di ALETA tidak berubah.";
    });

  return (
    <Card id="nomor-sk">
      <CardHeader>
        <CardTitle>Nomor SK penunjukan</CardTitle>
        <CardDescription>
          Nomor dan tanggal SK yang dikutip pada penetapan majelis hakim. Ubah di sini bila SK berganti, simpan, lalu terapkan ke
          ABT. Ini satu-satunya tempat mengubahnya: panel penunjukan majelis di bawah ikut membaca dari sini. Yang berlaku
          sekarang sudah terisi sebagai bawaan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {galat ? <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{galat}</p> : null}
        {info ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{info}</p> : null}
        {!data && !galat ? <p className="text-sm text-muted-foreground">Memuat nomor SK...</p> : null}
        {data ? (
          <>
            {data.galatAbt ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                Keadaan ABT belum dapat dibaca sekarang ({data.galatAbt}). Nomor SK tetap dapat disimpan di ALETA.
              </p>
            ) : null}
            {data.butir.map((b) => {
              const nilai = draf[b.kunci] ?? { nomor: "", tanggal: "" };
              const rencana = data.rencana.filter((r) => r.kunci === b.kunci);
              const tanggalTeks = tanggalPanjang(nilai.tanggal);
              const teks = nilai.nomor.trim() ? `${nilai.nomor.trim()}${tanggalTeks ? ` tanggal ${tanggalTeks}` : ""}` : "";
              return (
                <div key={b.kunci} className="space-y-3 rounded-xl border border-border/70 p-3">
                  <div>
                    <p className="font-medium">{b.label}</p>
                    <p className="text-sm text-muted-foreground">{b.keterangan}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Nomor SK</span>
                      <Input value={nilai.nomor} disabled={!boleh} maxLength={120} onChange={(e) => ubah(b.kunci, "nomor", e.target.value)} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Tanggal SK</span>
                      <Input type="date" value={nilai.tanggal} disabled={!boleh} onChange={(e) => ubah(b.kunci, "tanggal", e.target.value)} />
                    </label>
                  </div>
                  {teks ? (
                    <p className="break-words text-sm">
                      <span className="text-muted-foreground">Yang tertulis di blangko: </span>
                      {teks}
                    </p>
                  ) : null}
                  {teks && menyebutAleta(teks) ? <p className="text-sm text-amber-800 dark:text-amber-300">{pesanTandaAletaSipp("Nomor SK")}</p> : null}
                  {rencana.map((r) => (
                    <div key={r.bagian} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-14 font-medium">{r.bagian === "nomor" ? "Nomor" : "Tanggal"}</span>
                      {!r.ada ? (
                        <Badge variant="warning">Belum terpasang di ABT</Badge>
                      ) : r.perlu ? (
                        <Badge variant="warning">Di ABT masih berbeda</Badge>
                      ) : r.bisa ? (
                        <Badge variant="success">Sudah sama dengan ABT</Badge>
                      ) : (
                        <Badge variant="danger">Tidak dapat diterapkan</Badge>
                      )}
                      {r.sebab ? <span className="break-words text-muted-foreground">{r.sebab}</span> : null}
                      {r.ada && r.perlu && r.nilaiAbt ? <span className="break-words text-muted-foreground">Di ABT sekarang: {r.nilaiAbt}</span> : null}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" disabled={!boleh || !berubah || sibuk !== ""} onClick={() => void simpan()}>
                {sibuk === "simpan" ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button size="sm" variant="outline" disabled={!boleh || berubah || !data.tersimpan || sibuk !== ""} onClick={() => void terapkan()}>
                {sibuk === "terapkan" ? "Menerapkan..." : "Terapkan ke ABT"}
              </Button>
              {berubah ? <span className="text-sm text-muted-foreground">Ada perubahan yang belum disimpan.</span> : null}
              {!data.tersimpan && !berubah ? <span className="text-sm text-muted-foreground">Masih memakai nomor bawaan - tekan Simpan sekali agar tercatat di ALETA.</span> : null}
              {data.diubahOleh ? <span className="text-sm text-muted-foreground">Terakhir disimpan {jam(data.diubahPada)} oleh {data.diubahOleh}.</span> : null}
            </div>
            {riwayat.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Perubahan terakhir di ABT</p>
                <ul className="space-y-2">
                  {riwayat.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{jam(s.pada)}</span>
                          <span className="text-muted-foreground">oleh {s.olehNama || "-"}</span>
                          <Badge variant={s.status === "tersimpan" ? "success" : s.status === "gagal" ? "danger" : "warning"}>{s.status}</Badge>
                          {s.pulihDari ? <Badge variant="info">pengembalian</Badge> : null}
                        </div>
                        <p className="break-words">{s.ringkas}</p>
                        {s.galat ? <p className="break-words text-rose-700 dark:text-rose-300">{s.galat}</p> : null}
                      </div>
                      {s.status === "tersimpan" && boleh ? (
                        yakin === s.id ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button size="sm" variant="destructive" disabled={sibuk !== ""} onClick={() => void kembalikan(s.id)}>
                              Ya, kembalikan
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setYakin("")}>
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setYakin(s.id)}>
                            Kembalikan ke sebelum ini
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
