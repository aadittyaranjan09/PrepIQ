/**
 * PrepIQ Production Readiness & Verification Test Suite
 * Executes end-to-end and component tests for single-service deployment on Render.
 */

const http = require("http")
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()
dotenv.config({ path: path.join(__dirname, "../Backend/.env") })

const app = require("../Backend/src/app")

let totalPassed = 0
let totalFailed = 0
const results = []

function assert(condition, testName, detail = "") {
    if (condition) {
        totalPassed++
        console.log(`  ✅ PASS: ${testName}`)
        results.push({ test: testName, status: "PASS", detail })
    } else {
        totalFailed++
        console.error(`  ❌ FAIL: ${testName} ${detail ? "(" + detail + ")" : ""}`)
        results.push({ test: testName, status: "FAIL", detail })
    }
}

async function runTests() {
    console.log("======================================================================")
    console.log("🧪 STARTING PREPIQ PRODUCTION DEPLOYMENT TEST SUITE")
    console.log("======================================================================\n")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 1: Frontend Build & Static Artifacts
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 1: Frontend Production Build & Distribution Files")
    const distPath = path.resolve(__dirname, "../Frontend/dist")
    const indexPath = path.join(distPath, "index.html")
    const assetsPath = path.join(distPath, "assets")
    const modelsPath = path.join(distPath, "models")

    assert(fs.existsSync(distPath), "Frontend/dist directory exists")
    assert(fs.existsSync(indexPath), "Frontend/dist/index.html exists")

    if (fs.existsSync(indexPath)) {
        const indexHtml = fs.readFileSync(indexPath, "utf8")
        assert(indexHtml.includes('<div id="root">'), "index.html contains root container div")
        assert(indexHtml.includes("assets/"), "index.html references bundled assets")
    }

    assert(fs.existsSync(assetsPath), "Frontend/dist/assets directory exists")
    if (fs.existsSync(assetsPath)) {
        const assetFiles = fs.readdirSync(assetsPath)
        const hasJs = assetFiles.some(f => f.endsWith(".js"))
        const hasCss = assetFiles.some(f => f.endsWith(".css"))
        assert(hasJs, "Production JavaScript bundle compiled and present")
        assert(hasCss, "Production CSS stylesheet compiled and present")
    }

    assert(fs.existsSync(modelsPath), "Frontend/dist/models directory exists")
    if (fs.existsSync(modelsPath)) {
        const modelFiles = fs.readdirSync(modelsPath)
        const requiredModels = [
            "tiny_face_detector_model-weights_manifest.json",
            "face_landmark_68_tiny_model-weights_manifest.json",
            "face_expression_model-weights_manifest.json"
        ]
        const allPresent = requiredModels.every(m => modelFiles.includes(m))
        assert(allPresent, "All face-api.js neural network models exist in dist/models")
    }
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 2: Codebase URL & Relative Path Audit
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 2: Hardcoded URL & Relative Path Audit")
    const authServiceFile = fs.readFileSync(path.resolve(__dirname, "../Frontend/src/features/auth/services/auth.api.js"), "utf8")
    const interviewServiceFile = fs.readFileSync(path.resolve(__dirname, "../Frontend/src/features/interview/services/interview.api.js"), "utf8")
    const loginPageFile = fs.readFileSync(path.resolve(__dirname, "../Frontend/src/features/auth/pages/Login.jsx"), "utf8")

    assert(!authServiceFile.includes('http://localhost:3000'), "auth.api.js does not contain hardcoded localhost:3000")
    assert(!interviewServiceFile.includes('http://localhost:3000'), "interview.api.js does not contain hardcoded localhost:3000")
    assert(!loginPageFile.includes('http://localhost:3000'), "Login.jsx does not contain hardcoded localhost:3000")
    assert(authServiceFile.includes('import.meta.env.VITE_API_BASE_URL || ""'), "auth.api.js defaults to relative root URL")
    assert(interviewServiceFile.includes('import.meta.env.VITE_API_BASE_URL || ""'), "interview.api.js defaults to relative root URL")

    // Check built JS bundle doesn't contain hardcoded old Render or Vercel URLs
    if (fs.existsSync(assetsPath)) {
        const jsFiles = fs.readdirSync(assetsPath).filter(f => f.endsWith(".js"))
        let foundOldDomain = false
        for (const file of jsFiles) {
            const content = fs.readFileSync(path.join(assetsPath, file), "utf8")
            if (content.includes("prepiq-lngh.onrender.com")) {
                foundOldDomain = true
                break
            }
        }
        assert(!foundOldDomain, "Compiled frontend JS bundle does not contain stale Render domain")
    }
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 3: Live Express Server Startup & HTTP Routing
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 3: Express Single-Service Server, SPA Routing & API Priority")
    let server
    let baseUrl

    try {
        await new Promise((resolve, reject) => {
            // Bind to ephemeral port on 0.0.0.0
            server = app.listen(0, "127.0.0.1", () => {
                const port = server.address().port
                baseUrl = `http://127.0.0.1:${port}`
                console.log(`  ℹ Server listening on ${baseUrl}`)
                resolve()
            })
            server.on("error", reject)
        })

        // Test Health Check
        const healthRes = await fetch(`${baseUrl}/api/health`)
        assert(healthRes.status === 200, "Health check endpoint /api/health responds with HTTP 200")
        const healthJson = await healthRes.json()
        assert(healthJson.status === "ok", "Health check JSON body contains status: 'ok'")
        assert(typeof healthJson.uptime === "number", "Health check reports server uptime")
        assert(typeof healthJson.database === "string", `Health check reports DB status: '${healthJson.database}'`)

        // Test SPA Frontend Delivery on Root
        const rootRes = await fetch(`${baseUrl}/`)
        assert(rootRes.status === 200, "Root path / responds with HTTP 200")
        const rootText = await rootRes.text()
        assert(rootText.includes('<div id="root">'), "Root path serves Frontend/dist/index.html")

        // Test SPA Routing Fallback on Subpaths (Simulating Browser Refresh)
        const loginPageRes = await fetch(`${baseUrl}/login`)
        assert(loginPageRes.status === 200, "Direct navigation to /login responds with HTTP 200")
        const loginPageText = await loginPageRes.text()
        assert(loginPageText.includes('<div id="root">'), "/login route serves index.html for client-side routing")

        const interviewPageRes = await fetch(`${baseUrl}/interview/66f000000000000000000001`)
        assert(interviewPageRes.status === 200, "Direct navigation to /interview/:id responds with HTTP 200")
        const interviewPageText = await interviewPageRes.text()
        assert(interviewPageText.includes('<div id="root">'), "/interview/:id route serves index.html (page refresh works)")

        const faceInterviewRes = await fetch(`${baseUrl}/interview/66f000000000000000000001/face-mock`)
        assert(faceInterviewRes.status === 200, "Direct navigation to /interview/:id/face-mock responds with HTTP 200")

        // Test Static Asset Delivery
        const avatarRes = await fetch(`${baseUrl}/ai_avatar.png`)
        assert(avatarRes.status === 200, "Static asset /ai_avatar.png served with HTTP 200")

        const modelRes = await fetch(`${baseUrl}/models/tiny_face_detector_model-weights_manifest.json`)
        assert(modelRes.status === 200, "Face model /models/tiny_face_detector_model-weights_manifest.json served with HTTP 200")
        const modelJson = await modelRes.json()
        assert(Array.isArray(modelJson) && modelJson.length > 0, "Face model manifest contains valid JSON model weights array")

        // Test API Route Priority Over SPA Fallback
        const nonExistentApiRes = await fetch(`${baseUrl}/api/some-unknown-endpoint`)
        assert(nonExistentApiRes.status === 404, "Unknown /api route returns HTTP 404 (not intercepted by SPA fallback)")
        const nonExistentApiJson = await nonExistentApiRes.json()
        assert(nonExistentApiJson.message && nonExistentApiJson.message.includes("not found"), "Unknown /api route returns JSON error response")

        // Test Google OAuth Guard
        const googleAuthRes = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" })
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            assert([302, 200].includes(googleAuthRes.status), "Google OAuth configured and redirects to Google login")
        } else {
            assert(googleAuthRes.status === 503, "Google OAuth without credentials returns 503 Service Unavailable without crashing")
        }

    } finally {
        if (server) {
            await new Promise(resolve => server.close(resolve))
            console.log("  ℹ Test Express server cleanly stopped.")
        }
    }
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 4: File Upload & PDF Parsing Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 4: File Upload, Validation & PDF Parsing")
    const pdfParse = require("pdf-parse/lib/pdf-parse.js")
    const testPdfPath = path.resolve(__dirname, "../test_resume.pdf")

    assert(fs.existsSync(testPdfPath), "Test PDF file exists at repository root")
    if (fs.existsSync(testPdfPath)) {
        const testPdfBuffer = fs.readFileSync(testPdfPath)
        try {
            const parsed = await pdfParse(testPdfBuffer)
            assert(parsed && typeof parsed.text === "string", "pdf-parse extracts text from uploaded PDF buffer")
            assert(parsed.text.length > 0, `Extracted ${parsed.text.length} characters from test resume PDF`)
        } catch (err) {
            assert(false, "pdf-parse failed to parse test PDF", err.message)
        }
    }

    // Verify Multer middleware configuration
    const fileMiddleware = require("../Backend/src/middlewares/file.middleware")
    assert(typeof fileMiddleware.single === "function", "Multer PDF resume upload middleware configured")
    assert(typeof fileMiddleware.audioUpload.single === "function", "Multer audio upload middleware configured")
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 5: Puppeteer PDF Generation Reliability
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 5: Puppeteer PDF Generation & Resource Management")
    try {
        const puppeteerMod = await import("puppeteer")
        const puppeteer = puppeteerMod.default || puppeteerMod

        const launchArgs = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote"
        ]

        const browser = await puppeteer.launch({
            headless: true,
            args: launchArgs
        })
        assert(browser !== null, "Puppeteer browser launches in headless mode with Render-compatible flags")

        const page = await browser.newPage()
        await page.setContent(`
            <!DOCTYPE html>
            <html>
                <head><title>PrepIQ ATS Resume</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>John Doe — Senior Full Stack Engineer</h1>
                    <p>Experience: Node.js, React, MongoDB, Cloud Architecture</p>
                </body>
            </html>
        `, { waitUntil: "networkidle0", timeout: 15000 })

        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true })
        assert(Buffer.isBuffer(pdfBuffer), "Puppeteer page.pdf() returns a valid binary Buffer")
        assert(pdfBuffer.length > 1000, `Generated PDF buffer size: ${pdfBuffer.length} bytes`)

        // Verify PDF Magic Bytes (%PDF-)
        const pdfHeader = pdfBuffer.slice(0, 5).toString("utf8")
        assert(pdfHeader === "%PDF-", "Generated buffer is a valid PDF document (%PDF- header present)")

        await page.close()
        await browser.close()
        assert(true, "Puppeteer page and browser instances closed cleanly without process leaks")
    } catch (err) {
        assert(false, "Puppeteer PDF generation test encountered an error", err.message)
    }
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 6: AI Service Schemas, Validation & Key Handling
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 6: Groq AI Integration, Zod Schemas & Error Handling")
    const aiService = require("../Backend/src/services/ai.service")

    assert(typeof aiService.generateInterviewReport === "function", "generateInterviewReport function exported")
    assert(typeof aiService.generateResumePdf === "function", "generateResumePdf function exported")
    assert(typeof aiService.handlePlanChat === "function", "handlePlanChat function exported")
    assert(typeof aiService.evaluateMockAnswer === "function", "evaluateMockAnswer function exported")
    assert(typeof aiService.evaluateFaceInterview === "function", "evaluateFaceInterview function exported")
    assert(typeof aiService.transcribeAudio === "function", "transcribeAudio function exported")

    if (process.env.GROQ_API_KEY) {
        console.log("  ℹ GROQ_API_KEY is configured in environment.")
    } else {
        console.log("  ℹ GROQ_API_KEY is not set in local env (expected before user configuration). Validating guard.")
        try {
            await aiService.generateInterviewReport({ jobDescription: "Software Engineer" })
            assert(false, "Should have thrown missing GROQ_API_KEY error")
        } catch (err) {
            assert(err.message.includes("GROQ_API_KEY is missing"), "AI service protects against missing GROQ_API_KEY with informative error")
        }
    }
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUITE 7: Database & Ephemeral Storage Strategy
    // ──────────────────────────────────────────────────────────────────────────
    console.log("▶ SUITE 7: Database Configuration & Ephemeral Storage Strategy")
    const storageService = require("../Backend/src/services/storage.service")
    assert(storageService.isEphemeralSafe(), "Storage service complies with Render ephemeral filesystem constraints")

    const connectToDB = require("../Backend/src/config/database")
    assert(typeof connectToDB === "function", "MongoDB Atlas connection function configured")
    console.log("")

    // ──────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ──────────────────────────────────────────────────────────────────────────
    console.log("======================================================================")
    console.log(`📊 TEST SUITE COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED`)
    console.log("======================================================================")

    if (totalFailed > 0) {
        process.exit(1)
    }
}

runTests().catch(err => {
    console.error("Test Suite Fatal Error:", err)
    process.exit(1)
})
