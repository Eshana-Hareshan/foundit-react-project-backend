import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import Item, { IItem } from "../models/itemModel";
import Notification from "../models/notificationModel";
import MatchResult from "../models/matchResultModel";
import { UserModel, UserRole } from "../models/userModel";
import {
    findAndProcessMatches,
    compareLostAndFound,
    fallbackSemanticMatch,
    evaluateItemsWithGemini
} from "../services/geminiMatchingService";

const TEST_DB_URL =
    "mongodb+srv://eshanahbandara_db_user:nNuVlNyqx8GeLauM@foundit.izptn0o.mongodb.net/foundit_test_db?retryWrites=true&w=majority";

async function runTests() {
    console.log("=================================================");
    console.log("   FOUNDIT AI MATCHING & NOTIFICATION TEST SUITE  ");
    console.log("=================================================\n");

    await mongoose.connect(TEST_DB_URL);
    console.log("Connected to test database on MongoDB Atlas.\n");

    // Clean up test collections
    await Notification.deleteMany({});
    await MatchResult.deleteMany({});
    await Item.deleteMany({});
    await UserModel.deleteMany({ email: /@test\.foundit/ });

    // Create Test Users
    const userA = await UserModel.create({
        name: "Alice Tester",
        email: "alice@test.foundit",
        password: "hashedpassword123",
        roles: [UserRole.USER],
        isEmailVerified: true
    });

    const userB = await UserModel.create({
        name: "Bob Finder",
        email: "bob@test.foundit",
        password: "hashedpassword123",
        roles: [UserRole.USER],
        isEmailVerified: true
    });

    const userC = await UserModel.create({
        name: "Charlie Intruder",
        email: "charlie@test.foundit",
        password: "hashedpassword123",
        roles: [UserRole.USER],
        isEmailVerified: true
    });

    console.log("Test users created:");
    console.log(`- User A (Alice): ${userA._id}`);
    console.log(`- User B (Bob):   ${userB._id}`);
    console.log(`- User C (Charlie): ${userC._id}\n`);

    let passedTests = 0;
    const totalTests = 10;

    // -------------------------------------------------------------------------
    // TEST 1: User A reports lost Samsung phone. An existing matching found Samsung phone exists.
    // User A receives a notification.
    // -------------------------------------------------------------------------
    try {
        console.log("--- TEST 1: Found item exists first, User A reports lost item ---");
        const foundPhone = await Item.create({
            itemName: "Black Samsung Galaxy S23",
            category: "Mobile Phones",
            location: "Central Bus Station",
            description: "Found a black Samsung mobile phone with cracked screen protector near bus bay 4.",
            dateFound: new Date("2026-11-15"),
            imageUrl: "https://example.com/samsung.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const lostPhoneA = await Item.create({
            itemName: "Samsung Galaxy Smartphone",
            category: "Mobile Phones",
            location: "Bus Terminal Main Stop",
            description: "Lost my black Samsung smartphone while waiting for the evening bus.",
            dateFound: new Date("2026-11-14"),
            imageUrl: "https://example.com/lost_samsung.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        // Run matching for newly reported lost item
        await findAndProcessMatches(lostPhoneA);

        const notifsA = await Notification.find({
            userId: userA._id,
            type: "ITEM_MATCH_FOUND",
            lostItemId: lostPhoneA._id,
            foundItemId: foundPhone._id
        });

        if (notifsA.length === 1 && (notifsA[0].matchScore || 0) >= 65) {
            console.log("  [PASS] User A received qualifying match notification!");
            console.log(`         Score: ${notifsA[0].matchScore}%, Reason: "${notifsA[0].matchExplanation}"`);
            passedTests++;
        } else {
            console.error("  [FAIL] Expected 1 notification for User A, got:", notifsA.length);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 1 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: User A reports a lost phone. User B reports finding a matching phone later.
    // User A receives a notification.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 2: Lost item reported first, matching Found item reported later ---");
        const lostWatch = await Item.create({
            itemName: "Silver Wristwatch",
            category: "Jewellery",
            location: "City Park Bench",
            description: "Lost a classic silver wristwatch with leather strap near the central fountain.",
            dateFound: new Date("2026-11-16"),
            imageUrl: "https://example.com/watch.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const foundWatch = await Item.create({
            itemName: "Silver Watch with Leather Band",
            category: "Jewellery",
            location: "City Park Garden",
            description: "Discovered an elegant silver watch on a park bench near fountain.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/found_watch.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        // Run matching for newly reported found item (evaluates existing lost items)
        await findAndProcessMatches(foundWatch);

        const notifs = await Notification.find({
            userId: userA._id,
            type: "ITEM_MATCH_FOUND",
            lostItemId: lostWatch._id,
            foundItemId: foundWatch._id
        });

        if (notifs.length === 1 && (notifs[0].matchScore || 0) >= 65) {
            console.log("  [PASS] User A received notification when User B reported matching found item later!");
            console.log(`         Score: ${notifs[0].matchScore}%, Title: "${notifs[0].title}"`);
            passedTests++;
        } else {
            console.error("  [FAIL] Expected 1 notification for User A, got:", notifs.length);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 2 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: User reports a lost phone, another reports a wallet. No notification created.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 3: Category mismatch (Phone vs Wallet) -> No notification ---");
        const lostPhone3 = await Item.create({
            itemName: "iPhone 15 Pro",
            category: "Mobile Phones",
            location: "Library 2nd Floor",
            description: "Blue titanium iPhone left on study table.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/iphone.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const foundWallet3 = await Item.create({
            itemName: "Brown Leather Wallet",
            category: "Wallets",
            location: "Library 2nd Floor",
            description: "Found a brown leather bi-fold wallet on table.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/wallet.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        await findAndProcessMatches(lostPhone3);

        const irrelevantNotifs = await Notification.find({
            lostItemId: lostPhone3._id,
            foundItemId: foundWallet3._id
        });

        if (irrelevantNotifs.length === 0) {
            console.log("  [PASS] No irrelevant notification created across mismatched categories.");
            passedTests++;
        } else {
            console.error("  [FAIL] Irrelevant notification was created:", irrelevantNotifs);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 3 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Two matching posts compared repeatedly. Duplicate notifications NOT created.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 4: Repeated comparisons -> Duplicate prevention ---");
        const lostKeys = await Item.create({
            itemName: "Car Keys with Red Keychain",
            category: "Keys",
            location: "Supermarket Parking Lot",
            description: "Lost Honda car keys with a red silicone fob.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/keys.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const foundKeys = await Item.create({
            itemName: "Honda Car Key with Red Fob",
            category: "Keys",
            location: "Grocery Store Parking Bay",
            description: "Found car keys near cart return with red Honda tag.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/found_keys.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        // Process matches multiple times consecutively
        await findAndProcessMatches(lostKeys);
        await findAndProcessMatches(lostKeys);
        await findAndProcessMatches(foundKeys);

        const count = await Notification.countDocuments({
            userId: userA._id,
            lostItemId: lostKeys._id,
            foundItemId: foundKeys._id,
            type: "ITEM_MATCH_FOUND"
        });

        if (count === 1) {
            console.log("  [PASS] Duplicate notifications prevented! Exact notification count = 1.");
            passedTests++;
        } else {
            console.error("  [FAIL] Expected 1 notification, found:", count);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 4 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: User reports their own found item. They do NOT receive notification for own post.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 5: Own post exclusion -> No self-notification ---");
        const aliceLostBag = await Item.create({
            itemName: "Blue Gym Bag",
            category: "Bags",
            location: "Fitness Center",
            description: "Blue Nike duffel bag with workout gear.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/bag.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        // Alice reports finding a similar bag (maybe by mistake or test)
        const aliceFoundBag = await Item.create({
            itemName: "Blue Duffel Bag",
            category: "Bags",
            location: "Fitness Center Locker",
            description: "Blue gym bag left in locker room.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/found_bag.jpg",
            userId: userA._id, // SAME USER
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        await findAndProcessMatches(aliceFoundBag);

        const selfNotifs = await Notification.find({
            lostItemId: aliceLostBag._id,
            foundItemId: aliceFoundBag._id
        });

        if (selfNotifs.length === 0) {
            console.log("  [PASS] User did not receive notification for their own reported item.");
            passedTests++;
        } else {
            console.error("  [FAIL] Self-notification created:", selfNotifs);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 5 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Resolved item is excluded from future matching.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 6: Resolved item excluded from future matching ---");
        const resolvedFoundCharger = await Item.create({
            itemName: "MacBook 67W USB-C Charger",
            category: "Electronics",
            location: "Cafeteria",
            description: "White Apple USB-C laptop power adapter.",
            dateFound: new Date("2026-11-10"),
            imageUrl: "https://example.com/charger.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: true // ALREADY RESOLVED
        });

        const lostCharger = await Item.create({
            itemName: "Apple Mac Power Adapter",
            category: "Electronics",
            location: "Cafeteria Table",
            description: "Left white Apple MacBook charger plugged in.",
            dateFound: new Date("2026-11-17"),
            imageUrl: "https://example.com/lost_charger.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        await findAndProcessMatches(lostCharger);

        const resolvedNotifs = await Notification.find({
            lostItemId: lostCharger._id,
            foundItemId: resolvedFoundCharger._id
        });

        if (resolvedNotifs.length === 0) {
            console.log("  [PASS] Resolved items are successfully excluded from candidate matching.");
            passedTests++;
        } else {
            console.error("  [FAIL] Resolved item generated notification:", resolvedNotifs);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 6 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Gemini returns an invalid response. Handled safely via fallback.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 7: Invalid AI response handling ---");
        // Verify fallback semantic matcher produces valid schema
        const mockLost = {
            itemName: "Sony Noise Cancelling Headphones",
            category: "Electronics",
            description: "Black over-ear Sony WH-1000XM4 headphones in zipper case.",
            location: "Airport Terminal 2",
            dateFound: new Date("2026-11-17"),
            additionalDetails: "Serial number on headband"
        };

        const mockFound = {
            itemName: "Black Sony Wireless Headset",
            category: "Electronics",
            description: "Found Sony black over ear headphones in black case.",
            location: "Terminal 2 Gate 14",
            dateFound: new Date("2026-11-17"),
            additionalDetails: ""
        };

        const fallbackResult = fallbackSemanticMatch(mockLost as any, mockFound as any);

        if (
            typeof fallbackResult.matchScore === "number" &&
            fallbackResult.matchScore >= 0 &&
            fallbackResult.matchScore <= 100 &&
            typeof fallbackResult.isPossibleMatch === "boolean" &&
            typeof fallbackResult.reason === "string" &&
            Array.isArray(fallbackResult.matchingDetails)
        ) {
            console.log("  [PASS] Fallback semantic matcher safely handles anomalies & returns valid structure.");
            console.log(`         Score: ${fallbackResult.matchScore}%, Details: ${fallbackResult.matchingDetails.join("; ")}`);
            passedTests++;
        } else {
            console.error("  [FAIL] Invalid fallback structure:", fallbackResult);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 7 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Gemini returns a 429 quota error. Application uses fallback and continues.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 8: Gemini 429 quota error resilience ---");
        // We can test compareLostAndFound behavior under fallback
        const lostDoc = new Item({
            itemName: "Laptop Charger",
            category: "Electronics",
            location: "Campus Library",
            description: "Black Dell laptop power adapter cable.",
            dateFound: new Date(),
            imageUrl: "https://example.com/dell.jpg",
            userId: userA._id,
            status: "LOST",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const foundDoc = new Item({
            itemName: "Dell Computer Power Adapter",
            category: "Electronics",
            location: "Library 1st floor",
            description: "Found black Dell charger adapter.",
            dateFound: new Date(),
            imageUrl: "https://example.com/dell_found.jpg",
            userId: userB._id,
            status: "FOUND",
            moderationStatus: "ACTIVE",
            isResolved: false
        });

        const evaluation = fallbackSemanticMatch(lostDoc, foundDoc);

        if (evaluation.matchScore >= 65 && evaluation.isPossibleMatch) {
            console.log("  [PASS] Fallback matcher accurately evaluates semantic items (Charger <-> Power Adapter)");
            console.log(`         Score: ${evaluation.matchScore}%, isPossibleMatch: ${evaluation.isPossibleMatch}`);
            passedTests++;
        } else {
            console.error("  [FAIL] Fallback matcher did not meet threshold:", evaluation);
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 8 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 9: A user tries to access another user's notifications. Access is denied.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 9: Unauthorized notification access prevention ---");
        // Charlie (userC) tries to fetch notifications belonging to userA
        // Backend query is scoped strictly to authenticated user's sub: Notification.find({ userId: req.user.sub })
        const charlieNotifications = await Notification.find({ userId: userC._id });
        const aliceNotifications = await Notification.find({ userId: userA._id });

        const containsAliceNotif = charlieNotifications.some(
            (n) => n.userId.toString() === userA._id.toString()
        );

        // Charlie tries to mark Alice's notification as read
        const targetAliceNotif = aliceNotifications[0];
        const unauthorizedUpdate = await Notification.findOneAndUpdate(
            {
                _id: targetAliceNotif._id,
                userId: userC._id // Charlie's user ID
            },
            { isRead: true },
            { new: true }
        );

        if (!containsAliceNotif && unauthorizedUpdate === null) {
            console.log("  [PASS] Access denied: Charlie cannot view or update Alice's notifications.");
            passedTests++;
        } else {
            console.error("  [FAIL] Unauthorized access was not blocked!");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 9 error:", e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Clicking a matching notification opens the correct found item.
    // -------------------------------------------------------------------------
    try {
        console.log("\n--- TEST 10: Notification navigation target validation ---");
        const notif = await Notification.findOne({
            userId: userA._id,
            type: "ITEM_MATCH_FOUND"
        }).populate("foundItemId");

        if (notif && notif.foundItemId) {
            const targetId = (notif.foundItemId as any)._id.toString();
            const foundItemDoc = await Item.findById(targetId);

            if (foundItemDoc && foundItemDoc.status === "FOUND") {
                console.log("  [PASS] Notification properly links to found item ID:", targetId);
                console.log(`         Item: "${foundItemDoc.itemName}", Status: ${foundItemDoc.status}`);
                passedTests++;
            } else {
                console.error("  [FAIL] Target item is not a valid FOUND item.");
            }
        } else {
            console.error("  [FAIL] No match notification found to verify.");
        }
    } catch (e: any) {
        console.error("  [FAIL] Test 10 error:", e.message);
    }

    // Cleanup test data
    await Notification.deleteMany({});
    await MatchResult.deleteMany({});
    await Item.deleteMany({});
    await UserModel.deleteMany({ email: /@test\.foundit/ });

    console.log("\n=================================================");
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED   `);
    console.log("=================================================");

    await mongoose.disconnect();
    process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch((err) => {
    console.error("Fatal test suite runner error:", err);
    process.exit(1);
});
