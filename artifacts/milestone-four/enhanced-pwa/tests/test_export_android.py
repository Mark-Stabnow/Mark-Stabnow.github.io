"""Real SQLite tests; no PostgreSQL or third-party Python packages required."""
from contextlib import closing
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'export-android.py'
spec = importlib.util.spec_from_file_location('export_android', MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AndroidExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.db = self.root / 'warehouse_inventory.db'
        self.output = self.root / 'inventory.json'

    def fixture(self, count=2):
        with closing(sqlite3.connect(self.db)) as c, c:
            c.executescript("""CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT);
              CREATE TABLE inventory_items(id INTEGER PRIMARY KEY, item_name TEXT NOT NULL,
              sku TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 0, location TEXT NOT NULL,
              notes TEXT, updated_at TEXT NOT NULL);""")
            c.execute('INSERT INTO users VALUES(1,?,?)', ('private-user', 'private-hash'))
            c.executemany('INSERT INTO inventory_items VALUES(?,?,?,?,?,?,?)',
                [(i+1,'Cable',f'LEGACY-{i+1}',i,'Shelf A',None,'09/01/2026 12:00') for i in range(count)])

    def test_exports_actual_sqlite_rows(self):
        self.fixture()
        self.assertEqual(module.export_inventory(self.db,self.output),2)
        payload=json.loads(self.output.read_text())
        self.assertEqual(payload['items'][0]['id'],1)
        self.assertIsNone(payload['items'][0]['notes'])

    def test_does_not_export_users_or_password_hashes(self):
        self.fixture();module.export_inventory(self.db,self.output)
        text=self.output.read_text()
        self.assertNotIn('private-user',text);self.assertNotIn('private-hash',text)
        self.assertNotIn('password_hash',text)

    def test_source_database_bytes_remain_unchanged(self):
        self.fixture();before=hashlib.sha256(self.db.read_bytes()).hexdigest()
        module.export_inventory(self.db,self.output)
        self.assertEqual(before,hashlib.sha256(self.db.read_bytes()).hexdigest())

    def test_does_not_replace_an_existing_export(self):
        self.fixture();self.output.write_text('keep this')
        with self.assertRaises(ValueError):module.export_inventory(self.db,self.output)
        self.assertEqual(self.output.read_text(),'keep this')

    def test_does_not_replace_the_database(self):
        self.fixture()
        with self.assertRaises(ValueError):module.export_inventory(self.db,self.db)

    def test_rejects_an_unrelated_schema(self):
        with closing(sqlite3.connect(self.db)) as c, c:c.execute('CREATE TABLE inventory_items(id INTEGER)')
        with self.assertRaises(ValueError):module.export_inventory(self.db,self.output)
        self.assertFalse(self.output.exists())

    def test_preserves_exactly_one_thousand_records(self):
        self.fixture(1000);self.assertEqual(module.export_inventory(self.db,self.output),1000)

    def test_rejects_over_limit_without_truncating(self):
        self.fixture(1001)
        with self.assertRaises(ValueError):module.export_inventory(self.db,self.output)
        self.assertFalse(self.output.exists())

    def test_nonexistent_source_does_not_create_an_empty_database(self):
        with self.assertRaises(FileNotFoundError):module.export_inventory(self.db,self.output)
        self.assertFalse(self.db.exists())

if __name__=='__main__':unittest.main()
