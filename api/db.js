// api/db.js — Upstash Serverless Redis REST Gateway

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://exact-dinosaur-77555.upstash.io';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAAAS7zAAIgcDI4NGQ2MWU5OTI2ODA0MzMzOTE4NTdhMjdjM2JmNmQ1Yw';

async function redisCommand(command, ...args) {
  try {
    const url = `${UPSTASH_REDIS_REST_URL}/${command}/${args.map(a => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))).join('/')}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`
      }
    });

    if (!res.ok) {
      throw new Error(`Upstash HTTP Error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn(`Redis command '${command}' error:`, err.message);
    return null;
  }
}

async function redisPost(commands) {
  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Redis pipeline error:', err.message);
    return null;
  }
}

module.exports = {
  redisCommand,
  redisPost,
  get: (key) => redisCommand('get', key),
  set: (key, value) => redisCommand('set', key, value),
  incr: (key) => redisCommand('incr', key),
  lpush: (key, value) => redisCommand('lpush', key, value),
  lrange: (key, start = 0, stop = 50) => redisCommand('lrange', key, start, stop),
  sadd: (key, member) => redisCommand('sadd', key, member),
  smembers: (key) => redisCommand('smembers', key)
};
