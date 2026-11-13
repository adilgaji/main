"""Изображения: проверка лицензий (без сети), ссылки на архивы, sources.txt."""
import pytest

from factory.images import archives, licenses
from factory.images.archives import ImageRecord, _clean
from factory.images.licenses import LicenseRejected
from factory.images.store import Prepared, check_sources, parse_sources, safe_name, write_sources


def meta(**kw):
    return {k: {"value": v} for k, v in kw.items()}


def test_commons_accepts_only_pd_and_cc0():
    assert licenses.commons(meta(License="cc0", LicenseShortName="CC0", AttributionRequired="false")).name == licenses.CC0
    assert licenses.commons(meta(License="pd", LicenseShortName="Public domain", Copyrighted="False", AttributionRequired="false")).name == licenses.PD
    for bad in (
        meta(License="cc-by-2.0", LicenseShortName="CC BY 2.0", AttributionRequired="true", Copyrighted="True"),
        meta(License="cc-by-sa-4.0", LicenseShortName="CC BY-SA 4.0", Copyrighted="True"),
        meta(License="pd", LicenseShortName="Public domain", Copyrighted="True"),  # «PD в стране автора», но не везде
        meta(License="cc0", LicenseShortName="CC0", Restrictions="trademarked"),
        {},
    ):
        with pytest.raises(LicenseRejected):
            licenses.commons(bad)


def test_museum_flags():
    assert licenses.met({"isPublicDomain": True, "primaryImage": "x.jpg"}).name == licenses.CC0
    with pytest.raises(LicenseRejected):
        licenses.met({"isPublicDomain": False, "primaryImage": "x.jpg"})
    with pytest.raises(LicenseRejected):
        licenses.met({"isPublicDomain": True, "primaryImage": ""})
    assert licenses.aic({"is_public_domain": True, "image_id": "abc"}).name == licenses.CC0
    with pytest.raises(LicenseRejected):
        licenses.aic({"is_public_domain": False, "image_id": "abc"})
    assert licenses.smithsonian("CC0", "CC0").name == licenses.CC0
    with pytest.raises(LicenseRejected):
        licenses.smithsonian("CC0", "Usage conditions apply")
    assert licenses.rijksmuseum("http://creativecommons.org/publicdomain/mark/1.0").name == licenses.PD
    assert licenses.rijksmuseum("https://creativecommons.org/publicdomain/zero/1.0/").name == licenses.CC0
    with pytest.raises(LicenseRejected):
        licenses.rijksmuseum("https://creativecommons.org/licenses/by/4.0/")


def test_loc_only_no_known_restrictions():
    assert licenses.loc("No known restrictions on publication.").name == licenses.LOC_NKR
    for bad in ("Rights status not evaluated.", "", None, "No known restrictions on publication. Some images may be restricted by privacy rights; permission required."):
        with pytest.raises(LicenseRejected):
            licenses.loc(bad)


def test_refs_and_text_cleanup():
    a, i = archives.parse_ref("met:248299")
    assert a.name == "met" and i == "248299"
    assert archives.parse_ref("commons:A b: c.jpg")[1] == "A b: c.jpg"
    for bad in ("flickr:1", "met:", "248299"):
        with pytest.raises(ValueError):
            archives.parse_ref(bad)
    assert _clean('<div class="fn">Leonidas <span style="display: none;">QS:P571</span>at  Thermopylae</div>') == "Leonidas at Thermopylae"
    assert "|" not in _clean("a | b")


def rec(**kw):
    base = dict(archive="met", id="1", title="T", creator="C", date="1900", license=licenses.CC0, license_url=licenses.CC0_URL,
                evidence="isPublicDomain=true", page_url="https://example.org/p", image_url="https://example.org/i.jpg", holder="The Met")
    return ImageRecord(**{**base, **kw})


def test_sources_roundtrip_and_check(tmp_path):
    imgs = tmp_path / "images"
    imgs.mkdir()
    good = Prepared("met_1.jpg", 2000, 1500, rec())
    (imgs / "met_1.jpg").write_bytes(b"x")
    write_sources([good], tmp_path / "sources.txt", ["Карты: Natural Earth"])
    parsed = parse_sources(tmp_path / "sources.txt")
    assert parsed["met_1.jpg"]["license"].startswith("CC0 1.0") and parsed["met_1.jpg"]["evidence"]
    assert check_sources(imgs, tmp_path / "sources.txt") == []
    (imgs / "stray.jpg").write_bytes(b"x")  # файл без записи — нарушение «нет лицензии — нет файла»
    assert any("stray.jpg" in p for p in check_sources(imgs, tmp_path / "sources.txt"))


def test_safe_names_are_unique_and_plain():
    a = safe_name(rec(archive="commons", id="Leonidas at Thermopylae (detail).jpg"))
    b = safe_name(rec(archive="commons", id="Leonidas at Thermopylae [detail].jpg"))
    assert a != b and all(ch.isalnum() or ch == "_" for ch in a)
    assert safe_name(rec(id="248299")) == "met_248299"
    assert "public domain" in rec().credit
