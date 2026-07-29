import type { FieldType } from "@/lib/types";

/**
 * The things customers can ask for, as a pick-list.
 *
 * A blank "anything else?" box gets you "idk, just make it work". A short list
 * of concrete capabilities gets you a spec - people recognise what they need
 * faster than they can describe it.
 *
 * `field` links a capability to the field type that implements it, so a ticked
 * box on the intake form becomes a suggestion on the build screen rather than
 * something the operator has to translate by hand. Capabilities without a field
 * are real asks that need a person to think, not a column setting.
 */
export type Capability = {
  id: string;
  /** What the customer sees. Their words, not ours. */
  label: string;
  /** The concrete promise, so nobody ticks a box hoping. */
  detail: string;
  group: "Capture" | "Workflow" | "Output" | "Other";
  availability: "standard" | "custom" | "confirm";
  /** Field type that delivers it, when one does. */
  field?: FieldType;
};

export const CAPABILITIES: Capability[] = [
  {
    id: "location",
    label: "Pin it on a map",
    detail: "Tap the location field, drop a pin where it actually is.",
    group: "Capture",
    availability: "standard",
    field: "location",
  },
  {
    id: "photo",
    label: "Photos on an entry",
    detail: "Snap a picture from the phone and it stays attached.",
    group: "Capture",
    availability: "standard",
    field: "photo",
  },
  {
    id: "signature",
    label: "Signatures",
    detail: "Customer signs on the screen with a finger.",
    group: "Capture",
    availability: "standard",
    field: "signature",
  },
  {
    id: "barcode",
    label: "Scan barcodes or QR",
    detail: "Point the camera instead of typing a serial number.",
    group: "Capture",
    availability: "standard",
    field: "barcode",
  },
  {
    id: "money",
    label: "Prices and totals",
    detail: "Money fields that add up - quotes, invoices, job costs.",
    group: "Workflow",
    availability: "standard",
    field: "currency",
  },
  {
    id: "rating",
    label: "Pass / fail or a score",
    detail: "For inspections and checklists.",
    group: "Workflow",
    availability: "standard",
    field: "rating",
  },
  {
    id: "reminders",
    label: "Reminders on due dates",
    detail: "Nudge someone when a date is coming up.",
    group: "Workflow",
    availability: "confirm",
  },
  {
    id: "offline",
    label: "Works with no signal",
    detail: "Log it in a basement, it syncs when the phone reconnects.",
    group: "Workflow",
    availability: "standard",
  },
  {
    id: "print",
    label: "Print or send a PDF",
    detail: "A clean sheet to hand over or email out.",
    group: "Output",
    availability: "custom",
  },
  {
    id: "something_else",
    label: "Something else entirely",
    detail:
      "Describe any feature, workflow, integration, calculation, screen or behavior.",
    group: "Other",
    availability: "confirm",
  },
];

export function capabilityById(id: string): Capability | undefined {
  return CAPABILITIES.find((cap) => cap.id === id);
}

/** The field type a ticked capability implies, for the build screen. */
export function suggestedFieldType(id: string): FieldType | undefined {
  return capabilityById(id)?.field;
}

/**
 * The two questions on the intake form.
 *
 * Deliberately specific. "Anything we should know?" gets a shrug; asking what
 * their team should be able to do on a phone gets an actual answer, because it
 * is a question they have already been asking themselves.
 */
export const INTAKE_PROMPTS = [
  {
    id: "who_uses_it",
    label: "Who will use this app?",
    optional: true,
    placeholder:
      "e.g. six technicians in the field and our dispatcher in the office",
  },
  {
    id: "main_job",
    label: "What is the main thing they need to do?",
    optional: false,
    placeholder:
      "e.g. see today's jobs, mark one done, and photograph the meter",
  },
  {
    id: "what_wastes_time",
    label: "What wastes the most time or causes mistakes today?",
    optional: false,
    placeholder:
      "e.g. I retype everything off paper every evening, and half of it is unreadable",
  },
] as const;
