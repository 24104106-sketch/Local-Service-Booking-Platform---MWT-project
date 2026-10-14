require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const cors = require('cors');
const http = require('http');
const { connectDB, sequelize } = require('../config/database');
const providerRoutes = require('../routes/providerRoutes');

async function testHttpEndpoints() {
  console.log('================================================================');
  console.log('   TESTING REAL HTTP API ENDPOINT: /api/providers/recommended  ');
  console.log('================================================================\n');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/providers', providerRoutes);

  await connectDB();
  const server = http.createServer(app);
  const TEST_PORT = 5099;

  await new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`✓ Test HTTP server listening on port ${TEST_PORT}`);
      resolve();
    });
  });

  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/providers`;
  const lat = 13.0827;
  const lng = 80.2100;

  try {
    const categories = ['Electrician', 'Plumber', 'Carpenter', 'AC Repair', 'Cleaning'];

    for (const cat of categories) {
      console.log(`\nTesting GET /api/providers/recommended?category=${encodeURIComponent(cat)}...`);
      const url = `${BASE_URL}/recommended?category=${encodeURIComponent(cat)}&latitude=${lat}&longitude=${lng}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.message || 'Request failed'}`);
      }

      console.log(`  ✓ Status: ${res.status} OK`);
      console.log(`  ✓ Response count: ${data.data?.count || data.data?.providers?.length || 0}`);

      const providers = data.data?.providers || [];
      if (providers.length > 0) {
        const top = providers[0];
        console.log(`  ✓ Top Provider: "${top.providerName}" (${top.category})`);
        console.log(`    - Price: ₹${top.price}`);
        console.log(`    - Distance: ${top.distanceKm} km`);
        console.log(`    - Recommendation Score: ${top.recommendationScore}`);
        console.log(`    - Status: ${top.availabilityStatus}`);
        console.log(`    - Score Breakdown: Dist=${top.scoreBreakdown?.distanceScore}, Price=${top.scoreBreakdown?.priceScore}, Qual=${top.scoreBreakdown?.qualityScore}, Rel=${top.scoreBreakdown?.reliabilityScore}`);
      }

      // Test with availableOnly=true
      const availUrl = `${BASE_URL}/recommended?category=${encodeURIComponent(cat)}&latitude=${lat}&longitude=${lng}&availableOnly=true`;
      const availRes = await fetch(availUrl);
      const availData = await availRes.json();
      const availProviders = availData.data?.providers || [];
      console.log(`  ✓ Available-only count: ${availProviders.length}`);
      const allAvailable = availProviders.every(p => p.availabilityStatus === 'AVAILABLE');
      if (!allAvailable) {
        throw new Error('Available-only search included non-available provider!');
      }
      console.log(`  ✓ All ${availProviders.length} providers in availableOnly=true are AVAILABLE.`);
    }

    console.log('\n================================================================');
    console.log('   ✓ ALL HTTP API ENDPOINT TESTS PASSED SUCCESSFULLY!          ');
    console.log('================================================================\n');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('HTTP Test Error:', err);
    server.close();
    process.exit(1);
  }
}

if (require.main === module) {
  testHttpEndpoints();
}

module.exports = { testHttpEndpoints };
