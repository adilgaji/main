import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get('HSK_DB') or ROOT / 'hsk.db')
AUDIO_DIR = ROOT / 'audio'
CONTENT = ROOT / 'content'
WEB = ROOT / 'web'
PORT = 8765
# какие модули уже реализованы (остальные в плане показываются как «скоро», их минуты перераспределяются)
AVAILABLE = {'review', 'new', 'triage', 'listening', 'grammar', 'speaking'}
