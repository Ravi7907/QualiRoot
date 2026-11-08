from app.database import engine, init_db

try:
    with engine.connect() as connection:
        result = connection.exec_driver_sql(
            "SELECT version()"
        )
        print("PostgreSQL connection successful!")
        print(result.scalar())

    init_db()
    print("Investigations table created successfully!")

except Exception as e:
    print("Database connection failed!")
    print(e)