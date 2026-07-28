"use client";

import { useEffect, useRef } from "react";
import { customHtmlDocument } from "@/lib/custom-html";
import { supabaseBrowser } from "@/lib/supabase/client";
import { displayValue, hasValue } from "@/lib/fields";
import { statusField, titleField } from "@/lib/schema";
import type { AppApi } from "@/components/app/AppShell";
import type { Entry, FieldValue, Member, TenantBundle } from "@/lib/types";

type BridgeMessage = {
  source?: string;
  id?: string;
  method?: string;
  args?: unknown[];
};

export function UploadedHtmlApp({
  bundle,
  api = {},
}: {
  bundle: TenantBundle;
  api?: AppApi;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const entriesRef = useRef(bundle.entries);
  const membersRef = useRef(bundle.members);

  useEffect(() => {
    async function receive(event: MessageEvent<BridgeMessage>) {
      if (event.source !== frame.current?.contentWindow) return;
      const message = event.data;
      if (message?.source !== "crewlog-app" || !message.id || !message.method) return;
      const reply = (ok: boolean, value: unknown) =>
        frame.current?.contentWindow?.postMessage(
          {
            source: "crewlog-host",
            id: message.id,
            ok,
            ...(ok ? { result: value } : { error: String(value) }),
          },
          "*",
        );
      try {
        const args = message.args ?? [];
        switch (message.method) {
          case "getContext":
            reply(true, {
              tenant: {
                id: bundle.tenant.id,
                slug: bundle.tenant.slug,
                name: bundle.tenant.name,
                logLabel: bundle.tenant.log_label,
                status: bundle.tenant.status,
              },
              fields: bundle.fields,
              viewer: { role: bundle.viewerRole, name: bundle.viewerName },
            });
            return;
          case "listEntries":
            reply(true, entriesRef.current);
            return;
          case "createEntry": {
            const values = (args[0] ?? {}) as Record<string, FieldValue>;
            const row = api.createEntry
              ? await api.createEntry(values)
              : localCreateEntry(bundle, entriesRef.current, values);
            entriesRef.current = [row, ...entriesRef.current];
            reply(true, row);
            return;
          }
          case "updateEntry": {
            const id = String(args[0] ?? "");
            const values = (args[1] ?? {}) as Record<string, FieldValue>;
            const row = api.updateEntry
              ? await api.updateEntry(id, values)
              : localUpdateEntry(bundle, entriesRef.current, id, values);
            entriesRef.current = entriesRef.current.map((entry) =>
              entry.id === row.id ? row : entry,
            );
            reply(true, row);
            return;
          }
          case "deleteEntry": {
            const id = String(args[0] ?? "");
            if (api.deleteEntry) await api.deleteEntry(id);
            entriesRef.current = entriesRef.current.filter((entry) => entry.id !== id);
            reply(true, null);
            return;
          }
          case "listMembers":
            reply(true, membersRef.current);
            return;
          case "inviteMember": {
            const contact = String(args[0] ?? "");
            const member = api.inviteMember
              ? await api.inviteMember(contact)
              : localInviteMember(bundle, contact);
            membersRef.current = [...membersRef.current, member];
            reply(true, member);
            return;
          }
          case "removeMember": {
            const id = String(args[0] ?? "");
            if (api.removeMember) await api.removeMember(id);
            membersRef.current = membersRef.current.filter((member) => member.id !== id);
            reply(true, null);
            return;
          }
          case "uploadFile": {
            if (!api.createEntry) {
              throw new Error("Uploads are disabled in this preview.");
            }
            const fieldKey = String(args[0] ?? "");
            const file = args[1];
            const field = bundle.fields.find(
              (candidate) =>
                candidate.key === fieldKey &&
                (candidate.type === "photo" || candidate.type === "signature"),
            );
            if (!field) throw new Error("Choose a photo or signature field.");
            if (!(file instanceof File) || !file.type.startsWith("image/")) {
              throw new Error("Choose an image file.");
            }
            if (file.size > 10 * 1024 * 1024) {
              throw new Error("Images must be smaller than 10 MB.");
            }
            const extension =
              (file.name.split(".").pop() ?? "jpg")
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")
                .slice(0, 5) || "jpg";
            const path =
              `${bundle.tenant.id}/${fieldKey}/${crypto.randomUUID()}.${extension}`;
            const { error } = await supabaseBrowser()
              .storage.from("entry-photos")
              .upload(path, file, { contentType: file.type });
            if (error) throw new Error(error.message);
            reply(true, { path });
            return;
          }
          case "getFileUrl": {
            const path = String(args[0] ?? "");
            if (!path.startsWith(`${bundle.tenant.id}/`) || path.includes("..")) {
              throw new Error("That file is outside this tenant.");
            }
            const { data, error } = await supabaseBrowser()
              .storage.from("entry-photos")
              .createSignedUrl(path, 3600);
            if (error || !data?.signedUrl) {
              throw new Error(error?.message ?? "The file could not be opened.");
            }
            reply(true, { url: data.signedUrl, expiresIn: 3600 });
            return;
          }
          case "getCurrentLocation": {
            const location = await currentLocation();
            reply(true, location);
            return;
          }
          default:
            throw new Error(`Unknown CrewLog method: ${message.method}`);
        }
      } catch (error) {
        reply(false, error instanceof Error ? error.message : "CrewLog request failed.");
      }
    }
    window.addEventListener("message", receive);
    frame.current?.contentWindow?.postMessage(
      { source: "crewlog-host", type: "ready" },
      "*",
    );
    return () => window.removeEventListener("message", receive);
  }, [api, bundle]);

  return (
    <iframe
      ref={frame}
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { source: "crewlog-host", type: "ready" },
          "*",
        )
      }
      title={`${bundle.tenant.name} custom app`}
      sandbox="allow-scripts"
      srcDoc={customHtmlDocument(bundle.customHtml ?? "")}
      style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff" }}
    />
  );
}

function localCreateEntry(
  bundle: TenantBundle,
  entries: Entry[],
  values: Record<string, FieldValue>,
) {
  validateLocalValues(bundle, values);
  const now = new Date().toISOString();
  const row: Entry = {
    id: `preview-${crypto.randomUUID()}`,
    tenant_id: bundle.tenant.id,
    entry_no: Math.max(0, ...entries.map((entry) => entry.entry_no)) + 1,
    data: values,
    ...localDerived(bundle, values),
    created_by: null,
    created_by_name: bundle.viewerName,
    occurred_on: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };
  return row;
}

function localUpdateEntry(
  bundle: TenantBundle,
  entries: Entry[],
  id: string,
  values: Record<string, FieldValue>,
) {
  validateLocalValues(bundle, values);
  const current = entries.find((entry) => entry.id === id);
  if (!current) throw new Error("That action item is no longer available.");
  return {
    ...current,
    data: values,
    ...localDerived(bundle, values),
    updated_at: new Date().toISOString(),
  };
}

function localDerived(bundle: TenantBundle, values: Record<string, FieldValue>) {
  const title = titleField(bundle.fields);
  const status = statusField(bundle.fields);
  return {
    title: title ? displayValue(title.type, values[title.key] ?? null).slice(0, 300) : "",
    status_value: status
      ? displayValue(status.type, values[status.key] ?? null) || null
      : null,
  };
}

function validateLocalValues(
  bundle: TenantBundle,
  values: Record<string, FieldValue>,
) {
  const missing = bundle.fields.filter(
    (field) => field.required && !hasValue(field.type, values[field.key] ?? null),
  );
  if (missing.length) {
    throw new Error(`${missing.map((field) => field.label).join(", ")} still needed.`);
  }
}

function localInviteMember(bundle: TenantBundle, contact: string): Member {
  const value = contact.trim();
  if (!value) throw new Error("Use an email address or phone number.");
  const email = value.includes("@") ? value.toLowerCase() : null;
  return {
    id: `preview-${crypto.randomUUID()}`,
    tenant_id: bundle.tenant.id,
    user_id: null,
    display_name: email ? email.split("@")[0] : value,
    email,
    phone: email ? null : value,
    role: "crew",
    status: "pending",
    invite_token: null,
    last_log_at: null,
    joined_at: null,
  };
}

function currentLocation() {
  return new Promise<{ lat: number; lng: number; accuracy: number }>(
    (resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not available on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        () => reject(new Error("Location permission was denied.")),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    },
  );
}
