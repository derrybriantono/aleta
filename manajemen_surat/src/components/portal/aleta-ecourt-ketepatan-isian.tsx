"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { labelJenis, type KelompokKebenaran, type RingkasanBulananSaksi } from "@/lib/ketepatan-isian";
import { getEffectiveRoleId } from "@/lib/permissions";
import { usePortal } from "@/lib/app-state";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { RingkasanHuruf } from "@/server/modules/aleta-ecourt/huruf-alasan-belajar";
import type { KeputusanKetepatan, LayarKetepatan } from "@/server/modules/aleta-ecourt/ketepatan-isian";

/**
 * Ketepatan isian - kartu Admin (rantai D, D1, 25 Okt 2026).
 *
 * Menampilkan seberapa tepat usulan isian Blangko Derry di lapangan (dari jejak isian petugas), isian yang
 * layak terisi sendiri (atau harus kembali menjadi saran), dan kebenaran isi keterangan saksi. Usulan TIDAK
 * PERNAH berlaku sendiri: hanya Super Admin yang menyetujui. Saklarnya (Fitur satker "Ketepatan isian",
 * bawaan mati) dinyalakan Super Admin; selama mati gerbang isian memakai berkas bawaan.
 */

const persen = (x: number | null) => (x === null ? "-" : `${x}%`);
const persenDesimal = (x: number | null) => (x === null ? "-" : `${Math.round(x * 1000) / 10}%`);
const AMBIL = { credentials: "include" as const, cache: "no-store" as const };

function TabelKebenaran({ judul, baris }: { judul: string; baris: Array<KelompokKebenaran | RingkasanBulananSaksi> }) {
  if (!baris.length) return null;
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{judul}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Kelompok</th>
              <th className="pr-3">Butir</th>
              <th className="pr-3">Diterima</th>
              <th className="pr-3">Disunting</th>
              <th className="pr-3">Benar</th>
              <th>Kemiripan rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {baris.slice(0, 30).map((b) => (
              <tr key={b.kunci} className="border-t border-border">
                <td className="py-1 pr-3 break-all">{b.kunci}</td>
                <td className="pr-3">{b.jumlah}</td>
                <td className="pr-3">{b.diterima}</td>
                <td className="pr-3">{b.disunting}</td>
                <td className="pr-3">{persen(b.persenBenar)}</td>
                <td>{persenDesimal(b.rataKemiripan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const namaStatus = (s: string) =>
  s === "otomatis" ? "terisi sendiri" : s === "terstruktur" ? "terisi sendiri (dari data SIPP)" : s === "saran" ? "hanya saran" : s === "tanpa-ukuran" ? "belum diukur" : s === "belum-diketahui" ? "belum diketahui" : s;

/**
 * Kecocokan huruf alasan perceraian (D4): usulan mesin versus pilihan akhir hakim, per jenis perkara dan huruf usulan.
 * Tanpa nama hakim. Saklar &quot;Huruf alasan yang belajar dari hakim&quot; ada di Fitur satker (bawaan mati).
 */
function KecocokanHurufAlasan() {
  const [data, setData] = useState<RingkasanHuruf | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/huruf-alasan?bagian=ringkasan"), AMBIL);
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Kecocokan huruf alasan tidak dapat dibaca.");
      setData(j.data as RingkasanHuruf);
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Kecocokan huruf alasan tidak dapat dimuat."));
    } finally {
      setMemuat(false);
    }
  }, []);
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Kecocokan huruf alasan perceraian</div>
      <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
        {memuat ? "Memuat..." : data ? "Segarkan" : "Muat kecocokan huruf alasan"}
      </Button>
      {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
      {data && !data.aktif ? <p className="text-sm">Saklar &quot;Huruf alasan yang belajar dari hakim&quot; mati.</p> : null}
      {data?.aktif ? (
        data.perPola.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Jenis perkara</th>
                  <th className="pr-3">Huruf usulan</th>
                  <th className="pr-3">Perkara</th>
                  <th className="pr-3">Pilihan akhir sama</th>
                  <th>Pilihan akhir terbanyak</th>
                </tr>
              </thead>
              <tbody>
                {data.perPola.map((p) => (
                  <tr key={`${p.jenis}|${p.usulan}`} className="border-t border-border">
                    <td className="py-1 pr-3">{labelJenis(p.jenis)}</td>
                    <td className="pr-3">{p.usulan}</td>
                    <td className="pr-3">{p.n}</td>
                    <td className="pr-3">{persen(p.persenCocok)}</td>
                    <td>{p.sebaran[0] ? `${p.sebaran[0].huruf} (${p.sebaran[0].persen}%)` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pilihan huruf alasan yang tercatat.</p>
        )
      ) : null}
    </div>
  );
}

export function AletaEcourtKetepatanIsian() {
  const { currentUser } = usePortal();
  const superAdmin = getEffectiveRoleId(currentUser) === "super-admin";
  const [layar, setLayar] = useState<LayarKetepatan | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/ketepatan-isian"), AMBIL);
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Ketepatan isian tidak dapat dibaca.");
      setLayar(j.data as LayarKetepatan);
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Ketepatan isian tidak dapat dimuat."));
    } finally {
      setSibuk(false);
    }
  }, []);

  const kirim = useCallback(async (badan: Record<string, unknown>) => {
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/ketepatan-isian"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(badan),
      });
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Tindakan gagal.");
      setLayar((j.data.layar ?? null) as LayarKetepatan | null);
      if (j.data.bot && !j.data.bot.terkirim) setPesan(`Keputusan tersimpan. ${j.data.bot.pesan}`);
      else if (badan.aksi === "hitung") setPesan("Angka sudah dihitung ulang.");
      else setPesan("Keputusan tersimpan.");
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Tindakan gagal."));
    } finally {
      setSibuk(false);
    }
  }, []);

  const barisUsulan = (k: KeputusanKetepatan, aksi: "usulan" | "berlaku") => (
    <tr key={k.id} className="border-t border-border">
      <td className="py-1 pr-3">{k.kode}</td>
      <td className="pr-3 break-all">{k.pengisi || "-"}</td>
      <td className="pr-3">{labelJenis(k.jenis)}</td>
      <td className="pr-3">
        <Badge variant={k.arah === "naik" ? "success" : "warning"}>{k.arah === "naik" ? "Layak terisi sendiri" : "Harus jadi saran"}</Badge>
      </td>
      <td className="pr-3">{namaStatus(k.dariStatus)}</td>
      <td className="pr-3">{k.jumlah}</td>
      <td className="pr-3">{persenDesimal(k.presisi)}</td>
      <td>
        {superAdmin ? (
          aksi === "usulan" ? (
            <span className="flex gap-2">
              <Button type="button" size="sm" disabled={sibuk} onClick={() => void kirim({ aksi: "setujui", id: k.id })}>
                Setujui
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim({ aksi: "tolak", id: k.id })}>
                Tolak
              </Button>
            </span>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim({ aksi: "cabut", id: k.id })}>
              Cabut
            </Button>
          )
        ) : (
          <span className="text-muted-foreground">Hanya Super Admin</span>
        )}
      </td>
    </tr>
  );

  const kepala = (
    <thead className="text-muted-foreground">
      <tr>
        <th className="py-1 pr-3">Isian</th>
        <th className="pr-3">Sumber isian</th>
        <th className="pr-3">Jenis perkara</th>
        <th className="pr-3">Usulan</th>
        <th className="pr-3">Sekarang</th>
        <th className="pr-3">Kejadian</th>
        <th className="pr-3">Bertahan</th>
        <th>Tindakan</th>
      </tr>
    </thead>
  );

  return (
    <Card id="ketepatan-isian">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ketepatan isian
          {layar === null ? null : <Badge variant={layar.aktif ? "success" : "muted"}>{layar.aktif ? "Menghitung" : "Mati"}</Badge>}
        </CardTitle>
        <CardDescription>
          Seberapa sering usulan isian diterima petugas tanpa diubah. Isian dengan ketepatan {Math.round((layar?.ambang.naik ?? 0.95) * 100)}% atau lebih dari
          sedikitnya {layar?.ambang.minKejadian ?? 30} kejadian diusulkan boleh terisi sendiri; usulan hanya berlaku setelah Super Admin menyetujuinya. Saklar
          &quot;Ketepatan isian&quot; ada di Fitur satker (bawaan mati) dan membutuhkan saklar &quot;Jejak isian dan butir saksi&quot; menyala agar ada datanya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={sibuk}>
            {sibuk ? "Memuat..." : layar ? "Segarkan" : "Muat angka"}
          </Button>
          {layar?.aktif ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void kirim({ aksi: "hitung" })} disabled={sibuk}>
              Hitung ulang sekarang
            </Button>
          ) : null}
        </div>
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {pesan ? <p className="text-sm text-muted-foreground">{pesan}</p> : null}

        {layar && !layar.aktif ? <p className="text-sm">Saklar mati. Gerbang isian memakai berkas bawaan saja.</p> : null}

        {layar?.aktif ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dihitung terakhir: {layar.dihitungAt ? new Date(layar.dihitungAt).toLocaleString("id-ID") : "-"}.
              {layar.gerbangTerbaca ? "" : " Status gerbang bawaan di bot tidak terbaca pada hitungan ini, jadi kolom Sekarang bisa berisi belum diketahui."}
            </p>

            <div className="space-y-1">
              <div className="text-sm font-medium">Usulan menunggu keputusan ({layar.usulan.length})</div>
              {layar.usulan.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    {kepala}
                    <tbody>{layar.usulan.map((k) => barisUsulan(k, "usulan"))}</tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada isian yang memenuhi ambang. Angka terkumpul setelah beberapa pekan jejak isian menyala.</p>
              )}
            </div>

            {layar.berlaku.length ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Keputusan yang berlaku ({layar.berlaku.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    {kepala}
                    <tbody>{layar.berlaku.map((k) => barisUsulan(k, "berlaku"))}</tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="space-y-1">
              <div className="text-sm font-medium">Ketepatan per isian</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Isian</th>
                      <th className="pr-3">Sumber isian</th>
                      <th className="pr-3">Jenis perkara</th>
                      <th className="pr-3">Usulan</th>
                      <th className="pr-3">Bertahan</th>
                      <th className="pr-3">Ketepatan</th>
                      <th>Diketik petugas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {layar.perIsian.slice(0, 60).map((p) => (
                      <tr key={`${p.kode}|${p.pengisi}|${p.jenis}`} className="border-t border-border">
                        <td className="py-1 pr-3">{p.kode}</td>
                        <td className="pr-3 break-all">{p.pengisi || "-"}</td>
                        <td className="pr-3">{labelJenis(p.jenis)}</td>
                        <td className="pr-3">{p.usulan}</td>
                        <td className="pr-3">{p.bertahan}</td>
                        <td className="pr-3">{persenDesimal(p.presisi)}</td>
                        <td>{p.diketik}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Kebenaran isi keterangan saksi</div>
              <p className="text-sm">
                Butir saksi tercatat: <b>{layar.kebenaranSaksi.jumlah}</b>. Benar (diterima, atau disunting tetapi tetap mirip): <b>{persen(layar.kebenaranSaksi.persenBenar)}</b>;
                kemiripan rata-rata <b>{persenDesimal(layar.kebenaranSaksi.rataKemiripan)}</b>.
              </p>
              <TabelKebenaran judul="Per jenis keterangan" baris={layar.kebenaranSaksi.perJenisKeterangan} />
              <TabelKebenaran judul="Per katalog" baris={layar.kebenaranSaksi.perKatalog} />
              <TabelKebenaran judul="Per bulan" baris={layar.kebenaranSaksi.perBulan} />
            </div>

            {layar.riwayat.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Riwayat keputusan ({layar.riwayat.length})</summary>
                <ul className="mt-2 space-y-1">
                  {layar.riwayat.map((k) => (
                    <li key={k.id} className="text-muted-foreground">
                      {k.kode} / {k.pengisi || "-"} / {labelJenis(k.jenis)}: {k.arah === "naik" ? "naik" : "turun"}, {k.status}
                      {k.diputuskanNama ? ` oleh ${k.diputuskanNama}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
        <KecocokanHurufAlasan />
      </CardContent>
    </Card>
  );
}
