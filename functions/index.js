const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
admin.initializeApp();
const Buffer = require('buffer').Buffer;
exports.uploadProfileImage = functions.https.onRequest(async (req, res) => {
  try {
    const { base64, userId } = req.body;
    if (!base64 || !userId) {
      return res.status(400).send("Missing base64 or userId");
    }

    const buffer = Buffer.from(base64, "base64");
    const bucket = admin.storage().bucket();
    const filename = `profileImages/${userId}-${uuidv4()}.jpg`;
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: { contentType: "image/jpeg" }
    });

    // Make public or create a signed URL (example: public URL)
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    res.status(200).json({ downloadURL: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send("Upload failed");
  }
});
