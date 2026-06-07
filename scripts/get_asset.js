const mongoose = require('mongoose');
require('dotenv').config();

async function getAsset() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const doc = await mongoose.connection.db.collection('mediaassets').findOne({
      $or: [
        { _id: new mongoose.Types.ObjectId("6a206fe689b3b06b8e986351") },
        { _id: "6a206fe689b3b06b8e986351" }
      ]
    });
    console.log('--- Database Media Asset ---');
    console.log(JSON.stringify(doc, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

getAsset();
