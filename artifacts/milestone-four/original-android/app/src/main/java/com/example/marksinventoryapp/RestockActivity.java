package com.example.marksinventoryapp;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.textfield.TextInputEditText;

public class RestockActivity extends AppCompatActivity {
    public static final String EXTRA_ITEM_ID = "extra_item_id";

    private DBHelper dbHelper;
    private InventoryItem item;
    private TextInputEditText editRestockAmount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_restock);

        dbHelper = new DBHelper(this);
        editRestockAmount = findViewById(R.id.editRestockAmount);

        loadItem();

        findViewById(R.id.buttonApplyRestock).setOnClickListener(view -> applyRestock());
        findViewById(R.id.buttonRestockDetails).setOnClickListener(view -> openDetailsPage());
        findViewById(R.id.buttonCancel).setOnClickListener(view -> finish());
    }

        private void loadItem() {
        // Grab the item we are restocking.
        int itemId = getIntent().getIntExtra(EXTRA_ITEM_ID, -1);
        item = dbHelper.getInventoryItem(itemId);

        if (item == null) {
            Toast.makeText(this, R.string.inventory_item_not_found, Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        TextView textItemName = findViewById(R.id.textRestockItemName);
        TextView textCurrentQty = findViewById(R.id.textCurrentQty);

        textItemName.setText(item.getItemName());
        textCurrentQty.setText(getString(R.string.current_quantity, item.getQuantity()));
    }

        private void applyRestock() {
        // Read how much to add.
        String restockText = "";

        if (editRestockAmount.getText() != null) {
            restockText = editRestockAmount.getText().toString().trim();
        }

        int amountToAdd;
        try {
            amountToAdd = Integer.parseInt(restockText);
        } catch (NumberFormatException e) {
            Toast.makeText(this, R.string.quantity_must_be_a_number, Toast.LENGTH_SHORT).show();
            return;
        }

        if (amountToAdd < 0) {
            Toast.makeText(this, R.string.quantity_cannot_be_negative, Toast.LENGTH_SHORT).show();
            return;
        }

        int newQuantity = item.getQuantity() + amountToAdd;
        boolean updated = dbHelper.updateInventoryQuantity(item.getId(), newQuantity);

        if (updated) {
            SmsAlertHelper.maybeSendLowInventoryAlert(this, item.getItemName(), newQuantity);
            Toast.makeText(this, R.string.inventory_item_saved, Toast.LENGTH_SHORT).show();
            finish();
        } else {
            Toast.makeText(this, R.string.inventory_item_not_saved, Toast.LENGTH_SHORT).show();
        }
    }

        private void openDetailsPage() {
        // Jump to the full item details screen.
        Intent intent = new Intent(this, ItemDetailsActivity.class);
        intent.putExtra(ItemDetailsActivity.EXTRA_ITEM_ID, item.getId());
        startActivity(intent);
    }
}
