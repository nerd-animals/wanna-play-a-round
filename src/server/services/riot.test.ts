import { describe, it, expect } from 'vitest';
import { createProvisionalRiotSession, exchangeCodeForSession } from './riot';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

describe('Riot Service - Provisional Riot ID Mode', () => {
  it('RSO 승인 전 Riot ID 문자열로 임시 세션을 만든다', () => {
    const session = createProvisionalRiotSession(' Hide on bush # kr1 ');

    expect(session).toEqual({
      puuid: 'provisional:hide on bush#kr1',
      gameName: 'Hide on bush',
      tagLine: 'KR1',
      accessToken: 'provisional-riot-id',
      expiresAt: expect.any(Number),
    });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it('Riot ID 형식이 gameName#tagLine이 아니면 실패한다', () => {
    expect(() => createProvisionalRiotSession('Hide on bush')).toThrow('INVALID_RIOT_ID');
    expect(() => createProvisionalRiotSession('#KR1')).toThrow('INVALID_RIOT_ID');
    expect(() => createProvisionalRiotSession('Hide#KR1#extra')).toThrow('INVALID_RIOT_ID');
  });
});

describe('Riot Service - RSO Logic (TDD: Comprehensive Edge Cases)', () => {
  const RIOT_TOKEN_URL = 'https://auth.riotgames.com/token';
  const RIOT_USERINFO_URL = 'https://auth.riotgames.com/userinfo';

  it('1. [Happy Path] 인증 코드(code)를 전달하면 완벽한 UserSession을 반환해야 한다', async () => {
    const session = await exchangeCodeForSession('valid-code');

    expect(session).toEqual({
      puuid: 'mock-puuid-1234',
      gameName: 'Hide on bush',
      tagLine: 'KR1',
      accessToken: 'mock-access-token',
      expiresAt: expect.any(Number),
    });
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  describe('2. [Token Exchange Failures]', () => {
    it('클라이언트 인증 실패 (401) 시 RIOT_AUTH_FAILED 에러를 던져야 한다', async () => {
      server.use(
        http.post(RIOT_TOKEN_URL, () => new HttpResponse(null, { status: 401 }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('RIOT_AUTH_FAILED');
    });

    it('속도 제한 (429) 시 RIOT_RATE_LIMITED 에러를 던져야 한다', async () => {
      server.use(
        http.post(RIOT_TOKEN_URL, () => new HttpResponse(null, { status: 429 }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('RIOT_RATE_LIMITED');
    });

    it('라이엇 서버 장애 (500) 시 RIOT_SERVER_ERROR를 던져야 한다', async () => {
      server.use(
        http.post(RIOT_TOKEN_URL, () => new HttpResponse(null, { status: 500 }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('RIOT_SERVER_ERROR');
    });
  });

  describe('3. [Partial Success & Data Integrity]', () => {
    it('토큰 교환은 성공했으나 UserInfo 조회가 실패하면 전체 과정을 실패로 처리해야 한다', async () => {
      // 토큰은 정상 반환하지만, 유저 정보 조회에서 500 에러 발생 시뮬레이션
      server.use(
        http.get(RIOT_USERINFO_URL, () => new HttpResponse(null, { status: 500 }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('RIOT_USERINFO_FAILED');
    });

    it('UserInfo 응답에 필수 필드(sub/PUUID)가 누락된 경우 에러를 던져야 한다', async () => {
      server.use(
        http.get(RIOT_USERINFO_URL, () => HttpResponse.json({ game_name: 'NoPUUID' }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('MALFORMED_RIOT_RESPONSE');
    });

    it('UserInfo 응답에 Riot ID(game_name/tag_line)가 없는 계정인 경우 처리가 필요하다', async () => {
      // 롤 계정이 없는 단순 라이엇 계정일 경우
      server.use(
        http.get(RIOT_USERINFO_URL, () => HttpResponse.json({ sub: 'puuid-only' }))
      );
      await expect(exchangeCodeForSession('code')).rejects.toThrow('LOL_ACCOUNT_NOT_FOUND');
    });
  });

  describe('4. [Input Validation]', () => {
    it('빈 코드를 전달하면 즉시 에러를 던져야 한다', async () => {
      await expect(exchangeCodeForSession('')).rejects.toThrow('INVALID_AUTH_CODE');
    });
  });
});
