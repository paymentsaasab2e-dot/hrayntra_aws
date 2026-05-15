// File   : pass1SkillsMatch.cjs
// Purpose: Deterministic skills match (required / preferred / adjacency).
// Part of: HRJob+Candidate Matching Pipeline v1.0

const ADJACENCY_MAP = {
  docker: ['kubernetes', 'podman', 'containerd'],
  kubernetes: ['docker', 'helm', 'openshift'],
  postgresql: ['mysql', 'sqlite', 'mariadb'],
  mysql: ['postgresql', 'mariadb', 'sqlite'],
  react: ['vue', 'angular', 'svelte', 'nextjs', 'next.js'],
  angular: ['react', 'vue', 'typescript'],
  python: ['r', 'julia'],
  tensorflow: ['pytorch', 'keras', 'jax'],
  pytorch: ['tensorflow', 'keras'],
  aws: ['gcp', 'azure', 'cloudflare'],
  gcp: ['aws', 'azure'],
  azure: ['aws', 'gcp'],
  'apache spark': ['hadoop', 'flink', 'databricks'],
  airflow: ['prefect', 'dagster', 'luigi'],
  mongodb: ['couchdb', 'dynamodb', 'firestore'],
  redis: ['memcached', 'hazelcast'],
  elasticsearch: ['opensearch', 'solr'],
  kafka: ['rabbitmq', 'pulsar', 'nats'],
  java: ['kotlin', 'scala', 'groovy'],
  'node.js': ['deno', 'express', 'fastify'],
  go: ['rust', 'c++'],
  agile: ['scrum', 'kanban', 'jira'],
};

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function listNorm(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(norm).filter(Boolean);
}

function skillMatch(requiredSkill, candidateSkills) {
  const rs = norm(requiredSkill);
  if (!rs) return false;
  for (const c of candidateSkills) {
    if (!c) continue;
    if (c === rs) return true;
    if (c.includes(rs) || rs.includes(c)) return true;
  }
  return false;
}

function computePass1(candidateSkills, jobRequiredSkills, jobPreferredSkills) {
  const cand = listNorm(candidateSkills);
  const req = listNorm(jobRequiredSkills);
  const pref = listNorm(jobPreferredSkills);

  const matchedRequired = [];
  const missingRequired = [];
  for (const r of req) {
    if (skillMatch(r, cand)) matchedRequired.push(r);
    else missingRequired.push(r);
  }

  let scoreRequired = 70;
  if (req.length === 0) scoreRequired = 70;
  else scoreRequired = (matchedRequired.length / req.length) * 70;

  const matchedPreferred = [];
  const missingPreferred = [];
  for (const p of pref) {
    if (skillMatch(p, cand)) matchedPreferred.push(p);
    else missingPreferred.push(p);
  }

  let scorePreferred = 20;
  if (pref.length === 0) scorePreferred = 20;
  else scorePreferred = (matchedPreferred.length / pref.length) * 20;

  const jobUnion = [...new Set([...req, ...pref])];
  let adjacencyBonus = 0;
  for (const js of jobUnion) {
    const key = js.replace(/\s+/g, ' ').trim();
    const neighbors = ADJACENCY_MAP[key] || ADJACENCY_MAP[key.replace(/\.js$/i, '')];
    if (!neighbors) continue;
    for (const n of neighbors) {
      if (skillMatch(n, cand)) {
        adjacencyBonus += 2;
        break;
      }
    }
    if (adjacencyBonus >= 10) break;
  }
  adjacencyBonus = Math.min(10, adjacencyBonus);

  let final = Math.min(100, Math.max(0, scoreRequired + scorePreferred + adjacencyBonus));
  if (req.length > 0 && matchedRequired.length === 0) {
    final = Math.min(20, final);
  }

  return {
    score: Math.round(final * 100) / 100,
    matchedRequired,
    missingRequired,
    matchedPreferred,
    adjacencyBonus,
    breakdown: {
      required: Math.round(scoreRequired * 100) / 100,
      preferred: Math.round(scorePreferred * 100) / 100,
      adjacency: adjacencyBonus,
    },
  };
}

module.exports = { computePass1, ADJACENCY_MAP };
