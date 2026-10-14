require('dotenv').config({ path: __dirname + '/../.env' });
const assert = require('assert');
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth');
const { User, Booking, Notification, ProviderProfile, Service, sequelize } = require('../models');

async function testCompleteNotificationFlow() {
  console.log('====================================================');
  console.log(' FIXIT LOCAL - COMPLETE BOOKING NOTIFICATION AUDIT');
  console.log('====================================================\n');

  const secret = getJwtSecret();
  assert(secret, 'JWT Secret must be configured');

  // 1. Identify Test Users
  console.log('1. Loading test entities from database...');
  const customer = await User.findOne({ where: { role: 'customer', status: 'active' }, order: [['id', 'DESC']] });
  assert(customer, 'Active customer must exist in DB');

  const provider = await User.findOne({ where: { email: 'test.plumber01@fixitlocal.test' } });
  assert(provider, 'Provider test.plumber01@fixitlocal.test must exist in DB');

  const providerProfile = await ProviderProfile.findOne({ where: { user_id: provider.id } });
  assert(providerProfile, 'Provider profile must exist');

  const admin = await User.findOne({ where: { role: 'admin', status: 'active' } });
  assert(admin, 'Active admin must exist in DB');

  const service = await Service.findByPk(2); // Plumbing Fix
  assert(service, 'Service #2 (Plumbing Fix) must exist');

  console.log(`   ✓ Customer: ID ${customer.id} (${customer.email})`);
  console.log(`   ✓ Provider: ID ${provider.id} (${provider.email})`);
  console.log(`   ✓ Admin:    ID ${admin.id} (${admin.email})`);
  console.log(`   ✓ Service:  ID ${service.id} ("${service.title}")\n`);

  // 2. Generate Authenticated JWT Tokens
  const customerToken = jwt.sign({ id: customer.id, role: customer.role, email: customer.email }, secret, { expiresIn: '1h' });
  const providerToken = jwt.sign({ id: provider.id, role: provider.role, email: provider.email }, secret, { expiresIn: '1h' });
  const adminToken = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, secret, { expiresIn: '1h' });

  // 3. Connect Real-time Socket.IO Clients
  console.log('2. Connecting authenticated Socket.IO clients...');
  const SOCKET_URL = 'http://localhost:5000';

  const custSocket = io(SOCKET_URL, {
    auth: { token: `Bearer ${customerToken}` },
    transports: ['websocket', 'polling']
  });

  const provSocket = io(SOCKET_URL, {
    auth: { token: `Bearer ${providerToken}` },
    transports: ['websocket', 'polling']
  });

  const adminSocket = io(SOCKET_URL, {
    auth: { token: `Bearer ${adminToken}` },
    transports: ['websocket', 'polling']
  });

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve)),
    new Promise((resolve) => adminSocket.on('connect', resolve))
  ]);

  console.log('   ✓ Customer Socket connected:', custSocket.id);
  console.log('   ✓ Provider Socket connected:', provSocket.id);
  console.log('   ✓ Admin Socket connected:   ', adminSocket.id);

  // Explicitly join rooms to test both handshake & join_user
  custSocket.emit('join_user', customer.id);
  provSocket.emit('join_user', provider.id);
  adminSocket.emit('join_user', admin.id);

  // 4. Set up Real-time Event Listeners
  console.log('\n3. Registering real-time "notification" listeners on all sockets...');
  const receivedNotifs = {
    customer: [],
    provider: [],
    admin: []
  };

  custSocket.on('notification', (data) => {
    receivedNotifs.customer.push(data);
  });

  provSocket.on('notification', (data) => {
    receivedNotifs.provider.push(data);
  });

  adminSocket.on('notification', (data) => {
    receivedNotifs.admin.push(data);
  });

  // 5. Create a Real Booking through HTTP API
  console.log('\n4. Executing real booking creation: POST /api/bookings...');
  // Pick an open future weekday slot that has no conflict
  const { Op } = require('sequelize');
  let bookingDate = null;
  let bookingTime = null;
  const candidateTimes = ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];
  for (let d = 7; d < 60; d++) {
    const candidate = new Date(Date.now() + d * 86400000);
    const day = candidate.getDay();
    if (day === 0 || day === 6) continue;
    const dateStr = candidate.toISOString().slice(0, 10);
    for (const t of candidateTimes) {
      const existing = await Booking.findOne({
        where: { provider_id: provider.id, date: dateStr, time: t, status: { [Op.notIn]: ['cancelled', 'rejected'] } }
      });
      if (!existing) {
        bookingDate = dateStr;
        bookingTime = t;
        break;
      }
    }
    if (bookingDate) break;
  }

  const bookingPayload = {
    serviceId: service.id,
    providerId: provider.id,
    serviceName: service.title,
    provider: providerProfile.business_name,
    date: bookingDate || '2026-11-20',
    time: bookingTime || '02:00 PM',
    address: '15 Anna Salai, Chennai',
    latitude: 13.0827,
    longitude: 80.2100,
    paymentMethod: 'cash',
    customerNotes: 'Automated notification test request',
    amount: 299
  };

  const bookingRes = await fetch('http://localhost:5000/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify(bookingPayload)
  });

  const bookingJson = await bookingRes.json();
  if (bookingRes.status !== 201) {
    console.error('Booking creation error response:', bookingJson);
  }
  assert.strictEqual(bookingRes.status, 201, `Booking creation must return HTTP 201 (got ${bookingRes.status}: ${bookingJson.message})`);
  assert(bookingJson.success, 'Response must indicate success: true');
  const createdBooking = bookingJson.data;
  assert(createdBooking && createdBooking.id, 'Created booking must contain valid ID');

  console.log(`   ✓ Booking created successfully! ID: ${createdBooking.id}, Number: ${createdBooking.booking_number}`);

  // 6. Wait for Real-Time Socket.IO Notification Delivery
  console.log('\n5. Awaiting real-time Socket.IO notification delivery (up to 3s)...');
  const startTime = Date.now();
  while (Date.now() - startTime < 3000) {
    if (
      receivedNotifs.customer.some(n => n.metadata?.bookingId === createdBooking.id) &&
      receivedNotifs.provider.some(n => n.metadata?.bookingId === createdBooking.id) &&
      receivedNotifs.admin.some(n => n.metadata?.bookingId === createdBooking.id)
    ) {
      break;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // 7. Verify Provider Real-Time Notification
  console.log('\n6. Verifying Provider Real-Time Notification:');
  const provReceived = receivedNotifs.provider.find(n => n.metadata?.bookingId === createdBooking.id);
  assert(provReceived, 'Provider socket MUST receive real-time notification for booking');
  assert.strictEqual(provReceived.title, 'New Service Request', 'Provider notification title must be "New Service Request"');
  assert.strictEqual(provReceived.recipient_id, provider.id, `Recipient ID must match provider User ID ${provider.id}`);
  assert.strictEqual(provReceived.type, 'booking', 'Notification type must be "booking"');
  console.log('   ✓ Title:   ', provReceived.title);
  console.log('   ✓ Message: ', provReceived.message);
  console.log('   ✓ Booking: ', provReceived.metadata?.bookingNumber);

  // 8. Verify Admin Real-Time Notification
  console.log('\n7. Verifying Admin Real-Time Notification:');
  const adminReceived = receivedNotifs.admin.find(n => n.metadata?.bookingId === createdBooking.id);
  assert(adminReceived, 'Admin socket MUST receive real-time notification for booking');
  assert.strictEqual(adminReceived.title, 'New Booking Created', 'Admin notification title must be "New Booking Created"');
  assert.strictEqual(adminReceived.recipient_id, admin.id, `Recipient ID must match admin User ID ${admin.id}`);
  assert.strictEqual(adminReceived.type, 'booking', 'Notification type must be "booking"');
  console.log('   ✓ Title:   ', adminReceived.title);
  console.log('   ✓ Message: ', adminReceived.message);
  console.log('   ✓ Booking: ', adminReceived.metadata?.bookingNumber);

  // 9. Verify Customer Real-Time Notification
  console.log('\n8. Verifying Customer Real-Time Notification:');
  const custReceived = receivedNotifs.customer.find(n => n.metadata?.bookingId === createdBooking.id);
  assert(custReceived, 'Customer socket MUST receive real-time notification for booking');
  assert.strictEqual(custReceived.title, 'Booking Request Sent', 'Customer notification title must be "Booking Request Sent"');
  assert.strictEqual(custReceived.recipient_id, customer.id, `Recipient ID must match customer User ID ${customer.id}`);
  assert.strictEqual(custReceived.type, 'booking', 'Notification type must be "booking"');
  console.log('   ✓ Title:   ', custReceived.title);
  console.log('   ✓ Message: ', custReceived.message);
  console.log('   ✓ Booking: ', custReceived.metadata?.bookingNumber);

  // 10. Database Persistence & Deduplication Verification
  console.log('\n9. Querying MySQL "notifications" table directly...');
  const allRecent = await Notification.findAll({
    order: [['id', 'DESC']],
    limit: 20
  });
  const dbNotifs = allRecent.filter(n => {
    const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
    return meta?.bookingId === createdBooking.id;
  });

  console.log(`   ✓ Found ${dbNotifs.length} total database records for booking ID ${createdBooking.id}`);
  const activeAdminCount = await User.count({ where: { role: 'admin', status: 'active' } });
  assert.strictEqual(dbNotifs.length, 2 + activeAdminCount, 'Exact notification count must match 1 customer + 1 provider + active admins');

  const dbCust = dbNotifs.filter(n => n.recipient_id === customer.id);
  const dbProv = dbNotifs.filter(n => n.recipient_id === provider.id);
  const dbAdmin = dbNotifs.filter(n => n.recipient_id === admin.id);

  assert.strictEqual(dbCust.length, 1, 'Exactly 1 notification record must exist for customer');
  assert.strictEqual(dbProv.length, 1, 'Exactly 1 notification record must exist for provider');
  assert.strictEqual(dbAdmin.length, 1, 'Exactly 1 notification record must exist for admin');
  console.log('   ✓ Customer DB Record: ID', dbCust[0].id, '| Title:', dbCust[0].title);
  console.log('   ✓ Provider DB Record: ID', dbProv[0].id, '| Title:', dbProv[0].title);
  console.log('   ✓ Admin DB Record:    ID', dbAdmin[0].id, '| Title:', dbAdmin[0].title);

  // 11. Verify HTTP GET /api/notifications for Provider
  console.log('\n10. Verifying HTTP GET /api/notifications for Provider...');
  const provHttpRes = await fetch('http://localhost:5000/api/notifications', {
    headers: { 'Authorization': `Bearer ${providerToken}` }
  });
  assert.strictEqual(provHttpRes.status, 200, 'GET /api/notifications must return 200 OK');
  const provHttpData = await provHttpRes.json();
  assert(provHttpData.success, 'Response must be success');
  const provHttpList = provHttpData.data?.notifications || [];
  const foundInList = provHttpList.find(n => n.id === dbProv[0].id);
  assert(foundInList, 'Provider notification must be present in HTTP list');
  assert.strictEqual(foundInList.read, false, 'Notification must initially be unread');
  console.log(`   ✓ Provider has ${provHttpList.length} notifications, unread count: ${provHttpData.data?.unreadCount}`);

  // 12. Verify Mark As Read: PUT /api/notifications/:id/read
  console.log('\n11. Testing PUT /api/notifications/:id/read...');
  const markRes = await fetch(`http://localhost:5000/api/notifications/${dbProv[0].id}/read`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${providerToken}` }
  });
  assert.strictEqual(markRes.status, 200, 'Mark read must return 200 OK');
  await dbProv[0].reload();
  assert.strictEqual(dbProv[0].read, true, 'Database record must be updated to read: true');
  console.log('   ✓ Database notification marked as read in MySQL');

  // 13. Test Socket Reconnection Deduplication
  console.log('\n12. Testing Socket Reconnect and listener deduplication...');
  let extraProvNotifs = 0;
  provSocket.on('notification', () => { extraProvNotifs++; });
  provSocket.disconnect();
  provSocket.connect();
  await new Promise(r => setTimeout(r, 500));
  assert.strictEqual(extraProvNotifs, 0, 'No unexpected extra notifications upon socket reconnect');
  console.log('   ✓ Reconnection verified cleanly with zero duplicate emissions');

  // Clean up sockets
  custSocket.disconnect();
  provSocket.disconnect();
  adminSocket.disconnect();

  console.log('\n====================================================');
  console.log(' ALL NOTIFICATION FLOW VERIFICATIONS PASSED (100%)');
  console.log(' Real-time Socket.IO + MySQL Persistence Verified!');
  console.log('====================================================\n');
  process.exit(0);
}

testCompleteNotificationFlow().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
