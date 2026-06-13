const mongoose = require('mongoose');

const uri = 'mongodb+srv://sidv6213:Hello1234@cluster0.pgdilqb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkPlans() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const plans = await db.collection('plans').find({}).toArray();
    
    plans.forEach(p => {
      console.log(`Plan Name: ${p.name}`);
      console.log(`All keys: ${Object.keys(p).join(', ')}`);
      if (p.wpPlanId || p.wp_plan_id) console.log(`=> wpPlanId: ${p.wpPlanId || p.wp_plan_id}`);
      else console.log('=> No wpPlanId found in this document');
      console.log('---');
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkPlans();
