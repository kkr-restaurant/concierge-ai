// Run once per user: node scripts/enroll-mfa.mjs
//
// Usage:
//   npm install @supabase/supabase-js
//   node scripts/enroll-mfa.mjs you@example.com your-password
//
// Prints a QR-code URL (paste into your browser to see the QR, or paste the
// otpauth:// URI directly into an authenticator app that supports manual
// entry) and then prompts for the 6-digit code to finish enrollment.

import { createClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";

const SUPABASE_URL = "https://cpipjhbujhxqknkkvqnn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwaXBqaGJ1amh4cWtua2t2cW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MzQ5MTYsImV4cCI6MjEwNjAxMDkxNn0.eX9SbLhfPSMcPMQSKmcPze9MIm2jQwU39rBycWknv90";

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/enroll-mfa.mjs <email> <password>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error("Sign-in failed:", signInError.message);
  process.exit(1);
}

const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
  factorType: "totp"
});
if (enrollError) {
  console.error("Enroll failed:", enrollError.message);
  process.exit(1);
}

console.log("\nScan this in your authenticator app (or open the QR URL in a browser):");
console.log(enrollData.totp.qr_code ? "[QR SVG returned — see uri below for manual entry]" : "");
console.log("\nManual entry URI:\n" + enrollData.totp.uri + "\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await rl.question("Enter the 6-digit code from your app to confirm: ");
rl.close();

const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
  factorId: enrollData.id
});
if (challengeError) {
  console.error("Challenge failed:", challengeError.message);
  process.exit(1);
}

const { error: verifyError } = await supabase.auth.mfa.verify({
  factorId: enrollData.id,
  challengeId: challenge.id,
  code
});

if (verifyError) {
  console.error("Verify failed:", verifyError.message);
  process.exit(1);
}

console.log("\nMFA enrolled successfully. This account can now sign in at /platform/login.");
