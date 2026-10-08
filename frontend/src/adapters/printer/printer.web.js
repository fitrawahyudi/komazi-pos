import { usePrinterStore } from '../../store/printerStore';
import { formatCurrency, formatDateTime } from '../../utils/format';

/**
 * Web Printer Adapter
 * Fallback 1: Web Bluetooth jika terhubung di browser Chrome/Edge
 * Fallback 2: Browser Print Dialog (window.print) dengan layout struk thermal 58mm/80mm
 */
export const WebPrinter = {
  async connect(device) {
    const store = usePrinterStore.getState();
    if (device) {
      return await store.connectBluetoothDevice(device);
    }
    return await store.connectBluetooth();
  },

  async disconnect() {
    const store = usePrinterStore.getState();
    return await store.disconnectPrinter();
  },

  isConnected() {
    return usePrinterStore.getState().isConnected;
  },

  async getDevices() {
    if (typeof navigator !== 'undefined' && navigator.bluetooth?.getDevices) {
      try {
        const devices = await navigator.bluetooth.getDevices();
        return devices.map((d) => ({ id: d.id, name: d.name || 'Printer Bluetooth' }));
      } catch {
        return [];
      }
    }
    return [];
  },

  async print(receipt) {
    const store = usePrinterStore.getState();

    // Jalur A: Jika Bluetooth terhubung di web, kirim data ESC/POS via printer store
    if (store.isConnected && store.connectionType === 'BLUETOOTH') {
      try {
        // Render via print receipt helper dari store jika ada
        return await this.printViaEscPos(receipt);
      } catch (err) {
        console.warn('[WebPrinter] ESC/POS print failed, falling back to browser print dialog:', err);
      }
    }

    // Jalur B: Fallback Browser Print Dialog (window.print)
    return this.printViaBrowser(receipt);
  },

  async testPrint() {
    const testReceipt = {
      storeName: 'KOMAZI COFFEE & WORKSPACE',
      orderNumber: 'TEST-001',
      cashier: 'Tester',
      type: 'DINE IN',
      items: [
        { name: 'Kopi Susu Komazi', qty: 1, price: 20000, subtotal: 20000 },
        { name: 'Butter Croissant', qty: 1, price: 18000, subtotal: 18000 },
      ],
      subtotal: 38000,
      discount: 0,
      tax: 3800,
      total: 41800,
      paymentMethod: 'CASH',
    };
    return await this.print(testReceipt);
  },

  printViaBrowser(receipt) {
    if (typeof window === 'undefined') return { success: false };

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    const itemsHtml = (receipt.items || [])
      .map(
        (i) => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>${i.qty}x ${i.name || i.productName}</span>
          <span>${formatCurrency(i.subtotal || i.lineTotal || i.qty * i.price)}</span>
        </div>
      `
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.orderNumber || receipt.invoiceNo || ''}</title>
        <style>
          @page { margin: 0; size: auto; }
          body {
            font-family: monospace;
            width: 58mm;
            margin: 0 auto;
            padding: 8px 4px;
            font-size: 11px;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 13px;">${receipt.storeName || 'KOMAZI COFFEE'}</div>
        <div class="center" style="font-size: 9px; margin-bottom: 4px;">Coffee & Coworking Space</div>
        <div class="divider"></div>
        <div class="row"><span>No:</span><span>${receipt.orderNumber || receipt.invoiceNo || '-'}</span></div>
        <div class="row"><span>Waktu:</span><span>${formatDateTime(receipt.createdAt || new Date())}</span></div>
        <div class="row"><span>Kasir:</span><span>${receipt.cashier || 'Kasir'}</span></div>
        <div class="row"><span>Tipe:</span><span>${receipt.type || 'DINE IN'}</span></div>
        <div class="divider"></div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="row"><span>Subtotal:</span><span>${formatCurrency(receipt.subtotal || 0)}</span></div>
        ${receipt.discount ? `<div class="row"><span>Diskon:</span><span>-${formatCurrency(receipt.discount)}</span></div>` : ''}
        ${receipt.tax ? `<div class="row"><span>Pajak:</span><span>${formatCurrency(receipt.tax)}</span></div>` : ''}
        <div class="row bold" style="font-size: 13px; margin-top: 2px;">
          <span>TOTAL:</span><span>${formatCurrency(receipt.total || 0)}</span>
        </div>
        <div class="row" style="margin-top: 2px;">
          <span>Metode:</span><span>${receipt.paymentMethod || 'CASH'}</span>
        </div>
        <div class="divider"></div>
        <div class="center" style="margin-top: 6px; font-size: 10px;">Terima Kasih Atas Kunjungan Anda!</div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.warn('[WebPrinter] Browser print failed:', e);
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    }, 250);

    return { success: true, method: 'BROWSER_DIALOG' };
  },

  async printViaEscPos(receipt) {
    // Generate ESC/POS byte commands
    try {
      const EscPosEncoder = (await import('esc-pos-encoder')).default;
      const encoder = new EscPosEncoder();
      let enc = encoder
        .initialize()
        .align('center')
        .bold(true)
        .line(receipt.storeName || 'KOMAZI COFFEE')
        .bold(false)
        .line('Coffee & Coworking Space')
        .line('--------------------------------')
        .align('left')
        .line(`No: ${receipt.orderNumber || receipt.invoiceNo || '-'}`)
        .line(`Tipe: ${receipt.type || 'DINE IN'}`)
        .line('--------------------------------');

      for (const item of receipt.items || []) {
        enc = enc.line(`${item.qty}x ${item.name || item.productName}`);
      }

      enc = enc
        .line('--------------------------------')
        .align('right')
        .bold(true)
        .line(`TOTAL: ${formatCurrency(receipt.total || 0)}`)
        .bold(false)
        .align('center')
        .line('Terima Kasih!')
        .newline()
        .newline()
        .cut();

      const result = enc.encode();
      const store = usePrinterStore.getState();
      await store.sendRawData(result);
      return { success: true, method: 'BLUETOOTH_ESC_POS' };
    } catch (err) {
      console.warn('[WebPrinter] ESC/POS encoding error:', err);
      return this.printViaBrowser(receipt);
    }
  },
};
