"""Озвучка Kokoro с точным временем каждого слова.

Время слов берётся ПРЯМО из Kokoro (result.tokens: start_ts / end_ts) — без распознавания
речи. faster-whisper / ctranslate2 здесь не используются и использоваться не должны
(Smart App Control в Windows 11 блокирует их DLL).

Видеокарта используется, если она есть; при любой ошибке — автоматический откат на процессор.
"""
from __future__ import annotations

import difflib
import logging
import os
import time
import warnings
from dataclasses import dataclass, field

import numpy as np

from factory.paths import KOKORO_REPO, setup_model_env
from factory.tts import pronunciation as pron
from factory.tts.text import Chunk, make_chunks, normalize
from factory.tts.voices import accent_of, lang_of

log = logging.getLogger("factory.tts")

SAMPLE_RATE = 24000
ENGINE_NAME = "kokoro"


class TTSError(RuntimeError):
    """Ошибка озвучки с понятным русским текстом."""


@dataclass
class Word:
    text: str
    start: float
    end: float
    paragraph: int
    sentence: int
    estimated: bool = False  # True — время не от модели, а вычислено по соседям


@dataclass
class Narration:
    audio: np.ndarray  # float32, моно
    sample_rate: int
    text: str
    words: list[Word]
    voice: str
    speed: float
    device: str
    engine: str = ENGINE_NAME
    pronunciations: list[dict] = field(default_factory=list)
    synth_seconds: float = 0.0
    warnings: list[str] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return len(self.audio) / self.sample_rate

    @property
    def words_per_minute(self) -> float:
        spoken = [w for w in self.words if any(c.isalnum() for c in w.text)]
        if len(spoken) < 2:
            return 0.0
        span = spoken[-1].end - spoken[0].start
        return len(spoken) / span * 60 if span > 0 else 0.0

    def to_json(self) -> dict:
        return {
            "engine": self.engine,
            "voice": self.voice,
            "speed": self.speed,
            "device": self.device,
            "sample_rate": self.sample_rate,
            "duration": round(self.duration, 3),
            "words_per_minute": round(self.words_per_minute, 1),
            "synth_seconds": round(self.synth_seconds, 2),
            "text": self.text,
            "words": [
                {
                    "i": i,
                    "text": w.text,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "paragraph": w.paragraph,
                    "sentence": w.sentence,
                    **({"estimated": True} if w.estimated else {}),
                }
                for i, w in enumerate(self.words)
            ],
            "pronunciations": self.pronunciations,
            "warnings": self.warnings,
        }


def _pick_device(requested: str) -> str:
    requested = (os.environ.get("FACTORY_TTS_DEVICE") or requested or "auto").lower()
    if requested in ("cpu", "cuda"):
        return requested
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # noqa: BLE001
        return "cpu"


def _rms_db(audio: np.ndarray, win: int) -> np.ndarray:
    n = len(audio) // win
    if n == 0:
        return np.array([-120.0])
    frames = audio[: n * win].reshape(n, win)
    rms = np.sqrt((frames.astype(np.float64) ** 2).mean(axis=1))
    return 20 * np.log10(rms + 1e-9)


def audible_bounds(audio: np.ndarray, sr: int = SAMPLE_RATE, rel_db: float = -50.0) -> tuple[float, float]:
    """Начало и конец слышимой части (секунды). Порог — относительно самого громкого места."""
    win = sr // 100  # 10 мс
    db = _rms_db(audio, win)
    thr = max(db.max() + rel_db, -70.0)
    loud = np.where(db > thr)[0]
    if len(loud) == 0:
        return 0.0, len(audio) / sr
    return loud[0] * win / sr, (loud[-1] + 1) * win / sr


def _fade(audio: np.ndarray, sr: int, ms: float = 8.0) -> np.ndarray:
    n = min(int(sr * ms / 1000), len(audio) // 2)
    if n > 0:
        ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
        audio[:n] *= ramp
        audio[-n:] *= ramp[::-1]
    return audio


class KokoroEngine:
    """Держит модель в памяти и озвучивает тексты. Создавать один раз на процесс."""

    def __init__(self, device: str = "auto"):
        self.requested_device = device
        self.device = ""
        self._model = None
        self._pipelines: dict[str, object] = {}
        self._g2p_only: dict[str, object] = {}

    # ---------------------------------------------------------------- загрузка

    def _import(self):
        setup_model_env()
        warnings.filterwarnings("ignore", category=UserWarning, module=r"torch\..*")
        warnings.filterwarnings("ignore", category=FutureWarning, module=r"torch\..*")
        try:
            import kokoro  # noqa: F401
        except Exception as e:  # noqa: BLE001
            raise TTSError(
                "Не удалось загрузить Kokoro. Запустите setup.bat ещё раз. "
                f"Техническая причина: {type(e).__name__}: {e}"
            ) from e
        return kokoro

    def _load_model(self, device: str) -> None:
        kokoro = self._import()
        t0 = time.time()
        self._model = kokoro.KModel(repo_id=KOKORO_REPO).to(device).eval()
        self.device = device
        log.info("Модель Kokoro загружена (%s) за %.1f с", self._device_ru(), time.time() - t0)

    def _device_ru(self) -> str:
        return "видеокарта" if self.device == "cuda" else "процессор"

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        device = _pick_device(self.requested_device)
        if device == "cuda":
            try:
                import torch

                if not torch.cuda.is_available():
                    raise RuntimeError("CUDA недоступна")
                self._load_model("cuda")
                return
            except Exception as e:  # noqa: BLE001
                log.warning("Видеокарта не сработала (%s) — перехожу на процессор.", e)
                self._model = None
        try:
            self._load_model("cpu")
        except TTSError:
            raise
        except Exception as e:  # noqa: BLE001
            raise TTSError(
                "Не удалось загрузить модель голоса Kokoro. Если интернет медленный, "
                "запустите скачивание моделей ещё раз (оно продолжит с места остановки). "
                f"Техническая причина: {type(e).__name__}: {e}"
            ) from e

    def _fallback_to_cpu(self, reason: Exception) -> None:
        log.warning("Ошибка на видеокарте (%s) — продолжаю на процессоре.", reason)
        try:
            import torch

            self._model = self._model.to("cpu")
            torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001
            self._model = None
            self._pipelines.clear()
            self._load_model("cpu")
        self.device = "cpu"

    def _pipeline(self, lang: str):
        self._ensure_model()
        if lang not in self._pipelines:
            kokoro = self._import()
            self._pipelines[lang] = kokoro.KPipeline(lang_code=lang, repo_id=KOKORO_REPO, model=self._model)
        return self._pipelines[lang]

    def g2p(self, lang: str):
        """Только «текст → фонемы», без загрузки тяжёлой модели (для аудита произношений)."""
        if lang in self._pipelines:
            return self._pipelines[lang].g2p
        if lang not in self._g2p_only:
            kokoro = self._import()
            self._g2p_only[lang] = kokoro.KPipeline(lang_code=lang, repo_id=KOKORO_REPO, model=False)
        return self._g2p_only[lang].g2p

    # ------------------------------------------------------------------ синтез

    def _run(self, lang: str, marked: str, voice: str, speed: float):
        """Один вызов модели. Возвращает (звук, список токенов с абсолютным временем)."""
        pipeline = self._pipeline(lang)
        try:
            results = list(pipeline(marked, voice=voice, speed=speed, split_pattern=None))
        except Exception as e:  # noqa: BLE001
            if _hub_offline_miss(e):
                _allow_hub_online()
                results = list(pipeline(marked, voice=voice, speed=speed, split_pattern=None))
            elif self.device == "cuda":
                self._fallback_to_cpu(e)
                results = list(self._pipeline(lang)(marked, voice=voice, speed=speed, split_pattern=None))
            else:
                raise
        parts, tokens, offset = [], [], 0.0
        for r in results:
            if r.audio is None:
                continue
            a = r.audio.detach().cpu().numpy().astype(np.float32).reshape(-1)
            for t in r.tokens or []:
                tokens.append(
                    {
                        "text": t.text,
                        "ws": bool(t.whitespace),
                        "ph": t.phonemes or "",
                        "start": None if t.start_ts is None else t.start_ts + offset,
                        "end": None if t.end_ts is None else t.end_ts + offset,
                    }
                )
            offset += len(a) / SAMPLE_RATE
            parts.append(a)
        if not parts:
            raise TTSError(f"Kokoro не вернул звук для текста: «{marked[:60]}…»")
        return np.concatenate(parts), tokens

    @staticmethod
    def _words_from_tokens(tokens: list[dict]) -> list[list]:
        """Склеивает токены в слова по пробелам: [текст, начало, конец]."""
        words: list[list] = []
        text, start, end = "", None, None
        for t in tokens:
            text += t["text"]
            spoken = bool(t["ph"]) and any(c.isalnum() for c in t["text"])
            if spoken and t["start"] is not None and t["end"] is not None:
                if start is None:
                    start = t["start"]
                end = t["end"]
            if t["ws"]:
                if text:
                    words.append([text, start, end])
                text, start, end = "", None, None
        if text:
            words.append([text, start, end])
        return words

    @staticmethod
    def _align(expected: list[str], got: list[list], warn: list[str]) -> list[list]:
        """Гарантирует, что слова со временем в точности равны словам текста."""
        if [g[0] for g in got] == expected:
            return got
        warn.append(
            "Разбивка на слова не совпала с текстом в одном из кусков — время части слов вычислено по соседям."
        )
        out: list[list] = [[w, None, None] for w in expected]
        sm = difflib.SequenceMatcher(a=expected, b=[g[0] for g in got], autojunk=False)
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "equal":
                for k in range(i2 - i1):
                    out[i1 + k] = [expected[i1 + k], got[j1 + k][1], got[j1 + k][2]]
            elif tag == "replace" and i2 > i1 and j2 > j1:
                # Общий отрезок времени делим между словами по длине
                starts = [g[1] for g in got[j1:j2] if g[1] is not None]
                ends = [g[2] for g in got[j1:j2] if g[2] is not None]
                if starts and ends:
                    a, b = min(starts), max(ends)
                    total = sum(len(w) for w in expected[i1:i2]) or 1
                    pos = a
                    for k in range(i1, i2):
                        dur = (b - a) * len(expected[k]) / total
                        out[k] = [expected[k], pos, pos + dur]
                        pos += dur
        return out

    @staticmethod
    def _fill_missing(words: list[list], length: float) -> list[bool]:
        """Словам без времени (отдельное тире и т. п.) даёт время по соседям."""
        estimated = [w[1] is None or w[2] is None for w in words]
        prev_end = 0.0
        for i, w in enumerate(words):
            if w[1] is None or w[2] is None:
                nxt = next((x[1] for x in words[i + 1:] if x[1] is not None), None)
                has_sound = any(c.isalnum() for c in w[0])
                if has_sound and nxt is not None and nxt > prev_end:
                    w[1], w[2] = prev_end, nxt
                elif has_sound:
                    w[1], w[2] = prev_end, min(length, prev_end + 0.3)
                else:
                    w[1] = w[2] = prev_end
            w[1] = max(0.0, min(w[1], length))
            w[2] = max(w[1], min(w[2], length))
            prev_end = w[2]
        return estimated

    def synthesize(
        self,
        text: str,
        voice: str,
        speed: float = 1.0,
        sentence_gap: float = 0.45,
        paragraph_gap: float = 0.85,
        lead: float = 0.25,
        tail: float = 0.45,
        max_chars: int = 280,
        dictionary: pron.Dictionary | None = None,
        use_pronunciation: bool = True,
    ) -> Narration:
        """Озвучивает текст. Паузы (секунды): между кусками в абзаце, между абзацами,
        тишина в начале и в конце. use_pronunciation=False — читать «как есть», без словаря
        и без правил для римских цифр (нужно только для сравнения «до / после»)."""
        lang, accent = lang_of(voice), accent_of(voice)
        clean = normalize(text)
        chunks: list[Chunk] = make_chunks(clean, max_chars=max_chars)
        if not chunks:
            raise TTSError("Пустой текст — озвучивать нечего.")
        if dictionary is None:
            dictionary = pron.load_dictionary()

        t0 = time.time()
        g2p = self._pipeline(lang).g2p
        pieces: list[np.ndarray] = [np.zeros(int(lead * SAMPLE_RATE), dtype=np.float32)]
        cursor = lead
        words: list[Word] = []
        used: list[dict] = []
        warn: list[str] = []
        pad_in, pad_out = 0.05, 0.10

        for ci, chunk in enumerate(chunks):
            if use_pronunciation:
                applied = pron.apply(chunk.text, accent, dictionary, g2p)
            else:
                applied = pron.Applied(chunk.text, [])
            used.extend(applied.used)
            audio, tokens = self._run(lang, applied.text, voice, speed)
            total = len(audio) / SAMPLE_RATE

            got = self._words_from_tokens(tokens)
            aligned = self._align(chunk.text.split(), got, warn)

            on, off = audible_bounds(audio)
            cut_a = max(0.0, on - pad_in)
            cut_b = min(total, off + pad_out)
            known_starts = [w[1] for w in aligned if w[1] is not None]
            if known_starts:
                cut_a = min(cut_a, max(0.0, min(known_starts) - 0.02))
            a = _fade(audio[int(cut_a * SAMPLE_RATE): int(cut_b * SAMPLE_RATE)].copy(), SAMPLE_RATE)
            length = len(a) / SAMPLE_RATE
            for w in aligned:
                if w[1] is not None:
                    w[1] -= cut_a
                if w[2] is not None:
                    w[2] -= cut_a
            estimated = self._fill_missing(aligned, length)

            # номера предложений для слов этого куска
            sent_ids: list[int] = []
            for k, s in enumerate(chunk.sentences):
                sent_ids.extend([chunk.first_sentence + k] * len(s.split()))
            for (w_text, w_start, w_end), sid, est in zip(aligned, sent_ids, estimated):
                words.append(Word(w_text, cursor + w_start, cursor + w_end, chunk.paragraph, sid, est))

            pieces.append(a)
            cursor += length
            if ci + 1 < len(chunks):
                gap = paragraph_gap if chunks[ci + 1].paragraph != chunk.paragraph else sentence_gap
                silence = max(0.0, gap - pad_in - pad_out)
                pieces.append(np.zeros(int(silence * SAMPLE_RATE), dtype=np.float32))
                cursor += int(silence * SAMPLE_RATE) / SAMPLE_RATE

        pieces.append(np.zeros(int(tail * SAMPLE_RATE), dtype=np.float32))
        audio = np.concatenate(pieces)
        peak = float(np.abs(audio).max()) if len(audio) else 0.0
        if peak > 0.98:
            audio = audio * (0.98 / peak)

        expected = clean.split()
        if [w.text for w in words] != expected:
            raise TTSError(
                "Внутренняя ошибка озвучки: слова со временем не совпали с текстом "
                f"({len(words)} против {len(expected)})."
            )
        n_est = sum(1 for w in words if w.estimated and any(c.isalnum() for c in w.text))
        if n_est:
            warn.append(f"У {n_est} слов время вычислено по соседям, а не получено от модели.")

        seen, uniq = set(), []
        for u in used:
            key = (u["word"], u["phonemes"])
            if key not in seen:
                seen.add(key)
                uniq.append(u)

        return Narration(
            audio=audio,
            sample_rate=SAMPLE_RATE,
            text=clean,
            words=words,
            voice=voice,
            speed=speed,
            device=self.device,
            pronunciations=uniq,
            synth_seconds=time.time() - t0,
            warnings=list(dict.fromkeys(warn)),
        )


def _hub_offline_miss(e: Exception) -> bool:
    name = type(e).__name__
    return name in ("LocalEntryNotFoundError", "OfflineModeIsEnabled") or "offline" in str(e).lower()


def _allow_hub_online() -> None:
    """Голос ещё не скачан, а мы в офлайн-режиме — разрешаем один раз сходить в интернет."""
    os.environ["HF_HUB_OFFLINE"] = "0"
    try:
        import huggingface_hub.constants as c

        c.HF_HUB_OFFLINE = False
    except Exception:  # noqa: BLE001
        pass
    log.info("Голос ещё не скачан — скачиваю его из интернета.")


_engine: KokoroEngine | None = None


def get_engine(device: str = "auto") -> KokoroEngine:
    """Общий на процесс экземпляр движка (модель грузится один раз)."""
    global _engine
    if _engine is None:
        _engine = KokoroEngine(device)
    return _engine
