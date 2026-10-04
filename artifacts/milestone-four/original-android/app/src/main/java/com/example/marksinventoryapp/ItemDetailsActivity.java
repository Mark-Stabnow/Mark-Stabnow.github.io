package com.example.marksinventoryapp;

import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class ItemDetailsActivity extends AppCompatActivity {
    public static final String EXTRA_ITEM_ID = "extra_item_id";

    private DBHelper dbHelper;
    private int itemId;

    private TextInputEditText editItemName;
    private TextInputEditText editSku;
    private TextInputEditText editQuantity;
    private TextInputEditText editLocation;
    private TextInputEditText editNotes;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_inventory_item_form);

        dbHelper = new DBHelper(this);
        itemId = getIntent().getIntExtra(EXTRA_ITEM_ID, -1);

        editItemName = findViewById(R.id.editItemName);
        editSku = findViewById(R.id.editSku);
        editQuantity = findViewById(R.id.editQuantity);
        editLocation = findViewById(R.id.editLocation);
        editNotes = findViewById(R.id.editNotes);

        TextView title = findViewById(R.id.textFormTitle);
        title.setText(R.string.item_details);

        MaterialButton saveButton = findViewById(R.id.buttonSaveItem);
        saveButton.setText(R.string.update_item);
        saveButton.setOnClickListener(view -> updateItem());

        MaterialButton deleteButton = findViewById(R.id.buttonDeleteItem);
        deleteButton.setOnClickListener(view -> deleteItem());

        findViewById(R.id.buttonCancel).setOnClickListener(view -> finish());

        loadItem();
    }

        private void loadItem() {
        // Load the item so the form starts filled in.
        InventoryItem item = dbHelper.getInventoryItem(itemId);

        if (item == null) {
            Toast.makeText(this, R.string.inventory_item_not_found, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        editItemName.setText(item.getItemName());
        editSku.setText(item.getSku());
        editQuantity.setText(String.valueOf(item.getQuantity()));
        editLocation.setText(item.getLocation());
        editNotes.setText(item.getNotes());
    }

        private void updateItem() {
        // Read the latest values off the form.
        String itemName = getTextFromField(editItemName);
        String sku = getTextFromField(editSku);
        String quantityText = getTextFromField(editQuantity);
        String location = getTextFromField(editLocation);
        String notes = getTextFromField(editNotes);

        if (itemName.isEmpty() || sku.isEmpty() || quantityText.isEmpty() || location.isEmpty()) {
            Toast.makeText(this, R.string.complete_required_inventory_fields, Toast.LENGTH_SHORT).show();
            return;
        }

        int quantity;
        try {
            quantity = Integer.parseInt(quantityText);
        } catch (NumberFormatException e) {
            Toast.makeText(this, R.string.quantity_must_be_a_number, Toast.LENGTH_SHORT).show();
            return;
        }

        if (quantity < 0) {
            Toast.makeText(this, R.string.quantity_cannot_be_negative, Toast.LENGTH_SHORT).show();
            return;
        }

        boolean updated = dbHelper.updateInventoryItem(itemId, itemName, sku, quantity, location, notes);

        if (updated) {
            SmsAlertHelper.maybeSendLowInventoryAlert(this, itemName, quantity);
            Toast.makeText(this, R.string.inventory_item_saved, Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, R.string.inventory_item_not_saved, Toast.LENGTH_SHORT).show();
        }
    }

        private void deleteItem() {
        // Delete the item tied to this screen.
        boolean deleted = dbHelper.deleteInventoryItem(itemId);

        if (deleted) {
            Toast.makeText(this, R.string.inventory_item_deleted, Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, R.string.inventory_item_not_deleted, Toast.LENGTH_SHORT).show();
        }
    }

    // Quick trim for text fields.
    private String getTextFromField(TextInputEditText editText) {
        if (editText.getText() == null) {
            return "";
        }

        return editText.getText().toString().trim();
    }
}
