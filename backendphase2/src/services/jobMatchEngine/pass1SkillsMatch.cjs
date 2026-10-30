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

const SKILL_ALIASES = {
  'react.js': 'react',
  reactjs: 'react',
  'node.js': 'node',
  nodejs: 'node',
  'next.js': 'next',
  nextjs: 'next',
  typescript: 'ts',
  javascript: 'js',
  postgresql: 'postgres',
  mongodb: 'mongo',
  'tailwind css': 'tailwind',
  tailwindcss: 'tailwind',
};

function norm(s) {
  const cleaned = String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const aliasKey = cleaned.replace(/[\s.-]+/g, '');
  return SKILL_ALIASES[cleaned] || SKILL_ALIASES[aliasKey] || cleaned;
}

function listNorm(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(norm).filter(Boolean))];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when `needle` appears as a whole token inside `haystack` (not "react" inside "reactys"). */
function containsSkillToken(haystack, needle) {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n || n.length < 2) return false;
  if (h === n) return true;
  const re = new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(n)}([^a-z0-9+#]|$)`, 'i');
  return re.test(h);
}

function skillMatch(requiredSkill, candidateSkills) {
  const rs = norm(requiredSkill);
  if (!rs) return false;
  for (const c of candidateSkills) {
    if (!c) continue;
    if (c === rs) return true;
    // Token-aware only — bare substring matching caused false hits (react ⊂ reactys).
    if (containsSkillToken(c, rs) || containsSkillToken(rs, c)) return true;
  }
  return false;
}

function computePass1(candidateSkills, jobRequiredSkills, jobPreferredSkills) {
  const cand = listNorm(candidateSkills);
  const req = listNorm(jobRequiredSkills);
  const pref = listNorm(jobPreferredSkills);

  // No structured skills on the JD → neutral mid score so Pass 3 (semantic) / Pass 2
  // drive ranking instead of giving every candidate a free ~90 skills score.
  if (req.length === 0 && pref.length === 0) {
    return {
      score: 50,
      matchedRequired: [],
      missingRequired: [],
      matchedPreferred: [],
      adjacencyBonus: 0,
      breakdown: {
        required: 0,
        preferred: 0,
        adjacency: 0,
        neutral: 50,
      },
    };
  }

  const matchedRequired = [];
  const missingRequired = [];
  for (const r of req) {
    if (skillMatch(r, cand)) matchedRequired.push(r);
    else missingRequired.push(r);
  }

  let scoreRequired = 0;
  if (req.length > 0) {
    scoreRequired = (matchedRequired.length / req.length) * 70;
  } else {
    // Preferred-only JD: keep a modest base so preferred overlap still ranks.
    scoreRequired = 25;
  }

  const matchedPreferred = [];
  const missingPreferred = [];
  for (const p of pref) {
    if (skillMatch(p, cand)) matchedPreferred.push(p);
    else missingPreferred.push(p);
  }

  let scorePreferred = 0;
  if (pref.length > 0) {
    scorePreferred = (matchedPreferred.length / pref.length) * (req.length > 0 ? 20 : 55);
  } else if (req.length > 0) {
    // Required-only JD: do not gift preferred points.
    scorePreferred = 0;
  }

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
