import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentViewer } from "@/components/portal/document-viewer";
import { letters, personas } from "@/lib/mock-data";

vi.mock("@/lib/pdfjs-client", () => ({
  loadPdfJsModule: () =>
    Promise.resolve({
      GlobalWorkerOptions: {
        workerSrc: "",
      },
      getDocument: () => ({
        promise: Promise.reject(new Error("Object.defineProperty called on non-object")),
        destroy: vi.fn(),
      }),
    }),
}));

vi.mock("@/lib/pdf-binary", () => ({
  loadPdfBinary: () => Promise.resolve(new Uint8Array([37, 80, 68, 70])),
}));

vi.mock("@/components/pdf/pdf-live-viewer", () => ({
  PdfLiveViewer: () => <div data-testid="pdf-live-viewer-embedded">PDF live embedded</div>,
}));

describe("DocumentViewer", () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to inline preview when the smart PDF renderer fails", async () => {
    render(
      <DocumentViewer
        letter={{
          ...letters[0],
          documentUrl: "/uploads/pdf/contoh.pdf",
          documentFileName: "contoh.pdf",
        }}
        currentUser={personas[0]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("pdf-inline-preview-live")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Smart Preview sedang bermasalah di browser ini. PDF asli tetap ditampilkan langsung di bawah.")
    ).toBeInTheDocument();
    expect(screen.queryByText("PDF tidak bisa dipreview langsung")).not.toBeInTheDocument();
    expect(screen.getByText("Preview PDF asli aktif")).toBeInTheDocument();
    expect(screen.getByLabelText("Tambah zoom")).toBeDisabled();
  });
});
