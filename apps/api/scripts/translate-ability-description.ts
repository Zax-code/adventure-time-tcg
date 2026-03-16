import { translateAbilityDescriptionToFrench } from "../src/services/ability-translation-service";

async function readStdin() {
  const chunks: Buffer[] = [];
  return new Promise<string>((resolve, reject) => {
    process.stdin.on("data", (chunk: string | Buffer) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8")),
    );
    process.stdin.on("error", reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.length > 0 ? args.join(" ") : await readStdin();
  const description = input.trim();
  if (!description) {
    console.error(
      'Usage: npm run abilities:translate-description -- "<description>"',
    );
    process.exit(1);
  }

  const translated = await translateAbilityDescriptionToFrench(description);
  process.stdout.write(`${translated}\n`);
}

main().catch((error) => {
  console.error("Translation script failed:", error);
  process.exit(1);
});
