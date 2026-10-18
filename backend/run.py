import logging

from app import create_app

# Timestamped, levelled lines from every module's logger, so a service's
# fallback (logged with its traceback) can be read and pasted from the terminal.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5001)
