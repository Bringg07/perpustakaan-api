const { randomUUID } = require('node:crypto');

/**
 * Fake minimal Supabase client untuk pengujian.
 * Mendukung subset query builder yang dipakai oleh loanController:
 *   from().select().eq().neq().ilike().is().lt().lte().gt().gte().not().or()
 *   .order().range().single().maybeSingle()
 *   from().insert().select().single()
 *   from().update().eq().select().single()
 *   from().delete().eq().select().maybeSingle()
 */
class FakeQuery {
  constructor(store, table) {
    this.store = store;
    this.table = table;
    this._op = null;
    this._payload = null;
    this._filters = [];
    this._count = false;
    this._order = null;
    this._range = null;
    this._mode = 'many';
  }

  select(_columns, options) {
    if (this._op === null) this._op = 'select';
    if (options && options.count === 'exact') this._count = true;
    return this;
  }

  insert(payload) {
    this._op = 'insert';
    this._payload = payload;
    return this;
  }

  update(payload) {
    this._op = 'update';
    this._payload = payload;
    return this;
  }

  delete() {
    this._op = 'delete';
    return this;
  }

  eq(column, value) {
    this._filters.push((row) => row[column] === value);
    return this;
  }

  neq(column, value) {
    this._filters.push((row) => row[column] !== value);
    return this;
  }

  is(column, value) {
    this._filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  not(column, operator, value) {
    if (operator === 'is') {
      this._filters.push((row) => (value === null ? row[column] != null : row[column] == null));
    } else {
      this._filters.push((row) => row[column] !== value);
    }
    return this;
  }

  lt(column, value) {
    this._filters.push((row) => row[column] != null && row[column] < value);
    return this;
  }

  lte(column, value) {
    this._filters.push((row) => row[column] != null && row[column] <= value);
    return this;
  }

  gt(column, value) {
    this._filters.push((row) => row[column] != null && row[column] > value);
    return this;
  }

  gte(column, value) {
    this._filters.push((row) => row[column] != null && row[column] >= value);
    return this;
  }

  ilike(column, pattern) {
    const needle = String(pattern).replace(/%/g, '').toLowerCase();
    this._filters.push((row) => String(row[column] ?? '').toLowerCase().includes(needle));
    return this;
  }

  // Mendukung format PostgREST: "col.ilike.%val%,col2.ilike.%val2%"
  or(expression) {
    const predicates = String(expression)
      .split(',')
      .map((part) => {
        const match = part.match(/^([^.]+)\.([^.]+)\.(.*)$/);
        if (!match) return () => false;
        const [, column, operator, rawValue] = match;
        if (operator === 'ilike') {
          const needle = String(rawValue).replace(/%/g, '').toLowerCase();
          return (row) => String(row[column] ?? '').toLowerCase().includes(needle);
        }
        if (operator === 'eq') return (row) => row[column] === rawValue;
        return () => false;
      });

    this._filters.push((row) => predicates.some((predicate) => predicate(row)));
    return this;
  }

  order(column, options = {}) {
    this._order = { column, ascending: options.ascending !== false };
    return this;
  }

  range(from, to) {
    this._range = { from, to };
    return this;
  }

  single() {
    this._mode = 'single';
    return this;
  }

  maybeSingle() {
    this._mode = 'maybe';
    return this;
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  async _execute() {
    const table = this.store[this.table] || (this.store[this.table] = []);
    const matches = () => table.filter((row) => this._filters.every((filter) => filter(row)));

    switch (this._op) {
      case 'insert': {
        const now = new Date().toISOString();
        const row = {
          id: randomUUID(),
          created_at: now,
          updated_at: now,
          ...this._payload,
        };
        table.push(row);
        return this._wrap([row], null);
      }

      case 'update': {
        const matched = matches();
        const now = new Date().toISOString();
        for (const row of matched) Object.assign(row, this._payload, { updated_at: now });
        return this._wrap(matched, null);
      }

      case 'delete': {
        const matched = matches();
        const ids = new Set(matched.map((row) => row.id));
        this.store[this.table] = table.filter((row) => !ids.has(row.id));
        return this._wrap(matched, null);
      }

      case 'select':
      default: {
        let rows = matches();
        const total = rows.length;
        if (this._order) {
          const { column, ascending } = this._order;
          rows = [...rows].sort((a, b) => {
            if (a[column] === b[column]) return 0;
            return (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1);
          });
        }
        if (this._range) rows = rows.slice(this._range.from, this._range.to + 1);
        return this._wrap(rows, null, this._count ? total : null);
      }
    }
  }

  _wrap(rows, error, count = null) {
    if (error) return { data: null, error, count: null };

    if (this._mode === 'single') {
      if (rows.length !== 1) {
        return {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned' },
          count: null,
        };
      }
      return { data: rows[0], error: null, count };
    }

    if (this._mode === 'maybe') {
      return { data: rows[0] ?? null, error: null, count };
    }

    return { data: rows, error: null, count };
  }
}

/**
 * Membuat fake Supabase client dengan data awal opsional.
 * @param {object[]} [initialLoans]
 */
function createFakeSupabase(initialLoans = []) {
  const store = { loans: initialLoans.map((row) => ({ ...row })) };
  return {
    from(table) {
      return new FakeQuery(store, table);
    },
    __store: store,
  };
}

module.exports = { createFakeSupabase };
