const path = require("path")
const dotenv = require("dotenv")

dotenv.config()
dotenv.config({ path: path.join(__dirname, ".env") })

const app = require("./src/app")
const connectToDB = require("./src/config/database")

const PORT = parseInt(process.env.PORT, 10) || 10000
const HOST = "0.0.0.0"

connectToDB()

app.listen(PORT, HOST, () => {
    console.log(`PrepIQ backend server listening on http://${HOST}:${PORT}`)
})
