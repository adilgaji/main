"""Стили видео (блок A): список, выбор в настройках, читаемость текста и шрифты."""
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from factory import settings as st
from factory.styles import ask_style, choose_for_video, chosen_for_video, default_style, list_styles, menu_text, require_style_chosen, resolve_style, style_ids, style_of

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


def _answers(*items):
    it = iter(items)
    return lambda _prompt: next(it)


def test_style_menu_lists_all_eight_and_marks_the_current_one():
    text = menu_text("museum")
    assert text.count("\n") == 7
    assert "8. Музей ночью" in text and "← сейчас" in text.splitlines()[7]
    assert "← сейчас" not in "".join(text.splitlines()[:7])


def test_asking_for_a_style_enter_keeps_number_picks_garbage_is_asked_again():
    quiet = lambda _m: None  # noqa: E731
    assert ask_style("museum", ask=_answers(""), say=quiet) == "museum"
    assert ask_style("museum", ask=_answers("  "), say=quiet) == "museum"
    assert ask_style("museum", ask=_answers("3"), say=quiet) == "illustrated"
    said = []
    assert ask_style("museum", ask=_answers("pink", "9", "5"), say=said.append) == "newsreel"
    assert sum("Не понял" in m for m in said) == 2
    with pytest.raises(ValueError, match="не выбран"):
        ask_style("museum", ask=_answers(*["???"] * 5), say=quiet, tries=5)


def test_generation_does_not_start_until_a_style_is_chosen_for_the_video(tmp_path):
    video = tmp_path / "output" / "2025-01-01_thermopylae"
    assert chosen_for_video(video) is None
    with pytest.raises(ValueError, match="выбрать стиль"):
        require_style_chosen(video)
    # в state.json уже есть другие данные — выбор их не трогает
    video.mkdir(parents=True)
    (video / "state.json").write_text(json.dumps({"topic": "Thermopylae", "step": 2}), encoding="utf-8")
    assert choose_for_video(video, "8") == "museum"
    assert require_style_chosen(video) == "museum"
    state = json.loads((video / "state.json").read_text(encoding="utf-8"))
    assert state["topic"] == "Thermopylae" and state["step"] == 2 and state["overrides"] == {"style": "museum"}
    assert st.effective({"style": "newsreel"}, state["overrides"])["style"] == "museum"
    assert choose_for_video(video, "newsreel") == "newsreel"  # передумал — перезаписывается
    assert require_style_chosen(video) == "newsreel"
