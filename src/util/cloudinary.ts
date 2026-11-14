import cloudinary from "../config/cloudinary";
import { Readable } from "stream";

export const uploadToCloudinary = (
    file: Express.Multer.File
): Promise<string> => {

    return new Promise((resolve, reject) => {

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "lost-and-found",
                resource_type: "image"
            },
            (error, result) => {

                if (error) {
                    return reject(error);
                }

                if (!result) {
                    return reject(new Error("Image upload failed"));
                }

                resolve(result.secure_url);
            }
        );

        Readable.from(file.buffer).pipe(uploadStream);
    });
};