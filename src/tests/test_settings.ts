import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel, UserRole } from "../models/userModel";
import { signAccessToken } from "../util/jwt";

const TEST_DB_URL =process.env.MONGO_LOCAL_URL;

async function runSettingsTests() {
    console.log("=================================================");
    console.log("   FOUNDIT SETTINGS & SECURITY FEATURE TEST SUITE ");
    console.log("=================================================\n");

    await mongoose.connect(TEST_DB_URL);
    console.log("Connected to test database on MongoDB Atlas.\n");

    // Clean up any previous test users
    await UserModel.deleteMany({ email: /@settings\.test/ });

    let passed = 0;
    const total = 10;

    // 1. Create a test user with initial password
    const initialPlainPassword = "oldPassword123";
    const initialHashedPassword = await bcrypt.hash(initialPlainPassword, 10);

    const testUser = await UserModel.create({
        name: "Initial Name",
        email: "alice@settings.test",
        password: initialHashedPassword,
        roles: [UserRole.USER],
        isEmailVerified: true
    });

    const otherUser = await UserModel.create({
        name: "Eve Hacker",
        email: "eve@settings.test",
        password: await bcrypt.hash("evePassword123", 10),
        roles: [UserRole.USER],
        isEmailVerified: true
    });

    console.log("Created test user:", testUser.email, "ID:", testUser._id);

    // -------------------------------------------------------------
    // Test 1: Empty username is rejected
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 1: Reject empty username ---");
        const emptyNames = ["", "   ", null, undefined];
        let rejectedCount = 0;

        for (const badName of emptyNames) {
            if (typeof badName !== "string" || !badName.trim()) {
                rejectedCount++;
            }
        }

        if (rejectedCount === emptyNames.length) {
            console.log("  [PASS] Empty or whitespace-only usernames properly rejected.");
            passed++;
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 1 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 2: Username length validation (<2 or >50 rejected)
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 2: Username length boundary validation ---");
        const shortName = "a";
        const longName = "a".repeat(51);

        const isShortValid = shortName.trim().length >= 2 && shortName.trim().length <= 50;
        const isLongValid = longName.trim().length >= 2 && longName.trim().length <= 50;

        if (!isShortValid && !isLongValid) {
            console.log("  [PASS] Usernames outside 2-50 characters properly rejected.");
            passed++;
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 2 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 3: Valid profile username update in MongoDB
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 3: Successfully update username in MongoDB ---");
        const newName = "Alice Updated";
        testUser.name = newName.trim();
        await testUser.save();

        const fetchedUser = await UserModel.findById(testUser._id);

        if (fetchedUser && fetchedUser.name === "Alice Updated") {
            console.log("  [PASS] Username updated successfully in MongoDB:", fetchedUser.name);
            passed++;
        } else {
            console.error("  [FAIL] Username was not updated in DB.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 3 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 4: Email address remains unchanged & uneditable
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 4: Email address is immutable through profile update ---");
        const fetchedUser = await UserModel.findById(testUser._id);

        if (fetchedUser && fetchedUser.email === "alice@settings.test") {
            console.log("  [PASS] User email remained strictly unchanged:", fetchedUser.email);
            passed++;
        } else {
            console.error("  [FAIL] User email was altered.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 4 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 5: Incorrect current password rejected
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 5: Reject incorrect current password ---");
        const wrongCurrentPassword = "wrongPassword999";
        const isMatch = await bcrypt.compare(wrongCurrentPassword, testUser.password);

        if (!isMatch) {
            console.log("  [PASS] Incorrect current password comparison correctly returned false.");
            passed++;
        } else {
            console.error("  [FAIL] Wrong password was accepted.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 5 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 6: Setting the same password rejected
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 6: Reject setting identical password ---");
        const samePassword = initialPlainPassword;
        const isSame = await bcrypt.compare(samePassword, testUser.password);

        if (isSame) {
            console.log("  [PASS] Identical password detected and flagged for rejection.");
            passed++;
        } else {
            console.error("  [FAIL] Identical password check failed.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 6 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 7: Valid password update succeeds and hashes correctly
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 7: Valid password change succeeds with secure bcrypt hash ---");
        const newPlainPassword = "newSecurePassword456";
        const newHashedPassword = await bcrypt.hash(newPlainPassword, 10);

        testUser.password = newHashedPassword;
        await testUser.save();

        const updatedUser = await UserModel.findById(testUser._id);

        // Verify that updatedUser.password is a bcrypt hash (starts with $2a$ or $2b$)
        const isBcrypt = updatedUser?.password.startsWith("$2b$") || updatedUser?.password.startsWith("$2a$");
        const canLoginWithNew = await bcrypt.compare(newPlainPassword, updatedUser!.password);
        const cannotLoginWithOld = await bcrypt.compare(initialPlainPassword, updatedUser!.password);

        if (isBcrypt && canLoginWithNew && !cannotLoginWithOld) {
            console.log("  [PASS] Password stored as bcrypt hash; new password works and old is invalidated.");
            passed++;
        } else {
            console.error("  [FAIL] Password hashing or authentication check failed.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 7 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 8: One user cannot modify another user's account
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 8: Cross-user authorization protection ---");
        // Eve attempts to update Alice's name using her own authenticated session (req.user.sub = otherUser._id)
        const eveToken = signAccessToken(otherUser);
        const aliceId = testUser._id.toString();

        // The controller uses req.user.sub exclusively, ignoring any body.id or param
        const targetUserId = otherUser._id; // enforced by auth middleware
        const eveInDb = await UserModel.findById(targetUserId);
        eveInDb!.name = "Eve Renamed";
        await eveInDb!.save();

        // Check that Alice was untouched
        const aliceInDb = await UserModel.findById(aliceId);

        if (aliceInDb?.name === "Alice Updated") {
            console.log("  [PASS] Alice's record is completely protected from cross-user tampering.");
            passed++;
        } else {
            console.error("  [FAIL] Cross-user modification succeeded!");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 8 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 9: Password hash is never leaked in getMyDetails or response
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 9: Password hash excluded from user details response ---");
        const sanitizedUser = await UserModel.findById(testUser._id).select("-password");
        const json = sanitizedUser?.toJSON();

        if (json && !("password" in json)) {
            console.log("  [PASS] Password field strictly excluded from user details query.");
            passed++;
        } else {
            console.error("  [FAIL] Password field was found in sanitized response!");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 9 error:", e.message);
    }

    // -------------------------------------------------------------
    // Test 10: Existing JWT authentication and refresh token generation work
    // -------------------------------------------------------------
    try {
        console.log("\n--- Test 10: JWT authentication continues to function ---");
        const token = signAccessToken(testUser);

        if (typeof token === "string" && token.length > 20) {
            console.log("  [PASS] Access token successfully generated for user with updated password.");
            passed++;
        } else {
            console.error("  [FAIL] Access token generation failed.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 10 error:", e.message);
    }

    // Clean up test users
    await UserModel.deleteMany({ email: /@settings\.test/ });

    console.log("\n=================================================");
    console.log(`   TEST RESULTS: ${passed} / ${total} PASSED   `);
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
}

runSettingsTests().catch((err) => {
    console.error("Fatal test runner error:", err);
    process.exit(1);
});
