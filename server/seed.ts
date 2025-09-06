import { db } from "./db";
import { adWeeks, sourceDocs, dealRows, scores } from "@shared/schema";
import { randomUUID } from "crypto";

async function seed() {
  console.log("🌱 Seeding database...");

  try {
    // Create a practice week
    const practiceWeek = await db.insert(adWeeks).values({
      year: 2025,
      week: 26,
      label: "2025-W26",
      start: new Date("2025-06-25"),
      end: new Date("2025-07-01"),
      status: "Scored",
    }).returning();

    const weekId = practiceWeek[0].id;
    console.log(`✅ Created practice week: ${weekId}`);

    // Create sample source documents
    const sourceDoc1 = await db.insert(sourceDocs).values({
      adWeekId: weekId,
      kind: "ad-planner",
      vendor: "Hernando",
      filename: "Hernando_Ad_Planner_W26.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byteSize: 2048576,
      storagePath: "/uploads/sample/hernando_planner.xlsx",
      hash: "abc123def456",
      pageCount: 1,
      meta: { detectedType: "Ad Planner" },
    }).returning();

    const sourceDoc2 = await db.insert(sourceDocs).values({
      adWeekId: weekId,
      kind: "meat-planner",
      vendor: "Meat Dept",
      filename: "Meat_Planner_Jun25.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      byteSize: 1024000,
      storagePath: "/uploads/sample/meat_planner.xlsx",
      hash: "def456ghi789",
      pageCount: 1,
      meta: { detectedType: "Meat Planner" },
    }).returning();

    console.log(`✅ Created ${[sourceDoc1, sourceDoc2].length} source documents`);

    // Create sample deal rows
    const sampleDeals = [
      {
        adWeekId: weekId,
        sourceDocId: sourceDoc1[0].id,
        itemCode: "12345",
        description: "COCA COLA 12PK 12OZ CANS",
        dept: "Grocery",
        upc: "1234567890123",
        cost: 3.45,
        srp: 5.99,
        adSrp: 4.99,
        vendorFundingPct: 0.15,
        mvmt: 3.2,
        competitorPrice: 5.49,
        pack: "12",
        size: "12 OZ",
        promoStart: new Date("2025-06-25"),
        promoEnd: new Date("2025-07-01"),
        sourceRef: { page: 2, yOffset: 45 },
      },
      {
        adWeekId: weekId,
        sourceDocId: sourceDoc2[0].id,
        itemCode: "67890",
        description: "RIBEYE STEAK BONELESS",
        dept: "Meat",
        upc: "9876543210987",
        cost: 8.99,
        srp: 14.99,
        adSrp: 12.99,
        vendorFundingPct: 0.10,
        mvmt: 2.5,
        competitorPrice: 13.99,
        pack: "1",
        size: "LB",
        promoStart: new Date("2025-06-25"),
        promoEnd: new Date("2025-07-01"),
        sourceRef: { page: 1, yOffset: 23 },
      },
      {
        adWeekId: weekId,
        sourceDocId: sourceDoc1[0].id,
        itemCode: "11223",
        description: "STRAWBERRIES 1LB PACKAGE",
        dept: "Produce",
        upc: "5432167890543",
        cost: 1.99,
        srp: 3.99,
        adSrp: 2.99,
        vendorFundingPct: 0.05,
        mvmt: 4.1,
        competitorPrice: 3.49,
        pack: "1",
        size: "1 LB",
        promoStart: new Date("2025-06-25"),
        promoEnd: new Date("2025-07-01"),
        sourceRef: { page: 3, yOffset: 67 },
      },
      {
        adWeekId: weekId,
        sourceDocId: sourceDoc1[0].id,
        itemCode: "44556",
        description: "ARTISAN BREAD LOAF",
        dept: "Bakery",
        upc: "6789012345678",
        cost: 1.25,
        srp: 2.99,
        adSrp: 1.99,
        vendorFundingPct: 0.20,
        mvmt: 2.8,
        competitorPrice: 2.49,
        pack: "1",
        size: "20 OZ",
        promoStart: new Date("2025-06-25"),
        promoEnd: new Date("2025-07-01"),
        sourceRef: { page: 4, yOffset: 89 },
      },
      {
        adWeekId: weekId,
        sourceDocId: sourceDoc1[0].id,
        itemCode: "78901",
        description: "CHICKEN BREAST BONELESS SKINLESS",
        dept: "Meat",
        upc: "3456789012345",
        cost: 4.99,
        srp: 7.99,
        adSrp: 6.99,
        vendorFundingPct: 0.12,
        mvmt: 3.5,
        competitorPrice: 7.49,
        pack: "1",
        size: "LB",
        promoStart: new Date("2025-06-25"),
        promoEnd: new Date("2025-07-01"),
        sourceRef: { page: 2, yOffset: 123 },
      },
    ];

    const insertedDeals = await db.insert(dealRows).values(sampleDeals).returning();
    console.log(`✅ Created ${insertedDeals.length} sample deals`);

    // Create sample scores for the deals
    const sampleScores = [
      {
        adWeekId: weekId,
        dealRowId: insertedDeals[0].id,
        itemCode: "12345",
        total: 87.5,
        components: {
          margin: 85,
          velocity: 90,
          funding: 80,
          theme: 95,
          timing: 88,
          competitive: 75,
        },
        multipliers: {
          newItem: 1.0,
          seasonal: 1.2,
          strategic: 1.0,
          historical: 1.0,
        },
        reasons: [
          "Strong margin of 30.8% exceeds department standards.",
          "High velocity multiplier of 3.2x indicates strong sales potential.",
          "Vendor funding of 15% improves profitability.",
          "Strong seasonal alignment enhances promotional effectiveness.",
        ],
      },
      {
        adWeekId: weekId,
        dealRowId: insertedDeals[1].id,
        itemCode: "67890",
        total: 76.2,
        components: {
          margin: 70,
          velocity: 75,
          funding: 60,
          theme: 50,
          timing: 88,
          competitive: 80,
        },
        multipliers: {
          newItem: 1.0,
          seasonal: 1.0,
          strategic: 1.1,
          historical: 1.0,
        },
        reasons: [
          "Good margin of 30.8% meets department requirements.",
          "Moderate velocity multiplier of 2.5x shows steady demand.",
          "Vendor funding of 10% provides acceptable support.",
        ],
      },
      {
        adWeekId: weekId,
        dealRowId: insertedDeals[2].id,
        itemCode: "11223",
        total: 82.1,
        components: {
          margin: 88,
          velocity: 85,
          funding: 40,
          theme: 90,
          timing: 88,
          competitive: 60,
        },
        multipliers: {
          newItem: 1.0,
          seasonal: 1.3,
          strategic: 1.0,
          historical: 1.0,
        },
        reasons: [
          "Excellent margin of 33.4% well above department standards.",
          "High velocity multiplier of 4.1x indicates exceptional sales potential.",
          "Strong seasonal alignment for summer produce theme.",
        ],
      },
      {
        adWeekId: weekId,
        dealRowId: insertedDeals[3].id,
        itemCode: "44556",
        total: 79.3,
        components: {
          margin: 75,
          velocity: 70,
          funding: 85,
          theme: 60,
          timing: 88,
          competitive: 50,
        },
        multipliers: {
          newItem: 1.0,
          seasonal: 1.0,
          strategic: 1.0,
          historical: 1.0,
        },
        reasons: [
          "Good margin of 37.2% exceeds bakery department standards.",
          "Vendor funding of 20% provides excellent profitability support.",
          "Moderate velocity shows steady artisan bread demand.",
        ],
      },
      {
        adWeekId: weekId,
        dealRowId: insertedDeals[4].id,
        itemCode: "78901",
        total: 84.7,
        components: {
          margin: 80,
          velocity: 88,
          funding: 65,
          theme: 70,
          timing: 88,
          competitive: 85,
        },
        multipliers: {
          newItem: 1.0,
          seasonal: 1.0,
          strategic: 1.2,
          historical: 1.0,
        },
        reasons: [
          "Strong margin of 28.6% exceeds meat department standards.",
          "High velocity multiplier of 3.5x indicates strong demand.",
          "Competitive pricing advantage drives market share.",
          "Strategic protein item with consistent performance.",
        ],
      },
    ];

    await db.insert(scores).values(sampleScores);
    console.log(`✅ Created ${sampleScores.length} sample scores`);

    console.log("🎉 Database seeded successfully!");
    console.log(`
📊 Summary:
- Practice Week: ${practiceWeek[0].label} (${practiceWeek[0].start.toDateString()} - ${practiceWeek[0].end.toDateString()})
- Source Documents: 2
- Deal Rows: ${insertedDeals.length}
- Scores: ${sampleScores.length}

🚀 Ready to demo end-to-end workflow!
    `);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };
