/**
 * Script to fix shipment collection indexes
 * Removes the old trackingNumber_1 unique index that causes duplicate key errors
 * 
 * Run with: node scripts/fix-shipment-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

async function fixShipmentIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('shipments');

    // List all indexes
    console.log('\n📋 Current indexes on shipments collection:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check if trackingNumber_1 index exists
    const trackingNumberIndex = indexes.find(idx => idx.name === 'trackingNumber_1');
    
    if (trackingNumberIndex) {
      console.log('\n⚠️  Found problematic index: trackingNumber_1');
      console.log('🗑️  Dropping trackingNumber_1 index...');
      
      await collection.dropIndex('trackingNumber_1');
      console.log('✅ Successfully dropped trackingNumber_1 index');
    } else {
      console.log('\n✅ trackingNumber_1 index not found - no action needed');
    }

    // Also check for any other problematic null unique indexes
    const problematicIndexes = indexes.filter(idx => 
      idx.unique && 
      !['_id_', 'orderCode_1'].includes(idx.name)
    );

    if (problematicIndexes.length > 0) {
      console.log('\n⚠️  Other unique indexes found (review if needed):');
      problematicIndexes.forEach(idx => {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });
    }

    // List final indexes
    console.log('\n📋 Final indexes on shipments collection:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixShipmentIndex();


