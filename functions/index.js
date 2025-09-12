const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();
const Buffer = require("buffer").Buffer;

// Upload profile images
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

    // Generate a UUID token for Firebase download link
    const token = uuidv4();

    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const bucketName = bucket.name;
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;

    res.status(200).json({ downloadURL });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send("Upload failed");
  }
});

// Upload post/event images
exports.uploadPostImage = functions.https.onRequest(async (req, res) => {
  try {
    const { base64, userId } = req.body;
    if (!base64 || !userId) {
      return res.status(400).send("Missing base64 or userId");
    }
    const buffer = Buffer.from(base64, "base64");
    const bucket = admin.storage().bucket();
    const filename = `postimages/${userId}-${uuidv4()}.jpg`;
    const file = bucket.file(filename);

    // Generate a UUID token for Firebase download link
    const token = uuidv4();

    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const bucketName = bucket.name;
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filename)}?alt=media&token=${token}`;

    res.status(200).json({ downloadURL });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send("Upload failed");
  }
});
