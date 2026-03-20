/**
 * Database Logger Utility
 * Logs data being stored in the database in JSON format
 */

export const dbLogger = {
  logCreate(entity, data) {
    console.log('\n' + '='.repeat(80));
    console.log(`📝 [CREATE] ${entity.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80) + '\n');
  },

  logUpdate(entity, id, data) {
    console.log('\n' + '='.repeat(80));
    console.log(`✏️  [UPDATE] ${entity.toUpperCase()} (ID: ${id})`);
    console.log('='.repeat(80));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(80) + '\n');
  },

  logDelete(entity, id) {
    console.log('\n' + '='.repeat(80));
    console.log(`🗑️  [DELETE] ${entity.toUpperCase()} (ID: ${id})`);
    console.log('='.repeat(80) + '\n');
  },
};
