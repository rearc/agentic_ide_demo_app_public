"""Seed the dashboard with its default cards and the "Default" profile.

By default this is **additive**: it inserts only the default cards that are
missing, and never deletes anything. Cards you added at runtime, todos you
wrote, profiles you made and boards you arranged all survive a re-seed
(ADR-017). A missing default card goes back on the "Default" profile's board,
never on another profile's.

Pass `--reset` when you actually want the pristine starting state back. That
wipes the `cards`, `profiles` and `todos` tables first, and does destroy user
data.
"""

import argparse

from app import create_app, db
from app.models.card import Card
from app.models.profile import Profile
from app.models.profile_card import ProfileCard
from app.models.todo import Todo

STARTER_TODO_TEXT = 'Try checking this off'
DEFAULT_PROFILE_NAME = 'Default'

# Where each default card sits on the "Default" profile's board, by slug.
DEFAULT_BOARD = {
    'weather': {'x': 0, 'y': 0, 'w': 4, 'h': 4},
    'quote': {'x': 4, 'y': 0, 'w': 4, 'h': 4},
    'placeholder': {'x': 8, 'y': 0, 'w': 4, 'h': 4},
    'space': {'x': 0, 'y': 4, 'w': 6, 'h': 7},
    'todo': {'x': 6, 'y': 4, 'w': 6, 'h': 7},
    'timer': {'x': 0, 'y': 11, 'w': 4, 'h': 4},
    'moon': {'x': 4, 'y': 11, 'w': 4, 'h': 4},
}


def default_cards():
    """The cards a fresh dashboard starts with.

    Add a new default card here, with its place in `DEFAULT_BOARD`; a re-seed
    will insert it without touching anything already in the database.
    """
    return [
        Card(
            slug='weather',
            title='Weather',
            description='Current conditions at a glance',
            icon='cloud-sun',
            source='weather',
            config={'city': 'San Francisco'},
            position=1,
        ),
        Card(
            slug='quote',
            title='Daily Quote',
            description='A little daily inspiration',
            icon='quote',
            source='quote',
            position=2,
        ),
        Card(
            slug='placeholder',
            title='Coming Soon',
            description='Your next widget goes here',
            icon='',
            source='placeholder',
            position=3,
        ),
        Card(
            slug='space',
            title='Space Photo',
            description='NASA Astronomy Picture of the Day',
            icon='planet',
            source='space',
            position=4,
        ),
        Card(
            slug='todo',
            title='Todos',
            description='Track what needs doing',
            icon='checklist',
            source='todo',
            position=5,
        ),
        Card(
            slug='timer',
            title='Timer',
            description='A countdown timer, with a Pomodoro mode',
            icon='timer',
            source='timer',
            position=6,
        ),
        Card(
            slug='moon',
            title='Moon',
            description="Tonight's moon phase",
            icon='moon',
            source='moon',
            position=7,
        ),
    ]


def seed(app=None, reset=False):
    """Insert any missing default cards, and the "Default" profile if there is
    no profile at all.

    Args:
        app: the Flask app to seed. Builds the default app when given none.
        reset: wipe cards, profiles and todos first, restoring the pristine
            starting state. Destroys user-created data; off by default.

    Returns:
        The slugs of the cards this run actually created.
    """
    app = app or create_app()
    with app.app_context():
        if reset:
            # Board entries go with their profiles and cards (ON DELETE CASCADE).
            db.session.execute(db.delete(Todo))
            db.session.execute(db.delete(Profile))
            db.session.execute(db.delete(Card))

        existing = set(db.session.scalars(db.select(Card.slug)))
        created = [card for card in default_cards() if card.slug not in existing]
        db.session.add_all(created)
        # The board entries and the starter todo below need the new cards' ids.
        db.session.flush()

        _place_on_default_board(created)

        # The starter todo is a hint for a first-time user, so it is written
        # only alongside a newly created todo card - never re-added to a card
        # whose todos the user has since cleared out.
        for card in created:
            if card.slug == 'todo':
                db.session.add(Todo(card_id=card.id, text=STARTER_TODO_TEXT))
        db.session.commit()

        slugs = [card.slug for card in created]
        _report(slugs, reset)
        return slugs


def _place_on_default_board(created):
    """Put default cards on the "Default" profile at their `DEFAULT_BOARD` places.

    With no profile at all, "Default" is created holding every default card.
    Otherwise only the cards this run `created` are added, and only to the
    profile named "Default": the user's other profiles are theirs to arrange.
    """
    if db.session.scalars(db.select(Profile)).first() is None:
        profile = Profile(name=DEFAULT_PROFILE_NAME)
        db.session.add(profile)
        cards = db.session.scalars(db.select(Card).where(Card.slug.in_(list(DEFAULT_BOARD))))
    else:
        profile = db.session.scalars(
            db.select(Profile).filter_by(name=DEFAULT_PROFILE_NAME)
        ).first()
        if profile is None:
            return
        cards = created
    profile.board_entries.extend(
        ProfileCard(card_id=card.id, **DEFAULT_BOARD[card.slug]) for card in cards
    )


def _report(created, reset):
    if reset:
        print(f'Reset the board and seeded {len(created)} cards.')
    elif created:
        print(f'Added {len(created)} missing card(s): {", ".join(created)}.')
    else:
        print('Nothing to do - all default cards are already present.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--reset',
        action='store_true',
        help='wipe cards, profiles and todos first, restoring the pristine starting '
        'state (destroys custom cards, todos, profiles and board changes)',
    )
    seed(reset=parser.parse_args().reset)
