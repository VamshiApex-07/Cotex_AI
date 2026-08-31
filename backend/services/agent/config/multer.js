import fs from "fs"
import path from "path"
import multer from "multer"

// Resolve temp directory relative to the current file
const uploadDir = path.resolve(import.meta.dirname, "../temp")

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir)
  },
  filename(req, file, cb) {
    // Sanitizing spaces and calling Date.now()
    const sanitizedName = file.originalname.replace(/\s+/g, "_")
    cb(null, `${Date.now()}-${sanitizedName}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowedMimetypes = ["application/pdf"]
  
  if (allowedMimetypes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
    cb(null, true)
  } else {
    cb(new Error("Only PDF and image files are allowed."))
  }
}

export default multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB Limit
  }
})