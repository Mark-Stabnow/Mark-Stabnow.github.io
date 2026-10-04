package com.example.marksinventoryapp;

import android.content.Intent;
import android.os.Bundle;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class AccountActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_account);

        TextView textAccountUser = findViewById(R.id.textAccountUser);
                // Grab the signed-in username if there is one.
        String username = getIntent().getStringExtra(WarehouseInventoryActivity.EXTRA_USERNAME);

                // Fall back to the generic message if the name is missing.
        if (username == null || username.trim().isEmpty()) {
            textAccountUser.setText(R.string.account_signed_in);
        } else {
            textAccountUser.setText(getString(R.string.account_signed_in_as, username));
        }

        findViewById(R.id.buttonBackToInventory).setOnClickListener(view -> finish());

                // Kick the user back to the login screen and clear the stack.
        findViewById(R.id.buttonLogout).setOnClickListener(view -> {
            Intent intent = new Intent(AccountActivity.this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
        });
    }
}
