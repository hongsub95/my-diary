"""프로젝트 루트에서 python -m scripts.check_kakao_search로 실제 검색 1회 검증."""

from app.places.providers import PlaceProviderError, get_provider


def main() -> int:
    """키·검색 결과 원문을 출력하거나 DB에 저장하지 않는다."""
    try:
        items = get_provider("kakao").search("성수 카페", 1)
    except PlaceProviderError as error:
        print(f"kakao_search_failed: {error.reason}")
        return 1
    print(f"kakao_search_ok: count={len(items)}, provider=kakao")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
