from pathlib import Path

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


def get_session():
    with Session(engine) as session:
        yield session
