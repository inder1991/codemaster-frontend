"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type JSX, type ReactNode } from "react";

import { DarkModeProvider } from "@/components/ui/dark-mode-provider";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }): JSX.Element {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <DarkModeProvider>
        <ToastProvider>{children}</ToastProvider>
      </DarkModeProvider>
    </QueryClientProvider>
  );
}
