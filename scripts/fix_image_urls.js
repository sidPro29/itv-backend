const { MongoClient } = require('mongodb');
const URI = 'mongodb+srv://sidv6213:Hello1234@cluster0.pgdilqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const PROD_URL = 'https://api.interplanetary.tv/api/';
const localhostRx = /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\//;

async function fix() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('Connected to prod DB');
  const col = client.db('test').collection('mediaassets');
  const docs = await col.find({ images: { $exists: true } }).toArray();
  console.log(`Scanning ${docs.length} documents...`);
  let fixed = 0;
  for (const doc of docs) {
    if (!doc.images || !doc.images.some(img => img && localhostRx.test(img))) continue;
    const newImages = doc.images.map(img =>
      img && localhostRx.test(img) ? img.replace(localhostRx, PROD_URL) : img
    );
    await col.updateOne({ _id: doc._id }, { $set: { images: newImages } });
    console.log('  Fixed:', doc.title);
    fixed++;
  }
  console.log(`\nDone. Fixed ${fixed} documents.`);
  await client.close();
}
fix().catch(console.error);
