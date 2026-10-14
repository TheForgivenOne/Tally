---
description: Review price code against resolution order and error bands
---
# Price resolution check

For any price-related code under review, verify:

1. Resolution order respected: cache → tag OCR → barcode+recheck → web reference → AI estimate. Stops at first hit.
2. Every price carries `{ source, age, confidence }` and renders an "exact" or "estimated" label.
3. Lower sources never overwrite higher ones.
4. Error bands applied: recent tag ±0–2%, older cache ±5–10%, web ±10%, AI ±25%. Basket shows range + "register total may differ".
5. AI path is server-side only, behind provider interface, capped per day/device.

List violations with file:line, then propose the minimal fix.
