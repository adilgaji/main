"""Распознавание речи: faster-whisper. GPU (CUDA, float16), при любой проблеме — CPU int8. Модель грузится при первом использовании."""
import os, sys, time, threading, glob
from pathlib import Path
_lock = threading.Lock(); _model = None; _info = {'loaded': False, 'device': None, 'model': None, 'error': None}
MODEL = os.environ.get('HSK_STT_MODEL', 'large-v3-turbo'); CPU_MODEL = os.environ.get('HSK_STT_CPU_MODEL', 'small')
def _add_cuda_dlls():
    """Windows: pip-пакеты nvidia-cublas-cu12 / nvidia-cudnn-cu12 кладут DLL в site-packages/nvidia/*/bin"""
    if sys.platform != 'win32': return
    for p in glob.glob(str(Path(sys.prefix) / 'Lib' / 'site-packages' / 'nvidia' / '*' / 'bin')):
        try: os.add_dll_directory(p); os.environ['PATH'] = p + os.pathsep + os.environ.get('PATH', '')
        except Exception: pass
def status(): return dict(_info, fake=bool(os.environ.get('HSK_FAKE_STT')))
def _load():
    global _model
    if _model: return _model
    _add_cuda_dlls(); from faster_whisper import WhisperModel
    try:
        _model = WhisperModel(MODEL, device='cuda', compute_type='float16'); _info.update(device='cuda', model=MODEL)
        _model.transcribe(__import__('numpy').zeros(16000, dtype='float32'), language='zh')  # пробный прогон: ловим отсутствие cuDNN/cuBLAS сразу
    except Exception as e:
        _info['error'] = f'GPU недоступен ({type(e).__name__}: {str(e)[:120]}), работаю на процессоре'
        _model = WhisperModel(CPU_MODEL, device='cpu', compute_type='int8'); _info.update(device='cpu', model=CPU_MODEL)
    _info['loaded'] = True; return _model
def transcribe(path):
    if os.environ.get('HSK_FAKE_STT'): return {'text': os.environ['HSK_FAKE_STT'], 'device': 'fake', 'model': 'fake', 'secs': 0.0}
    with _lock:
        m = _load(); t = time.time()
        segs, info = m.transcribe(str(path), language='zh', initial_prompt='以下是普通话的句子，使用简体中文。', vad_filter=True, beam_size=5)
        text = ''.join(s.text for s in segs).strip()
    return {'text': text, 'device': _info['device'], 'model': _info['model'], 'secs': round(time.time() - t, 1)}
