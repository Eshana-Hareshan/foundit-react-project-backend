
import { Request, Response } from "express";
import Settings from "../models/settingsModel";

// Get platform settings for administrators
export const getSettings = async (
    req: Request,
    res: Response
) => {
    try {
        let settings = await Settings.findOne();

        // Create default settings if they do not exist
        if (!settings) {
            settings = await Settings.create({});
        }

        return res.status(200).json({
            message: "Settings retrieved successfully",
            data: settings
        });

    } catch (error) {
        console.error("Get settings error:", error);

        return res.status(500).json({
            message: "Failed to retrieve settings"
        });
    }
};


// Update platform settings
export const updateSettings = async (
    req: Request,
    res: Response
) => {
    try {
        const {
            platformName,
            description,
            registrationEnabled,
            emailVerification
        } = req.body;

        // Validate platform name
        if (
            typeof platformName !== "string" ||
            !platformName.trim() ||
            platformName.trim().length > 100
        ) {
            return res.status(400).json({
                message: "Platform name is required and must not exceed 100 characters"
            });
        }

        // Validate description
        if (
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 500
        ) {
            return res.status(400).json({
                message: "Description is required and must not exceed 500 characters"
            });
        }

        // Validate boolean settings
        if (
            typeof registrationEnabled !== "boolean" ||
            typeof emailVerification !== "boolean"
        ) {
            return res.status(400).json({
                message: "Invalid settings values"
            });
        }

        const settings = await Settings.findOneAndUpdate(
            {},
            {
                platformName: platformName.trim(),
                description: description.trim(),
                registrationEnabled,
                emailVerification
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return res.status(200).json({
            message: "Settings updated successfully",
            data: settings
        });

    } catch (error) {
        console.error("Update settings error:", error);

        return res.status(500).json({
            message: "Failed to update settings"
        });
    }
};


// Get public platform settings
export const getPublicSettings = async (
    req: Request,
    res: Response
) => {
    try {
        let settings = await Settings.findOne();

        // Create default settings if they do not exist
        if (!settings) {
            settings = await Settings.create({});
        }

        // Return only public information
        return res.status(200).json({
            message: "Public settings retrieved successfully",
            data: {
                platformName: settings.platformName,
                description: settings.description
            }
        });

    } catch (error) {
        console.error("Get public settings error:", error);

        return res.status(500).json({
            message: "Failed to retrieve public settings"
        });
    }
};
