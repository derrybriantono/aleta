"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";

import { EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";

type SearchMode = "simple" | "filtered";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const { getSearchResults } = usePortal();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<SearchMode>("simple");
  const [resultType, setResultType] = useState<"semua" | "surat" | "disposisi" | "pengguna">("semua");
  const [keywordFilter, setKeywordFilter] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(initialQuery);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialQuery]);

  const results = useMemo(() => getSearchResults(deferredQuery), [deferredQuery, getSearchResults]);
  const keywordOptions = useMemo(
    () =>
      Array.from(new Set(results.flatMap((item) => item.keywords)))
        .filter(Boolean)
        .slice(0, 12),
    [results]
  );
  const filteredResults = useMemo(
    () =>
      results.filter((item) => {
        const matchesType = resultType === "semua" || item.type === resultType;
        const matchesKeyword =
          !keywordFilter.trim() ||
          item.keywords.some((keyword) => keyword.toLowerCase().includes(keywordFilter.toLowerCase()));

        return matchesType && matchesKeyword;
      }),
    [keywordFilter, resultType, results]
  );
  const grouped = {
    surat: filteredResults.filter((item) => item.type === "surat"),
    disposisi: filteredResults.filter((item) => item.type === "disposisi"),
    pengguna: filteredResults.filter((item) => item.type === "pengguna"),
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Pencarian Global"
        title="Pencarian Global"
        description="Gunakan Simple Search untuk pencarian cepat, atau Filtered Search saat Anda ingin menyempitkan hasil dengan jenis hasil dan kata kunci badge yang lebih spesifik."
      />

      <Card className="border-border/90">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pusat Pencarian ALETA</CardTitle>
              <CardDescription>Hasil tetap mengikuti hak akses akun aktif dan hanya menampilkan data yang memang boleh dibuka.</CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted/35 p-1">
              <Button
                type="button"
                size="sm"
                variant={searchMode === "simple" ? "default" : "ghost"}
                onClick={() => {
                  setSearchMode("simple");
                  setResultType("semua");
                  setKeywordFilter("");
                }}
              >
                Simple Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant={searchMode === "filtered" ? "default" : "ghost"}
                onClick={() => setSearchMode("filtered")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtered Search
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari perihal, nomor surat, instruksi disposisi, atau nama pengguna..."
              className="h-12 pl-11 text-base"
            />
          </div>

          {searchMode === "filtered" ? (
            <div className="grid gap-4 rounded-[1.3rem] border border-border bg-muted/30 p-4 lg:grid-cols-3">
              <NativeSelect
                value={resultType}
                onChange={(event) => setResultType(event.target.value as "semua" | "surat" | "disposisi" | "pengguna")}
                className="h-12 text-base"
              >
                <option value="semua">Semua Jenis Hasil</option>
                <option value="surat">Hanya Surat</option>
                <option value="disposisi">Hanya Disposisi</option>
                <option value="pengguna">Hanya Pengguna</option>
              </NativeSelect>
              <Input
                value={keywordFilter}
                onChange={(event) => setKeywordFilter(event.target.value)}
                placeholder="Filter keyword badge, misalnya audit atau prioritas"
                className="h-12 text-base lg:col-span-2"
              />
              {keywordOptions.length > 0 ? (
                <div className="lg:col-span-3">
                  <div className="flex flex-wrap gap-2">
                    {keywordOptions.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        onClick={() => setKeywordFilter(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!deferredQuery.trim() ? (
            <EmptyState
              title="Masukkan kata kunci pencarian"
              description="Contoh yang bagus: audit, triwulan, Ahmad, disposisi, atau nomor surat."
            />
          ) : filteredResults.length === 0 ? (
            <EmptyState
              title="Tidak ada hasil yang cocok"
              description="Coba gunakan kata yang lebih umum, ubah jenis hasil, atau hapus filter lanjutan agar pencarian kembali lebih luas."
            />
          ) : (
            <div className="grid gap-6">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{filteredResults.length} hasil</Badge>
                <Badge variant={searchMode === "filtered" ? "warning" : "default"}>
                  {searchMode === "filtered" ? "Filtered Search" : "Simple Search"}
                </Badge>
                {resultType !== "semua" ? <Badge variant="outline">{resultType}</Badge> : null}
                {keywordFilter.trim() ? <Badge variant="outline">Keyword: {keywordFilter}</Badge> : null}
              </div>
              <ResultGroup title="Surat" items={grouped.surat} />
              <ResultGroup title="Disposisi" items={grouped.disposisi} />
              <ResultGroup title="Pengguna" items={grouped.pengguna} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultGroup({
  title,
  items,
}: {
  title: string;
  items: ReturnType<typeof usePortal>["getSearchResults"] extends (...args: never[]) => infer Result
    ? Result extends Array<infer Item>
      ? Item[]
      : never
    : never;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground sm:text-2xl">{title}</h2>
        <Badge variant="outline">{items.length} hasil</Badge>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <Card className="border-border/90 transition hover:-translate-y-0.5 hover:shadow-panel">
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm leading-7 text-muted-foreground">{item.excerpt}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
