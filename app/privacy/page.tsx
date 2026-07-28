import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "CrewLog — privacy",
  description: "What we collect, what we don't, and how to get it all back.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage
        title="Privacy"
        updated="July 2026"
        sections={[
          {
            h: "What we hold",
            p: [
              "The spreadsheet you send us, the entries your team logs, and the names, emails and phone numbers you give us so people can sign in and get notified. That's it. No tracking pixels, no ad networks, no analytics vendors watching your team work.",
            ],
          },
          {
            h: "Isolation",
            p: [
              "Every company's data is separated at the database level by row-level security, not by application code remembering to filter. A query made on behalf of your team cannot return another company's rows even if we wrote a bug.",
            ],
          },
          {
            h: "Who can see it",
            p: [
              "The people you invite, and the one operator who builds and maintains your app. Nobody else. We do not sell, share, or train anything on your data.",
            ],
          },
          {
            h: "Getting it back",
            p: [
              "Any owner can export a full CSV from Settings, any time, without asking us. If you cancel, you get a complete export within a day, and we delete your data within 30 days of the request.",
            ],
          },
          {
            h: "Deleted entries",
            p: [
              "Deleting an entry in the app hides it immediately and keeps it recoverable by the owner for 30 days, then it's gone. This is on purpose: crews delete things by accident on small screens.",
            ],
          },
          {
            h: "Sub-processors",
            p: [
              "Supabase hosts the database, authentication and file storage. Vercel serves the site. If email delivery is enabled, a mail provider handles the five transactional emails. Payment details, when payments are enabled, are handled entirely by Stripe — they never touch our servers.",
            ],
          },
          {
            h: "Reaching a person",
            p: [
              "Email build@crewlog.app. The same person who built your app reads it.",
            ],
          },
        ]}
      />
      <SiteFooter />
    </>
  );
}
