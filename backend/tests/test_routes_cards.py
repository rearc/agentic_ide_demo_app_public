"""Tests for /api/cards.

Response-shape conventions under test (see docs/coding_standards.md): collections
return a bare list, single resources return the object, errors return
{"error": "..."}, and DELETE returns 204 with an empty body. The body and
not-found checks every route shares are in test_routes_helpers.py.
"""

import pytest

from app.routes.helpers import SQLITE_INT_MAX, SQLITE_INT_MIN

VALID_CARD = {'slug': 'stocks', 'title': 'Stocks', 'source': 'stocks'}
PLACE = {'x': 0, 'y': 0, 'w': 4, 'h': 4, 'hidden': False}


class TestListCards:
    def test_returns_empty_list_when_no_cards_exist(self, client):
        response = client.get('/api/cards')

        assert response.status_code == 200
        assert response.get_json() == []

    def test_orders_cards_by_position(self, client, make_card):
        make_card(slug='third', position=3)
        make_card(slug='first', position=1)
        make_card(slug='second', position=2)

        slugs = [card['slug'] for card in client.get('/api/cards').get_json()]

        assert slugs == ['first', 'second', 'third']

    def test_serializes_the_full_card_shape(self, client, card):
        payload = client.get('/api/cards').get_json()[0]

        assert set(payload) == {
            'id', 'slug', 'title', 'description', 'icon', 'source',
            'config', 'position', 'created_at',
        }


class TestGetCard:
    def test_returns_the_card(self, client, card):
        response = client.get(f'/api/cards/{card.id}')

        assert response.status_code == 200
        assert response.get_json()['slug'] == 'weather'


class TestCreateCard:
    def test_creates_and_returns_201(self, client):
        response = client.post('/api/cards', json=VALID_CARD)

        assert response.status_code == 201
        body = response.get_json()
        assert body['slug'] == 'stocks'
        assert body['id'] is not None

    def test_created_card_is_listed(self, client):
        client.post('/api/cards', json=VALID_CARD)

        assert len(client.get('/api/cards').get_json()) == 1

    def test_created_card_is_on_no_board(self, client, make_profile):
        """A new card joins the library only; the user places it on a board."""
        make_profile()

        client.post('/api/cards', json=VALID_CARD)

        assert client.get('/api/profiles').get_json()[0]['board'] == {}

    def test_applies_defaults_for_optional_fields(self, client):
        body = client.post('/api/cards', json=VALID_CARD).get_json()

        assert body['description'] == ''
        assert body['icon'] == ''
        assert body['config'] == {}
        assert body['position'] == 0

    def test_missing_required_field_returns_400(self, client):
        response = client.post('/api/cards', json={'slug': 'stocks'})

        assert response.status_code == 400
        assert 'title' in response.get_json()['error']
        assert 'source' in response.get_json()['error']

    def test_duplicate_slug_returns_409(self, client, card):
        response = client.post(
            '/api/cards',
            json={'slug': 'weather', 'title': 'Another', 'source': 'weather'},
        )

        assert response.status_code == 409
        assert 'already exists' in response.get_json()['error']


# A new value for every field an update may change. config repoints the card's
# data fetch, source is the dispatch key on both registries (ADR-008), and
# position is the library's sort key.
UPDATES = [
    ('title', 'Renamed'),
    ('description', 'Rewritten'),
    ('icon', 'rain'),
    ('source', 'quote'),
    ('config', {'city': 'Boston', 'units': 'metric'}),
    ('position', 3),
]


class TestUpdateCard:
    @pytest.mark.parametrize(('field', 'value'), UPDATES)
    def test_persists_an_updated_field(self, client, card, field, value):
        response = client.put(f'/api/cards/{card.id}', json={field: value})

        assert response.status_code == 200
        assert client.get(f'/api/cards/{card.id}').get_json()[field] == value

    @pytest.mark.parametrize('slug', ['changed', 5])
    def test_slug_is_ignored_on_update(self, client, card, slug):
        """slug is how the seed recognises a default card (ADR-017), so an update
        ignores it, whatever its value, rather than rejecting the request."""
        response = client.put(f'/api/cards/{card.id}', json={'slug': slug})

        assert response.status_code == 200
        assert response.get_json()['slug'] == 'weather'


class TestDeleteCard:
    def test_returns_204_with_empty_body(self, client, card):
        response = client.delete(f'/api/cards/{card.id}')

        assert response.status_code == 204
        assert response.data == b''

    def test_deleted_card_is_gone(self, client, card):
        client.delete(f'/api/cards/{card.id}')

        assert client.get(f'/api/cards/{card.id}').status_code == 404

    def test_deleted_card_is_removed_from_boards(self, client, make_card, make_profile):
        """The board rows cascade with the card (DB-12), so no profile keeps
        an entry for a card that no longer exists."""
        card, other = make_card(), make_card()
        make_profile(board={card.id: PLACE, other.id: PLACE})

        client.delete(f'/api/cards/{card.id}')

        board = client.get('/api/profiles').get_json()[0]['board']
        assert list(board) == [str(other.id)]


# One bad value per validated field, plus one per clause of a compound check
# (TEST-11): '   ' needs the strip, True is a Python int, and an integer must
# fit SQLite's 64-bit range on both sides.
BAD_VALUES = [
    ('slug', None), ('title', None), ('source', '   '),
    ('description', 5), ('icon', None),
    ('config', [1]),
    ('position', 'x'), ('position', True),
    ('position', SQLITE_INT_MAX + 1), ('position', SQLITE_INT_MIN - 1),
]


class TestCardFieldTypes:
    """Presence checks are not type checks: a null or wrongly typed value must
    be a 400 naming the field, never a 500 from the database (API-7)."""

    @pytest.mark.parametrize(('field', 'value'), BAD_VALUES)
    def test_rejects_a_wrongly_typed_field(self, client, field, value):
        response = client.post('/api/cards', json={**VALID_CARD, field: value})

        assert response.status_code == 400
        assert response.get_json()['error'].startswith(f'{field} must be')

    @pytest.mark.parametrize('position', [SQLITE_INT_MIN, SQLITE_INT_MAX])
    def test_accepts_an_integer_at_the_edge_of_the_sqlite_range(self, client, card, position):
        response = client.put(f'/api/cards/{card.id}', json={'position': position})

        assert response.status_code == 200
        assert client.get(f'/api/cards/{card.id}').get_json()['position'] == position

    def test_a_rejected_create_writes_nothing(self, client):
        client.post('/api/cards', json={**VALID_CARD, 'position': 'x'})

        assert client.get('/api/cards').get_json() == []

    def test_a_rejected_update_changes_nothing(self, client, card):
        """The valid title must not be written before the bad position is seen."""
        response = client.put(f'/api/cards/{card.id}', json={'title': 'Renamed', 'position': 'x'})

        assert response.status_code == 400
        assert client.get(f'/api/cards/{card.id}').get_json()['title'] == 'Weather'
