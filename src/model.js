export const emptyWorkspace = { version: 1, keys: [], loans: [] };
export function required(value, label, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`${label} is required (up to ${max} characters).`);
  return value.trim();
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function validate(value) {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.keys) ||
    !Array.isArray(value.loans) ||
    value.keys.length > 1000 ||
    value.loans.length > 10000
  )
    throw new Error("This is not a valid Keynest backup.");
  const ids = new Set();
  const tags = new Set();
  for (const key of value.keys) {
    required(key.id, "ID", 100);
    required(key.tag, "Key tag", 40);
    required(key.property, "Property", 200);
    if (
      typeof key.notes !== "string" ||
      key.notes.length > 1000 ||
      ids.has(key.id) ||
      tags.has(key.tag.toLowerCase())
    )
      throw new Error("Invalid or duplicate key.");
    ids.add(key.id);
    tags.add(key.tag.toLowerCase());
  }
  const loanIds = new Set();
  const open = new Set();
  for (const loan of value.loans) {
    required(loan.id, "Loan ID", 100);
    required(loan.borrower, "Borrower", 100);
    if (
      !ids.has(loan.keyId) ||
      loanIds.has(loan.id) ||
      !validDate(loan.due) ||
      !Number.isFinite(loan.outAt) ||
      (loan.returnedAt !== null &&
        (!Number.isFinite(loan.returnedAt) || loan.returnedAt < loan.outAt)) ||
      typeof loan.note !== "string" ||
      loan.note.length > 1000
    )
      throw new Error("Invalid handover record.");
    if (loan.returnedAt === null) {
      if (open.has(loan.keyId))
        throw new Error("A key cannot have two open handovers.");
      open.add(loan.keyId);
    }
    loanIds.add(loan.id);
  }
  return value;
}
export function addKey(state, value, id = crypto.randomUUID()) {
  if (state.keys.length >= 1000) throw new Error("The key register is full.");
  const tag = required(value.tag, "Key tag", 40);
  if (state.keys.some((key) => key.tag.toLowerCase() === tag.toLowerCase()))
    throw new Error("This key tag already exists.");
  state.keys.push({
    id,
    tag,
    property: required(value.property, "Property", 200),
    notes: String(value.notes || "")
      .trim()
      .slice(0, 1000),
  });
  return state;
}
export function checkout(
  state,
  value,
  now = Date.now(),
  id = crypto.randomUUID(),
) {
  if (!state.keys.some((key) => key.id === value.keyId))
    throw new Error("Choose an existing key.");
  if (
    state.loans.some(
      (loan) => loan.keyId === value.keyId && loan.returnedAt === null,
    )
  )
    throw new Error("This key is already checked out.");
  if (state.loans.length >= 10000)
    throw new Error("The handover history is full. Export a backup.");
  if (!validDate(value.due) || value.due < localDate(new Date(now)))
    throw new Error("The return date must be today or later.");
  state.loans.push({
    id,
    keyId: value.keyId,
    borrower: required(value.borrower, "Borrower", 100),
    due: value.due,
    outAt: now,
    returnedAt: null,
    note: String(value.note || "").slice(0, 1000),
  });
  return state;
}
export function returnKey(state, id, now = Date.now()) {
  const loan = state.loans.find((item) => item.id === id);
  if (!loan || loan.returnedAt !== null)
    throw new Error("This handover is already closed or no longer exists.");
  loan.returnedAt = Math.max(now, loan.outAt);
  return state;
}
export function csv(state) {
  const cell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  return [
    ["Key tag", "Property", "Borrower", "Issued", "Due", "Returned", "Note"],
    ...state.loans.map((loan) => {
      const key = state.keys.find((key) => key.id === loan.keyId);
      return [
        key.tag,
        key.property,
        loan.borrower,
        new Date(loan.outAt).toISOString(),
        loan.due,
        loan.returnedAt ? new Date(loan.returnedAt).toISOString() : "",
        loan.note,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
