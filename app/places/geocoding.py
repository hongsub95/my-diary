"""Authenticated address lookup, normalized independently of provider payloads."""

from decimal import Decimal

import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.places.errors import PlaceSearchUnavailableError


class AddressResult(BaseModel):
    address: str = Field(min_length=1, max_length=500)
    latitude: Decimal = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: Decimal = Field(ge=-180, le=180, allow_inf_nan=False)


class AddressSearchResponse(BaseModel):
    items: list[AddressResult]


class ReverseAddressResponse(BaseModel):
    address: str | None


def _documents(path: str, params: dict) -> list[dict]:
    settings = get_settings()
    key = settings.kakao_rest_api_key.get_secret_value().strip()
    if settings.place_search_provider != "kakao" or not key:
        raise PlaceSearchUnavailableError()
    try:
        with httpx.Client(timeout=settings.kakao_search_timeout_seconds) as client:
            response = client.get(
                f"https://dapi.kakao.com/v2/local/{path}.json",
                headers={"Authorization": f"KakaoAK {key}"}, params=params,
            )
            response.raise_for_status()
            documents = response.json()["documents"]
            if not isinstance(documents, list):
                raise ValueError("Invalid documents")
            return documents
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise PlaceSearchUnavailableError() from None


def search_addresses(query: str) -> AddressSearchResponse:
    documents = _documents("search/address", {"query": query, "size": 15})
    try:
        return AddressSearchResponse(items=[AddressResult(
            address=(doc.get("road_address") or {}).get("address_name") or doc["address_name"],
            latitude=doc["y"], longitude=doc["x"],
        ) for doc in documents])
    except (ValueError, KeyError, TypeError, AttributeError):
        raise PlaceSearchUnavailableError() from None


def reverse_address(latitude: float, longitude: float) -> ReverseAddressResponse:
    documents = _documents("geo/coord2address", {"x": longitude, "y": latitude})
    try:
        if not documents:
            return ReverseAddressResponse(address=None)
        doc = documents[0]
        address = (doc.get("road_address") or doc.get("address") or {}).get("address_name")
        if address is not None and (not isinstance(address, str) or len(address) > 500):
            raise ValueError("Invalid address")
        return ReverseAddressResponse(address=address or None)
    except (ValueError, KeyError, TypeError, AttributeError):
        raise PlaceSearchUnavailableError() from None
