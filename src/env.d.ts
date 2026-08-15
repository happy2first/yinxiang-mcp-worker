interface Env {
  readonly YINXIANG_DEVELOPER_TOKEN?: string;
  readonly YINXIANG_NOTESTORE_URL?: string;
  readonly UPSTREAM_TIMEOUT_MS?: string;
  readonly MAX_RESPONSE_BYTES?: string;
  readonly TEAM_DOMAIN?: string;
  readonly POLICY_AUD?: string;
}

declare namespace Cloudflare {
  interface Env {
    readonly YINXIANG_DEVELOPER_TOKEN?: string;
    readonly YINXIANG_NOTESTORE_URL?: string;
    readonly UPSTREAM_TIMEOUT_MS?: string;
    readonly MAX_RESPONSE_BYTES?: string;
    readonly TEAM_DOMAIN?: string;
    readonly POLICY_AUD?: string;
  }
}
