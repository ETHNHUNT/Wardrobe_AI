from pathlib import Path

from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session

_HERE = Path(__file__).parent
DATABASE_URL = f"sqlite:///{_HERE / 'wardrobe.db'}"
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def run_migrations():
    """Add new columns to existing tables without dropping data.

    SQLModel's create_all() only creates missing tables, never alters existing ones.
    New nullable/defaulted columns must be added via ALTER TABLE.
    Safe to run on every startup: each ALTER is guarded by a PRAGMA existence check.
    """
    migrations = [
        # Iteration 1 — garment physical specs on ClothingItem
        ("clothingitem", "garment_measurements", "TEXT DEFAULT '{}'"),
        ("clothingitem", "material",             "TEXT"),
        # Iteration 6 — worn tracking + naming on SavedOutfit
        ("savedoutfit", "worn_date",  "TEXT"),           # ISO-8601 string
        ("savedoutfit", "times_worn", "INTEGER DEFAULT 0"),
        ("savedoutfit", "name",       "TEXT"),
    ]

    with engine.connect() as conn:
        for table, column, col_def in migrations:
            existing = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            col_names = [row[1] for row in existing]
            if column not in col_names:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}"))
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
