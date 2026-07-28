# CrewLog launch checklist

## Required before charging anyone

1. Apply every Supabase migration to the production project.
   - Sign in with `supabase login`.
   - Link this repository with `supabase link --project-ref znirkfgqyuaoqrkslvix`.
   - Preview changes with `supabase db push --dry-run`.
   - Apply them with `supabase db push`.
   - Never run `supabase db reset --linked` against production.
2. Create one Stripe product called CrewLog.
3. Add a recurring monthly price of $10. Do not add the waived setup fee as a
   Stripe line item.
4. Create a Payment Link using only that recurring monthly price.
5. Put the Payment Link URL in the Vercel Production variable
   `STRIPE_PAYMENT_LINK`.
6. Create a Stripe webhook endpoint at
   `https://crewlog-one.vercel.app/api/stripe`.
7. Subscribe it to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
8. Put its signing secret in the Vercel Production variable
   `STRIPE_WEBHOOK_SECRET`.
9. Redeploy after changing Vercel environment variables.
10. Complete one Stripe test-mode activation and confirm:
    - $0 setup is shown.
    - $10 is charged immediately.
    - the subscription renews monthly from activation day.
    - the tenant changes to active.
    - the activation receipt says $10 charged today.
    - billing status, Stripe IDs and billing period appear under the tenant.

## Required for customer email

1. Verify a sending domain in Resend.
2. Set `RESEND_API_KEY`, `EMAIL_FROM_BUILD`, `EMAIL_FROM_LOG` and
   `EMAIL_REPLY_TO` in Vercel Production.
3. Remove `EMAIL_TEST_INBOX` only after a real test reaches you.
4. Send every template from `/ops/emails` to yourself and inspect it on mobile.

## Required for a safe customer API

1. Create keys only from `/ops/tenants/[id]`.
2. Copy a new key once and deliver it through a secure channel.
3. Give each integration its own key so it can be revoked independently.
4. Start with 60 calls per minute. Raise it only when observed usage needs it.
5. Never give customers Supabase, Clerk, Stripe or Vercel credentials.
6. Test the tenant endpoint:

```bash
curl -H "Authorization: Bearer TENANT_KEY" \
  https://crewlog-one.vercel.app/api/v1/TENANT_SLUG/entries
```

## Before the first paid customer

1. Use Stripe test mode for the full purchase, webhook and cancellation flow.
2. Confirm Clerk Google and email sign-in on a fresh phone.
3. Confirm owner, crew and operator access are isolated.
4. Test an app with a large sheet, photos, a failed upload and a revoked API key.
5. Add error monitoring and a support inbox you check daily.
6. Publish a privacy policy, terms, refund policy and support contact that match
   how the product actually operates.
7. Confirm export and deletion requests work before promising them.
8. Keep the first customers concierge-managed. Review their usage and failed
   actions manually before automating plan enforcement.
