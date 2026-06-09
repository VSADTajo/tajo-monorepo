import multer from "multer";

const storage = multer.memoryStorage();

export const fileFilter = (
    req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const allowedTypes = [
        "text/csv",
        "application/xml",
        "text/xml",
        "application/json",
        "text/plain",
        "application/pdf",
        "image/png",
        "text/html",
        "application/octet-stream",
        "text/html",
        "application/octet-stream",
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
    },
});

