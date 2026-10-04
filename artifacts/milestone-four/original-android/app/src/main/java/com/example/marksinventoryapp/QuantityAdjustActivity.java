package com.example.marksinventoryapp;

import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.textfield.TextInputEditText;

public class QuantityAdjustActivity extends AppCompatActivity {
    public static final String EXTRA_ITEM_ID = "extra_item_id";

    private DBHelper dbHelper;
    private InventoryItem item;
    private TextInputEditText editQuantity;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_quantity_adjust);

        dbHelper = new DBHelper(this);
        editQuantity = findViewById(R.id.editQuantity);

        loadItem();

        findViewById(R.id.buttonSaveQuantity).setOnClickListener(view -> saveQuantity());
        findViewById(R.id.buttonCancel).setOnClickListener(view -> finish());
    }

        private void loadItem() {
        // Grab the item this screen is working on.
        int itemId = getIntent().getIntExtra(EXTRA_ITEM_ID, -1);
        item = dbHelper.getInventoryItem(itemId);

        if (item == null) {
            Toast.makeText(this, R.string.inventory_item_not_found, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        TextView textItemName = findViewById(R.id.textQuantityItemName);
        TextView textCurrentQty = findViewById(R.id.textCurrentQty);

        textItemName.setText(item.getItemName());
        textCurrentQty.setText(getString(R.string.current_quantity, item.getQuantity()));
        editQuantity.setText(String.valueOf(item.getQuantity()));
    }

        private void saveQuantity() {
        // Read the new quantity from the box.
        String quantityText = "";

        if (editQuantity.getText() != null) {
            quantityText = editQuantity.getText().toString().trim();
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

        boolean updated = dbHelper.updateInventoryQuantity(item.getId(), quantity);

        if (updated) {
            SmsAlertHelper.maybeSendLowInventoryAlert(this, item.getItemName(), quantity);
            Toast.makeText(this, R.string.inventory_item_saved, Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, R.string.inventory_item_not_saved, Toast.LENGTH_SHORT).show();
        }
    }
}
