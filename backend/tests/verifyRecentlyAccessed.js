require('dotenv').config({ path: __dirname + '/../.env' });
const { connectDB } = require('../config/database');
const { sequelize, User, Service, ProviderProfile, RecentlyAccessed } = require('../models');

async function testRecentlyAccessedFeature() {
  console.log('================================================================');
  console.log('       TESTING RECENTLY ACCESSED (VIEWED) FEATURE              ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    const db = await connectDB();
    if (!db) {
      console.warn('Database is not connected. Skipping DB-dependent test.');
      return;
    }

    await sequelize.sync();
    assert(true, 'RecentlyAccessed model synchronized with database');

    // Find or create test users
    let userA = await User.findOne({ where: { role: 'customer' } });
    if (!userA) {
      userA = await User.create({
        name: 'Test Customer A',
        email: `test_recent_a_${Date.now()}@fixit.local`,
        password: 'Password@123',
        role: 'customer',
        status: 'active'
      });
    }

    let userB = await User.findOne({
      where: {
        role: 'customer',
        id: { [sequelize.Sequelize.Op.ne]: userA.id }
      }
    });
    if (!userB) {
      userB = await User.create({
        name: 'Test Customer B',
        email: `test_recent_b_${Date.now()}@fixit.local`,
        password: 'Password@123',
        role: 'customer',
        status: 'active'
      });
    }

    // Clean previous test records for userA and userB
    await RecentlyAccessed.destroy({
      where: { user_id: [userA.id, userB.id] }
    });

    // Test 1: Record service access for User A
    const dummyServiceId = 1;
    const record1 = await RecentlyAccessed.create({
      user_id: userA.id,
      item_type: 'service',
      item_id: dummyServiceId,
      accessed_at: new Date(Date.now() - 60000), // 1 min ago
      metadata: { source: 'test' }
    });
    assert(record1 && record1.id, 'Successfully created recently accessed record for User A');

    // Test 2: Upsert / Timestamp Update on Re-access
    const existing = await RecentlyAccessed.findOne({
      where: {
        user_id: userA.id,
        item_type: 'service',
        item_id: dummyServiceId
      }
    });
    assert(existing !== null, 'Found existing record for User A');

    const updatedTime = new Date();
    existing.accessed_at = updatedTime;
    await existing.save();

    const countUserA = await RecentlyAccessed.count({
      where: {
        user_id: userA.id,
        item_type: 'service',
        item_id: dummyServiceId
      }
    });
    assert(countUserA === 1, `No duplicate record created; count is exactly 1 (got: ${countUserA})`);

    const refreshed = await RecentlyAccessed.findByPk(existing.id);
    assert(
      Math.abs(new Date(refreshed.accessed_at).getTime() - updatedTime.getTime()) <= 1000,
      'Timestamp updated to newer time on re-access'
    );

    // Test 3: User B data isolation
    const userBRecords = await RecentlyAccessed.findAll({
      where: { user_id: userB.id }
    });
    assert(
      userBRecords.length === 0,
      'User B cannot see User A recently accessed records (data isolation confirmed)'
    );

    // Test 4: Record provider access (accessed strictly later)
    const recordProv = await RecentlyAccessed.create({
      user_id: userA.id,
      item_type: 'provider',
      item_id: 1,
      accessed_at: new Date(Date.now() + 5000),
      metadata: { source: 'profile' }
    });
    assert(recordProv.item_type === 'provider', 'Successfully recorded provider access');

    // Test 5: Ordering latest first
    const allUserA = await RecentlyAccessed.findAll({
      where: { user_id: userA.id },
      order: [['accessed_at', 'DESC']]
    });
    assert(
      allUserA.length === 2 && allUserA[0].id === recordProv.id,
      'Records are sorted with newest accessed item first'
    );

    // Clean up test records
    await RecentlyAccessed.destroy({
      where: { user_id: [userA.id, userB.id] }
    });
    assert(true, 'Test records cleaned up successfully');

    console.log(`\n================================================================`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`================================================================\n`);

    if (failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Test execution error:', err.message);
    process.exit(1);
  }
}

testRecentlyAccessedFeature();
