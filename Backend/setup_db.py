"""
CipherGuard — MongoDB Setup Script
Run once to create indexes and initial data
Usage: python setup_db.py
"""

from pymongo import MongoClient, DESCENDING
import datetime
import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")

def setup_database():
    print("🔧 Setting up CipherGuard database...")
    client = MongoClient(MONGO_URI)
    db = client["cipherguard"]

    # ── Create Collections ──
    print("  ✓ Creating collections...")
    if "analyses" not in db.list_collection_names():
        db.create_collection("analyses")
    if "stats" not in db.list_collection_names():
        db.create_collection("stats")

    # ── Create Indexes ──
    print("  ✓ Creating indexes...")
    db.analyses.create_index([("analyzed_at", DESCENDING)])
    db.analyses.create_index([("score", DESCENDING)])
    db.analyses.create_index([("password_hash", 1)], unique=False)

    # ── Seed Initial Stats Doc ──
    print("  ✓ Seeding stats document...")
    db.stats.update_one(
        {"_id": "global"},
        {
            "$setOnInsert": {
                "total_analyses": 0,
                "created_at": datetime.datetime.utcnow(),
                "last_updated": datetime.datetime.utcnow()
            }
        },
        upsert=True
    )

    # ── Verify ──
    print("\n📊 Database Status:")
    print(f"   Collections: {db.list_collection_names()}")
    print(f"   analyses docs: {db.analyses.count_documents({})}")
    print(f"   Indexes: {list(db.analyses.index_information().keys())}")
    print("\n✅ Database setup complete!")
    client.close()

if __name__ == "__main__":
    setup_database()