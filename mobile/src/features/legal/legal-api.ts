import { apiClient } from '@/shared/api/client';

// 약관과 개인정보 처리방침은 서버가 내려준다. 화면에 글을 박아두지 않는 이유는
// app/legal/service.py에 적혀 있다 — 웹과 앱이 서로 다른 약관을 보여주는 상태를
// 막고, 문구를 고칠 때 앱 스토어 심사를 기다리지 않기 위해서다.

/** 공개 중인 문서 코드. 서버의 app/legal/service.py DOCUMENTS와 같아야 한다. */
export const LEGAL_DOCUMENTS = {
  privacy: 'privacy-policy',
  terms: 'terms-of-service',
} as const;

export type LegalDocumentCode = (typeof LEGAL_DOCUMENTS)[keyof typeof LEGAL_DOCUMENTS];

/** 서버가 내려주는 본문 한 덩어리. 종류에 따라 채워지는 필드가 다르다. */
export type LegalBlock = {
  type: 'heading' | 'paragraph' | 'bullet' | 'table' | 'callout';
  text: string | null;
  /** 제목 단계. 2가 절, 3이 소절이다. */
  level: number | null;
  /** 표의 행 목록. 첫 행이 머리글이다. */
  rows: string[][] | null;
};

export type LegalDocument = {
  code: string;
  title: string;
  /** 문서 파일의 마지막 수정일. 정식 공고일은 본문 부칙을 따른다. */
  updated_at: string;
  blocks: LegalBlock[];
};

/**
 * 약관 문서 하나를 가져온다.
 *
 * **인증이 필요 없다.** 가입하기 전에 약관을 읽어야 동의할 수 있기 때문이다.
 * 응답의 blocks는 이미 화면이 그릴 수 있는 형태라 마크다운 파서가 필요 없다.
 */
export async function fetchLegalDocument(code: string): Promise<LegalDocument> {
  const response = await apiClient.get<LegalDocument>(`/legal/documents/${code}`);
  return response.data;
}
