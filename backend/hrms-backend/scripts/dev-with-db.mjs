import { spawn } from 'child_process'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

config({ path: path.join(root, '.env') })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[dev] DATABASE_URL is missing in .env')
  process.exit(1)
}

function checkMongoPort(host = '127.0.0.1', port = 27017) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.setTimeout(1500, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

const isLocalMongo = databaseUrl.includes('127.0.0.1') || databaseUrl.includes('localhost')

if (isLocalMongo) {
  const mongoReady = await checkMongoPort()
  if (!mongoReady) {
    console.error(`
[dev] Local MongoDB is not running on 127.0.0.1:27017.
Install/start MongoDB, or set a MongoDB Atlas URL in .env.
`)
    process.exit(1)
  }
}

console.log('[dev] Setting up database schema and seed data...')

try {
  await run('npx', ['prisma', 'generate'])
  await run('npx', ['prisma', 'db', 'push'])
  await run('node', ['prisma/seed.js'])
} catch (err) {
  console.error('[dev] Database setup failed:', err.message)
  process.exit(1)
}

console.log('[dev] Database ready. Login: superadmin@hrms.local / SuperAdmin@123')

const devServer = spawn(
  'npx',
  ['ts-node-dev', '--respawn', '--transpile-only', 'src/server.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  }
)

function shutdown() {
  devServer.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
