// Probe: try a single upload + text_to_image with reference to surface the
// actual SDK error (the "Connection error" wrapper hides the cause).

import RunwayML from "@runwayml/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.RUNWAYML_API_SECRET) {
  console.error("RUNWAYML_API_SECRET not set.");
  process.exit(1);
}

const client = new RunwayML();

const galleryPath = path.join(__dirname, "..", "public", "directors", "marcel-vrai.png");
console.log("File path:", galleryPath);
console.log("File exists:", fs.existsSync(galleryPath));
console.log("File size:", fs.statSync(galleryPath).size, "bytes");

console.log("\n--- Test 1: upload via fs.createReadStream ---");
try {
  const stream = fs.createReadStream(galleryPath);
  const upload = await client.uploads.createEphemeral({ file: stream });
  console.log("OK upload result:", JSON.stringify(upload, null, 2));
} catch (err) {
  console.log("FAIL message:", err?.message);
  console.log("FAIL name:", err?.name);
  console.log("FAIL cause:", err?.cause);
  console.log("FAIL status:", err?.status);
  console.log("FAIL stack:", err?.stack?.split("\n").slice(0, 8).join("\n"));
  if (err?.cause) {
    console.log("CAUSE message:", err.cause?.message);
    console.log("CAUSE code:", err.cause?.code);
    console.log("CAUSE stack:", err.cause?.stack?.split("\n").slice(0, 8).join("\n"));
  }
}

console.log("\n--- Test 2: upload via Blob from buffer ---");
try {
  const buf = fs.readFileSync(galleryPath);
  const blob = new Blob([buf], { type: "image/png" });
  const upload = await client.uploads.createEphemeral({ file: blob });
  console.log("OK upload result:", JSON.stringify(upload, null, 2));
} catch (err) {
  console.log("FAIL message:", err?.message);
  console.log("FAIL cause:", err?.cause?.message);
  console.log("FAIL stack:", err?.stack?.split("\n").slice(0, 8).join("\n"));
}

console.log("\n--- Test 3: upload via native File ---");
try {
  const buf = fs.readFileSync(galleryPath);
  const file = new File([buf], "marcel-vrai.png", { type: "image/png" });
  const upload = await client.uploads.createEphemeral({ file });
  console.log("OK upload result:", JSON.stringify(upload, null, 2));
} catch (err) {
  console.log("FAIL message:", err?.message);
  console.log("FAIL cause:", err?.cause?.message);
  console.log("FAIL stack:", err?.stack?.split("\n").slice(0, 8).join("\n"));
}
