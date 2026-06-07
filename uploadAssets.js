const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const MediaAsset = require('./models/MediaAsset');
const Plan = require('./models/Plan');

async function run() {
  try {
    console.log("Connecting to MongoDB via URI specified in .env...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected successfully!");

    // Fetch existing plans to map membership levels
    const plans = await Plan.find({});
    const planMap = {};
    plans.forEach(p => {
      if (p.name) {
        planMap[p.name.toLowerCase().trim()] = p._id;
      }
    });
    console.log(`Loaded ${plans.length} plans from the database for mapping.`);

    // Define helper to process a JSON file
    async function processFile(filePath, defaultType) {
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}. Skipping...`);
        return;
      }
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      const results = data.results || [];
      console.log(`Found ${results.length} items in ${path.basename(filePath)}. Processing...`);

      let upsertCount = 0;
      for (const item of results) {
        const assetId = Number(item.asset_id);
        if (!assetId) continue;

        // 1. Category -> Type Mapping
        let mappedType = defaultType;
        if (defaultType === "movies") {
          mappedType = "movies";
        } else if (defaultType === "tvshows") {
          mappedType = "tvshows";
        } else {
          mappedType = "video";
        }

        // 2. Languages array split by comma
        const languages = item.language
          ? item.language.split(',').map(l => l.trim()).filter(Boolean)
          : [];

        // 3. Genres array split by comma
        const genres = item.genre
          ? item.genre.split(',').map(g => g.trim()).filter(Boolean)
          : [];

        // 4. Tags array split by comma + special rules
        const tags = item.tag
          ? item.tag.split(',').map(t => t.trim()).filter(Boolean)
          : [];

        const top10Ids = [572, 65, 231, 325, 466, 570, 577, 586, 589];
        const bingeIds = [606, 492, 534, 556, 551, 557, 567, 568, 572, 580, 603];

        if (top10Ids.includes(assetId)) {
          if (!tags.includes("our top 10")) {
            tags.push("our top 10");
          }
        }
        if (bingeIds.includes(assetId)) {
          if (!tags.includes("Binge Videos")) {
            tags.push("Binge Videos");
          }
        }

        // 5. Video Url as Array
        const videoUrls = Array.isArray(item.videoUrls)
          ? item.videoUrls
          : (item.videoUrl ? [item.videoUrl] : []);

        // 6. Membership Level split by comma & mapped to plans
        const planNames = item.membership_level
          ? item.membership_level.split(',').map(p => p.trim()).filter(Boolean)
          : [];
        
        const membershipLevel = planNames.map(name => {
          const planId = planMap[name.toLowerCase().trim()] || null;
          return {
            planId,
            planName: name
          };
        });

        // 7. Map to model schema
        const assetData = {
          wp_asset_id: assetId,
          type: mappedType,
          title: item.title,
          description: item.description || "",
          images: item.imageUrl ? [item.imageUrl] : [],
          videoUrl: videoUrls,
          trailerUrl: "",
          languages: languages,
          genres: genres,
          tags: tags,
          membership_level: membershipLevel
        };

        // 8. Upsert (update if exists, insert if not) to prevent duplicate uploads
        // We query by both wp_asset_id AND type so that if the same assetId exists 
        // in different files (e.g. as a video and a tvshow), they remain separate documents.
        await MediaAsset.findOneAndUpdate(
          { wp_asset_id: assetId, type: mappedType },
          { $set: assetData },
          { upsert: true, new: true }
        );
        upsertCount++;
      }
      console.log(`Successfully upserted ${upsertCount} documents for type "${defaultType}".`);
    }

    // Paths to the three json files in the root folder
    const videosPath = path.resolve(__dirname, '../videos.json');
    const moviesPath = path.resolve(__dirname, '../movies.json');
    const tvshowsPath = path.resolve(__dirname, '../tvshows.json');

    // Run the processes
    await processFile(videosPath, "video");
    await processFile(moviesPath, "movies");
    await processFile(tvshowsPath, "tvshows");

    console.log("All uploads completed successfully!");
  } catch (error) {
    console.error("Error during upload process:", error);
  } finally {
    console.log("Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
