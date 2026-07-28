"use client";

import dynamic from "next/dynamic";
import type { AppApi } from "@/components/app/AppShell";
import type { TenantBundle } from "@/lib/types";

/**
 * Hand-built apps, one per key.
 *
 * When a tenant's `app_kind` is `custom`, `/app/[slug]` looks its
 * `custom_app_key` up here and renders that component instead of the generated
 * shell. Adding one means writing a component and adding a line below - it ships
 * with a deploy, which is the point: nothing loads operator-authored code at
 * runtime, so there is no sandbox to get wrong and no way for a bad build to
 * take down anyone else's app.
 *
 * The contract is deliberately narrow. A custom app receives the same
 * TenantBundle and the same server actions as the generic shell, so it reads and
 * writes `entries` through RLS and inherits isolation, CSV export, magic-link
 * auth and crew invites for free. A custom app must never talk to the database
 * another way.
 */

export type CustomAppProps = {
  bundle: TenantBundle;
  api: AppApi;
};

/**
 * Each entry is dynamically imported so one custom app's code never lands in
 * anybody else's bundle.
 */
export const CUSTOM_APPS: Record<
  string,
  React.ComponentType<CustomAppProps>
> = {
  "route-day": dynamic(
    () => import("./route-day/RouteDayApp").then((m) => m.RouteDayApp),
    { ssr: false },
  ),
};

export function hasCustomApp(key: string | null | undefined): boolean {
  return !!key && key in CUSTOM_APPS;
}
