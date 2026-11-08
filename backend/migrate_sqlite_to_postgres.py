import sqlite3
from sqlalchemy import text
from app.database import engine

SQLITE_DB = "rca_copilot.db"


def migrate():
    print("Starting SQLite to PostgreSQL migration...")

    # Read existing SQLite records
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row

    records = sqlite_conn.execute("""
        SELECT id, incident_title, status, payload,
               created_at, updated_at
        FROM investigations
        ORDER BY id
    """).fetchall()

    print(f"Found {len(records)} SQLite investigations.")

    migrated = 0

    try:
        with engine.begin() as conn:

            for record in records:

                result = conn.execute(
                    text("""
                        INSERT INTO investigations
                        (id, incident_title, status, payload,
                         created_at, updated_at)
                        VALUES
                        (:id, :title, :status, :payload,
                         :created_at, :updated_at)
                        ON CONFLICT (id) DO NOTHING
                    """),
                    {
                        "id": record["id"],
                        "title": record["incident_title"],
                        "status": record["status"],
                        "payload": record["payload"],
                        "created_at": record["created_at"],
                        "updated_at": record["updated_at"]
                    }
                )

                if result.rowcount > 0:
                    migrated += 1

            # Synchronize the PostgreSQL identity sequence
            conn.execute(text("""
                SELECT setval(
                    pg_get_serial_sequence('investigations', 'id'),
                    COALESCE(
                        (SELECT MAX(id) FROM investigations),
                        1
                    ),
                    EXISTS(
                        SELECT 1 FROM investigations
                    )
                )
            """))

        print(f"Successfully migrated: {migrated}")

    except Exception as error:
        print("Migration failed:", error)
        raise

    finally:
        sqlite_conn.close()

    # Verify destination record count
    with engine.connect() as conn:
        count = conn.execute(
            text("SELECT COUNT(*) FROM investigations")
        ).scalar_one()

        print(f"PostgreSQL investigation count: {count}")

    print("Migration completed successfully!")


if __name__ == "__main__":
    migrate()