# QR Menu Card (GitHub Pages + Google Sheets)

This is a static menu web page that can be opened by scanning a QR code.

## 1. Prepare Google Sheet

1. Create a Google Sheet with tab name: `Menu`
2. Add headers in row 1:
   - `item`
   - `price`
   - `category` (veg / non-veg / alcoholic-drink / non-alcoholic-drink)
   - `section` (any section name you want, e.g., Starters/Snacks, Thali, Whiskey, Mocktail, Other)
   - `type` (optional: food / drinks)
3. Fill your menu rows.
4. Make it public:
   - Share -> General access -> **Anyone with the link**

## 2. Connect Sheet to website

In `script.js`, replace:

`REPLACE_WITH_SHEET_ID`

Find sheet ID in your URL:

`https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit...`

## 3. Deploy for free on GitHub Pages

1. Push this folder to a GitHub repository.
2. Open repo -> Settings -> Pages.
3. Source: **Deploy from a branch**
4. Branch: `main` (or your default branch), folder: `/ (root)`
5. Save.

Your menu URL will be:

`https://<username>.github.io/<repo-name>/`

## 4. Generate QR code

Use any free QR generator with your GitHub Pages URL and print/display it in your restaurant.
