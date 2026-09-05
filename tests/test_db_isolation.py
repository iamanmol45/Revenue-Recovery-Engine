from database.connection import engine as prod_engine, DATABASE_URL
from tests.conftest import test_engine

def test_test_engine_is_not_production_engine():
    assert str(test_engine.url) != str(prod_engine.url)
    assert test_engine is not prod_engine

def test_test_database_is_not_database_url():
    assert str(test_engine.url) != DATABASE_URL
    assert "sqlite" in str(test_engine.url) or str(test_engine.url) != DATABASE_URL

def test_production_engine_untouched(db_session):
    # Just asserting that the session bound engine is the test engine
    assert db_session.get_bind() is test_engine
    assert db_session.get_bind() is not prod_engine
