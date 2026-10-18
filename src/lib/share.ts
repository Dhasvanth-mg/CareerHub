import { createHash, randomBytes } from "node:crypto";

export const EXPIRY_DAYS = [7, 14, 30, 90] as const;
export const DEFAULT_EXPIRY_DAYS = 14;

/** 256 bits of randomness, URL-safe. Anyone with the link can read the summary, so it must be unguessable. */
export const newShareToken = () => randomBytes(32).toString("base64url");

/** Matches `encode(sha256(convert_to(token, 'utf8')), 'hex')` in the database function. Only this hash is stored. */
export const hashShareToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export type SharedProgress = {
  label: string;
  owner: string | null;
  expires_at: string;
  include_interviews: boolean;
  applications: {
    company: string;
    title: string;
    stage: string;
    location: string | null;
    applied_on: string | null;
    deadline: string | null;
    updated_at: string;
  }[];
  interviews: { company: string; round_type: string; scheduled_at: string; status: string }[];
};
