"""Изображения: поиск в шести архивах, проверка лицензии, кэш, sources.txt.

    from factory import images
    rec = images.get("met:248299")          # запись с проверенной лицензией
    img = images.prepare(rec, папка)         # JPEG для кадра
    images.write_sources([img], "sources.txt")
"""
from factory.images.archives import ARCHIVES, ImageRecord, get, parse_ref, search
from factory.images.http import ArchiveUnavailable
from factory.images.licenses import LicenseRejected
from factory.images.store import ImageError, Prepared, check_sources, parse_sources, prepare, write_sources

__all__ = [
    "ARCHIVES", "ArchiveUnavailable", "ImageError", "ImageRecord", "LicenseRejected", "Prepared",
    "check_sources", "get", "parse_ref", "parse_sources", "prepare", "search", "write_sources",
]
