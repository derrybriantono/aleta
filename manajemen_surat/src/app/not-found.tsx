import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  Home,
  Pause,
  RefreshCw,
  Sparkles,
  TimerReset,
} from "lucide-react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";

const REDIRECT_DELAY_MS = 5000;
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function buildRedirectScript() {
  const config = {
    authEndpoint: apiPath("/api/auth/get-session"),
    portalHref: apiPath("/portal"),
    loginHref: apiPath("/login"),
    redirectDelayMs: REDIRECT_DELAY_MS,
    ringCircumference: RING_CIRCUMFERENCE,
  };

  return `
    (function () {
      var config = ${JSON.stringify(config)};
      var targetHref = config.loginHref;
      var targetLabel = "Login ALETA";
      var actionLabel = "Kembali ke Login";
      var remainingMs = config.redirectDelayMs;
      var paused = false;
      var intervalId = null;
      var resolved = false;

      function byId(id) {
        return document.getElementById(id);
      }

      function setText(id, value) {
        var element = byId(id);
        if (element) element.textContent = value;
      }

      function setHref(id, value) {
        var element = byId(id);
        if (element) element.setAttribute("href", value);
      }

      function updateTarget(isAuthenticated) {
        targetHref = isAuthenticated ? config.portalHref : config.loginHref;
        targetLabel = isAuthenticated ? "Portal ALETA" : "Login ALETA";
        actionLabel = isAuthenticated ? "Kembali ke Portal" : "Kembali ke Login";
        setText("aleta-404-target-label", targetLabel);
        setText("aleta-404-primary-label", actionLabel);
        setText("aleta-404-secondary-label", "Buka " + targetLabel);
        setHref("aleta-404-secondary-link", targetHref);
      }

      function updateCountdownLabel(value) {
        setText("aleta-404-countdown-label", value);
      }

      function renderCountdown() {
        var secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
        var progress = Math.max(0, Math.min(1, remainingMs / config.redirectDelayMs));
        var ring = byId("aleta-404-progress-ring");
        if (ring) {
          ring.style.strokeDashoffset = String(config.ringCircumference * (1 - progress));
        }
        updateCountdownLabel(paused ? "Redirect dijeda" : secondsLeft + " detik");
      }

      function goToTarget() {
        window.location.replace(targetHref);
      }

      function stopCountdown() {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
      }

      function startCountdown() {
        stopCountdown();
        renderCountdown();
        intervalId = window.setInterval(function () {
          if (paused) return;
          remainingMs = Math.max(0, remainingMs - 100);
          renderCountdown();
          if (remainingMs <= 0) {
            stopCountdown();
            goToTarget();
          }
        }, 100);
      }

      function resolveAsGuestIfStillChecking() {
        if (resolved) return;
        resolved = true;
        updateTarget(false);
        startCountdown();
      }

      function bindControls() {
        var primary = byId("aleta-404-primary-action");
        if (primary) {
          primary.addEventListener("click", function () {
            goToTarget();
          });
        }

        var pause = byId("aleta-404-pause-action");
        if (pause) {
          pause.addEventListener("click", function () {
            paused = !paused;
            if (remainingMs <= 0) remainingMs = config.redirectDelayMs;
            setText("aleta-404-pause-label", paused ? "Lanjutkan Hitung Mundur" : "Tetap di Halaman Ini");
            var pauseIcon = byId("aleta-404-pause-icon");
            var resumeIcon = byId("aleta-404-resume-icon");
            if (pauseIcon) pauseIcon.style.display = paused ? "none" : "inline-block";
            if (resumeIcon) resumeIcon.style.display = paused ? "inline-block" : "none";
            renderCountdown();
          });
        }
      }

      bindControls();
      window.setTimeout(resolveAsGuestIfStillChecking, 1500);

      fetch(config.authEndpoint, {
        credentials: "include",
        cache: "no-store",
        headers: { "x-aleta-silent-loading": "1" }
      })
        .then(function (response) {
          if (!response.ok) return null;
          return response.json().catch(function () { return null; });
        })
        .then(function (payload) {
          if (resolved) return;
          resolved = true;
          updateTarget(Boolean(payload && payload.user));
          startCountdown();
        })
        .catch(resolveAsGuestIfStillChecking);
    })();
  `;
}

export default function NotFound() {
  const loginHref = apiPath("/login");

  return (
    <main className="relative isolate flex min-h-screen overflow-hidden bg-[#07131c] px-5 py-6 text-white sm:px-8">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.28),transparent_32%),radial-gradient(circle_at_85%_16%,rgba(16,185,129,0.2),transparent_28%),linear-gradient(135deg,#06111b_0%,#0b2536_48%,#10251d_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute left-1/2 top-14 -z-10 h-72 w-72 -translate-x-1/2 rounded-full border border-cyan-200/25 shadow-[0_0_90px_rgba(56,189,248,0.28)] animate-[aleta-404-pulse_4s_ease-in-out_infinite]" />

      <section className="mx-auto flex w-full max-w-6xl flex-col justify-center gap-8 py-10">
        <nav className="flex items-center justify-between gap-4">
          <AletaLogo
            title="ALETA"
            subtitle="Halaman Tidak Ditemukan"
            size="md"
            className="[&_*]:text-white [&_p:last-child]:text-slate-300 [&>div:first-child]:border-white/15 [&>div:first-child]:bg-white/10"
          />
          <div className="hidden rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 shadow-2xl backdrop-blur sm:flex">
            Tujuan aman: <span className="ml-1" id="aleta-404-target-label">Memeriksa sesi...</span>
          </div>
        </nav>

        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 shadow-[0_14px_50px_rgba(34,211,238,0.12)]">
              <Compass className="h-4 w-4 animate-[aleta-404-spin_7s_linear_infinite]" />
              Jalur aplikasi tidak ditemukan
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[1.02] tracking-normal text-white sm:text-6xl lg:text-7xl">
                404, halaman ini belum ada di ALETA.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Link yang dibuka mungkin sudah berubah, belum tersedia, atau tidak termasuk akses akun Anda.
                ALETA akan mengantar Anda kembali ke halaman yang aman dalam beberapa detik.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                id="aleta-404-primary-action"
                size="lg"
                className="h-12 rounded-2xl bg-cyan-300 px-5 font-semibold text-slate-950 shadow-[0_18px_50px_rgba(34,211,238,0.24)] hover:bg-cyan-200"
              >
                <Home className="h-4 w-4" />
                <span id="aleta-404-primary-label">Kembali ke Login</span>
              </Button>
              <Button
                id="aleta-404-pause-action"
                size="lg"
                variant="outline"
                className="h-12 rounded-2xl border-white/15 bg-white/10 px-5 text-white hover:bg-white/15 hover:text-white"
              >
                <Pause className="h-4 w-4" id="aleta-404-pause-icon" />
                <RefreshCw className="hidden h-4 w-4" id="aleta-404-resume-icon" />
                <span id="aleta-404-pause-label">Tetap di Halaman Ini</span>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="h-12 rounded-2xl text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <Link href={loginHref} id="aleta-404-secondary-link">
                  <ArrowLeft className="h-4 w-4" />
                  <span id="aleta-404-secondary-label">Buka Login ALETA</span>
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                Tidak ada data yang diubah.
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                Redirect otomatis bisa dihentikan.
              </span>
            </div>
          </div>

          <div className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center">
            <div className="absolute inset-8 rounded-full border border-white/10 bg-white/[0.06] shadow-[inset_0_0_80px_rgba(255,255,255,0.06)] backdrop-blur" />
            <div className="absolute h-[78%] w-[78%] rounded-full border border-cyan-200/20 animate-[aleta-404-orbit_12s_linear_infinite]" />
            <div className="absolute h-[58%] w-[58%] rounded-full border border-emerald-200/20 animate-[aleta-404-orbit_9s_linear_infinite_reverse]" />

            <div className="relative flex h-60 w-60 flex-col items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-center shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="5"
                />
                <circle
                  id="aleta-404-progress-ring"
                  cx="60"
                  cy="60"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgb(103,232,249)"
                  strokeLinecap="round"
                  strokeWidth="5"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset="0"
                  className="transition-[stroke-dashoffset] duration-100 ease-linear"
                />
              </svg>
              <Sparkles className="mb-3 h-7 w-7 text-cyan-200 animate-[aleta-404-float_2.4s_ease-in-out_infinite]" />
              <div className="font-serif text-7xl font-semibold leading-none text-white">404</div>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-cyan-100">
                <TimerReset className="h-4 w-4" />
                <span id="aleta-404-countdown-label">Memeriksa sesi</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <script dangerouslySetInnerHTML={{ __html: buildRedirectScript() }} />

      <style>{`
        @keyframes aleta-404-pulse {
          0%, 100% { transform: translateX(-50%) scale(0.96); opacity: 0.56; }
          50% { transform: translateX(-50%) scale(1.06); opacity: 0.9; }
        }
        @keyframes aleta-404-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes aleta-404-orbit {
          to { transform: rotate(360deg); }
        }
        @keyframes aleta-404-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
      `}</style>
    </main>
  );
}
