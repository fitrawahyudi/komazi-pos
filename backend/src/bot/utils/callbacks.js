/**
 * Skema callback_data telegram (maks 64 bytes)
 * format: domain:action:id
 */
export const CALLBACKS = {
  NAV: /^go:(\w+)$/,
  CATEGORY: /^cat:(\d+)$/,
  PRODUCT: /^prd:(\d+)$/,
  CART_DONE: 'cart:done',
  TYPE: /^type:(DINE_IN|TAKE_AWAY)$/,
  PAYMENT: /^pay:(CASH|QRIS|TRANSFER|OPEN|CANCEL)$/,
  ORDER_ACTION: /^ord:(prep|ready):(\d+)$/,
  APPROVAL_ACTION: /^apr:(ok|no):(\d+)$/,
  WORKSPACE_AREA: /^area:(\d+)$/,
  WORKSPACE_PKG: /^pkg:(\d+)$/,
  LINK_STAFF: /^link:(\d+)$/,
};
