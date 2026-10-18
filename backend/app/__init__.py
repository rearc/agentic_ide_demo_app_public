import json
import logging
import sqlite3

from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException

from app.models.base import Base

logger = logging.getLogger(__name__)

db = SQLAlchemy(model_class=Base)
migrate = Migrate()


@event.listens_for(Engine, 'connect')
def _enforce_sqlite_foreign_keys(dbapi_connection, _connection_record):
    """Turn on foreign key enforcement for each new SQLite connection.

    SQLite ships with foreign keys off, per connection. Without this the
    `ON DELETE CASCADE` on `todos.card_id` is inert, and deleting a card leaves
    its todos behind for the next card that reuses the id.
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.execute('PRAGMA foreign_keys = ON')


def create_app(config_object: str | type = 'config.Config'):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_object)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app)

    from app.routes.cards import cards_bp
    from app.routes.data import data_bp
    from app.routes.todos import todos_bp

    app.register_blueprint(cards_bp, url_prefix='/api')
    app.register_blueprint(data_bp, url_prefix='/api')
    app.register_blueprint(todos_bp, url_prefix='/api')

    _register_error_handlers(app)

    return app


def _register_error_handlers(app):
    """Answer every error as `{"error": "<message>"}` JSON (API-4, SEC-4).

    Without these, Werkzeug answers a 404 or 405 with an HTML page.
    """

    @app.errorhandler(HTTPException)
    def http_error(error):
        # Werkzeug's own response keeps the status and any headers the error
        # sets (a 405's `Allow`); only the HTML body is swapped for JSON.
        response = error.get_response()
        response.data = json.dumps({'error': error.description})
        response.content_type = 'application/json'
        return response

    @app.errorhandler(Exception)
    def unhandled_error(error):
        logger.exception('Unhandled error')
        return jsonify({'error': 'Internal server error'}), 500
