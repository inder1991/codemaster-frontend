import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "codemaster",
  description:
    "codemaster admin console: review traceability + platform operations.",
};

// Runs before React hydrates; reads the persisted theme and sets the
// `dark` class on <html> so the user never sees a flash of the wrong
// theme on navigation or full reload.
//
// SYMMETRIC: explicitly REMOVES the class when storage is not
// "dark", so a stale `dark` class from any prior path (older
// prelude version, dev-tools, browser extension) is cleared on
// every reload instead of sticking forever.
const THEME_PRELUDE = `
(function () {
  try {
    var root = document.documentElement;
    var stored = window.localStorage.getItem("codemaster-admin:theme");
    if (stored === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_PRELUDE }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
