package com.example.marksinventoryapp;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class MainActivity extends AppCompatActivity {

    private TextInputEditText usernameText;
    private TextInputEditText passwordText;
    private MaterialButton buttonLogin;
    private MaterialButton buttonCreateAccount;
    private TextView textStatus;
    private DBHelper dbHelper;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        usernameText = findViewById(R.id.usernameText);
        passwordText = findViewById(R.id.passwordText);
        buttonLogin = findViewById(R.id.buttonLogin);
        buttonCreateAccount = findViewById(R.id.buttonCreateAccount);
        textStatus = findViewById(R.id.textStatus);

        dbHelper = new DBHelper(this);
    }

        public void loginUser(View view) {
        // Grab what the user typed in.
        String username = getTextFromField(usernameText);
        String password = getTextFromField(passwordText);

        if (TextUtils.isEmpty(username) || TextUtils.isEmpty(password)) {
            textStatus.setText(R.string.please_enter_both_username_and_password);
            return;
        }

        boolean isValidUser = dbHelper.checkUser(username, password);

        // If it checks out, head to inventory.
        if (isValidUser) {
            textStatus.setText(R.string.login_successful);
            Toast.makeText(this, "Welcome, " + username + "!", Toast.LENGTH_SHORT).show();

            Intent intent = new Intent(this, WarehouseInventoryActivity.class);
            intent.putExtra(WarehouseInventoryActivity.EXTRA_USERNAME, username);
            startActivity(intent);
        } else {
            textStatus.setText(R.string.invalid_username_or_password);
        }
    }

        public void createAccount(View view) {
        // Same deal here, read the fields first.
        String username = getTextFromField(usernameText);
        String password = getTextFromField(passwordText);

        if (TextUtils.isEmpty(username) || TextUtils.isEmpty(password)) {
            textStatus.setText(R.string.please_enter_a_username_and_password_first);
            return;
        }

        if (dbHelper.userExists(username)) {
            textStatus.setText(R.string.that_username_already_exists);
            return;
        }

        boolean inserted = dbHelper.insertUser(username, password);

        if (inserted) {
            textStatus.setText(R.string.account_created_successfully);
            Toast.makeText(this, "Account created for " + username, Toast.LENGTH_SHORT).show();
            usernameText.setText("");
            passwordText.setText("");
        } else {
            textStatus.setText(R.string.account_could_not_be_created);
        }
    }

    // Trim so we do not repeat this everywhere.
    private String getTextFromField(TextInputEditText editText) {
        if (editText.getText() == null) {
            return "";
        }

        return editText.getText().toString().trim();
    }
}
