
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

export const sendOTPEmail = async (
    email: string,
    otp: string
) => {
    await transporter.sendMail({
        from: `"Foundit Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Foundit Email Verification",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Welcome to Foundit!</h2>
                <p>Use the following OTP to verify your email address.</p>
                <h1 style="color: #4f46e5; letter-spacing: 5px;">
                    ${otp}
                </h1>
                <p>This OTP expires in 5 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            </div>
        `
    });
};
