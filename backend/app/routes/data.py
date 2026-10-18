from flask import Blueprint, abort, jsonify, request

from app.services import daylight, quotes, space, weather

data_bp = Blueprint('data', __name__)

SERVICES = {
    'weather': weather.fetch,
    'quote': quotes.fetch,
    'space': space.fetch,
    'daylight': daylight.fetch,
}


@data_bp.route('/data/<source>', methods=['GET'])
def get_data(source):
    handler = SERVICES.get(source)
    if not handler:
        abort(404, f'Unknown source: {source}')

    config = request.args.to_dict()
    result = handler(**config)
    return jsonify(result)
