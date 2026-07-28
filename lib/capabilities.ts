import type { FieldType } from "@/lib/types";

/**
 * The things customers can ask for, as a pick-list.
 *
 * A blank "anything else?" box gets you "idk, just make it work". A short list
 * of concrete capabilities gets you a spec — people recognise what they need
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
  /** Field type that delivers it, when one does. */
  field?: FieldType;
};

export const CAPABILITIES: Capability[] = [
  {
    id: "location",
    label: "Pin it on a map",
    detail: "Tap the location field, drop a pin where it actually is.",
    field: "location",
  },
  {
    id: "photo",
    label: "Photos on an entry",
    detail: "Snap a picture from the phone and it stays attached.",
    field: "photo",
  },
  {
    id: "signature",
    label: "Signatures",
    detail: "Customer signs on the screen with a finger.",
    field: "signature",
  },
  {
    id: "barcode",
    label: "Scan barcodes or QR",
    detail: "Point the camera instead of typing a serial number.",
    field: "barcode",
  },
  {
    id: "money",
    label: "Prices and totals",
    detail: "Money fields that add up — quotes, invoices, job costs.",
    field: "currency",
  },
  {
    id: "rating",
    label: "Pass / fail or a score",
    detail: "For inspections and checklists.",
    field: "rating",
  },
  {
    id: "reminders",
    label: "Reminders on due dates",
    detail: "Nudge someone when a date is coming up.",
  },
  {
    id: "offline",
    label: "Works with no signal",
    detail: "Log it in a basement, it syncs when the phone reconnects.",
  },
  {
    id: "print",
    label: "Print or send a PDF",
    detail: "A clean sheet to hand over or email out.",
  },
  {
    id: "something_else",
    label: "Something else entirely",
    detail: "Describe it below — we'll tell you yes or no in 48 hours.",
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
    id: "what_it_should_do",
    label: "What should your team be able to do on their phone?",
    placeholder:
      "e.g. see today's jobs, mark one done, photograph the meter before they leave",
  },
  {
    id: "what_wastes_time",
    label: "What part of this wastes the most time right now?",
    placeholder:
      "e.g. I retype everything off paper every evening, and half of it is unreadable",
  },
] as const;
