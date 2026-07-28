"use client";

import { useEffect, useRef, useState } from "react";
import { customHtmlDocument } from "@/lib/custom-html";
import { supabaseBrowser } from "@/lib/supabase/client";
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
  const [entries, setEntries] = useState(bundle.entries);
  const [members, setMembers] = useState(bundle.members);

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
            reply(true, entries);
            return;
          case "createEntry": {
            if (!api.createEntry) throw new Error("Writes are disabled in this preview.");
            const row = await api.createEntry((args[0] ?? {}) as Record<string, FieldValue>);
            setEntries((current) => [row, ...current]);
            reply(true, row);
            return;
          }
          case "updateEntry": {
            if (!api.updateEntry) throw new Error("Writes are disabled in this preview.");
            const row = await api.updateEntry(
              String(args[0] ?? ""),
              (args[1] ?? {}) as Record<string, FieldValue>,
            );
            setEntries((current) => current.map((entry) => entry.id === row.id ? row : entry));
            reply(true, row);
            return;
          }
          case "deleteEntry": {
            if (!api.deleteEntry) throw new Error("Writes are disabled in this preview.");
            const id = String(args[0] ?? "");
            await api.deleteEntry(id);
            setEntries((current) => current.filter((entry) => entry.id !== id));
            reply(true, null);
            return;
          }
          case "listMembers":
            reply(true, members);
            return;
          case "inviteMember": {
            if (!api.inviteMember) throw new Error("Invites are disabled in this preview.");
            const member = await api.inviteMember(String(args[0] ?? ""));
            setMembers((current) => [...current, member]);
            reply(true, member);
            return;
          }
          case "removeMember": {
            if (!api.removeMember) throw new Error("Member changes are disabled in this preview.");
            const id = String(args[0] ?? "");
            await api.removeMember(id);
            setMembers((current) => current.filter((member) => member.id !== id));
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
  }, [api, bundle, entries, members]);

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
