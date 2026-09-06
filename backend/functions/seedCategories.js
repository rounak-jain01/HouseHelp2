const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const categories = [
  {
    id: "cleaning",
    name: "Cleaning",
    ratePerHour: 99,
    isActive: true,
  },
  {
    id: "cooking",
    name: "Cooking",
    ratePerHour: 99,
    isActive: true,
  },
  {
    id: "laundry",
    name: "Laundry",
    ratePerHour: 99,
    isActive: true,
  },
  {
    id: "dishwashing",
    name: "Dishwashing",
    ratePerHour: 99,
    isActive: true,
  },
];

async function seedCategories() {
  try {
    const batch = db.batch();

    categories.forEach((category) => {
      const ref = db.collection("categories").doc(category.id);

      batch.set(ref, {
        name: category.name,
        ratePerHour: category.ratePerHour,
        isActive: category.isActive,
      });
    });

    await batch.commit();

    console.log("✅ Categories seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Category seed failed:", error);
    process.exit(1);
  }
}

seedCategories();