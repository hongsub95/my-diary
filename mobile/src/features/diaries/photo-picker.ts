import * as ImagePicker from 'expo-image-picker';

import type { PickedPhoto } from './diary-api';

// 한 번에 고를 수 있는 최대 장수. 서버의 1회 업로드 제한과 같아야 한다
// (app/diaries/photo_service.py의 MAX_FILES_PER_REQUEST).
const MAX_SELECTION = 10;

/**
 * 갤러리를 열어 사진을 고른다.
 *
 * @returns 고른 사진들. 사용자가 취소했거나 권한을 거부하면 빈 배열
 *
 * 권한을 미리 요청하지 않고 이 함수를 부를 때 요청한다. 앱을 처음 열자마자 갤러리
 * 권한을 묻는 것보다, 사진을 올리려는 순간에 묻는 편이 왜 필요한지 분명하다
 * (docs/DEVELOPMENT_BRIEF.md 7절의 위치 권한 원칙과 같은 이유).
 */
export async function pickPhotos(): Promise<PickedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    // SDK 57부터 MediaTypeOptions는 폐기됐고 문자열 배열을 쓴다.
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_SELECTION,
  });

  if (result.canceled) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    // 파일명과 형식이 비어 오는 기기가 있다. 서버는 파일 내용으로 형식을 판별하므로
    // 여기 값이 정확하지 않아도 업로드는 성공한다. 자리를 비워두지만 않으면 된다.
    fileName: asset.fileName ?? `photo-${Date.now()}-${index}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }));
}
