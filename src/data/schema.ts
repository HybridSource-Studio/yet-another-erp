// Record shapes for everything the app stores. See docs/plan.md, "Data model".
//
// Rules that keep merging between devices safe (and a self-hosted sync an add-on, not a rewrite):
// - Every record extends BaseRecord: a client-made id, a workspace, a tombstone, and a clock
//   stamp per field so two copies can be merged field by field (see merge.ts).
// - Optional fields are null, never undefined, so a JSON export round-trips exactly.
// - Fields whose names start with "_" are local only: derived on this device for indexes,
//   never exported.
// - Stock moves and journal entries are ledgers: written once, never edited or deleted. A
//   mistake is corrected by a reversing entry. Balances are always derived from the ledgers.
// - Money is an integer in minor units, quantities are integer thousandths, rates are basis
//   points. No floats are ever stored (see money.ts).

/** Bump when a record shape changes, and add a migration in migrations.ts. */
export const SCHEMA_VERSION = 1;

export type Id = string;
/** A calendar date with no time or zone: "YYYY-MM-DD". */
export type IsoDate = string;
/** A Hybrid Logical Clock stamp; see hlc.ts. Plain string comparison orders them. */
export type Stamp = string;
/** Money: an integer in the currency's minor units (cents). */
export type Minor = number;
/** A quantity: an integer in thousandths of a unit (1.5 kg is 1500). */
export type Milli = number;
/** A rate in basis points: 2000 is 20%. */
export type BasisPoints = number;

export interface BaseRecord {
  id: Id;
  workspaceId: Id;
  /** Milliseconds since the epoch on the device that made it. For display, not ordering. */
  createdAt: number;
  updatedAt: number;
  /** Set when deleted. Records are never removed, so a delete merges like any other edit. */
  deletedAt: number | null;
  /** For each clocked field, the stamp of its last write. */
  fieldClocks: Record<string, Stamp>;
}

// ---------- Settings and master data ----------

/** The business itself. The free, local app has exactly one. */
export interface Workspace extends BaseRecord {
  name: string;
  legalName: string;
  address: string;
  taxId: string;
  /** ISO 4217 code. Every amount in the workspace is in this currency for now. */
  currency: string;
  /** First day of the financial year, as "MM-DD". */
  fiscalYearStart: string;
}

/** A customer, a supplier, or both. One record per business you deal with. */
export interface Party extends BaseRecord {
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  /** Days from the issue date to the due date on new invoices and bills; null uses none. */
  paymentTermsDays: number | null;
  notes: string;
}

export type ItemKind = "stock" | "service";

/** Something you sell or buy. Stock items are counted; services are not. */
export interface Item extends BaseRecord {
  sku: string;
  name: string;
  kind: ItemKind;
  /** The unit it is counted in: "pcs", "kg", "h". */
  unit: string;
  salePrice: Minor | null;
  /**
   * The cost used when a sale is posted. A placeholder until moving-average costing derives it
   * from stock receipts (see docs/plan.md, phase 4).
   */
  costPrice: Minor | null;
  taxRateId: Id | null;
  reorderPoint: Milli | null;
  archived: boolean;
}

export interface TaxRate extends BaseRecord {
  name: string;
  rate: BasisPoints;
  archived: boolean;
}

/** Where stock is kept: a warehouse, a shop, a van. */
export interface Location extends BaseRecord {
  name: string;
  archived: boolean;
}

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

/**
 * The accounts posting needs to find without asking. Each role belongs to exactly one account;
 * the default chart sets them up, and users can rename those accounts but not remove them.
 */
export type AccountRole =
  | "cash"
  | "receivables"
  | "inventory"
  | "taxPaid"
  | "payables"
  | "taxCollected"
  | "equity"
  | "sales"
  | "costOfSales"
  | "purchases"
  | "stockAdjustments";

export interface Account extends BaseRecord {
  code: string;
  name: string;
  type: AccountType;
  role: AccountRole | null;
  archived: boolean;
}

// ---------- Documents ----------

export type DocumentType =
  "quote" | "salesOrder" | "invoice" | "creditNote" | "purchaseOrder" | "bill";

/**
 * draft: editable, posts nothing. confirmed: numbered, posted, and never edited again.
 * cancelled: was confirmed; its postings have been reversed.
 */
export type DocumentStatus = "draft" | "confirmed" | "cancelled";

export interface DocumentLine {
  itemId: Id | null;
  description: string;
  quantity: Milli;
  unitPrice: Minor;
  discount: BasisPoints;
  taxRateId: Id | null;
  /** The tax rate's value, copied when the line is saved and again on confirm. */
  taxRate: BasisPoints;
}

/**
 * Quotes, orders, invoices, credit notes and bills share one shape and one table, so numbering,
 * the draft/confirm/cancel lifecycle, conversion and printing are written once. Totals are never
 * stored: they are derived from the lines (totals.ts).
 */
export interface TradeDocument extends BaseRecord {
  type: DocumentType;
  status: DocumentStatus;
  /** Given on confirm ("INV-000042"); null while a draft. */
  number: string | null;
  partyId: Id;
  issueDate: IsoDate;
  dueDate: IsoDate | null;
  /** Where stock leaves from or arrives at; null uses the default location. */
  locationId: Id | null;
  reference: string;
  notes: string;
  lines: DocumentLine[];
  /** The document this one was converted from (a quote for an order, an order for an invoice). */
  sourceId: Id | null;
}

export type PaymentDirection = "in" | "out";

export interface Allocation {
  documentId: Id;
  amount: Minor;
}

/** Money received from a customer or paid to a supplier, set against documents. */
export interface Payment extends BaseRecord {
  direction: PaymentDirection;
  status: DocumentStatus;
  partyId: Id;
  date: IsoDate;
  amount: Minor;
  /** The cash or bank account the money moved through. */
  accountId: Id;
  method: string;
  reference: string;
  allocations: Allocation[];
}

// ---------- Ledgers (append-only) ----------

export type LedgerSource = "document" | "payment" | "adjustment" | "transfer" | "manual";

/** One change to the stock of one item at one location. Stock on hand is the sum of these. */
export interface StockMove extends BaseRecord {
  itemId: Id;
  locationId: Id;
  date: IsoDate;
  /** Positive arrives, negative leaves. */
  quantity: Milli;
  /** Cost per whole unit at the time of the move. */
  unitCost: Minor;
  sourceType: LedgerSource;
  sourceId: Id | null;
  /** The move this one reverses, if it is a reversal. */
  reversesId: Id | null;
  memo: string;
}

export interface JournalLine {
  accountId: Id;
  debit: Minor;
  credit: Minor;
}

/** A balanced double-entry journal entry. Account balances are the sum of these. */
export interface JournalEntry extends BaseRecord {
  date: IsoDate;
  memo: string;
  lines: JournalLine[];
  sourceType: LedgerSource;
  sourceId: Id | null;
  reversesId: Id | null;
}

// ---------- Tables ----------

export interface RecordTypes {
  workspaces: Workspace;
  taxRates: TaxRate;
  locations: Location;
  accounts: Account;
  parties: Party;
  items: Item;
  documents: TradeDocument;
  payments: Payment;
  stockMoves: StockMove;
  journal: JournalEntry;
}

export type TableName = keyof RecordTypes;

/** The synced, user-editable fields of each record type. Each gets its own clock stamp. */
export const FIELDS = {
  workspaces: ["name", "legalName", "address", "taxId", "currency", "fiscalYearStart"],
  taxRates: ["name", "rate", "archived"],
  locations: ["name", "archived"],
  accounts: ["code", "name", "type", "role", "archived"],
  parties: [
    "name",
    "isCustomer",
    "isSupplier",
    "email",
    "phone",
    "address",
    "taxId",
    "paymentTermsDays",
    "notes",
  ],
  items: [
    "sku",
    "name",
    "kind",
    "unit",
    "salePrice",
    "costPrice",
    "taxRateId",
    "reorderPoint",
    "archived",
  ],
  documents: [
    "type",
    "status",
    "number",
    "partyId",
    "issueDate",
    "dueDate",
    "locationId",
    "reference",
    "notes",
    "lines",
    "sourceId",
  ],
  payments: [
    "direction",
    "status",
    "partyId",
    "date",
    "amount",
    "accountId",
    "method",
    "reference",
    "allocations",
  ],
  stockMoves: [
    "itemId",
    "locationId",
    "date",
    "quantity",
    "unitCost",
    "sourceType",
    "sourceId",
    "reversesId",
    "memo",
  ],
  journal: ["date", "memo", "lines", "sourceType", "sourceId", "reversesId"],
} as const satisfies { [T in TableName]: readonly (keyof RecordTypes[T])[] };

/** Every table, in the order an export lists them (parents before the records that point at them). */
export const TABLES: readonly TableName[] = [
  "workspaces",
  "taxRates",
  "locations",
  "accounts",
  "parties",
  "items",
  "documents",
  "payments",
  "stockMoves",
  "journal",
];

/** Tables written once and never edited or deleted. Corrections are reversing entries. */
export type LedgerTable = "stockMoves" | "journal";

export const LEDGER_TABLES: readonly LedgerTable[] = ["stockMoves", "journal"];

export function isLedgerTable(table: TableName): table is LedgerTable {
  return (LEDGER_TABLES as readonly string[]).includes(table);
}

/** Clocked fields of a table, including the tombstone. */
export function clockedFields(table: TableName): readonly string[] {
  return [...FIELDS[table], "deletedAt"];
}

/** The editable part of a record: what create() takes and update() patches. */
export type Fields<T extends TableName> = Pick<
  RecordTypes[T],
  Extract<(typeof FIELDS)[T][number], keyof RecordTypes[T]>
>;

/** Local-only fields kept on stored records for indexing. Never exported. */
export interface LocalFields {
  /** Search words; absent on deleted records so they drop out of the index. */
  _words?: string[];
  /** Normalised name for sorting; absent on deleted records so lists skip them. */
  _sort?: string;
}

export type Stored<T extends TableName> = RecordTypes[T] & LocalFields;

// ---------- First-run defaults ----------

export const DEFAULT_CURRENCY = "USD";
export const DEFAULT_FISCAL_YEAR_START = "01-01";
export const DEFAULT_LOCATION = "Main";
export const DEFAULT_TAX_RATES: readonly { name: string; rate: BasisPoints }[] = [
  { name: "No tax", rate: 0 },
];

/** A small, generic chart of accounts. Users can add, rename and archive accounts. */
export const DEFAULT_ACCOUNTS: readonly {
  code: string;
  name: string;
  type: AccountType;
  role: AccountRole | null;
}[] = [
  { code: "1000", name: "Cash and bank", type: "asset", role: "cash" },
  { code: "1100", name: "Accounts receivable", type: "asset", role: "receivables" },
  { code: "1200", name: "Inventory", type: "asset", role: "inventory" },
  { code: "1300", name: "Tax paid", type: "asset", role: "taxPaid" },
  { code: "2000", name: "Accounts payable", type: "liability", role: "payables" },
  { code: "2100", name: "Tax collected", type: "liability", role: "taxCollected" },
  { code: "3000", name: "Owner's equity", type: "equity", role: "equity" },
  { code: "4000", name: "Sales", type: "income", role: "sales" },
  { code: "5000", name: "Cost of sales", type: "expense", role: "costOfSales" },
  { code: "5100", name: "Purchases and expenses", type: "expense", role: "purchases" },
  { code: "5200", name: "Stock adjustments", type: "expense", role: "stockAdjustments" },
];

/** Number prefixes, by document type. Numbers look like "INV-000042". */
export const NUMBER_PREFIX: Record<DocumentType, string> = {
  quote: "QUO",
  salesOrder: "SO",
  invoice: "INV",
  creditNote: "CN",
  purchaseOrder: "PO",
  bill: "BILL",
};
