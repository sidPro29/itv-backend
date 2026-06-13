const fs = require('fs');
const mongoose = require('mongoose');

const uri = 'mongodb+srv://sidv6213:Hello1234@cluster0.pgdilqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function analyze() {
  const files = [
    '/Users/sidv1605/Desktop/professional/itv-androidTv/app/src/main/assets/movies_data.json',
    '/Users/sidv1605/Desktop/professional/itv-androidTv/app/src/main/assets/tvshows_data.json',
    '/Users/sidv1605/Desktop/professional/itv-androidTv/app/src/main/assets/videos_data.json'
  ];

  const uniqueLevels = new Set();
  const assetsWithLevels = [];

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.results && Array.isArray(data.results)) {
        items = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      }

      items.forEach(item => {
        let levels = item.membership_level;

        if (levels && typeof levels === 'string' && levels.trim() !== '') {
          const levelsArray = levels.split(',').map(s => s.trim()).filter(s => s);
          if (levelsArray.length > 0) {
            assetsWithLevels.push({
              wp_asset_id: item.asset_id,
              title: item.title,
              levels: levelsArray
            });
            levelsArray.forEach(l => uniqueLevels.add(l));
          }
        }
      });
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }

  console.log('Total old assets with non-empty membership levels:', assetsWithLevels.length);
  console.log('Unique membership level values found in JSONs:', Array.from(uniqueLevels));

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const plans = await db.collection('plans').find({}).toArray();
    
    console.log(`\nFound ${plans.length} plans in the DB.`);
    plans.forEach(p => {
      console.log(`Plan ID: ${p._id}, Name: ${p.name}, WP ID: ${p.wp_id || p.wpId || 'None'}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

analyze();
