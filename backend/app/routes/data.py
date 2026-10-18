from flask import Blueprint, jsonify, request

from app.services import weather, quotes, space

data_bp = Blueprint('data', __name__)

SERVICES = {
    'weather': weather.fetch,
    'quote': quotes.fetch,
    'space': space.fetch,
}


@data_bp.route('/data/<source>', methods=['GET'])
def get_data(source):
    handler = SERVICES.get(source)
    if not handler:
        return jsonify({'error': f'Unknown source: {source}'}), 404

    config = request.args.to_dict()
    result = handler(**config)
    return jsonify(result)
