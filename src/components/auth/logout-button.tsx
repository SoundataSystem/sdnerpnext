"use client";

import { useAction } from "next-safe-action/hooks";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth-actions";

export function LogoutButton() {
  const { execute, isPending } = useAction(logoutAction);

  return (
    <button
      type="button"
      onClick={() => execute(undefined)}
      disabled={isPending}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <LogOut className="h-3.5 w-3.5" />
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}