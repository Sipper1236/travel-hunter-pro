import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function createRegionCache({ directory = join(process.cwd(), '.cache', 'regions'), ttlMs = 24 * 60 * 60 * 1000, now = Date.now } = {}) {
  const pending = new Map();
  return async (name, lookup) => {
    const key = name.trim().toLocaleLowerCase('en');
    if (pending.has(key)) return pending.get(key);
    const task = (async () => {
      const file = join(directory, `${createHash('sha256').update(key).digest('hex')}.json`);
      let cached;
      try {
        const record = JSON.parse(await readFile(file, 'utf8'));
        if (record.version === 1 && Number.isFinite(record.savedAt) && record.savedAt <= now() && record.value?.region && Array.isArray(record.value.airports) && record.value.airports.length) cached = record;
      } catch { /* Missing or unreadable cache is a miss. */ }
      const annotate = (record, status) => ({ ...record.value, cache: { status, savedAt: new Date(record.savedAt).toISOString() } });
      if (cached && now() - cached.savedAt < ttlMs) return annotate(cached, 'hit');
      let value;
      try { value = await lookup(name); }
      catch (error) { if (cached) return annotate(cached, 'stale'); throw error; }
      if (!value.airports?.length) return {...value, cache:{status:'not_cached'}};
      const record = { version: 1, savedAt: now(), value };
      let temp;
      try {
        await mkdir(directory, {recursive:true});
        temp = `${file}.${randomUUID()}.tmp`;
        await writeFile(temp, JSON.stringify(record), {mode:0o600});
        await rename(temp, file);
      } catch { if (temp) await unlink(temp).catch(() => {}); }
      return annotate(record, 'fresh');
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };
}
