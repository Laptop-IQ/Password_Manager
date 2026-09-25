/**
 * One-time migration script.
 *
 * Before the security fix, Password/Card/Secret records had no "user"
 * owner field. This script attaches every existing record that has no
 * "user" set to a user account you choose, so nothing is silently lost
 * after the auth fix goes live.
 *
 * USAGE (run from the backend/ folder):
 *   node scripts/migrateOwnerlessRecords.js --email you@example.com
 *   node scripts/migrateOwnerlessRecords.js --user-id 64f1c2...
 *   node scripts/migrateOwnerlessRecords.js --email you@example.com --dry-run
 *
 * Notes:
 * - Requires MONGODB_URI in your .env (same as the main app).
 * - Safe to re-run: it only touches records where "user" is missing/null,
 *   so already-migrated or already-owned records are left untouched.
 * - Use --dry-run first to see how many records WOULD be updated,
 *   without changing anything.
 */

import "dotenv/config";
import mongoose from "mongoose";

import User from "../models/userModel.js";
import Password from "../models/passwordModel.js";
import Card from "../models/cardModel.js";
import Secret from "../models/secretModel.js";

// ============================================================================
// PARSE CLI ARGS
// ============================================================================

const args = process.argv.slice(2);

const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const email = getArg("--email");
const userIdArg = getArg("--user-id");
const isDryRun = args.includes("--dry-run");

if (!email && !userIdArg) {
  console.error(
    "❌ You must pass either --email <email> or --user-id <id>.\n" +
      "   Example: node scripts/migrateOwnerlessRecords.js --email you@example.com",
  );
  process.exit(1);
}

// ============================================================================
// RUN MIGRATION
// ============================================================================

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    let targetUser;

    if (userIdArg) {
      if (!/^[0-9a-fA-F]{24}$/.test(userIdArg)) {
        throw new Error(`"${userIdArg}" is not a valid Mongo ObjectId.`);
      }
      targetUser = await User.findById(userIdArg);
    } else {
      targetUser = await User.findOne({ email: email.trim().toLowerCase() });
    }

    if (!targetUser) {
      throw new Error(
        `No user found for ${userIdArg ? `id "${userIdArg}"` : `email "${email}"`}.`,
      );
    }

    console.log(
      `👤 Target user: ${targetUser.email || targetUser._id} (${targetUser._id})`,
    );

    const ownerlessFilter = {
      $or: [{ user: { $exists: false } }, { user: null }],
    };

    const collections = [
      { name: "Passwords", Model: Password },
      { name: "Cards", Model: Card },
      { name: "Secrets", Model: Secret },
    ];

    console.log(isDryRun ? "\n🔎 DRY RUN — nothing will be changed.\n" : "\n🚀 Migrating...\n");

    for (const { name, Model } of collections) {
      const count = await Model.countDocuments(ownerlessFilter);

      if (isDryRun) {
        console.log(`   ${name}: ${count} record(s) would be linked to this user.`);
        continue;
      }

      if (count === 0) {
        console.log(`   ${name}: nothing to migrate.`);
        continue;
      }

      const result = await Model.updateMany(ownerlessFilter, {
        $set: { user: targetUser._id },
      });

      console.log(
        `   ${name}: linked ${result.modifiedCount} of ${count} record(s) to ${targetUser.email || targetUser._id}.`,
      );
    }

    console.log(isDryRun ? "\n✅ Dry run complete. Re-run without --dry-run to apply." : "\n✅ Migration complete.");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
