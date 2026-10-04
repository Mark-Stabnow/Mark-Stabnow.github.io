#!/usr/bin/env python3
"""Read a backup of the original DBHelper SQLite database; export inventory only."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
import sys

FIELDS = ('id', 'item_name', 'sku', 'quantity', 'location', 'notes', 'updated_at')

def export_inventory(source: Path, destination: Path) -> int:
    source, destination = source.resolve(strict=True), destination.resolve()
    if source == destination:
        raise ValueError('Output must not overwrite the SQLite database.')
    if destination.exists():
        raise ValueError('Output already exists. Choose a new export filename.')
    # mode=ro prevents changing the source; use an actual SQLite backup, not a
    # main-file-only copy from a running WAL-mode Android application.
    connection = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)
    try:
        connection.execute('BEGIN')
        columns = {row[1] for row in connection.execute('PRAGMA table_info(inventory_items)')}
        if not set(FIELDS).issubset(columns):
            raise ValueError('Database does not have the original DBHelper inventory_items fields.')
        rows = connection.execute('SELECT ' + ','.join(FIELDS) + ' FROM inventory_items ORDER BY id LIMIT 1001').fetchall()
        if not 1 <= len(rows) <= 1000:
            raise ValueError('Export one to 1,000 inventory items for this capstone.')
        payload = {'format': 'cs499-android-inventory-v1',
                   'items': [dict(zip(FIELDS, row)) for row in rows]}
        # Exclusive create protects a source file or previous export from replacement.
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as output:
                json.dump(payload, output, ensure_ascii=False, allow_nan=False, indent=2)
                output.write('\n')
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        return len(rows)
    finally:
        connection.close()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    try:
        count = export_inventory(args.source, args.destination)
        print(f'Exported {count} inventory records. Usernames and password hashes were not exported.')
        return 0
    except (OSError, ValueError, sqlite3.Error, TypeError) as error:
        print(str(error), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
