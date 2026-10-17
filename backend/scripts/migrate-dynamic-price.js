import prisma from '../src/config/db.js';

async function migrate() {
  console.log('🔄 Checking / applying database columns for isDynamicPrice & minPrice...');
  try {
    const existingCols = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Product' 
      AND TABLE_SCHEMA = DATABASE()
    `);
    const colNames = existingCols.map((c) => c.COLUMN_NAME);

    if (!colNames.includes('isDynamicPrice')) {
      console.log('➕ Adding isDynamicPrice column...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`Product\` ADD COLUMN \`isDynamicPrice\` BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      console.log('✅ Added isDynamicPrice');
    } else {
      console.log('✓ isDynamicPrice column already exists');
    }

    if (!colNames.includes('minPrice')) {
      console.log('➕ Adding minPrice column...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE \`Product\` ADD COLUMN \`minPrice\` DECIMAL(12, 2) NULL DEFAULT 0;
      `);
      console.log('✅ Added minPrice');
    } else {
      console.log('✓ minPrice column already exists');
    }

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

migrate();
