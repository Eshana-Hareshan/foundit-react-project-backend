import express, { type Request, type Response } from "express"
import AuthRouter from "./routes/authRoutes"
import ItemRouter from "./routes/itemRoutes";
import ChatRouter from "./routes/chatRoutes";
import AdminRouter from "./routes/adminRoutes";
import SettingsRouter from "./routes/settingsRoutes";
import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

import cors from "cors"

const MONGO_URL = process.env.MONGO_LOCAL_URL || ""
const PORT = process.env.PORT || 3000

// console.log("Mongo URL loaded:", Boolean(MONGO_URL));
// console.log("Mongo URL starts correctly:",
//   MONGO_URL.startsWith("mongodb://") ||
//   MONGO_URL.startsWith("mongodb+srv://")
// );

const app = express()

app.use(cors())
app.use(express.json())

// Authentication routes
app.use("/api/v1/auth", AuthRouter)

// Admin routes
app.use("/api/v1/admin", AdminRouter);

// Found item routes
app.use("/api/v1/items", ItemRouter);

// Chats
app.use("/api/v1/chats", ChatRouter);

app.use("/api/v1/admin/settings", SettingsRouter);


mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("DB connected..!")

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Fail to connect DB..!")
    console.error("MongoDB Error:", err)
  })
