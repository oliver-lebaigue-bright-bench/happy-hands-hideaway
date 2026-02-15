# Happy Hands Hideaway - Admin Guide

## Overview

The **Admin Dashboard** has been created to manage your product inventory and stock levels. It's integrated with Firebase Realtime Database to track all your handmade items.

## Accessing the Admin Panel

1. Navigate to the **Admin** link in the shop navigation (visible in the top right corner)
2. URL: `admin.html`
3. When you first access the admin page, you'll be prompted for a password
4. **Default Password:** `hideaway2025`
5. This password is stored in browser localStorage for convenience (you can change it by editing the code)

## Admin Features

### 📦 Current Inventory Tab

View all your products at a glance with:
- **Product names** - Display names of all items
- **Prices** - Retail price of each item
- **Current Stock** - How many units are in stock
- **Status** - Quick indicator (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock)

#### Summary Statistics
- **Total Products** - Count of all product types
- **Total Stock** - Combined inventory units
- **Low Stock Items** - Products with less than 5 units (alerts you to restock)

### 📊 Adjust Stock Tab

Manage inventory levels with two forms:

#### Add Stock
1. Select a product from the dropdown
2. Enter the quantity to add
3. Click "Add Stock"
4. The new total will display immediately

#### Deduct Stock
1. Select a product from the dropdown
2. Enter the quantity to deduct
3. Click "Deduct Stock"
4. The system prevents deducting more than available stock
5. The new total will display immediately

### ➕ Add New Product Tab

Create new products to sell:

1. **Product Name** (Required) - e.g., "Bunting #5"
2. **Price** (Required) - Enter in £ (e.g., 9.99)
3. **Initial Stock** - Starting inventory (optional, defaults to 0)
4. **Category** - Choose from:
   - Bunting
   - Creatures
   - Desk Tidy
   - Gonks
   - Other
5. **Image URL** - Link to your product image (from GitHub or elsewhere)
6. **Description** - Brief product description

**Note:** After creating a new product, you'll need to:
- Add it to the relevant product page HTML file
- Update the shop.html if adding a new category
- Upload images to your GitHub repository

## How Stock Management Works

### Firebase Database Structure

Your inventory is stored in Firebase Realtime Database with this structure:

```
items/
  productkey1/
    name: "Product Name"
    price: 9.99
    stock: 15
    category: "bunting"
    imageUrl: "https://..."
    description: "..."
  productkey2/
    ...
```

### How Product Keys Work

Product names are converted to keys by:
- Converting to lowercase
- Removing special characters and spaces
- Example: "Bunting #1" → "bunting1"

### Stock Deduction During Purchase

When a customer buys an item:
1. The stock is checked to ensure availability
2. If enough stock exists, it's automatically deducted
3. The order is processed
4. You can see updated stock in the admin panel immediately

## Tips for Using the Admin Panel

✅ **Best Practices:**
- Check "Current Inventory" regularly to track stock levels
- Add stock when items fall below 5 units
- Update prices in the database directly if needed (contact support)
- Create new products in advance before they run out

⚠️ **Things to Remember:**
- The inventory updates in real-time across all pages
- All data is stored in Firebase (secure cloud backup)
- Images must be hosted separately (GitHub or image storage service)
- Test new products on your local version before connecting to real inventory

## Password Security

For better security:
1. Change the password in `admin.html` (line 318)
2. Use a strong password that's hard to guess
3. Store the password somewhere safe
4. If you need to reset, clear browser localStorage

## Troubleshooting

**Issue:** Password prompt keeps appearing
- Clear your browser's localStorage
- Refresh the page

**Issue:** Stock not updating
- Check your Firebase connection
- Ensure you have internet connectivity
- Verify Firebase API credentials in the HTML files

**Issue:** Can't add new products
- Ensure all required fields are filled (name, price)
- Check for special characters that might cause issues
- Verify Firebase permissions

## GitHub Image Storage Setup

Since you're using GitHub for image storage:

1. Create a folder in your GitHub repo: `/images/products/`
2. Upload product images there
3. Use raw GitHub URLs for image links:
   ```
   https://raw.githubusercontent.com/oliver-lebaigue-bright-bench/happy-hands-hideaway/main/images/product_name.jpg
   ```
4. Update image URLs in the admin panel when creating/editing products

---

**Created:** February 2026
**For:** Happy Hands Hideaway by Oliver LeBarige
