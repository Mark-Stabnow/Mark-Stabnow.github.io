package com.example.marksinventoryapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.card.MaterialCardView;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class WarehouseInventoryActivity extends AppCompatActivity {
    public static final String EXTRA_USERNAME = "extra_username";

    private static final int FILTER_ALL = 0;
    private static final int FILTER_LOW_STOCK = 1;
    private static final int FILTER_OUT_OF_STOCK = 2;
    private static final int FILTER_IN_STOCK = 3;
    private static final int LOW_STOCK_THRESHOLD = 2;

    private static final String PREFS_NAME = "inventory_screen_preferences";
    private static final String KEY_STARTER_DATA_SEEDED = "starter_data_seeded";

    private DBHelper dbHelper;
    private LinearLayout cardContainer;
    private MaterialButton buttonLowStock;
    private MaterialButton buttonOutOfStock;
    private TextInputEditText editSearch;
    private TextView textTotalItems;

    private String username;
    private int activeFilter = FILTER_ALL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_warehouse_inventory);

        username = getIntent().getStringExtra(EXTRA_USERNAME);
        dbHelper = new DBHelper(this);

        seedStarterInventoryIfNeeded();
        setupViews();
        setupButtons();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh the list when we come back from another screen.
        loadInventoryCards();
    }

        private void setupViews() {
        // Hooks up the screen pieces.
        cardContainer = findViewById(R.id.cardContainer);
        buttonLowStock = findViewById(R.id.buttonLowStock);
        buttonOutOfStock = findViewById(R.id.buttonOutOfStock);
        editSearch = findViewById(R.id.editSearch);
        textTotalItems = findViewById(R.id.textTotalItems);
    }

        private void setupButtons() {
        // Wire up the clicks and search box.
        findViewById(R.id.buttonBack).setOnClickListener(view -> finish());
        findViewById(R.id.buttonMenu).setOnClickListener(view -> openAccountPage());
        findViewById(R.id.buttonAddItem).setOnClickListener(view -> {
            Intent intent = new Intent(this, InventoryItemFormActivity.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonFilters).setOnClickListener(view -> showFilterPicker());

        findViewById(R.id.buttonNavInventory).setOnClickListener(view -> {
            // Reset the quick filters and search.
            activeFilter = FILTER_ALL;
            editSearch.setText("");
            loadInventoryCards();
        });

        findViewById(R.id.buttonNavAlerts).setOnClickListener(view -> {
            Intent intent = new Intent(this, SMSNotificationActivity.class);
            startActivity(intent);
        });

        findViewById(R.id.buttonNavAccount).setOnClickListener(view -> openAccountPage());

        buttonLowStock.setOnClickListener(view -> {
            // Tap once to filter, tap again to clear it.
            if (activeFilter == FILTER_LOW_STOCK) {
                activeFilter = FILTER_ALL;
            } else {
                activeFilter = FILTER_LOW_STOCK;
            }
            loadInventoryCards();
        });

        buttonOutOfStock.setOnClickListener(view -> {
            // Same idea here, tap again to turn it back off.
            if (activeFilter == FILTER_OUT_OF_STOCK) {
                activeFilter = FILTER_ALL;
            } else {
                activeFilter = FILTER_OUT_OF_STOCK;
            }
            loadInventoryCards();
        });

        editSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // Refilter the list as the user types.
                loadInventoryCards();
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });
    }

        private void loadInventoryCards() {
        // Pull the items and redraw the cards.
        List<InventoryItem> allItems = dbHelper.getAllInventoryItems();
        List<InventoryItem> visibleItems = getVisibleItems(allItems);

        // Showing item types here, not the grand total quantity.
        textTotalItems.setText(getString(R.string.total_items_equals, allItems.size()));
        // Keep the quick filter buttons in sync with the active filter.
        updateFilterButtonStyles();

        // Clear the old cards before drawing the new set.
        cardContainer.removeAllViews();

        if (visibleItems.isEmpty()) {
            TextView emptyText = new TextView(this);
            emptyText.setText(R.string.no_inventory_cards);
            emptyText.setGravity(Gravity.CENTER);
            emptyText.setTextColor(Color.rgb(31, 41, 55));
            emptyText.setPadding(0, dp(24), 0, dp(24));
            cardContainer.addView(emptyText);
            return;
        }

        for (InventoryItem item : visibleItems) {
            MaterialCardView card = createInventoryCard(item);
            cardContainer.addView(card);
        }
    }

        private List<InventoryItem> getVisibleItems(List<InventoryItem> allItems) {
        // Apply the current filter and search text.
        List<InventoryItem> visibleItems = new ArrayList<>();

        String searchText = "";
        if (editSearch.getText() != null) {
            // Lowercase it so the search is easier to match.
            searchText = editSearch.getText().toString().trim().toLowerCase(Locale.US);
        }

        for (InventoryItem item : allItems) {
            // Start by assuming the item passes both checks.
            boolean matchesFilter = true;
            boolean matchesSearch = true;

            if (activeFilter == FILTER_LOW_STOCK) {
                // Low stock means small number, but not fully empty.
                matchesFilter = item.getQuantity() <= LOW_STOCK_THRESHOLD && item.getQuantity() > 0;
            } else if (activeFilter == FILTER_OUT_OF_STOCK) {
                matchesFilter = item.getQuantity() == 0;
            } else if (activeFilter == FILTER_IN_STOCK) {
                matchesFilter = item.getQuantity() > 0;
            }

            if (!searchText.isEmpty()) {
                // Search checks the main fields the user would expect.
                String name = item.getItemName().toLowerCase(Locale.US);
                String sku = item.getSku().toLowerCase(Locale.US);
                String location = item.getLocation().toLowerCase(Locale.US);

                matchesSearch = name.contains(searchText)
                        || sku.contains(searchText)
                        || location.contains(searchText);
            }

            if (matchesFilter && matchesSearch) {
                visibleItems.add(item);
            }
        }

        return visibleItems;
    }

        private MaterialCardView createInventoryCard(InventoryItem item) {
        // Builds out one card for one item.
        MaterialCardView card = new MaterialCardView(this);
        card.setCardBackgroundColor(Color.rgb(235, 252, 232));
        card.setStrokeColor(Color.BLACK);
        card.setStrokeWidth(dp(2));
        card.setRadius(dp(3));
        card.setCardElevation(0);
        card.setUseCompatPadding(false);
        card.setOnClickListener(view -> openDetailsPage(item.getId()));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 0, 0, dp(8));
        card.setLayoutParams(cardParams);

        LinearLayout content = new LinearLayout(this);
        // Main stack inside the card.
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(10), dp(8), dp(10), dp(8));
        card.addView(content);

        LinearLayout titleRow = new LinearLayout(this);
        // Top row holds the item name and qty badge.
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(titleRow);

        TextView nameText = new TextView(this);
        nameText.setText(item.getItemName());
        nameText.setTextColor(Color.BLACK);
        nameText.setTextSize(17);
        nameText.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
        );
        titleRow.addView(nameText, nameParams);

        TextView quantityBadge = new TextView(this);
        quantityBadge.setText(getString(R.string.qty_badge, item.getQuantity()));
        quantityBadge.setTextColor(Color.BLACK);
        quantityBadge.setTextSize(12);
        quantityBadge.setGravity(Gravity.CENTER);
        quantityBadge.setBackgroundResource(R.drawable.bg_quantity_badge);
        quantityBadge.setPadding(dp(8), dp(2), dp(8), dp(2));
        titleRow.addView(quantityBadge);

        TextView locationText = new TextView(this);
        locationText.setText(getString(R.string.location_value, item.getLocation()));
        locationText.setTextColor(Color.rgb(17, 24, 39));
        locationText.setTextSize(13);
        locationText.setPadding(0, dp(8), 0, dp(14));
        content.addView(locationText);

        LinearLayout actionRow = new LinearLayout(this);
        // Bottom row holds quantity controls and action buttons.
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        actionRow.setGravity(Gravity.CENTER_VERTICAL);
        content.addView(actionRow);

        EditText quantityBox = new EditText(this);
        quantityBox.setText(String.valueOf(item.getQuantity()));
        quantityBox.setFocusable(false);
        quantityBox.setSingleLine(true);
        quantityBox.setGravity(Gravity.CENTER);
        quantityBox.setTextSize(14);
        quantityBox.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        quantityBox.setOnClickListener(view -> openQuantityPage(item.getId()));
        LinearLayout.LayoutParams quantityBoxParams = new LinearLayout.LayoutParams(dp(46), dp(34));
        quantityBoxParams.setMargins(0, 0, dp(2), 0);
        actionRow.addView(quantityBox, quantityBoxParams);

        MaterialButton minusButton = createSmallButton("-");
        minusButton.setOnClickListener(view -> openQuantityPage(item.getId()));
        LinearLayout.LayoutParams minusParams = new LinearLayout.LayoutParams(dp(32), dp(34));
        minusParams.setMargins(0, 0, dp(2), 0);
        actionRow.addView(minusButton, minusParams);

        MaterialButton plusButton = createSmallButton("+");
        plusButton.setOnClickListener(view -> openQuantityPage(item.getId()));
        LinearLayout.LayoutParams plusParams = new LinearLayout.LayoutParams(dp(32), dp(34));
        plusParams.setMargins(0, 0, dp(2), 0);
        actionRow.addView(plusButton, plusParams);

        View spacer = new View(this);
        // This pushes the action buttons over to the right.
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(
                0,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                1f
        );
        actionRow.addView(spacer, spacerParams);

        MaterialButton restockButton = createOutlineButton(getString(R.string.restock));
        restockButton.setOnClickListener(view -> openRestockPage(item.getId()));
        LinearLayout.LayoutParams restockParams = new LinearLayout.LayoutParams(dp(82), dp(38));
        restockParams.setMargins(0, 0, dp(2), 0);
        actionRow.addView(restockButton, restockParams);

        MaterialButton detailsButton = createOutlineButton(getString(R.string.details));
        detailsButton.setOnClickListener(view -> openDetailsPage(item.getId()));
        LinearLayout.LayoutParams detailsParams = new LinearLayout.LayoutParams(dp(76), dp(38));
        detailsParams.setMargins(dp(8), 0, 0, 0);
        actionRow.addView(detailsButton, detailsParams);

        return card;
    }

        private MaterialButton createSmallButton(String text) {
        // Small plus and minus buttons.
        MaterialButton button = new MaterialButton(this);
        button.setText(text);
        button.setTextSize(14);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setInsetTop(0);
        button.setInsetBottom(0);
        button.setPadding(0, 0, 0, 0);
        button.setStrokeColorResource(R.color.inventory_blue);
        button.setTextColor(getColor(R.color.inventory_blue));
        button.setBackgroundColor(Color.TRANSPARENT);
        return button;
    }

        private MaterialButton createOutlineButton(String text) {
        // Reusing this style for the action buttons.
        MaterialButton button = new MaterialButton(this);
        button.setText(text);
        button.setTextSize(13);
        button.setMinWidth(0);
        button.setMinHeight(0);
        button.setInsetTop(0);
        button.setInsetBottom(0);
        button.setPadding(0, 0, 0, 0);
        button.setStrokeColorResource(android.R.color.black);
        button.setStrokeWidth(dp(1));
        button.setTextColor(Color.BLACK);
        button.setBackgroundColor(Color.TRANSPARENT);
        return button;
    }

    private void openDetailsPage(int itemId) {
        Intent intent = new Intent(this, ItemDetailsActivity.class);
        intent.putExtra(ItemDetailsActivity.EXTRA_ITEM_ID, itemId);
        startActivity(intent);
    }

    private void openQuantityPage(int itemId) {
        Intent intent = new Intent(this, QuantityAdjustActivity.class);
        intent.putExtra(QuantityAdjustActivity.EXTRA_ITEM_ID, itemId);
        startActivity(intent);
    }

    private void openRestockPage(int itemId) {
        Intent intent = new Intent(this, RestockActivity.class);
        intent.putExtra(RestockActivity.EXTRA_ITEM_ID, itemId);
        startActivity(intent);
    }

    private void openAccountPage() {
        Intent intent = new Intent(this, AccountActivity.class);
        intent.putExtra(EXTRA_USERNAME, username);
        startActivity(intent);
    }

        private void showFilterPicker() {
        // Pop open the filter choices.
        String[] filters = {
                getString(R.string.all_items),
                getString(R.string.low_stock),
                getString(R.string.out_of_stock),
                getString(R.string.in_stock)
        };

        new AlertDialog.Builder(this)
                .setTitle(R.string.filter_inventory)
                .setSingleChoiceItems(filters, activeFilter, (dialog, which) -> {
                    activeFilter = which;
                    dialog.dismiss();
                    loadInventoryCards();
                })
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    private void updateFilterButtonStyles() {
        // Checked state gives a little visual cue for the quick filters.
        buttonLowStock.setChecked(activeFilter == FILTER_LOW_STOCK);
        buttonOutOfStock.setChecked(activeFilter == FILTER_OUT_OF_STOCK);
    }

        private void seedStarterInventoryIfNeeded() {
        // Starter data the first time only.
        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean alreadySeeded = preferences.getBoolean(KEY_STARTER_DATA_SEEDED, false);
        boolean hasItems = !dbHelper.getAllInventoryItems().isEmpty();

        if (alreadySeeded || hasItems) {    // Skip this if the starter data is already in there.
            return;
        }

        dbHelper.insertInventoryItem("Cat6 Cable 1,000'ft Box",
                "CAT6-1000-A", 0,
                "Aisle 3-C1", "Starter inventory record");
        dbHelper.insertInventoryItem("Cat6 Cable 2,000'ft Box",
                "CAT6-1000-B", 2,
                "Aisle 3-A", "Starter inventory record");
        dbHelper.insertInventoryItem("Maglock 12/24v w/ Bond Sen",
                "MAG-1224-BS", 10,
                "Aisle 3-B", "Starter inventory record");

        preferences.edit().putBoolean(KEY_STARTER_DATA_SEEDED, true).apply();
    }

    private int dp(int value) {
        // Quick dp to pixel helper so the sizes look right on different screens.
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}