package com.example.marksinventoryapp;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import android.widget.Toast;

import androidx.core.content.ContextCompat;

public class SmsAlertHelper {
    private static final int LOW_STOCK_THRESHOLD = 2;

    private SmsAlertHelper() {
        // No reason to make one of these.
    }

    public static void maybeSendLowInventoryAlert(Context context, String itemName, int quantity) {
        // Only text when the count is low enough.
        if (quantity > LOW_STOCK_THRESHOLD) {
            return;
        }

        boolean hasPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED;

        // No permission, no text.
        if (!hasPermission) {
            Toast.makeText(context, R.string.sms_permission_missing_alert_skipped,
                    Toast.LENGTH_LONG).show();
            return;
        }

        SharedPreferences preferences = context.getSharedPreferences(
                SMSNotificationActivity.getPreferencesName(),
                Context.MODE_PRIVATE
        );

        if (!SMSNotificationActivity.areSmsAlertsEnabled(preferences)) {
            return;
        }

        String phoneNumber = SMSNotificationActivity.getSavedPhoneNumber(preferences);

        if (phoneNumber.isEmpty()) {
            Toast.makeText(context, R.string.sms_phone_missing_alert_skipped,
                    Toast.LENGTH_LONG).show();
            return;
        }

        String message;
        if (quantity == 0) {
            message = "Out of Stock Alert: " + itemName + " is out of stock.";
        } else {
            message = "Low Inventory Alert: " + itemName + " is down to " + quantity + " units.";
        }

        SmsManager smsManager = getSmsManager();
        smsManager.sendTextMessage(phoneNumber, null, message, null, null);

        Toast.makeText(context, R.string.low_inventory_sms_sent, Toast.LENGTH_SHORT).show();
    }

    @SuppressWarnings("deprecation")
    private static SmsManager getSmsManager() {
        return SmsManager.getDefault();
    }
}
