"use client";

import { createAuthClient } from "better-auth/react";

// Dengan mengosongkan baseURL, Better Auth akan otomatis menggunakan URL relatif
// `/api/auth` dari origin yang sedang dikunjungi browser (baik localhost, 127.0.0.1, atau IP).
export const authClient = createAuthClient();
