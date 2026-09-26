"""Create any missing tables:   python -m app.init_db

The API creates tables at startup when run with uvicorn, but serverless hosts such as Vercel
don't run startup hooks, so run this once against the database (and after adding a table).
It only creates what is missing; it never alters or drops anything.
"""
from .db import Base, engine
from . import models  # noqa: F401  (registers the tables on Base.metadata)

if __name__ == "__main__":
    Base.metadata.create_all(engine)
    print("Tables ready:", ", ".join(sorted(Base.metadata.tables)))
