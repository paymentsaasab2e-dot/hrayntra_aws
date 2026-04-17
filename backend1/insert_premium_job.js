const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function createPremiumJob() {
  try {
    const jobPath = path.join(__dirname, 'premium_job_template.json');
    const jobData = JSON.parse(fs.readFileSync(jobPath, 'utf8'));

    // Map salary into the required fields if needed, 
    // although our template is already prepared for our schema
    const result = await prisma.job.create({
      data: jobData
    });

    console.log(`\n✅ 💎 PREMIUM JOB CREATED: "${result.title}"`);
    console.log(`📍 ID: ${result.id}`);
    console.log(`🔥 Ready for AI Match Orchestration\n`);
  } catch (error) {
    console.error('Failed to insert premium job:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createPremiumJob();
