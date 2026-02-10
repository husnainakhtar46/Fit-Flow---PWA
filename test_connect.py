
import psycopg2
import os
import sys

# Try Transaction Pooling port (6543) - often bypasses port 5432 blocks
DB_HOST = "aws-0-us-east-1.pooler.supabase.com"
DB_NAME = "postgres"
DB_USER = "postgres.sxbywyjsruhwoxrdgwwh" 
DB_PASSWORD = "bkEDn@EDjMYADF5"
DB_PORT = "6543" 

def test_connect():
    print(f"Testing connection to: {DB_HOST}:{DB_PORT}...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT, 
            sslmode='require'
        )
        print("✅ CONNECTION SUCCESSFUL!")
        return True
    except Exception as e:
        print("\n❌ CONNECTION FAILED")
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    test_connect()
