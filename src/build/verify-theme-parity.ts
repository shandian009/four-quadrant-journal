export function assertThemeParity(themes: object): void {
  const entries = Object.entries(themes) as Array<[string, object]>;
  if (entries.length === 0) throw new Error('没有可验证的主题');
  const expected = Object.keys(entries[0][1]).sort().join('|');
  for (const [id, tokens] of entries.slice(1)) {
    const actual = Object.keys(tokens).sort().join('|');
    if (actual !== expected) throw new Error(`主题令牌不一致：${id}`);
  }
}
