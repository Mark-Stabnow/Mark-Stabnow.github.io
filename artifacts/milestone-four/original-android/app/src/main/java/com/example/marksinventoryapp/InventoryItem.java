package com.example.marksinventoryapp;
//
// I built out my InventoryItem class using OOP and then ended up going a different way
// using the sqlLite setup. So some of the objects are not used ,but they aren't hindering the app
// either, so I left them in.
public class InventoryItem {
    private int id;
    private String itemName;
    private String sku;
    private int quantity;
    private String location;
    private String notes;
    private String updatedAt;

    public InventoryItem(int id, String itemName, String sku, int quantity,
                         String location, String notes, String updatedAt) {
        this.id = id;
        this.itemName = itemName;
        this.sku = sku;
        this.quantity = quantity;
        this.location = location;
        this.notes = notes;
        this.updatedAt = updatedAt;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
