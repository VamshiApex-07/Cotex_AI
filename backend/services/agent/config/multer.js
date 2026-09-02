import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import multer from "multer"

const uploadDir = path.resolve(import.meta.dirname, "../temp")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// The extension is derived from the mimetype allowlist, never from
// file.originalname. multer's disk storage path.join()s the filename onto the
// destination, so an originalname of "x-../../../index.js" resolved to the
// service entrypoint: one segment absorbed by the fake prefix, two real "..",
// landing on services/agent/index.js — which nodemon then re-executed. Any
// mimetype not in this table is rejected by fileFilter, so the ?? ".bin"
// fallback is unreachable and exists only so a future filter change cannot
// produce an extensionless file.
const EXTENSION_BY_MIME = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

export const ALLOWED_MIMETYPES = Object.keys(EXTENSION_BY_MIME)
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    cb(null, `${crypto.randomUUID()}${EXTENSION_BY_MIME[file.mimetype] ?? ".bin"}`)
  },
})

// Previously any `image/*` was accepted, which included image/svg+xml — an SVG
// is an XML document that executes script when rendered, and these files are
// handed to OCR and vision pipelines and re-served to the client. The allowlist
// is now exact.
const fileFilter = (req, file, cb) => {
  if (Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, file.mimetype)) {
    return cb(null, true)
  }
  const error = new Error("Only PDF and PNG/JPEG/WebP/GIF files are allowed.")
  error.status = 415
  error.data = { code: "unsupported_media_type", message: error.message }
  cb(error)
}

export default multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 20,
    fieldSize: 1 * 1024 * 1024,
    parts: 25,
    headerPairs: 100,
  },
})
