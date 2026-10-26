import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from app import create_app

# Timestamped, levelled lines from every module's logger, so a service's
# fallback (logged with its traceback) can be read and pasted from the terminal.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)

# A worktree's own ports (scripts/worktree-setup.mjs); the main checkout has no
# such file and keeps 5001.
load_dotenv(Path(__file__).resolve().parent.parent / '.dev-ports')

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=int(os.environ.get('BACKEND_PORT', 5001)))
