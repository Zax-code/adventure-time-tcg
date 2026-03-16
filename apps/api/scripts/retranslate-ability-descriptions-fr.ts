import { asc, eq } from "drizzle-orm";

import { db, abilityDefs } from "@adventure-time/db";

import { translateAbilityDescriptionToFrench } from "../src/services/ability-translation-service";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const abilities = await db.query.abilityDefs.findMany({
    orderBy: [asc(abilityDefs.key)],
  });

  console.log(`Found ${abilities.length} abilities to retranslate.`);

  for (let i = 0; i < abilities.length; i += 1) {
    const ability = abilities[i];
    const descriptionFr = await translateAbilityDescriptionToFrench(
      ability.description,
    );

    await db
      .update(abilityDefs)
      .set({
        descriptionFr,
        updatedAt: new Date(),
      })
      .where(eq(abilityDefs.id, ability.id));

    console.log(
      `[${i + 1}/${abilities.length}] ${ability.key} description updated`,
    );
    if (i < abilities.length - 1) {
      await sleep(650);
    }
  }
}

main().catch((error) => {
  console.error("Retranslation failed:", error);
  process.exit(1);
});
