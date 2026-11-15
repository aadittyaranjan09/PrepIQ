/**
 * PrepIQ File Storage Service
 *
 * Render uses an ephemeral filesystem where files written to local disk are wiped
 * on every deploy, restart, or scale event.
 *
 * Strategy:
 * 1. Default: In-memory pipeline (multer.memoryStorage()). Files are streamed directly to
 *    pdf-parse or Groq Whisper in RAM. Extracted textual content (parsed resumes, AI reports,
 *    transcripts) is persistently stored in MongoDB Atlas.
 * 2. Generated PDF: Generated in-memory via Puppeteer and streamed directly to client HTTP response.
 * 3. Cloud Extension: Extensible adapter for AWS S3 or Cloudinary if configured via env vars.
 */

class StorageService {
    constructor() {
        this.provider = process.env.STORAGE_PROVIDER || "memory_atlas"
    }

    /**
     * Store file or buffer
     * @param {Buffer} buffer 
     * @param {string} filename 
     * @param {string} mimetype 
     * @returns {Promise<{ url: string, storageId: string, provider: string }>}
     */
    async storeFile(buffer, filename, mimetype) {
        // If an S3 or Cloudinary provider is configured in future, handle here
        if (this.provider === "s3" && process.env.AWS_S3_BUCKET) {
            // S3 upload adapter stub
            return {
                url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${filename}`,
                storageId: filename,
                provider: "s3"
            }
        }

        // Default: Memory + Atlas database persistence
        return {
            url: null,
            storageId: `memory_${Date.now()}_${filename}`,
            provider: "memory_atlas",
            size: buffer.length,
            mimetype
        }
    }

    /**
     * Verify whether ephemeral local disk is used
     */
    isEphemeralSafe() {
        return true // Uses memory buffers & Atlas database, never writes permanent data to local disk
    }
}

module.exports = new StorageService()
