"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export function CallbackClient() {
  return <AuthenticateWithRedirectCallback />;
}
