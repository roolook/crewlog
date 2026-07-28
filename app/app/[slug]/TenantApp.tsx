"use client";

import { AppShell, type AppApi } from "@/components/app/AppShell";
import { CUSTOM_APPS } from "@/app/custom/registry";
import { UploadedHtmlApp } from "@/components/app/UploadedHtmlApp";
import type { FieldValue, TenantBundle } from "@/lib/types";
import {
  createEntryAction,
  deleteEntryAction,
  inviteMemberAction,
  removeMemberAction,
  updateEntryAction,
} from "./actions";

/**
 * Binds this tenant's server actions to whichever app it runs.
 *
 * A `custom` tenant renders its hand-built component from the registry; anything
 * else - including a custom tenant whose key isn't in the registry, which can
 * happen between setting the key and shipping the code - falls back to the
 * generated shell. Failing back to a working generic app beats showing nothing.
 *
 * Both paths get the identical `api`, so a custom app cannot reach the database
 * any way the generic shell can't.
 */
export function TenantApp({ bundle }: { bundle: TenantBundle }) {
  const slug = bundle.tenant.slug;

  const api: AppApi = {
    createEntry: (values: Record<string, FieldValue>) =>
      createEntryAction(slug, values),
    updateEntry: (id: string, values: Record<string, FieldValue>) =>
      updateEntryAction(slug, id, values),
    deleteEntry: (id: string) => deleteEntryAction(slug, id),
    inviteMember: (contact: string) => inviteMemberAction(slug, contact),
    removeMember: (id: string) => removeMemberAction(slug, id),
  };

  const key = bundle.tenant.custom_app_key;
  const Custom =
    bundle.tenant.app_kind === "custom" && key ? CUSTOM_APPS[key] : undefined;

  if (
    bundle.tenant.app_kind === "custom" &&
    bundle.tenant.custom_app_key === "uploaded-html" &&
    bundle.customHtml
  ) {
    return <UploadedHtmlApp bundle={bundle} api={api} />;
  }

  if (Custom) return <Custom bundle={bundle} api={api} />;

  return <AppShell bundle={bundle} api={api} />;
}
