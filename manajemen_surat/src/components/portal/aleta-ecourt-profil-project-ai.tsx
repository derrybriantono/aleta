"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { BATAS_PROFIL, labelVersiProfil, type ProfilProjectAi } from "@/lib/profil-project-ai";

/**
 * ============================================================================
 * PROFIL PROJECT ALETA AI - PENGATURAN SUPER ADMIN (18 Okt 2026)
 * ============================================================================
 *
 * Perintah AI di Status Perkara, bila petugas mencentang "menggunakan Project
 * ALETA AI PA CLAUDE ULTRA", tidak lagi menulis peran: Project sudah punya
 * instruksinya sendiri. Yang dicatat di sini ringkasan instruksi itu supaya
 * perintahnya memakai istilah, bagian, dan format yang sama. Bila Project
 * diperbarui, Super Admin memperbarui catatan ini dan mengganti versi serta
 * tanggalnya.
 *
 * Kartu ini hanya tampil bagi yang boleh mengubahnya.
 */

type Halaman = {
  profil: ProfilProjectAi;
  tersimpan: boolean;
  bolehMengubah: boolean;
  isiTersimpan: ProfilProjectAi | null;
};

type Borang = {
  namaProject: string;
  versi: string;
  tanggal: string;
  ringkasanRole: string;
  formatKeluaran: string;
  istilah: string;
  bagian: string;
  pembuka: string;
  catatan: string;
};

function keBorang(p: ProfilProjectAi): Borang {
  return {
    namaProject: p.namaProject,
    versi: p.versi,
    tanggal: p.tanggal,
    ringkasanRole: p.ringkasanRole,
    formatKeluaran: p.formatKeluaran,
    istilah: p.istilah,
    bagian: p.bagian.join("\n"),
    pembuka: p.pembuka,
    catatan: p.catatan,
  };
}

export function AletaEcourtProfilProjectAi() {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [borang, setBorang] = useState<Borang | null>(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const jawab = await fetch(apiPath("/api/aleta-ecourt/profil-project-ai"), { cache: "no-store" });
        const luar = (await jawab.json()) as { data?: Halaman } | null;
        const isi = luar?.data;
        if (!batal && isi && isi.profil) {
          setHalaman(isi);
          setBorang(keBorang(isi.profil));
        }
      } catch {
        /* kartu ini hanya pelengkap; tanpa data ia tidak tampil */
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  if (!halaman || !halaman.bolehMengubah || !borang) return null;

  const ubah = (kunci: keyof Borang, nilai: string) => {
    setBorang((lama) => (lama ? { ...lama, [kunci]: nilai } : lama));
    setPesan("");
  };

  const simpan = async (bawaan: boolean) => {
    setSibuk(true);
    setPesan("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/profil-project-ai"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          bawaan
            ? { bawaan: true }
            : {
                ...borang,
                bagian: borang.bagian
                  .split("\n")
                  .map((b) => b.trim())
                  .filter(Boolean),
              }
        ),
      });
      const luar = (await jawab.json()) as { data?: Halaman; error?: string; message?: string } | null;
      if (!jawab.ok || !luar?.data) {
        setPesan(luar?.message || luar?.error || "Profil tidak dapat disimpan.");
      } else {
        setHalaman(luar.data);
        setBorang(keBorang(luar.data.profil));
        setPesan(bawaan ? "Kembali ke bawaan V.4.5." : "Tersimpan.");
      }
    } catch {
      setPesan("Server tidak dapat dihubungi.");
    } finally {
      setSibuk(false);
    }
  };

  const kelasKotak = "w-full rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <Card id="profil-project-ai">
      <CardHeader>
        <CardTitle>Profil Project ALETA AI</CardTitle>
        <CardDescription>
          Ringkasan instruksi Project ALETA AI PA CLAUDE ULTRA. Dipakai penyusun perintah AI di Status
          Perkara bila petugas mencentang pemakaian Project itu: perintahnya tidak menulis peran, hanya
          data perkara dan permintaan dengan istilah di bawah. {labelVersiProfil(halaman.profil)}.
          {halaman.tersimpan ? "" : " (bawaan)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 sm:col-span-1">
            <span className="text-sm font-medium">Nama Project</span>
            <Input value={borang.namaProject} maxLength={BATAS_PROFIL.nama} onChange={(e) => ubah("namaProject", e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-1">
            <span className="text-sm font-medium">Versi</span>
            <Input value={borang.versi} maxLength={BATAS_PROFIL.versi} onChange={(e) => ubah("versi", e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-1">
            <span className="text-sm font-medium">Tanggal instruksi</span>
            <Input type="date" value={borang.tanggal} onChange={(e) => ubah("tanggal", e.target.value)} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Ringkasan peran Project (catatan saja, tidak masuk perintah)</span>
          <textarea rows={3} className={kelasKotak} value={borang.ringkasanRole} maxLength={BATAS_PROFIL.teksPanjang} onChange={(e) => ubah("ringkasanRole", e.target.value)} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Format keluaran</span>
            <textarea rows={4} className={kelasKotak} value={borang.formatKeluaran} maxLength={BATAS_PROFIL.teksPanjang} onChange={(e) => ubah("formatKeluaran", e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Istilah dan aturan yang dipegang</span>
            <textarea rows={4} className={kelasKotak} value={borang.istilah} maxLength={BATAS_PROFIL.teksPanjang} onChange={(e) => ubah("istilah", e.target.value)} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Bagian yang diharapkan (satu per baris, berurutan)</span>
            <textarea rows={8} className={kelasKotak} value={borang.bagian} onChange={(e) => ubah("bagian", e.target.value)} />
          </label>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Kalimat pembuka</span>
              <textarea rows={3} className={kelasKotak} value={borang.pembuka} maxLength={BATAS_PROFIL.pembuka} onChange={(e) => ubah("pembuka", e.target.value)} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Catatan versi</span>
              <textarea rows={3} className={kelasKotak} value={borang.catatan} maxLength={BATAS_PROFIL.catatan} onChange={(e) => ubah("catatan", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void simpan(false)} disabled={sibuk || !borang.versi.trim()}>
            Simpan profil
          </Button>
          <Button type="button" variant="outline" onClick={() => void simpan(true)} disabled={sibuk || !halaman.tersimpan}>
            Kembali ke bawaan V.4.5
          </Button>
          {halaman.profil.diubahOleh ? (
            <span className="text-xs text-muted-foreground">
              Terakhir diubah {halaman.profil.diubahOleh}
              {halaman.profil.diubahPada ? `, ${halaman.profil.diubahPada.slice(0, 10)}` : ""}
            </span>
          ) : null}
          {pesan ? <span className="text-sm text-muted-foreground">{pesan}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
