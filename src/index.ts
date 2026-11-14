import express, { type Request, type Response } from "express"
import AuthRouter from "./routes/authRoutes"
import ItemRouter from "./routes/itemRoutes";
import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

import cors from "cors"

const MONGO_URL = process.env.MONGO_LOCAL_URL || ""
const PORT = process.env.PORT || 6000

const app = express()

app.use(cors())
app.use(express.json())

// Authentication routes
app.use("/api/v1/auth", AuthRouter)

// Found item routes
app.use("/api/v1/items", ItemRouter);

mongoose
  .connect(MONGO_URL)
  .then(() => {
    console.log("DB connected..!")

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  })
  .catch((err) => console.error("Fail to connect DB..!"))
