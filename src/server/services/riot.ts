import 'server-only';
import { UserSession, RsoTokenResponse, RsoUserInfo } from '@/shared/types/auth';

function normalizeRiotIdPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function createProvisionalRiotSession(riotId: string): UserSession {
  const trimmed = riotId.trim();
  const [rawGameName, rawTagLine, ...rest] = trimmed.split('#');
  const gameName = normalizeRiotIdPart(rawGameName ?? '');
  const tagLine = normalizeRiotIdPart(rawTagLine ?? '').toUpperCase();

  if (!trimmed || !gameName || !tagLine || rest.length > 0) {
    throw new Error('INVALID_RIOT_ID');
  }

  return {
    puuid: `provisional:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`,
    gameName,
    tagLine,
    accessToken: 'provisional-riot-id',
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
}

/**
 * 라이엇 인증 코드(code)를 사용하여 세션 정보를 획득합니다.
 * @param code 라이엇 RSO 인증 후 전달받은 authorization_code
 * @throws INVALID_AUTH_CODE, RIOT_AUTH_FAILED, RIOT_RATE_LIMITED, RIOT_SERVER_ERROR,
 *         RIOT_USERINFO_FAILED, MALFORMED_RIOT_RESPONSE, LOL_ACCOUNT_NOT_FOUND
 */
export async function exchangeCodeForSession(code: string): Promise<UserSession> {
  // 1. 입력값 유효성 검사
  if (!code) {
    throw new Error('INVALID_AUTH_CODE');
  }

  // 환경 변수 로드 (실제 환경에서는 .env에 정의되어야 함)
  const clientId = process.env.RIOT_CLIENT_ID || 'mock-client-id';
  const clientSecret = process.env.RIOT_CLIENT_SECRET || 'mock-client-secret';
  const redirectUri = process.env.RIOT_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  // 2. RSO 토큰 교환 요청
  const tokenResponse = await fetch('https://auth.riotgames.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    if (tokenResponse.status === 401) throw new Error('RIOT_AUTH_FAILED');
    if (tokenResponse.status === 429) throw new Error('RIOT_RATE_LIMITED');
    if (tokenResponse.status >= 500) throw new Error('RIOT_SERVER_ERROR');
    throw new Error('RIOT_AUTH_FAILED');
  }

  const tokens: RsoTokenResponse = await tokenResponse.json();

  // 3. UserInfo 조회 요청
  const userInfoResponse = await fetch('https://auth.riotgames.com/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    throw new Error('RIOT_USERINFO_FAILED');
  }

  const userInfo: RsoUserInfo = await userInfoResponse.json();

  // 4. 데이터 무결성 검증
  if (!userInfo.sub) {
    throw new Error('MALFORMED_RIOT_RESPONSE');
  }

  if (!userInfo.game_name || !userInfo.tag_line) {
    throw new Error('LOL_ACCOUNT_NOT_FOUND');
  }

  // 5. UserSession 조립 및 반환
  return {
    puuid: userInfo.sub,
    gameName: userInfo.game_name,
    tagLine: userInfo.tag_line,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}
