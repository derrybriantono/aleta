import "@testing-library/jest-dom/vitest";
import "./k11-konten-gabungan";

import { beforeEach } from "vitest";
import { pakaiAntarmukaLama } from "./antarmuka-lama";

// Uji lama menguji tampilan lama; lihat antarmuka-lama.ts.
beforeEach(() => pakaiAntarmukaLama());
