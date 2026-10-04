package com.example.marksinventoryapp;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.widget.TextView;
import android.widget.Toast;
import java.util.List;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class SMSNotificationActivity extends AppCompatActivity {

    private static final int SMS_PERMISSION_CODE = 101;
    private static final String PREFS_NAME = "sms_alert_preferences";
    private static final String KEY_PHONE_NUMBER = "phone_number";
    private static final String KEY_SMS_ALERTS_ENABLED = "sms_alerts_enabled";

    private TextView textPermissionStatus;
    private TextInputEditText editPhoneNumber;
    private SharedPreferences preferences;
    private boolean sendTestAlertAfterPermission;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_sms_notifications);

        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        textPermissionStatus = findViewById(R.id.textPermissionStatus);
        editPhoneNumber = findViewById(R.id.editPhoneNumber);

        MaterialButton buttonEnableSms = findViewById(R.id.buttonEnableSms);
        MaterialButton buttonDisableSms = findViewById(R.id.buttonDisableSms);
        MaterialButton buttonSendTestSms = findViewById(R.id.buttonSendTestSms);

        editPhoneNumber.setText(getSavedPhoneNumber(preferences));
        updatePermissionStatus();

        findViewById(R.id.buttonBackSms).setOnClickListener(view -> finish());

        buttonEnableSms.setOnClickListener(view -> checkSmsPermission());
        buttonDisableSms.setOnClickListener(view -> disableSmsAlerts());

        buttonSendTestSms.setOnClickListener(view -> sendTestAlert());
    }

    public static String getSavedPhoneNumber(SharedPreferences preferences) {
        return preferences.getString(KEY_PHONE_NUMBER, "");
    }

    public static String getPreferencesName() {
        return PREFS_NAME;
    }

    public static boolean areSmsAlertsEnabled(SharedPreferences preferences) {
        return preferences.getBoolean(KEY_SMS_ALERTS_ENABLED, false);
    }

    private void setSmsAlertsEnabled(boolean enabled) {
        preferences.edit().putBoolean(KEY_SMS_ALERTS_ENABLED, enabled).apply();
    }

    private void checkSmsPermission() {
        if (hasSmsPermission()) {
            savePhoneNumber();
            setSmsAlertsEnabled(true);
            updatePermissionStatus();
            Toast.makeText(this, "SMS alerts enabled.", Toast.LENGTH_SHORT).show();
        } else {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.SEND_SMS},
                    SMS_PERMISSION_CODE
            );
        }
    }

    private void updatePermissionStatus() {
        boolean alertsEnabled = areSmsAlertsEnabled(preferences);

        if (!hasSmsPermission()) {
            textPermissionStatus.setText("SMS permission not granted.");
            textPermissionStatus.setTextColor(0xFF8A1F24);
            return;
        }

        if (alertsEnabled) {
            textPermissionStatus.setText("SMS alerts are on.");
            textPermissionStatus.setTextColor(0xFF2E7D32);
        } else {
            textPermissionStatus.setText("SMS alerts are off.");
            textPermissionStatus.setTextColor(0xFFB26A00);
        }
    }

    private void sendTestAlert() {
        String phoneNumber = savePhoneNumber();

        if (phoneNumber.isEmpty()) {
            Toast.makeText(this, "Enter a phone number to send a test alert.",
                    Toast.LENGTH_SHORT).show();
            return;
        }

        if (!hasSmsPermission()) {
            sendTestAlertAfterPermission = true;
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{Manifest.permission.SEND_SMS},
                    SMS_PERMISSION_CODE
            );
            return;
        }

        sendLowInventorySms(phoneNumber);
    }

    private boolean hasSmsPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void sendLowInventorySms(String phoneNumber) {
        DBHelper dbHelper = new DBHelper(this);
        List<InventoryItem> allItems = dbHelper.getAllInventoryItems();

        try {
            SmsManager smsManager = getSmsManager();
            smsManager.sendTextMessage(phoneNumber, null,
                    getStringBuilder(allItems).toString(), null, null);
            Toast.makeText(this, "Test SMS alert sent.", Toast.LENGTH_SHORT).show();
            openMessagesConversation(phoneNumber);
        } catch (IllegalArgumentException | SecurityException exception) {
            Toast.makeText(this, "The test SMS could not be sent.",
                    Toast.LENGTH_LONG).show();
        }
    }

    @NonNull
    private static StringBuilder getStringBuilder(List<InventoryItem> allItems) {
        StringBuilder message = new StringBuilder();
        boolean foundAny = false;

        message.append("Inventory Alert:\n\n");

        for (InventoryItem item : allItems) {
            if (item.getQuantity() == 0) {
                message.append("Out of stock: ")
                        .append(item.getItemName())
                        .append("\n");
                foundAny = true;
            } else if (item.getQuantity() <= 2) {
                message.append("Low stock: ")
                        .append(item.getItemName())
                        .append(" is down to ")
                        .append(item.getQuantity())
                        .append("\n");
                foundAny = true;
            }
        }

        if (!foundAny) {
            message.append("No low or out of stock items right now.\n");
        }
        return message;
    }

    private void disableSmsAlerts() {
        setSmsAlertsEnabled(false);
        updatePermissionStatus();
        Toast.makeText(this, "SMS alerts disabled.", Toast.LENGTH_SHORT).show();
    }

    @SuppressWarnings("deprecation")
    private SmsManager getSmsManager() {
        return SmsManager.getDefault();
    }

    private void openMessagesConversation(String phoneNumber) {
        Intent conversationIntent = new Intent(Intent.ACTION_VIEW);
        conversationIntent.setData(Uri.parse("sms:" + Uri.encode(phoneNumber)));

        try {
            startActivity(conversationIntent);
        } catch (ActivityNotFoundException exception) {
            openMessagesApp();
        }
    }

    private void openMessagesApp() {
        Intent launchIntent = getPackageManager()
                .getLaunchIntentForPackage("com.google.android.apps.messaging");

        if (launchIntent == null) {
            launchIntent = getPackageManager()
                    .getLaunchIntentForPackage("com.android.messaging");
        }

        if (launchIntent == null) {
            Toast.makeText(this, "Open the Messages app to view the SMS.",
                    Toast.LENGTH_LONG).show();
            return;
        }

        startActivity(launchIntent);
    }

    private String savePhoneNumber() {
        String phoneNumber = editPhoneNumber.getText() == null
                ? ""
                : editPhoneNumber.getText().toString().trim();
        preferences.edit().putString(KEY_PHONE_NUMBER, phoneNumber).apply();
        return phoneNumber;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == SMS_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                String phoneNumber = savePhoneNumber();
                setSmsAlertsEnabled(true);
                updatePermissionStatus();

                if (sendTestAlertAfterPermission) {
                    sendTestAlertAfterPermission = false;
                    sendLowInventorySms(phoneNumber);
                } else {
                    Toast.makeText(this, "Permission granted. SMS alerts are on.",
                            Toast.LENGTH_SHORT).show();
                }
            } else {
                sendTestAlertAfterPermission = false;
                setSmsAlertsEnabled(false);
                updatePermissionStatus();
                Toast.makeText(this, "Permission denied. SMS alerts stay off.",
                        Toast.LENGTH_SHORT).show();
            }
        }
    }
}
