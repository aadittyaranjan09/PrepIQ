const path = require("path")
const dotenv = require("dotenv")

// Load environment variables (checks root .env, then Backend/.env fallback)
dotenv.config()
dotenv.config({ path: path.join(__dirname, "Backend/.env") })

const app = require("./Backend/src/app")
const connectToDB = require("./Backend/src/config/database")

// Render provides PORT in process.env (defaults to 10000)
const PORT = parseInt(process.env.PORT, 10) || 10000
const HOST = "0.0.0.0"

// Initialize database connection
connectToDB()

// Start Express server binding to 0.0.0.0
app.listen(PORT, HOST, () => {
    console.log(`🚀 PrepIQ server listening on http://${HOST}:${PORT}`)
    console.log(`   Health check: http://${HOST}:${PORT}/api/health`)
})
