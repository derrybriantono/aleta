import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentViewer } from "@/components/portal/document-viewer";
import { printPdfDocument } from "@/lib/pdf-print";
import { letters, personas } from "@/lib/mock-data";

const pdfMock = vi.hoisted(() => ({
  shouldReject: true,
}));

vi.mock("@/lib/pdfjs-client", () => ({
  loadPdfJsModule: () =>
    Promise.resolve({
      GlobalWorkerOptions: {
        workerSrc: "",
      },
      getDocument: () => ({
        promise: pdfMock.shouldReject
          ? Promise.reject(new Error("Object.defineProperty called on non-object"))
          : Promise.resolve({
              numPages: 2,
              destroy: vi.fn(),
              getPage: vi.fn(async () => ({
                getViewport: () => ({ width: 960, height: 1360 }),
                render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
              })),
            }),
        destroy: vi.fn(),
      }),
    }),
}));

vi.mock("@/lib/pdf-binary", () => ({
  loadPdfBinary: () => Promise.resolve(new Uint8Array([37, 80, 68, 70])),
}));

vi.mock("@/lib/pdf-print", () => ({
  printPdfDocument: vi.fn(() => Promise.resolve()),
}));

describe("DocumentViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfMock.shouldReject = true;
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        observe() {}
        disconnect() {}
      }
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserverMock {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          width: 1280,
          height: 820,
          top: 0,
          left: 0,
          right: 1280,
          bottom: 820,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      font: "",
      fillStyle: "",
      textAlign: "center",
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not mount a secondary PDF viewer when the smart PDF renderer fails", async () => {
    render(
      <DocumentViewer
        letter={{
          ...letters[0],
          documentUrl: "/uploads/pdf/contoh.pdf",
          documentFileName: "contoh.pdf",
          viewerMode: "download",
        }}
        currentUser={personas[0]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Tampilan PDF tidak tersedia")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("pdf-inline-preview-live")).not.toBeInTheDocument();
    expect(screen.queryByText("Unduh PDF")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tambah zoom")).toBeDisabled();
  });

  it("renders PDF Asli from the same loaded document without opening a download route", async () => {
    pdfMock.shouldReject = false;
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <DocumentViewer
        letter={{
          ...letters[0],
          documentUrl: "/uploads/pdf/contoh.pdf",
          documentFileName: "contoh.pdf",
          viewerMode: "download",
        }}
        currentUser={personas[0]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("2 halaman PDF aktif")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /PDF Asli/i }));

    await waitFor(() => {
      expect(screen.getByText("2 halaman PDF asli aktif")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Dokumen Asli").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tampilan PDF tidak tersedia")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cetak/i }));
    expect(printPdfDocument).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Layar Penuh/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("/pdf-viewer"), "_blank", "noopener,noreferrer");
  });
});
