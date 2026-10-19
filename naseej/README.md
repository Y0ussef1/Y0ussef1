# Naseej

A small e-commerce storefront for Naseej. Plain HTML, CSS, and JavaScript with no build step and no dependencies.

## Features

- Product catalog with category filters
- Product detail page with quantity selector
- Cart stored in `localStorage`, with running count in the header
- Cart review with quantity changes and subtotal
- Checkout form with validation and an order confirmation

This is a demo. No payment is processed and no order is sent anywhere.

## Run locally

Any static file server works:

```bash
cd naseej
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Files

| File           | Purpose                                        |
| -------------- | ---------------------------------------------- |
| `index.html`   | Page shell, header, and footer                 |
| `styles.css`   | Styles, including light and dark themes        |
| `products.js`  | Sample catalog (`PRODUCTS` array)              |
| `app.js`       | Hash router, cart state, and views             |

## Next steps

- Replace `products.js` with data from a backend or headless CMS
- Add a payment provider on the checkout step
- Add Arabic/RTL support, since the brand name is Arabic
