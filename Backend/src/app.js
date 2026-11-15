const path = require("path")
const fs = require("fs")
const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const mongoose = require("mongoose")

const app = express()

// Trust Render reverse proxy headers (for secure cookies & protocol detection)
app.set("trust proxy", 1)

// Body parsers
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

// CORS configuration (same-origin production, localhost / configured domains for dev)
app.use(cors({
    origin: function (origin, callback) {
        // Same-origin or non-browser requests (curl, postman, server-to-server)
        if (!origin) return callback(null, true)

        // Localhost in development
        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            return callback(null, true)
        }

        // Configured production application URL
        const clientUrl = process.env.CLIENT_URL
        if (clientUrl && origin === clientUrl.replace(/\/$/, "")) {
            return callback(null, true)
        }

        const allowedOrigin = process.env.ALLOWED_ORIGIN
        if (allowedOrigin && origin === allowedOrigin.replace(/\/$/, "")) {
            return callback(null, true)
        }

        // Also allow vercel preview domains if configured
        if (process.env.ALLOW_VERCEL_PREVIEW === "true" && /^https:\/\/.*\.vercel\.app$/.test(origin)) {
            return callback(null, true)
        }

        callback(null, true) // Lenient fallback to prevent blocking valid clients
    },
    credentials: true
}))

// Health check endpoint (Render healthCheckPath: /api/health)
app.get("/api/health", (req, res) => {
    const dbState = mongoose.connection.readyState
    const dbStatusMap = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    }

    res.status(200).json({
        status: "ok",
        service: "PrepIQ",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: dbStatusMap[dbState] || "unknown",
        environment: process.env.NODE_ENV || "development"
    })
})

// Serve static frontend production build
const frontendDist = path.resolve(__dirname, "../../Frontend/dist")
app.use(express.static(frontendDist))

/* Require all routes */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

/* Register API routes */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

// Unhandled API routes return JSON 404 (processed BEFORE SPA fallback)
app.use("/api", (req, res) => {
    res.status(404).json({
        message: `API endpoint ${req.method} ${req.originalUrl} not found`
    })
})

// SPA fallback for all GET routes (Express 5 syntax compatible)
app.get("/{*splat}", (req, res, next) => {
    // If request was for an /api route, pass to next (error handler)
    if (req.path.startsWith("/api")) {
        return next()
    }

    const indexPath = path.join(frontendDist, "index.html")
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath)
    }

    res.status(200).send("PrepIQ Single-Service Backend is running. Run 'npm run build' to generate the frontend UI.")
})

/* Global error handler */
app.use((err, req, res, next) => {
    console.error("Global Error Handler:", err.message || err)
    res.status(err.status || 500).json({
        message: err.message || "Internal server error"
    })
})

module.exports = app
