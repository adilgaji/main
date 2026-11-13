"""Шесть разрешённых архивов: поиск и получение записи с ПРОВЕРЕННОЙ лицензией.

Каждый архив умеет:
    search(запрос, limit) → список ImageRecord (только те, что прошли проверку лицензии)
    get(id)               → ImageRecord или LicenseRejected с причиной

Ссылка на изображение в раскадровке: «архив:id», например  met:248299  или
commons:Leonidas at Thermopylae MET DP213754.jpg
"""
from __future__ import annotations

import html
import re
from dataclasses import asdict, dataclass

from factory.images import licenses
from factory.images.http import ArchiveUnavailable, NotFound, get_json
from factory.images.licenses import License, LicenseRejected

MAX_SIDE = 2880  # больше для кадра 1920x1080 с приближением не нужно


@dataclass
class ImageRecord:
    archive: str
    id: str
    title: str
    creator: str
    date: str
    license: str
    license_url: str
    evidence: str
    page_url: str
    image_url: str
    width: int = 0
    height: int = 0
    holder: str = ""  # кто хранит: строка для подписи на экране

    @property
    def ref(self) -> str:
        return f"{self.archive}:{self.id}"

    @property
    def credit(self) -> str:
        """Короткая строка для кадра: кто хранит + лицензия."""
        lic = "public domain (CC0)" if self.license == licenses.CC0 else ("no known restrictions" if self.license == licenses.LOC_NKR else "public domain")
        return f"{self.holder} · {lic}"

    def to_json(self) -> dict:
        return asdict(self)


def _clean(value: object, limit: int = 220) -> str:
    """Текст из архива → одна строка без разметки."""
    s = str(value or "")
    s = re.sub(r"<(div|span)[^>]*display:\s*none[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("|", "/")
    s = " ".join(s.split())
    return s[:limit].rstrip()


def _record(archive: str, id_: str, lic: License, **kw) -> ImageRecord:
    return ImageRecord(archive=archive, id=str(id_), license=lic.name, license_url=lic.url, evidence=lic.evidence, **kw)


class Archive:
    name = ""
    title = ""

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        raise NotImplementedError

    def get(self, id_: str) -> ImageRecord:
        raise NotImplementedError

    def _collect(self, ids: list, limit: int) -> list[ImageRecord]:
        out: list[ImageRecord] = []
        for i in ids:
            if len(out) >= limit:
                break
            try:
                out.append(self.get(i))
            except (LicenseRejected, NotFound):
                continue
        return out


# ---------------------------------------------------------------- Wikimedia Commons

class Commons(Archive):
    name, title = "commons", "Wikimedia Commons"
    API = "https://commons.wikimedia.org/w/api.php"
    FIELDS = "LicenseShortName|License|LicenseUrl|Copyrighted|AttributionRequired|Artist|DateTimeOriginal|ObjectName|Restrictions"

    def _query(self, **params) -> list[dict]:
        data = get_json(self.API, {
            "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": MAX_SIDE, "iiextmetadatafilter": self.FIELDS, **params,
        })
        pages = list((data.get("query") or {}).get("pages", {}).values())
        return sorted(pages, key=lambda p: p.get("index", 0))

    def _to_record(self, page: dict) -> ImageRecord:
        if not page.get("imageinfo"):
            raise LicenseRejected("Wikimedia Commons: файл не найден")
        info = page["imageinfo"][0]
        if info.get("mime") not in ("image/jpeg", "image/png", "image/tiff"):
            raise LicenseRejected(f"Wikimedia Commons: формат {info.get('mime')} не подходит")
        meta = info.get("extmetadata") or {}
        lic = licenses.commons(meta)
        name = page["title"].split(":", 1)[1]
        big = info.get("width", 0) > MAX_SIDE and info.get("thumburl")
        return _record(
            self.name, name, lic,
            title=_clean(meta.get("ObjectName", {}).get("value")) or name.rsplit(".", 1)[0],
            creator=_clean(meta.get("Artist", {}).get("value"), 120) or "unknown",
            date=_clean(meta.get("DateTimeOriginal", {}).get("value"), 60) or "n.d.",
            page_url=info.get("descriptionurl", ""),
            image_url=info["thumburl"] if big else info["url"],
            width=info.get("thumbwidth", 0) if big else info.get("width", 0),
            height=info.get("thumbheight", 0) if big else info.get("height", 0),
            holder="Wikimedia Commons",
        )

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        pages = self._query(generator="search", gsrnamespace=6, gsrsearch=f"{query} filetype:bitmap", gsrlimit=min(50, limit * 4))
        out = []
        for p in pages:
            try:
                out.append(self._to_record(p))
            except LicenseRejected:
                continue
            if len(out) >= limit:
                break
        return out

    def get(self, id_: str) -> ImageRecord:
        pages = self._query(titles="File:" + id_.removeprefix("File:"))
        if not pages:
            raise LicenseRejected("Wikimedia Commons: файл не найден")
        return self._to_record(pages[0])


# ---------------------------------------------------------------- The Met

class Met(Archive):
    name, title = "met", "The Metropolitan Museum of Art"
    API = "https://collectionapi.metmuseum.org/public/collection/v1"
    SEARCH = "https://collectionapi.metmuseum.org/public/collection/v1.1"

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        # Поиск версии v1 музей отключил 01.10.2026; v1.1 отдаёт результаты страницами (offset / limit).
        data = get_json(f"{self.SEARCH}/search", {"q": query, "hasImages": "true", "isPublicDomain": "true", "limit": limit * 3, "offset": 0})
        return self._collect((data.get("objectIDs") or [])[: limit * 3], limit)

    def get(self, id_: str) -> ImageRecord:
        o = get_json(f"{self.API}/objects/{id_}")
        lic = licenses.met(o)
        return _record(
            self.name, o["objectID"], lic,
            title=_clean(o.get("title")) or "Untitled",
            creator=_clean(o.get("artistDisplayName") or o.get("culture"), 120) or "unknown",
            date=_clean(o.get("objectDate"), 60) or "n.d.",
            page_url=o.get("objectURL") or f"https://www.metmuseum.org/art/collection/search/{o['objectID']}",
            image_url=o["primaryImage"],
            holder="The Metropolitan Museum of Art, New York",
        )


# ---------------------------------------------------------------- Art Institute of Chicago

class Aic(Archive):
    name, title = "aic", "Art Institute of Chicago"
    API = "https://api.artic.edu/api/v1/artworks"
    FIELDS = "id,title,artist_display,date_display,image_id,is_public_domain,thumbnail"

    def _to_record(self, a: dict) -> ImageRecord:
        lic = licenses.aic(a)
        thumb = a.get("thumbnail") or {}
        w, h = int(thumb.get("width") or 0), int(thumb.get("height") or 0)
        side = min(1686, w) if w else 1686  # 1686 — самый крупный размер, который музей отдаёт всем
        return _record(
            self.name, a["id"], lic,
            title=_clean(a.get("title")) or "Untitled",
            creator=_clean(a.get("artist_display"), 120) or "unknown",
            date=_clean(a.get("date_display"), 60) or "n.d.",
            page_url=f"https://www.artic.edu/artworks/{a['id']}",
            image_url=f"https://www.artic.edu/iiif/2/{a['image_id']}/full/{side},/0/default.jpg",
            width=side if w else 0,
            height=round(h * side / w) if w else 0,
            holder="Art Institute of Chicago",
        )

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        data = get_json(f"{self.API}/search", {"q": query, "limit": limit * 2, "fields": self.FIELDS, "query[term][is_public_domain]": "true"})
        out = []
        for a in data.get("data") or []:
            try:
                out.append(self._to_record(a))
            except LicenseRejected:
                continue
        return out[:limit]

    def get(self, id_: str) -> ImageRecord:
        return self._to_record(get_json(f"{self.API}/{id_}", {"fields": self.FIELDS})["data"])


# ---------------------------------------------------------------- Smithsonian Open Access

class Smithsonian(Archive):
    name, title = "smithsonian", "Smithsonian Open Access"
    API = "https://api.si.edu/openaccess/api/v1.0"

    @staticmethod
    def _key() -> str:
        from factory.settings import load_settings

        return load_settings().get("images", {}).get("smithsonian_api_key") or "DEMO_KEY"

    def _call(self, path: str, params: dict) -> dict:
        try:
            return get_json(f"{self.API}/{path}", {**params, "api_key": self._key()})
        except ArchiveUnavailable as e:
            if "429" in str(e) and self._key() == "DEMO_KEY":
                raise ArchiveUnavailable(
                    "Smithsonian: исчерпан лимит общего демо-ключа. Получите бесплатный личный ключ на "
                    "https://api.data.gov/signup/ и впишите его в config/settings.json → images.smithsonian_api_key"
                ) from e
            raise

    def _to_record(self, row: dict) -> ImageRecord:
        content = row.get("content") or {}
        dn = content.get("descriptiveNonRepeating") or {}
        media = [m for m in (dn.get("online_media") or {}).get("media", []) if m.get("type") == "Images"]
        if not media:
            raise LicenseRejected("Smithsonian: у записи нет изображения")
        m = media[0]
        lic = licenses.smithsonian((dn.get("metadata_usage") or {}).get("access"), (m.get("usage") or {}).get("access"))
        url, w, h = m.get("content", ""), 0, 0
        for res in m.get("resources") or []:
            if "jpeg" in str(res.get("label", "")).lower() and "high" in str(res.get("label", "")).lower() and res.get("url"):
                url, w, h = res["url"], int(res.get("width") or 0), int(res.get("height") or 0)
        if not url:
            raise LicenseRejected("Smithsonian: нет ссылки на файл")
        free = content.get("freetext") or {}

        def first(key: str) -> str:
            return _clean((free.get(key) or [{}])[0].get("content"), 120)

        return _record(
            self.name, row["id"], lic,
            title=_clean(row.get("title") or (dn.get("title") or {}).get("content")) or "Untitled",
            creator=first("name") or "unknown",
            date=first("date") or "n.d.",
            page_url=dn.get("record_link") or dn.get("guid") or "",
            image_url=url, width=w, height=h,
            holder=_clean(dn.get("data_source"), 80) or "Smithsonian Institution",
        )

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        data = self._call("search", {"q": f'{query} AND online_media_type:"Images" AND media_usage:"CC0"', "rows": limit * 2})
        out = []
        for row in (data.get("response") or {}).get("rows") or []:
            try:
                out.append(self._to_record(row))
            except LicenseRejected:
                continue
        return out[:limit]

    def get(self, id_: str) -> ImageRecord:
        return self._to_record(self._call(f"content/{id_}", {})["response"])


# ---------------------------------------------------------------- Rijksmuseum

class Rijksmuseum(Archive):
    name, title = "rijksmuseum", "Rijksmuseum"
    SEARCH = "https://data.rijksmuseum.nl/search/collection"
    LD = {"Accept": "application/ld+json"}
    EN = "http://vocab.getty.edu/aat/300388277"

    @classmethod
    def _is_en(cls, node: dict) -> bool:
        return any(lang.get("id") == cls.EN for lang in node.get("language") or [])

    @classmethod
    def _pick(cls, nodes: list[dict]) -> str:
        """Английский текст, если он есть; иначе первый."""
        texts = [n for n in nodes if isinstance(n.get("content"), str)]
        en = [n for n in texts if cls._is_en(n)]
        return _clean((en or texts or [{}])[0].get("content"))

    def get(self, id_: str) -> ImageRecord:
        o = get_json(f"https://id.rijksmuseum.nl/{id_}", headers=self.LD)
        image_url = rights = page = ""
        for subj in o.get("subject_of") or []:
            for dig in subj.get("digitally_carried_by") or []:
                for ap in dig.get("access_point") or []:
                    link = ap.get("id", "")
                    if "iiif" in link and not image_url:
                        image_url = link
                        rights = next((r.get("content", "") for r in dig.get("referred_to_by") or [] if "creativecommons" in str(r.get("content"))), "")
                    elif dig.get("format") == "text/html" and not page:
                        page = link
        if not image_url:
            raise LicenseRejected("Rijksmuseum: у записи нет изображения")
        lic = licenses.rijksmuseum(rights)
        prod = o.get("produced_by") or {}
        w = h = 0
        base = image_url.split("/full/")[0]
        try:
            info = get_json(base + "/info.json")
            w, h = int(info.get("width") or 0), int(info.get("height") or 0)
        except ArchiveUnavailable:
            pass
        if w and max(w, h) > MAX_SIDE:
            k = MAX_SIDE / max(w, h)
            w, h = round(w * k), round(h * k)
            image_url = f"{base}/full/{w},/0/default.jpg"
        number = next((n.get("content", "") for n in o.get("identified_by") or [] if n.get("type") == "Identifier"), "")
        return _record(
            self.name, id_, lic,
            title=self._pick([n for n in o.get("identified_by") or [] if n.get("type") == "Name"]) or "Untitled",
            creator=self._pick(prod.get("referred_to_by") or []) or "unknown",
            date=self._pick((prod.get("timespan") or {}).get("identified_by") or []) or "n.d.",
            page_url=page or f"https://www.rijksmuseum.nl/en/collection/{number}",
            image_url=image_url, width=w, height=h,
            holder="Rijksmuseum, Amsterdam",
        )

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        ids: list[str] = []
        for field in ("title", "description"):  # у музея нет общего поиска — ищем в названии и в описании
            data = get_json(self.SEARCH, {field: query, "imageAvailable": "true"})
            for item in data.get("orderedItems") or []:
                i = item.get("id", "").rsplit("/", 1)[-1]
                if i and i not in ids:
                    ids.append(i)
        return self._collect(ids[: limit * 2], limit)


# ---------------------------------------------------------------- Library of Congress

class Loc(Archive):
    name, title = "loc", "Library of Congress"
    BASE = "https://www.loc.gov/pictures"

    def get(self, id_: str) -> ImageRecord:
        data = get_json(f"{self.BASE}/item/{id_}/", {"fo": "json"})
        item = data.get("item") or {}
        lic = licenses.loc(item.get("rights_information"))
        best, size = "", 0
        for res in data.get("resources") or []:
            for kind in ("large", "larger", "largest", "medium"):
                url, s = str(res.get(kind) or ""), int(res.get(f"{kind}_s") or 0)
                ok = url.lower().endswith((".jpg", ".jpeg")) or (url.lower().endswith((".tif", ".tiff")) and s < 150_000_000)
                if ok and "notdig" not in url and s > size:
                    best, size = url, s
            if best:
                break
        if not best:
            raise LicenseRejected("Library of Congress: у записи нет оцифрованного изображения")
        creators = "; ".join(_clean(c.get("title"), 80) for c in item.get("creators") or [] if c.get("title"))
        return _record(
            self.name, item.get("id") or id_, lic,
            title=_clean(item.get("title")) or "Untitled",
            creator=creators or "unknown",
            date=_clean(item.get("date") or item.get("created_published_date"), 60) or "n.d.",
            page_url=item.get("link") or f"{self.BASE}/item/{id_}/",
            image_url=best,
            holder="Library of Congress, Prints & Photographs Division",
        )

    def search(self, query: str, limit: int = 6) -> list[ImageRecord]:
        data = get_json(f"{self.BASE}/search/", {"q": query, "fo": "json"})
        ids = []
        for r in data.get("results") or []:
            m = re.search(r"/item/([^/]+)/", (r.get("links") or {}).get("item", ""))
            if m and "notdig" not in str((r.get("image") or {}).get("full", "")):
                ids.append(m.group(1))
        return self._collect(ids[: limit * 2], limit)


ARCHIVES: dict[str, Archive] = {a.name: a for a in (Commons(), Met(), Aic(), Smithsonian(), Rijksmuseum(), Loc())}


def parse_ref(ref: str) -> tuple[Archive, str]:
    """«met:248299» → (архив, id). Неизвестный архив — ошибка: чужие сайты запрещены."""
    name, _, id_ = ref.partition(":")
    if name not in ARCHIVES or not id_:
        raise ValueError(f"Непонятная ссылка на изображение «{ref}». Нужно «архив:id», архивы: {', '.join(ARCHIVES)}")
    return ARCHIVES[name], id_


def get(ref: str) -> ImageRecord:
    archive, id_ = parse_ref(ref)
    return archive.get(id_)


def search(query: str, archives: list[str] | None = None, limit: int = 6) -> tuple[list[ImageRecord], dict[str, str]]:
    """Ищет по выбранным архивам. Возвращает (записи, {архив: почему не ответил})."""
    found: list[ImageRecord] = []
    problems: dict[str, str] = {}
    for name in archives or list(ARCHIVES):
        try:
            found.extend(ARCHIVES[name].search(query, limit))
        except ArchiveUnavailable as e:
            problems[name] = str(e)
    return found, problems
