import { asc, or, eq, isNull } from "drizzle-orm";

import { db, abilityDefs } from "@adventure-time/db";

import { translateAbilityToFrench } from "../src/services/ability-translation-service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const abilities = await db.query.abilityDefs.findMany({
    where: or(
      isNull(abilityDefs.nameFr),
      eq(abilityDefs.nameFr, ""),
      isNull(abilityDefs.descriptionFr),
      eq(abilityDefs.descriptionFr, ""),
    ),
    orderBy: [asc(abilityDefs.key)],
  });

  console.log(`Found ${abilities.length} abilities to backfill.`);

  for (let i = 0; i < abilities.length; i += 1) {
    const ability = abilities[i];
    const translated = await translateAbilityToFrench({
      name: ability.name,
      description: ability.description,
    });

    await db
      .update(abilityDefs)
      .set({
        nameFr: translated.nameFr,
        descriptionFr: translated.descriptionFr,
        updatedAt: new Date(),
      })
      .where(eq(abilityDefs.id, ability.id));

    console.log(`[${i + 1}/${abilities.length}] ${ability.key} updated`);
    if (i < abilities.length - 1) {
      await sleep(650);
    }
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
