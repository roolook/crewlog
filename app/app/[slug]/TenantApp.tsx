"use client";

import { AppShell, type AppApi } from "@/components/app/AppShell";
import type { TenantBundle } from "@/lib/types";
import {
  createEntryAction,
  deleteEntryAction,
  inviteMemberAction,
  removeMemberAction,
  updateEntryAction,
} from "./actions";

/** Binds the shared app shell to this tenant's server actions. */
export function TenantApp({ bundle }: { bundle: TenantBundle }) {
  const slug = bundle.tenant.slug;

  const api: AppApi = {
    createEntry: (values) => createEntryAction(slug, values),
    updateEntry: (id, values) => updateEntryAction(slug, id, values),
    deleteEntry: (id) => deleteEntryAction(slug, id),
    inviteMember: (contact) => inviteMemberAction(slug, contact),
    removeMember: (id) => removeMemberAction(slug, id),
  };

  return <AppShell bundle={bundle} api={api} />;
}
