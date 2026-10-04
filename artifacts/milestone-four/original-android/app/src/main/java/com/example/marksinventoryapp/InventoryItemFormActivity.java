package com.example.marksinventoryapp;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class InventoryItemFormActivity extends AppCompatActivity {

    private DBHelper dbHelper;

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

        editItemName = findViewById(R.id.editItemName);
        editSku = findViewById(R.id.editSku);
        editQuantity = findViewById(R.id.editQuantity);
        editLocation = findViewById(R.id.editLocation);
        editNotes = findViewById(R.id.editNotes);

        TextView title = findViewById(R.id.textFormTitle);
        title.setText(R.string.add_inventory_item);

        MaterialButton saveButton = findViewById(R.id.buttonSaveItem);
        saveButton.setText(R.string.add_item);
        saveButton.setOnClickListener(view -> saveItem());

        findViewById(R.id.buttonDeleteItem).setVisibility(View.GONE);
        findViewById(R.id.buttonCancel).setOnClickListener(view -> finish());
    }

        private void saveItem() {
        // Pull everything out of the form.
        String itemName = getTextFromField(editItemName);
        String sku = getTextFromField(editSku);
        String quantityText = getTextFromField(editQuantity);
        String location = getTextFromField(editLocation);
        String notes = getTextFromField(editNotes);

        if (itemName.isEmpty() || sku.isEmpty() || quantityText.isEmpty() || location.isEmpty()) {
            Toast.makeText(this, R.string.complete_required_inventory_fields, Toast.LENGTH_SHORT).show();
            return;
        }

        // Make sure quantity is actually a number.
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
        // Save the new item to the database.
        long newId = dbHelper.insertInventoryItem(itemName, sku, quantity, location, notes);

        if (newId == -1) {
            Toast.makeText(this, R.string.inventory_item_not_saved, Toast.LENGTH_SHORT).show();
        } else {
            SmsAlertHelper.maybeSendLowInventoryAlert(this, itemName, quantity);
            Toast.makeText(this, R.string.inventory_item_saved, Toast.LENGTH_SHORT).show();
            finish();
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
