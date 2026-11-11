import json
from types import SimpleNamespace

import pytest

from factory.tts import pronunciation as pron


def make_dict(**words):
    d = pron.Dictionary()
    for w, (us, gb) in words.items():
        d.entries[pron._fold(w)] = pron.Entry(word=w, us=us, gb=gb, say="")
    return d


D = make_dict(
    Xerxes=("zˈɜɹksiz", "zˈɜːksiːz"),
    Hatshepsut=("hætʃˈɛpsʊt", "hatʃˈɛpsʊt"),
    Mexica=("mɛʃˈikə", "mɛʃˈiːkə"),
    **{"Cortés": ("kɔɹtˈɛz", "kɔːtˈɛz"), "Nice": ("nˈis", "nˈiːs")},
)


def fake_g2p(text):
    """Подделка G2P: каждое слово «произносится» как оно само в нижнем регистре."""
    words = text.split()
    toks = [SimpleNamespace(phonemes=w.lower(), whitespace=" " if i < len(words) - 1 else "") for i, w in enumerate(words)]
    return "", toks


def test_project_dictionary_is_valid():
    d = pron.load_dictionary()
    assert len(d) >= 20
    assert pron.validate_dictionary(d) == []


def test_apply_basic_and_accent():
    a = pron.apply("King Xerxes came.", "us", D)
    assert a.text == "King [Xerxes](/zˈɜɹksiz/) came."
    b = pron.apply("King Xerxes came.", "gb", D)
    assert b.text == "King [Xerxes](/zˈɜːksiːz/) came."
    assert a.used[0]["word"] == "Xerxes"


def test_possessive_rules():
    # после шипящих/свистящих — отдельный слог
    assert pron.apply("Xerxes's army", "us", D).text == "[Xerxes's](/zˈɜɹksizᵻz/) army"
    assert pron.apply("Xerxes's army", "gb", D).text == "[Xerxes's](/zˈɜːksiːzɪz/) army"
    # после глухой согласной — s
    assert pron.apply("Hatshepsut's temple", "us", D).text == "[Hatshepsut's](/hætʃˈɛpsʊts/) temple"
    # голая апостроф-форма не меняет произношение
    assert pron.apply("Xerxes' army", "us", D).text == "[Xerxes'](/zˈɜɹksiz/) army"


def test_plural_and_accents():
    assert pron.apply("The Mexicas built it.", "us", D).text == "The [Mexicas](/mɛʃˈikəz/) built it."
    # слово без диакритики находит запись с диакритикой
    assert pron.apply("Cortes arrived.", "us", D).text == "[Cortes](/kɔɹtˈɛz/) arrived."
    assert pron.apply("Cortés arrived.", "us", D).text == "[Cortés](/kɔɹtˈɛz/) arrived."


def test_proper_noun_does_not_hit_common_word():
    assert pron.apply("That was nice.", "us", D).text == "That was nice."
    assert pron.apply("They sailed to Nice.", "us", D).text == "They sailed to [Nice](/nˈis/)."


def test_no_partial_word_match():
    assert pron.apply("Xerxesian", "us", D).text == "Xerxesian"


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Thutmose III ruled.", "Thutmose [III](/the third/) ruled."),
        ("Henry V won.", "Henry [V](/the fifth/) won."),
        ("Louis XIV built it.", "Louis [XIV](/the fourteenth/) built it."),
        ("World War II ended.", "World War [II](/two/) ended."),
        ("World War I began.", "World War [I](/one/) began."),
        ("Darius I, the Great King.", "Darius [I](/the first/), the Great King."),
        ("The Mark IV tank.", "The Mark [IV](/four/) tank."),
        # не номера правителей — не трогаем
        ("Malcolm X spoke.", "Malcolm X spoke."),
        ("Then I saw it.", "Then I saw it."),
        ("Caesar and I agree.", "Caesar and I agree."),
        ("Darius I think was king.", "Darius I think was king."),
    ],
)
def test_roman_numerals(text, expected):
    assert pron.apply(text, "us", pron.Dictionary(), fake_g2p).text == expected


def test_roman_untouched_without_g2p():
    assert pron.apply("Thutmose III ruled.", "us", pron.Dictionary()).text == "Thutmose III ruled."


def test_check_phonemes():
    assert pron.check_phonemes("zˈɜɹksiz", "us") == []
    assert pron.check_phonemes("zˈɜːksiːz", "gb") == []
    assert pron.check_phonemes("", "us")
    assert any("ударения" in p for p in pron.check_phonemes("zɜɹksiz", "us"))  # нет ударения
    assert any("перед гласной" in p for p in pron.check_phonemes("ˈzɜɹksiz", "us"))  # ударение не у гласной
    assert any("недопустимые" in p for p in pron.check_phonemes("zˈɜːksiːz", "us"))  # британская долгота в us
    assert any("недопустимые" in p for p in pron.check_phonemes("hætʃˈɛpsʊt", "gb"))  # æ нет в gb


def test_save_entry_validates_and_sorts(tmp_path):
    path = tmp_path / "pron.json"
    pron.save_entry("Xerxes", "zˈɜɹksiz", "zˈɜːksiːz", say="ZURK-seez", path=path)
    pron.save_entry("Darius", "dəɹˈIəs", "dəɹˈIəs", path=path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert list(raw["words"]) == ["Darius", "Xerxes"]
    with pytest.raises(ValueError):
        pron.save_entry("Bad", "xyz!", "zˈɜːks", path=path)
    with pytest.raises(ValueError):
        pron.save_entry("Two Words", "zˈɜɹks", "zˈɜːks", path=path)
    d = pron.load_dictionary(path)
    assert d.get("xerxes").say == "ZURK-seez"
