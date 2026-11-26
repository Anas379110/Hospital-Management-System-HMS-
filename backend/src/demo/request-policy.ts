/** Pure fictional-demo admission policy. No HTTP framework or operational imports. */
export interface DemoRequestShape {
  method: string;
  path: string;
  queryKeys: string[];
  bodyKeys: string[];
  contentLength?: string;
  transferEncoding?: string;
}
export type Admission = { allowed: true; needsViewer: boolean } | { allowed: false; code: 'DEMO_READ_ONLY' | 'DEMO_INPUT_DISABLED' };

export function admitDemoRequest(request: DemoRequestShape): Admission {
  const route = `${request.method} ${request.path}`;
  if (!['GET /api/demo/status', 'POST /api/demo/session', 'GET /api/demo/catalog'].includes(route)) return { allowed: false, code: 'DEMO_READ_ONLY' };
  // No body encoding or framing except a zero-length body is meaningful here.
  if (request.transferEncoding !== undefined || (request.contentLength !== undefined && request.contentLength !== '0') || request.queryKeys.length > 0 || request.bodyKeys.length > 0) return { allowed: false, code: 'DEMO_INPUT_DISABLED' };
  return { allowed: true, needsViewer: route === 'GET /api/demo/catalog' };
}
