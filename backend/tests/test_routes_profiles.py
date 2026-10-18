"""Tests for /api/profiles.

A profile is a named board; its `board` is an object keyed by card id as a
string. The body and not-found checks every route shares are in
test_routes_helpers.py.
"""

import pytest

from app.routes.helpers import SQLITE_INT_MAX

PLACE = {'x': 0, 'y': 0, 'w': 4, 'h': 4}
ENTRY = {**PLACE, 'hidden': False}


def board_of(card, entry=ENTRY):
    """A one-card board, as the API sends and receives it."""
    return {str(card.id): entry}


class TestListProfiles:
    def test_lists_profiles_in_creation_order(self, client, make_profile):
        make_profile(name='Work')
        make_profile(name='Home')

        names = [p['name'] for p in client.get('/api/profiles').get_json()]

        assert names == ['Work', 'Home']

    def test_serializes_the_profile_with_its_board(self, client, card, make_profile):
        make_profile(name='Work', board={card.id: {**PLACE, 'hidden': True}})

        profile = client.get('/api/profiles').get_json()[0]

        assert set(profile) == {'id', 'name', 'board', 'created_at'}
        assert profile['board'] == board_of(card, {**PLACE, 'hidden': True})


class TestCreateProfile:
    def test_creates_an_empty_profile_and_returns_201(self, client):
        response = client.post('/api/profiles', json={'name': 'Work'})

        assert response.status_code == 201
        assert response.get_json()['name'] == 'Work'
        assert response.get_json()['board'] == {}

    def test_creates_a_profile_from_a_copied_board(self, client, card):
        """What "Save as new profile" does: it sends the shown board."""
        response = client.post('/api/profiles', json={'name': 'Work', 'board': board_of(card)})

        assert response.status_code == 201
        assert client.get('/api/profiles').get_json()[0]['board'] == board_of(card)

    def test_an_entry_without_hidden_is_visible(self, client, card):
        body = client.post(
            '/api/profiles', json={'name': 'Work', 'board': board_of(card, PLACE)}
        ).get_json()

        assert body['board'] == board_of(card, ENTRY)

    def test_trims_the_name(self, client):
        body = client.post('/api/profiles', json={'name': '  Work  '}).get_json()

        assert body['name'] == 'Work'

    def test_accepts_a_name_at_the_length_limit(self, client):
        response = client.post('/api/profiles', json={'name': 'n' * 50})

        assert response.status_code == 201

    def test_duplicate_name_returns_409(self, client, make_profile):
        make_profile(name='Work')

        response = client.post('/api/profiles', json={'name': 'Work'})

        assert response.status_code == 409
        assert 'already exists' in response.get_json()['error']


class TestUpdateProfile:
    def test_renames_the_profile(self, client, make_profile):
        profile = make_profile(name='Work')

        response = client.patch(f'/api/profiles/{profile.id}', json={'name': 'Office'})

        assert response.status_code == 200
        assert client.get('/api/profiles').get_json()[0]['name'] == 'Office'

    def test_keeping_its_own_name_is_not_a_duplicate(self, client, make_profile):
        profile = make_profile(name='Work')

        response = client.patch(f'/api/profiles/{profile.id}', json={'name': 'Work'})

        assert response.status_code == 200

    def test_renaming_to_another_profiles_name_returns_409(self, client, make_profile):
        make_profile(name='Home')
        profile = make_profile(name='Work')

        response = client.patch(f'/api/profiles/{profile.id}', json={'name': 'Home'})

        assert response.status_code == 409
        assert 'already exists' in response.get_json()['error']

    def test_a_board_replaces_the_whole_board(self, client, make_card, make_profile):
        """An entry left out is removed, one sent again is overwritten, a new
        one is added."""
        dropped, kept, added = make_card(), make_card(), make_card()
        profile = make_profile(board={dropped.id: PLACE, kept.id: PLACE})
        board = {
            str(kept.id): {'x': 4, 'y': 2, 'w': 6, 'h': 3, 'hidden': True},
            str(added.id): ENTRY,
        }

        response = client.patch(f'/api/profiles/{profile.id}', json={'board': board})

        assert response.status_code == 200
        assert client.get('/api/profiles').get_json()[0]['board'] == board

    def test_body_without_name_or_board_returns_400(self, client, make_profile):
        profile = make_profile()

        response = client.patch(f'/api/profiles/{profile.id}', json={'title': 'Work'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'No valid fields to update'

    def test_a_rejected_update_changes_nothing(self, client, make_profile):
        """The valid name must not be written before the bad board is seen."""
        profile = make_profile(name='Work')

        response = client.patch(
            f'/api/profiles/{profile.id}', json={'name': 'Office', 'board': []}
        )

        assert response.status_code == 400
        assert client.get('/api/profiles').get_json()[0]['name'] == 'Work'

    def test_unknown_profile_returns_404(self, client):
        response = client.patch('/api/profiles/999', json={'name': 'Work'})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Profile not found'


class TestDeleteProfile:
    def test_returns_204_and_removes_the_profile(self, client, make_profile):
        make_profile(name='Home')
        profile = make_profile(name='Work')

        response = client.delete(f'/api/profiles/{profile.id}')

        assert response.status_code == 204
        assert response.data == b''
        assert [p['name'] for p in client.get('/api/profiles').get_json()] == ['Home']

    def test_the_last_profile_cannot_be_deleted(self, client, make_profile):
        profile = make_profile()

        response = client.delete(f'/api/profiles/{profile.id}')

        assert response.status_code == 409
        assert len(client.get('/api/profiles').get_json()) == 1

    def test_unknown_profile_returns_404(self, client, make_profile):
        """Not the last-profile 409: with one profile left, the unknown id is
        what is wrong."""
        make_profile()

        response = client.delete('/api/profiles/999')

        assert response.status_code == 404


# One bad name per clause (TEST-11): not a string, blank once trimmed, too long.
BAD_NAMES = [None, 5, '   ', 'n' * 51]

# One bad entry per clause of the entry check (TEST-11): not an object, a field
# missing, an extra field, a bool (a Python int), a float, an integer beyond
# SQLite's range, each lower bound, and a non-boolean hidden.
BAD_ENTRIES = [
    'x',
    {'x': 0, 'y': 0, 'w': 4},
    {**PLACE, 'z': 0},
    {**PLACE, 'w': True},
    {**PLACE, 'h': 1.5},
    {**PLACE, 'x': SQLITE_INT_MAX + 1},
    {**PLACE, 'x': -1},
    {**PLACE, 'y': -1},
    {**PLACE, 'w': 0},
    {**PLACE, 'h': 0},
    {**PLACE, 'hidden': 1},
]


class TestProfileValidation:
    """A bad name or board is a 400 naming the problem, never a 500 (API-7).
    Each runs through create and update, which share the checks."""

    @pytest.fixture(params=['create', 'update'])
    def send(self, request, client, make_profile):
        """POST a new profile or PATCH an existing one with `fields`."""
        if request.param == 'create':
            return lambda fields: client.post('/api/profiles', json={'name': 'New', **fields})
        profile = make_profile(name='Existing')
        return lambda fields: client.patch(f'/api/profiles/{profile.id}', json=fields)

    @pytest.mark.parametrize('name', BAD_NAMES)
    def test_rejects_a_bad_name(self, send, name):
        response = send({'name': name})

        assert response.status_code == 400
        assert response.get_json()['error'].startswith('name must be')

    def test_rejects_a_board_that_is_not_an_object(self, send):
        response = send({'board': [1]})

        assert response.status_code == 400
        assert response.get_json()['error'].startswith('board must be')

    @pytest.mark.parametrize('entry', BAD_ENTRIES)
    def test_rejects_a_bad_board_entry(self, send, card, entry):
        response = send({'board': board_of(card, entry)})

        assert response.status_code == 400
        assert response.get_json()['error'].startswith(f'board["{card.id}"] must be')

    def test_accepts_an_entry_at_the_lower_bounds(self, send, card):
        response = send({'board': board_of(card, {'x': 0, 'y': 0, 'w': 1, 'h': 1})})

        assert response.status_code in (200, 201)

    def test_rejects_keys_that_name_no_card(self, send, card):
        """A missing id, a non-digit key, and a digit string beyond SQLite's
        range (which would otherwise overflow the query) are all reported."""
        too_big = str(SQLITE_INT_MAX + 1)
        board = {str(card.id): ENTRY, '999': ENTRY, 'abc': ENTRY, too_big: ENTRY}

        response = send({'board': board})

        assert response.status_code == 400
        error = response.get_json()['error']
        assert error.startswith('Unknown card id(s): ')
        assert set(error.removeprefix('Unknown card id(s): ').split(', ')) == {
            '999', 'abc', too_big,
        }
