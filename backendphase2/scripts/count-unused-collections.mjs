import { PrismaClient } from '@prisma/client';
import { MongoClient } from 'mongodb';

const prisma = new PrismaClient();

const CANDIDATES = [
  'AcademicAchievement',
  'Accomplishment',
  'Application',
  'ApplicationCommunication',
  'ApplicationTimeline',
  'CVVersion',
  'Certification',
  'CompetitiveExam',
  'Education',
  'GapExplanation',
  'Internship',
  'Job',
  'Language',
  'Notification',
  'PortfolioLink',
  'Profile',
  'Project',
  'ResumeUpload',
  'SavedJob',
  'Skill',
  'User',
  'WorkExperience',
  'office_gossip_entities',
  'office_gossip_meta',
  'user_office_gossip_profiles',
  'aria_undo_stack',
  'dashboard_stats',
  'companies',
  'employer_demo_requests',
  'token_transactions',
  'tenant_behavior_snapshots',
  'sessions',
  'teams',
  'team_members',
  'team_tasks',
];

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL missing');
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = uri.split('/').pop()?.split('?')[0] || 'jobportal';
  const db = client.db(dbName);
  console.log('DB', dbName);
  for (const name of CANDIDATES) {
    try {
      const count = await db.collection(name).estimatedDocumentCount();
      console.log(`${count}\t${name}`);
    } catch (e) {
      console.log(`ERR\t${name}\t${e.message}`);
    }
  }
  await client.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
