const { connectDatabase, disconnectDatabase } = require("../config/database");
const User = require("../models/User");
const { ROLES, LAWYER_VERIFICATION } = require("../constants");

async function upsertUser(data) {
  const existing = await User.findOne({ email: data.email });
  if (existing) return existing;
  return User.create(data);
}

async function seed() {
  await connectDatabase();

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.startsWith("CHANGE_ME")) {
    throw new Error("Set SEED_ADMIN_EMAIL and a strong SEED_ADMIN_PASSWORD before seeding");
  }

  await upsertUser({
    name: "LegalSphere Administrator",
    email: adminEmail.toLowerCase(),
    passwordHash: adminPassword,
    role: ROLES.ADMIN,
    emailVerified: true
  });

  if (process.env.SEED_DEMO_DATA === "true") {
    const demoPassword = process.env.SEED_DEMO_PASSWORD;
    if (!demoPassword) throw new Error("SEED_DEMO_PASSWORD is required for demo data");

    const lawyers = [
      {
        name: "Ayesha Khan",
        email: "ayesha.lawyer@example.test",
        city: "Lahore",
        specialization: "Family Law",
        experienceYears: 9,
        hourlyRate: 120
      },
      {
        name: "Hamza Ali",
        email: "hamza.lawyer@example.test",
        city: "Islamabad",
        specialization: "Corporate Law",
        experienceYears: 12,
        hourlyRate: 180
      }
    ];

    for (const lawyer of lawyers) {
      await upsertUser({
        name: lawyer.name,
        email: lawyer.email,
        passwordHash: demoPassword,
        role: ROLES.LAWYER,
        emailVerified: true,
        city: lawyer.city,
        lawyerProfile: {
          licenseNumber: `DEMO-${lawyer.experienceYears}`,
          specialization: lawyer.specialization,
          experienceYears: lawyer.experienceYears,
          hourlyRate: lawyer.hourlyRate,
          bio: "Demo lawyer profile for local development.",
          verificationStatus: LAWYER_VERIFICATION.APPROVED
        }
      });
    }
  }

  console.log("Seed completed.");
  await disconnectDatabase();
}

seed().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
