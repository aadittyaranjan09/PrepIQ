const mongoose = require("mongoose")

/**
 * Connect to MongoDB Atlas with robust error handling and connection event logging
 */
async function connectToDB() {
    const mongoUri = process.env.MONGO_URI

    if (!mongoUri) {
        console.warn("⚠️  MONGO_URI is not set in environment variables. Database features will be unavailable.")
        return
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000,
            retryWrites: true,
            w: "majority"
        })
        console.log("✅ Connected to MongoDB Atlas successfully")
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message)
    }
}

mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose connected to MongoDB cluster")
})

mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose runtime connection error:", err.message)
})

mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  Mongoose disconnected from MongoDB cluster")
})

module.exports = connectToDB
