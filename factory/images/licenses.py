"""Проверка лицензии изображения. Правило проекта: нет лицензии — нет файла.

Пропускаются ТОЛЬКО public domain и CC0 (и «no known restrictions» у Библиотеки Конгресса).
Каждая функция возвращает License или причину отказа (LicenseRejected). В License.evidence
записано, что именно ответил архив, — эта строка попадает в sources.txt.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

CC0_URL = "https://creativecommons.org/publicdomain/zero/1.0/"
PDM_URL = "https://creativecommons.org/publicdomain/mark/1.0/"

PD = "Public domain"
CC0 = "CC0 1.0"
LOC_NKR = "No known restrictions on publication"


class LicenseRejected(ValueError):
    """Изображение брать нельзя. Текст — причина на русском."""


@dataclass(frozen=True)
class License:
    name: str  # «Public domain» | «CC0 1.0» | «No known restrictions on publication»
    url: str
    evidence: str  # дословно: какие поля архива это подтверждают


def _val(meta: dict, key: str) -> str:
    v = meta.get(key)
    if isinstance(v, dict):
        v = v.get("value")
    return str(v or "").strip()


def commons(extmetadata: dict) -> License:
    """Wikimedia Commons: поля extmetadata из API (imageinfo)."""
    code = _val(extmetadata, "License").lower()
    short = _val(extmetadata, "LicenseShortName")
    copyrighted = _val(extmetadata, "Copyrighted").lower()
    attribution = _val(extmetadata, "AttributionRequired").lower()
    restrictions = _val(extmetadata, "Restrictions")
    evidence = f"License={code or '—'}; LicenseShortName={short or '—'}; Copyrighted={copyrighted or '—'}; AttributionRequired={attribution or '—'}"
    if restrictions:
        raise LicenseRejected(f"у файла отмечены ограничения ({restrictions}) — например, товарный знак или изображение человека")
    if attribution == "true":
        raise LicenseRejected(f"лицензия требует указания автора ({short or code}) — это не public domain / CC0")
    if code in ("cc0", "cc-zero") or short.upper().startswith("CC0"):
        return License(CC0, CC0_URL, evidence)
    if (code == "pd" or short.lower().startswith("public domain")) and copyrighted == "false":
        return License(PD, _val(extmetadata, "LicenseUrl") or PDM_URL, evidence)
    raise LicenseRejected(f"лицензия «{short or code or 'не указана'}» — не public domain / CC0")


def met(obj: dict) -> License:
    """The Met Open Access: isPublicDomain=true означает CC0."""
    if obj.get("isPublicDomain") is not True:
        raise LicenseRejected("The Met: isPublicDomain=false — изображение не в открытом доступе")
    if not obj.get("primaryImage"):
        raise LicenseRejected("The Met: у записи нет изображения")
    return License(CC0, CC0_URL, "The Met Open Access: isPublicDomain=true")


def aic(art: dict) -> License:
    """Art Institute of Chicago: is_public_domain=true означает CC0."""
    if art.get("is_public_domain") is not True:
        raise LicenseRejected("Art Institute of Chicago: is_public_domain=false")
    if not art.get("image_id"):
        raise LicenseRejected("Art Institute of Chicago: у записи нет изображения")
    return License(CC0, CC0_URL, "Art Institute of Chicago API: is_public_domain=true")


def smithsonian(record_access: str | None, media_access: str | None) -> License:
    """Smithsonian Open Access: и запись, и сам файл должны быть помечены CC0."""
    if (record_access or "").upper() != "CC0" or (media_access or "").upper() != "CC0":
        raise LicenseRejected(f"Smithsonian: метка использования «{media_access or record_access or 'не указана'}», а нужна CC0")
    return License(CC0, CC0_URL, "Smithsonian Open Access: metadata_usage.access=CC0; media.usage.access=CC0")


def rijksmuseum(rights_url: str | None) -> License:
    """Rijksmuseum: у цифрового изображения должна стоять ссылка на Public Domain Mark или CC0."""
    url = (rights_url or "").replace("http://", "https://").rstrip("/") + "/"
    if url == PDM_URL:
        return License(PD, PDM_URL, f"Rijksmuseum data: rights={PDM_URL}")
    if url == CC0_URL:
        return License(CC0, CC0_URL, f"Rijksmuseum data: rights={CC0_URL}")
    raise LicenseRejected(f"Rijksmuseum: права на изображение «{rights_url or 'не указаны'}» — не public domain / CC0")


_LOC_OK = re.compile(r"^no known restrictions? on (publication|reproduction)", re.I)


def loc(rights_information: str | None) -> License:
    """Library of Congress: только записи с пометкой «No known restrictions on publication»."""
    text = " ".join(str(rights_information or "").split())
    if not _LOC_OK.match(text):
        raise LicenseRejected(f"Library of Congress: права «{text[:90] or 'не указаны'}» — подходит только «No known restrictions on publication»")
    if re.search(r"\b(may be|might be|possibl[ey]) (restricted|protected)|permission", text, re.I):
        raise LicenseRejected(f"Library of Congress: в описании прав есть оговорка — «{text[:120]}»")
    return License(LOC_NKR, "https://www.loc.gov/rr/print/res/rights.html", f"Library of Congress: rights_information=«{text[:140]}»")
