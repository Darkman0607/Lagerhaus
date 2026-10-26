/**
 * U01: bewusster leerer, schreibgeschützter Startzustand.
 * Ab U02 durch versionierte IndexedDB-Transaktionen ersetzen.
 * Hier werden ausdrücklich keine fiktiven Testbestände ausgeliefert.
 */
export class WarehouseRepository {
  async summary() {
    return Object.freeze({ articles: 0, lowStock: 0, outOfStock: 0, openPurchases: 0 });
  }
  async recentActivity() { return []; }
  async articles() { return []; }
  async locations() { return []; }
  async purchases() { return []; }
}
export const repository = new WarehouseRepository();
