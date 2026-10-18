// Deterministic fictional e-commerce dataset: EXACTLY 100 data rows.
// Contains controlled, documented quality issues for demonstration:
//  - 3 exact duplicate rows (copies of earlier rows)
//  - ~6 missing values, ~8 values with stray whitespace
//  - Inconsistent category capitalization, mixed date formats (ISO, US, EU)
//  - 2 invalid dates, a few numbers stored as "$1,234.50" text
//  - 1 suspicious quantity outlier (valid-looking but extreme)
export const DEMO_COLUMNS = [
  "Order ID", "Order Date", "Customer ID", "Customer Name", "Email", "Product", "Category",
  "Quantity", "Unit Price", "Discount %", "Revenue", "Cost", "Region", "Payment Status", "Order Status",
];

const products: [string, string, number, number][] = [
  ["Wireless Headphones", "Electronics", 79.99, 42], ["Mechanical Keyboard", "Electronics", 129.5, 71],
  ["USB-C Hub", "Electronics", 44.99, 23], ["Ergonomic Chair", "Furniture", 249, 140],
  ["Standing Desk", "Furniture", 499, 310], ["Desk Lamp", "Furniture", 39.95, 18],
  ["Running Shoes", "Apparel", 119.99, 58], ["Cotton Hoodie", "Apparel", 54.5, 24],
  ["Yoga Mat", "Fitness", 34.99, 15], ["Dumbbell Set", "Fitness", 89.99, 47],
  ["Coffee Beans 1kg", "Grocery", 19.99, 9], ["Green Tea Box", "Grocery", 12.5, 5],
  ["Skincare Serum", "Beauty", 42, 16], ["Electric Toothbrush", "Beauty", 69.99, 33],
  ["Board Game Deluxe", "Toys & Games", 59.99, 28], ["Building Blocks Set", "Toys & Games", 74.95, 36],
];
const first = ["Amelia", "Liam", "Sofia", "Noah", "Priya", "Mateo", "Ingrid", "Kenji", "Fatima", "Lucas", "Elena", "Omar", "Grace", "Hugo", "Mei", "Diego", "Anna", "Ravi", "Zara", "Tomas"];
const last = ["Carter", "Nguyen", "Garcia", "Kim", "Patel", "Haddad", "Novak", "Tanaka", "Ali", "Brown", "Kowalska", "Nasser", "O'Brien", "Moreau", "Chen", "Rossi", "Novakova", "Sharma", "Khan", "Berg"];
const regions = ["North", "South", "East", "West", "Central"];
const payStatuses = ["Paid", "Paid", "Paid", "Paid", "Pending", "Refunded"];
const orderStatuses = ["Delivered", "Delivered", "Delivered", "Shipped", "Processing", "Cancelled"];

function rng(seed: number) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
const pad = (n: number) => String(n).padStart(2, "0");

export function generateDemoRows(): Record<string, string>[] {
  const r = rng(20260105);
  const rows: Record<string, string>[] = [];
  for (let i = 0; i < 97; i++) {
    const [product, category, price, cost] = products[Math.floor(r() * products.length)];
    const custNum = 1001 + Math.floor(r() * 40);
    const name = `${first[custNum % first.length]} ${last[(custNum * 7) % last.length]}`;
    const qty = 1 + Math.floor(r() * 5);
    const discount = [0, 0, 0, 5, 10, 15, 20][Math.floor(r() * 7)];
    const revenue = +(qty * price * (1 - discount / 100)).toFixed(2);
    const month = 7 + Math.floor(r() * 6); const day = 1 + Math.floor(r() * 28);
    const d = `${2025}-${pad(month)}-${pad(day)}`;
    let dateStr = d;
    if (i % 9 === 4) dateStr = `${pad(month)}/${pad(day)}/2025`; // US format
    if (i % 11 === 6) dateStr = `${pad(day)}.${pad(month)}.2025`; // EU dotted
    let cat = category;
    if (i % 13 === 5) cat = category.toLowerCase();
    if (i % 17 === 8) cat = category.toUpperCase();
    let revStr = String(revenue);
    if (i % 14 === 7) revStr = `$${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`; // number as text
    let region = regions[Math.floor(r() * regions.length)];
    if (i % 12 === 3) region = ` ${region} `;
    rows.push({
      "Order ID": `ORD-${5001 + i}`, "Order Date": dateStr, "Customer ID": `CUST-${custNum}`,
      "Customer Name": i % 15 === 9 ? ` ${name} ` : name,
      "Email": `${name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/ +/g, ".")}@example.com`,
      "Product": product, "Category": cat, "Quantity": String(qty), "Unit Price": String(price),
      "Discount %": String(discount), "Revenue": revStr, "Cost": String(+(qty * cost).toFixed(2)),
      "Region": region, "Payment Status": payStatuses[Math.floor(r() * payStatuses.length)],
      "Order Status": orderStatuses[Math.floor(r() * orderStatuses.length)],
    });
  }
  // Controlled issues
  rows[10]["Email"] = "grace.obrien_at_example";           // invalid email
  rows[22]["Order Date"] = "13/32/2025";                    // invalid date
  rows[57]["Order Date"] = "2025-02-30";                    // invalid date (Feb 30)
  rows[31]["Unit Price"] = "";                              // missing
  rows[44]["Region"] = "";                                  // missing
  rows[63]["Quantity"] = "";                                // missing
  rows[78]["Discount %"] = "";                              // missing
  rows[85]["Customer Name"] = "";                           // missing
  rows[40]["Quantity"] = "two";                             // number as word
  rows[71]["Quantity"] = "480";                             // outlier candidate
  rows[71]["Revenue"] = String(+(480 * parseFloat(rows[71]["Unit Price"])).toFixed(2));
  // 3 exact duplicates → total exactly 100 rows
  rows.push({ ...rows[4] }, { ...rows[28] }, { ...rows[66] });
  return rows;
}

export const DEMO_EXPECTED = {
  rows: 100, duplicates: 3, invalidDates: 2, invalidEmails: 1,
  note: "Fictional sample data generated for demonstration. Deterministic: the same seed always produces the same 100 rows.",
};
