# Taskerrand Backend

FastAPI backend for the Taskerrand platform.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload
```

## Database

The application uses SQLite by default for development. The database file `taskerrand.db` will be created automatically on first run.

For production, set the `DATABASE_URL` environment variable to use PostgreSQL:
```bash
export DATABASE_URL=postgresql://user:password@localhost/taskerrand
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Authentication

The API uses Firebase ID tokens for authentication. Include the token in the Authorization header:
```
Authorization: Bearer <firebase_id_token>
```

## Environment Variables

- `DATABASE_URL`: Database connection string (default: sqlite:///./taskerrand.db)

