import { isAxiosError } from 'axios';

import type { ApiErrorPayload } from './types';

const FALLBACK_ERROR: ApiErrorPayload = {
  code: 'UNKNOWN_ERROR',
  message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
  field: null,
};

export function getApiError(error: unknown): ApiErrorPayload {
  if (!isAxiosError(error)) return FALLBACK_ERROR;

  const data = error.response?.data;
  if (
    data &&
    typeof data === 'object' &&
    typeof data.code === 'string' &&
    typeof data.message === 'string' &&
    ('field' in data)
  ) {
    return { ...data, message: data.message.replaceAll('스페이스를', '공간을').replaceAll('스페이스는', '공간은').replaceAll('스페이스로', '공간으로').replaceAll('스페이스', '공간') } as ApiErrorPayload;
  }

  return error.code === 'ERR_NETWORK'
    ? { code: 'NETWORK_ERROR', message: '서버에 연결할 수 없습니다. API 주소와 서버 상태를 확인해주세요.', field: null }
    : FALLBACK_ERROR;
}
