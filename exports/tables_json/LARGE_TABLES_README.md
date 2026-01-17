# Menu Items and Inventory Items

Due to the large size of these tables (300+ items each), use the Supabase database query tool to export complete data:

```sql
-- Export menu_items
COPY (SELECT * FROM menu_items) TO '/tmp/menu_items.json' WITH (FORMAT JSON);

-- Export inventory_items  
COPY (SELECT * FROM inventory_items) TO '/tmp/inventory_items.json' WITH (FORMAT JSON);

-- Export audit_logs
COPY (SELECT * FROM audit_logs) TO '/tmp/audit_logs.json' WITH (FORMAT JSON);
```

Or use the Supabase JavaScript client:

```javascript
const { data: menuItems } = await supabase.from('menu_items').select('*');
const { data: inventoryItems } = await supabase.from('inventory_items').select('*');
const { data: auditLogs } = await supabase.from('audit_logs').select('*');

// Save to files
fs.writeFileSync('menu_items.json', JSON.stringify(menuItems, null, 2));
fs.writeFileSync('inventory_items.json', JSON.stringify(inventoryItems, null, 2));
fs.writeFileSync('audit_logs.json', JSON.stringify(auditLogs, null, 2));
```

## Summary of Large Tables

| Table | Approximate Row Count |
|-------|----------------------|
| menu_items | ~300 items |
| inventory_items | ~300 items |
| audit_logs | ~15 entries |
