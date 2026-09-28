app.js
  ↓
Connect Oracle
  ↓
Start purchaseOrderWatcher



purchaseOrderWatcher.js
  ↓
Check ORDER_HEAD + ORDER_BODY
  ↓
Detect new PD order
  ↓
Get new VRNO
  ↓
Call purchaseOrderService.js



purchaseOrderService.js
  ↓
Fetch order by VRNO
  ↓
Get:
ACC_CODE
MAKE_CODE
COST_CODE
  ↓
Call 3 separate master services





accountMasterService.js
  ↓
ACC_CODE
  ↓
ACC_MAST
  ↓
Return Account Master





makeMasterService.js
  ↓
MAKE_CODE
  ↓
MAKE_MAST
  ↓
Return Make Master




costMasterService.js
  ↓
COST_CODE
  ↓
COST_MAST
  ↓
Return Cost Master




purchaseOrderService.js
  ↓
Combine:
Order data
+ Account Master
+ Make Master
+ Cost Master
  ↓
Return final Purchase Order object
  ↓
purchaseOrderWatcher.js
  ↓
Currently console.log
  ↓
Future: Send to BookEZ API



Watch new Purchase Order
→ identify VRNO
→ fetch related codes
→ fetch required masters
→ combine complete data
→ send to BookEZ