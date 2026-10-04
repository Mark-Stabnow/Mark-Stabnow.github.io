package com.example.marksinventoryapp;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class DBHelper extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "warehouse_inventory.db";
    private static final int DATABASE_VERSION = 1;

    private static final String TABLE_USERS = "users";
    private static final String TABLE_INVENTORY = "inventory_items";

    public DBHelper(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        // Keeping the users and inventory in the same database.
        db.execSQL("CREATE TABLE " + TABLE_USERS + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "username TEXT NOT NULL UNIQUE, "
                + "password_hash TEXT NOT NULL)");

        db.execSQL("CREATE TABLE " + TABLE_INVENTORY + " ("
                + "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                + "item_name TEXT NOT NULL, "
                + "sku TEXT NOT NULL, "
                + "quantity INTEGER NOT NULL DEFAULT 0, "
                + "location TEXT NOT NULL, "
                + "notes TEXT, "
                + "updated_at TEXT NOT NULL)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_INVENTORY);
        db.execSQL("DROP TABLE IF EXISTS " + TABLE_USERS);
        onCreate(db);
    }

        public boolean insertUser(String username, String password) {
        // Stops any duplicates before they hit the table.
        if (userExists(username)) {
            return false;
        }

        ContentValues values = new ContentValues();
        values.put("username", username);
        values.put("password_hash", hashPassword(password));

        long id = getWritableDatabase().insert(TABLE_USERS, null, values);
        return id != -1;
    }

    public boolean userExists(String username) {
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_USERS,
                new String[]{"id"},
                "username = ?",
                new String[]{username},
                null,
                null,
                null
        )) {
            return cursor.moveToFirst();
        }
    }

    public boolean checkUser(String username, String password) {
        String[] args = {username, hashPassword(password)};

        try (Cursor cursor = getReadableDatabase().query(
                TABLE_USERS,
                new String[]{"id"},
                "username = ? AND password_hash = ?",
                args,
                null,
                null,
                null
        )) {
            return cursor.moveToFirst();
        }
    }

    public long insertInventoryItem(String itemName, String sku, int quantity, String location,
                                    String notes) {
        ContentValues values = createInventoryValues(itemName, sku, quantity, location, notes);
        return getWritableDatabase().insert(TABLE_INVENTORY, null, values);
    }

    public boolean updateInventoryItem(int id, String itemName, String sku, int quantity,
                                       String location, String notes) {
        ContentValues values = createInventoryValues(itemName, sku, quantity, location, notes);
        int rows = getWritableDatabase().update(
                TABLE_INVENTORY,
                values,
                "id = ?",
                new String[]{String.valueOf(id)}
        );
        return rows > 0;
    }

    public boolean deleteInventoryItem(int id) {
        int rows = getWritableDatabase().delete(
                TABLE_INVENTORY,
                "id = ?",
                new String[]{String.valueOf(id)}
        );
        return rows > 0;
    }

        public boolean updateInventoryQuantity(int id, int quantity) {
        // Pulls the item first so we only swap the quantity.
        InventoryItem item = getInventoryItem(id);
        if (item == null) {
            return false;
        }

        return updateInventoryItem(
                id,
                item.getItemName(),
                item.getSku(),
                quantity,
                item.getLocation(),
                item.getNotes()
        );
    }

        public List<InventoryItem> getAllInventoryItems() {
        // Build the list the screen uses.
        List<InventoryItem> items = new ArrayList<>();

        try (Cursor cursor = getReadableDatabase().query(
                TABLE_INVENTORY,
                null,
                null,
                null,
                null,
                null,
                "item_name COLLATE NOCASE ASC"
        )) {
            while (cursor.moveToNext()) {
                items.add(readInventoryItem(cursor));
            }
        }

        return items;
    }

    public InventoryItem getInventoryItem(int id) {
        try (Cursor cursor = getReadableDatabase().query(
                TABLE_INVENTORY,
                null,
                "id = ?",
                new String[]{String.valueOf(id)},
                null,
                null,
                null
        )) {
            if (cursor.moveToFirst()) {
                return readInventoryItem(cursor);
            }
        }

        return null;
    }

        // Pack the item fields up before inserting or updating.
    private ContentValues createInventoryValues(String itemName, String sku, int quantity,
                                                String location, String notes) {
        ContentValues values = new ContentValues();
        values.put("item_name", itemName);
        values.put("sku", sku);
        values.put("quantity", quantity);
        values.put("location", location);
        values.put("notes", notes);
        values.put("updated_at", currentTimestamp());
        return values;
    }

        // Turn one database row into an InventoryItem object.
    private InventoryItem readInventoryItem(Cursor cursor) {
        return new InventoryItem(
                cursor.getInt(cursor.getColumnIndexOrThrow("id")),
                cursor.getString(cursor.getColumnIndexOrThrow("item_name")),
                cursor.getString(cursor.getColumnIndexOrThrow("sku")),
                cursor.getInt(cursor.getColumnIndexOrThrow("quantity")),
                cursor.getString(cursor.getColumnIndexOrThrow("location")),
                cursor.getString(cursor.getColumnIndexOrThrow("notes")),
                cursor.getString(cursor.getColumnIndexOrThrow("updated_at"))
        );
    }

        // Stamp the item with the latest save time.
    private String currentTimestamp() {
        return new SimpleDateFormat("MM/dd/yyyy HH:mm", Locale.US).format(new Date());
    }

    private String hashPassword(String password) {
        try {
            // Encrypting a PW is not as hard as I thought it would be!!
            // Hash the password first so we are not storing it wide open.
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte item : bytes) {
                builder.append(String.format(Locale.US, "%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable on this device.", exception);
        }
    }
}
