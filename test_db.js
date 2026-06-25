const mongoose = require('mongoose');
const uri = "mongodb+srv://sidv6213:Hello1234@cluster0.pgdilqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.useDb('test'); // default is probably 'test' or 'interplanetary_tv'
  const collections = await db.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  const Article = mongoose.connection.collection('articles');
  const doc = await Article.findOne({});
  console.log("Article in Atlas:", doc ? doc.imageUrl : null);
  process.exit();
});
