# 나의 일기(내일) 모바일

Expo 기반 React Native 앱입니다. 백엔드 계약은 `../docs/API_SPEC.md`를 따르며,
구현된 API의 최종 기준은 실행 중인 서버의 `/openapi.json`입니다.

## 실행

1. `.env.example`을 `.env.local`로 복사합니다.
2. 실행 기기에 맞게 `EXPO_PUBLIC_API_BASE_URL`을 설정합니다.
3. 백엔드 서버를 실행합니다.
4. `npm.cmd start`를 실행합니다.

| 실행 환경 | API 호스트 |
|---|---|
| Android 에뮬레이터 | `http://10.0.2.2:8000/api/v1` |
| iOS 시뮬레이터 | `http://localhost:8000/api/v1` |
| 실제 기기 | `http://{PC의 공유기 IP}:8000/api/v1` |

앱 인증은 `/auth/*` JWT만 사용합니다. access/refresh token은 SecureStore에 저장하며,
`401 + UNAUTHORIZED` 응답에서 refresh token을 회전한 뒤 원래 요청을 한 번 재시도합니다.

## 실제 Android 휴대폰에서 바로 수정 확인하기

개발용 APK에는 `expo-dev-client`가 포함된다. 처음 한 번 설치한 뒤 Metro 개발
서버에 연결하면 화면, 스타일, JavaScript/TypeScript 로직 변경을 Fast Refresh로
확인할 수 있다. 개발 서버와 백엔드는 PC에서 계속 실행되어 있어야 한다.

같은 공유기의 LAN 연결은 PC가 유선이고 휴대폰이 Wi-Fi여도 사용할 수 있다.
기기 간 접근이 제한된 네트워크에서는 Metro용 HTTPS 터널을 사용한다.
기존 웹 개발 서버와 충돌하지 않도록 휴대폰 개발 서버의 기본 포트는 8082다.

```powershell
cd D:\hongdate-app\my-diary\mobile
$env:EXPO_PUBLIC_API_BASE_URL = 'https://현재-API-호스트/api/v1'
npm.cmd run start:device
```

HTTPS 터널로 연결할 경우 먼저 별도 창에서 저장소 루트의
`outputs/mobile-test/cloudflared.exe tunnel --url http://127.0.0.1:8082 --protocol http2 --no-autoupdate`를
실행한다. 출력된 HTTPS 주소를 아래 환경변수에 넣고 Metro를 시작한다.

```powershell
$env:EXPO_PACKAGER_PROXY_URL = 'https://현재-Metro-호스트.trycloudflare.com'
$env:NODE_OPTIONS = "$env:NODE_OPTIONS --dns-result-order=ipv4first".Trim()
npm.cmd run start:device -- --localhost
```

휴대폰의 개발용 앱에서 Metro의 HTTPS 주소를 입력하거나 해당 개발 서버의 QR / 앱 열기
링크로 연결한다. API용 터널과 Metro용 터널은 서로 다른 서버를 연결하므로 구별한다.
터널 주소가 바뀌면 서버 시작 환경변수와 휴대폰의 연결 주소를 갱신한다.
API 환경변수 변경 후에는 Metro를 다시 시작하고 앱을 다시 로드한다.

네이티브 라이브러리, Android 권한/설정, Expo SDK를 변경할 때는 개발 APK도 다시 빌드한다.
화면 코드만 수정할 때는 재빌드하지 않는다. 개발 APK를 다시 만드는 명령은 다음과 같다.

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA/Android/Sdk"
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
npx.cmd expo prebuild --platform android --no-install
cd android
.\gradlew.bat :app:assembleDebug '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a' --console=plain
```

APK 경로는 `android/app/build/outputs/apk/debug/app-debug.apk`다. 개발 APK는 배포용으로
사용하지 않는다. 공식 참고: https://docs.expo.dev/develop/development-builds/introduction/

현재 인증과 메뉴는 실제 API를 호출합니다. 스페이스·일정·장소·일기·사진은 백엔드 구현
전까지 `docs/API_SPEC.md` 응답 형태를 따르는 mock repository를 사용합니다.
