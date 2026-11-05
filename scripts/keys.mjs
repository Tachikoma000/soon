// Prints fresh secrets for your environment variables.
// Run with: npm run keys

import { randomBytes } from "node:crypto";
import webpush from "web-push";

const vapid = webpush.generateVAPIDKeys();
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
console.log(`TOKEN_KEY=${randomBytes(32).toString("base64")}`);
console.log(`VAPID_PUBLIC_KEY=${vapid.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapid.privateKey}`);
