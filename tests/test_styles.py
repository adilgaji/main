"""Стили видео (блок A): список, выбор в настройках, читаемость текста и шрифты."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from factory import settings as st
from factory.styles import default_style, list_styles, resolve_style, style_ids, style_of

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"


def test_eight_styles_in_the_agreed_order():
    ids = style_ids()
    assert len(ids) == 8 and len(set(ids)) == 8
    assert ids[0] == "documentary" == default_style()
    for s in list_styles():
        assert s.name_ru.strip() and s.tagline_ru.strip()


def test_style_can_be_picked_by_number_id_or_name():
    styles = list_styles()
    assert resolve_style(None) == default_style()
    assert resolve_style(3) == styles[2].id
    assert resolve_style("3") == styles[2].id
    assert resolve_style("NEWSREEL") == "newsreel"
    assert resolve_style(styles[7].name_ru) == styles[7].id
    for bad in ("0", "9", "pink", "-1"):
        with pytest.raises(ValueError, match="Неизвестный стиль"):
            resolve_style(bad)


def test_settings_remember_the_chosen_style(tmp_path):
    path = tmp_path / "settings.json"
    assert style_of(st.load_settings(path)) == default_style()  # не выбран — работает стиль по умолчанию
    s = st.update_settings({"style": "5"}, path)  # номер превращается в id
    assert s["style"] == "newsreel"
    assert json.loads(path.read_text(encoding="utf-8"))["style"] == "newsreel"
    assert style_of(st.load_settings(path)) == "newsreel"
    # для отдельного видео стиль можно переопределить, общий выбор не меняется
    over = st.effective(st.load_settings(path), {"style": "museum"})
    assert style_of(over) == "museum" and style_of(st.load_settings(path)) == "newsreel"
    with pytest.raises(ValueError):
        st.update_settings({"style": "pink"}, path)
    path.write_text('{"style": "pink"}', encoding="utf-8")
    with pytest.raises(ValueError, match="неизвестный стиль"):
        style_of(st.load_settings(path))


def test_every_font_family_is_licensed():
    """Шрифты только с открытой лицензией: каждое семейство перечислено в LICENSES.md."""
    faces = (VIDEO / "src" / "fontFaces.ts").read_text(encoding="utf-8")
    families = re.findall(r"^\s*'?([A-Z][A-Za-z0-9 ]+?)'?: (?:variable|fixed)\(", faces, re.M)
    assert len(families) >= 12
    licenses = (VIDEO / "public" / "fonts" / "LICENSES.md").read_text(encoding="utf-8")
    assert "SIL Open Font License" in licenses
    for fam in families:
        assert fam in licenses, f"шрифт {fam} не записан в LICENSES.md"


@pytest.mark.skipif(not (VIDEO / "node_modules").is_dir() or not shutil.which("node"), reason="зависимости video/ не установлены")
def test_style_check_script_passes():
    """Контраст текста, шрифты на диске, различимость стилей, совпадение styles.json и style.ts."""
    p = subprocess.run([shutil.which("node"), "scripts/check-styles.mjs"], cwd=VIDEO, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    assert p.returncode == 0, p.stdout[-2500:]
    assert "Все проверки стилей пройдены" in p.stdout
