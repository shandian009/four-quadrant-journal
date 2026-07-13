const NETWORK_PATTERNS: Array<[string, RegExp]> = [
  ['fetch(', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['http://', /http:\/\//],
  ['https://', /https:\/\//]
];

export function findNetworkViolations(source: string): string[] {
  return NETWORK_PATTERNS.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}
