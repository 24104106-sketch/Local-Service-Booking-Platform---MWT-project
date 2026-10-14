require('dotenv').config({ path: __dirname + '/../.env' });
const { ProviderProfile, sequelize } = require('../models');

async function syncGps() {
  try {
    await sequelize.authenticate();
    console.log('[GPS Sync] Database connection verified.');

    const profiles = await ProviderProfile.findAll();
    let updatedCount = 0;

    for (const p of profiles) {
      let lat = p.latitude != null ? Number(p.latitude) : null;
      let lng = p.longitude != null ? Number(p.longitude) : null;

      // Parse JSON location and current_location safely
      const loc = typeof p.location === 'string' ? JSON.parse(p.location) : (p.location || {});
      const curLoc = typeof p.current_location === 'string' ? JSON.parse(p.current_location) : (p.current_location || {});

      // Extract latitude from JSON if not already populated
      if (lat == null || isNaN(lat)) {
        if (loc.lat != null && !isNaN(Number(loc.lat))) {
          lat = Number(loc.lat);
        } else if (loc.latitude != null && !isNaN(Number(loc.latitude))) {
          lat = Number(loc.latitude);
        } else if (curLoc.lat != null && !isNaN(Number(curLoc.lat))) {
          lat = Number(curLoc.lat);
        } else if (curLoc.latitude != null && !isNaN(Number(curLoc.latitude))) {
          lat = Number(curLoc.latitude);
        }
      }

      // Extract longitude from JSON if not already populated
      if (lng == null || isNaN(lng)) {
        if (loc.lng != null && !isNaN(Number(loc.lng))) {
          lng = Number(loc.lng);
        } else if (loc.longitude != null && !isNaN(Number(loc.longitude))) {
          lng = Number(loc.longitude);
        } else if (curLoc.lng != null && !isNaN(Number(curLoc.lng))) {
          lng = Number(curLoc.lng);
        } else if (curLoc.longitude != null && !isNaN(Number(curLoc.longitude))) {
          lng = Number(curLoc.longitude);
        }
      }

      let changed = false;
      if (lat != null && !isNaN(lat) && p.latitude !== lat) {
        p.latitude = lat;
        changed = true;
      }
      if (lng != null && !isNaN(lng) && p.longitude !== lng) {
        p.longitude = lng;
        changed = true;
      }

      // Also ensure address, city, state, pincode are populated if available in loc
      if (!p.address && (loc.address || curLoc.address)) {
        p.address = loc.address || curLoc.address;
        changed = true;
      }
      if (!p.city && (loc.city || curLoc.city)) {
        p.city = loc.city || curLoc.city;
        changed = true;
      }
      if (!p.state && (loc.state || curLoc.state)) {
        p.state = loc.state || curLoc.state;
        changed = true;
      }
      if (!p.pincode && (loc.pincode || curLoc.pincode)) {
        p.pincode = loc.pincode || curLoc.pincode;
        changed = true;
      }

      if (changed) {
        await p.save();
        updatedCount++;
        console.log(`[GPS Sync] Profile ID ${p.id} (${p.business_name}) synced -> lat: ${p.latitude}, lng: ${p.longitude}`);
      } else {
        console.log(`[GPS Sync] Profile ID ${p.id} (${p.business_name}) already up-to-date -> lat: ${p.latitude}, lng: ${p.longitude}`);
      }
    }

    console.log(`[GPS Sync] Synchronization complete. ${updatedCount} profiles updated.`);
    process.exit(0);
  } catch (error) {
    console.error('[GPS Sync Error]:', error);
    process.exit(1);
  }
}

syncGps();
