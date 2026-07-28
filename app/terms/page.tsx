import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "CrewLog — terms",
  description: "The deal, written out.",
};

const SETUP = process.env.NEXT_PUBLIC_SETUP_FEE ?? "99";
const MONTHLY = process.env.NEXT_PUBLIC_MONTHLY_FEE ?? "10";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage
        title="Terms"
        updated="July 2026"
        sections={[
          {
            h: "What we do",
            p: [
              "You send a spreadsheet. A person turns it into a phone app with your data in it and sends you a link within 48 hours of confirming your spot. The preview is free and has no time limit on your own use of it.",
            ],
          },
          {
            h: "What it costs",
            p: [
              `$${SETUP} once to set up, then $${MONTHLY} a month. Flat — no per-seat pricing, however many people you add. 25 GB of storage is included; more is $${MONTHLY} a month per additional 25 GB, and we'll tell you before it matters.`,
              "If the preview isn't right, you owe nothing. If we miss 48 hours from confirming your spot, setup is free.",
            ],
          },
          {
            h: "Changes",
            p: [
              "Reply to any email from us to request a change — a new column, a renamed dropdown, a second log. We aim to have it done within a day. Requests that amount to a different product may need a new setup fee; we'll say so before doing the work.",
            ],
          },
          {
            h: "Cancelling",
            p: [
              "Cancel any time, no notice period. You get a full CSV export within a day. We keep your data for 30 days in case you change your mind, then delete it.",
            ],
          },
          {
            h: "Your data is yours",
            p: [
              "You own everything you put in. We claim no licence to it beyond what's needed to run the app for you. You can export it yourself from Settings at any moment without asking.",
            ],
          },
          {
            h: "What you agree to",
            p: [
              "Don't use CrewLog to store data you have no right to hold, and don't use it to break the law. Keep your sign-in links to yourself — anyone holding a valid link can read your log.",
            ],
          },
          {
            h: "Availability",
            p: [
              "We aim to keep the app up and reachable, and we run on Supabase and Vercel to that end. This is a small operation, not an enterprise vendor: there's no uptime SLA, and the honest remedy for a bad month is that you cancel and take your CSV.",
            ],
          },
          {
            h: "Liability",
            p: [
              `To the extent the law allows, our liability is capped at what you've paid us in the previous twelve months. We can't be responsible for losses that follow from a wrong entry in a log — the app records what your team types.`,
            ],
          },
          {
            h: "Reaching a person",
            p: ["build@crewlog.app. Same person who built your app."],
          },
        ]}
      />
      <SiteFooter />
    </>
  );
}
