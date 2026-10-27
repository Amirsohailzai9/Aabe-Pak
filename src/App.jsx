import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { adminEmails, auth, db, firebaseConfigured } from './firebase.js';

const currency = import.meta.env.VITE_CURRENCY || 'USD';
const money = (amount) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0);
const dateLabel = (value) => {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};
const today = () => new Date().toISOString().slice(0, 10);
const monthNow = () => new Date().toISOString().slice(0, 7);
const errorText = (error) => {
  const messages = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account exists for this email.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'permission-denied': 'Your account is not authorized. Check the Firebase admin allowlist.',
  };
  return messages[error?.code] || error?.message || 'Something went wrong. Please try again.';
};

function Icon({ name, size = 19 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  const paths = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    receipt: <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6L6.3 16l1.4-1.1a7 7 0 0 1 0-1.8L6.3 12l1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8H14l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.9Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    water: <><path d="M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12Z" /><path d="M9 16a3 3 0 0 0 3 2" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Login({ onLogin, busy, error, configured }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event) => { event.preventDefault(); onLogin(email, password); };
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark"><Icon name="water" size={25} /></div>
        <p className="eyebrow">WATER SUPPLIER MANAGEMENT</p>
        <h1>Welcome back</h1>
        <p className="login-copy">Sign in to manage your customers and billing.</p>
        {!configured ? (
          <div className="notice error"><strong>Firebase setup required</strong><br />Copy <code>.env.example</code> to <code>.env</code>, add your Firebase web app configuration, then restart the dev server.</div>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            {error && <div className="notice error">{error}</div>}
            <label>Email address<input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" /></label>
            <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'} <Icon name="arrow" size={17} /></button>
            {adminEmails.length === 0 && <p className="field-hint">Set <code>VITE_ADMIN_EMAILS</code> in your <code>.env</code> before signing in.</p>}
          </form>
        )}
        <p className="login-footnote">Secure access for authorized administrators</p>
      </section>
    </main>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" /></button></header>{children}</section></div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('Dashboard');
  const [customers, setCustomers] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const notify = (message, kind = 'success') => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3600);
  };

  useEffect(() => {
    if (!auth) { setAuthReady(true); return undefined; }
    return onAuthStateChanged(auth, (nextUser) => {
      if (nextUser && (!nextUser.emailVerified || !adminEmails.includes(nextUser.email?.toLowerCase()))) {
        setUser(null);
        setAuthError(!nextUser.emailVerified ? 'Please verify your email address before signing in.' : 'This account is not on the configured admin allowlist.');
        void signOut(auth);
      } else {
        setUser(nextUser);
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setCustomers([]);
      setBills([]);
      return undefined;
    }
    setLoading(true);
    let customerReady = false;
    let billsReady = false;
    const done = () => { if (customerReady && billsReady) setLoading(false); };
    const handleError = (error) => { setLoading(false); notify(errorText(error), 'error'); };
    const stopCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      customerReady = true; done();
    }, handleError);
    const stopBills = onSnapshot(collection(db, 'bills'), (snapshot) => {
      setBills(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      billsReady = true; done();
    }, handleError);
    return () => { stopCustomers(); stopBills(); };
  }, [user]);

  const authorized = Boolean(user && user.emailVerified && adminEmails.includes(user.email?.toLowerCase()));

  const login = async (email, password) => {
    setAuthBusy(true); setAuthError('');
    try {
      if (!adminEmails.includes(email.trim().toLowerCase())) throw new Error('This email is not on the configured admin allowlist.');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email address before signing in.');
      }
    } catch (error) { setAuthError(errorText(error)); }
    finally { setAuthBusy(false); }
  };

  const totals = useMemo(() => {
    const paidBills = bills.filter((bill) => bill.status === 'Paid');
    const unpaidBills = bills.filter((bill) => bill.status !== 'Paid');
    return {
      received: paidBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
      outstanding: unpaidBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0),
      paid: paidBills.length,
      unpaid: unpaidBills.length,
    };
  }, [bills]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => [customer.name, customer.phone, customer.customerCode].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [customers, search]);
  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bills.filter((bill) => [bill.customerName, bill.customerCode, bill.billNumber, bill.billingMonth, bill.status].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [bills, search]);

  const saveCustomer = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const values = {
        name: String(form.get('name')).trim(),
        phone: String(form.get('phone')).trim(),
        address: String(form.get('address')).trim(),
        monthlyPrice: Number(form.get('monthlyPrice')),
        updatedAt: serverTimestamp(),
      };
      if (modal.customer) await updateDoc(doc(db, 'customers', modal.customer.id), values);
      else {
        const customerRef = doc(collection(db, 'customers'));
        await setDoc(customerRef, { ...values, customerCode: `CUS-${customerRef.id.toUpperCase()}`, createdAt: serverTimestamp() });
      }
      setModal(null); notify(modal.customer ? 'Customer updated successfully.' : 'Customer added successfully.');
    } catch (error) { notify(errorText(error), 'error'); }
    finally { setSaving(false); }
  };

  const saveBill = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = customers.find((item) => item.id === form.get('customerId'));
    if (!customer) { notify('Choose a customer for this bill.', 'error'); return; }
    setSaving(true);
    try {
      const values = {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.customerCode,
        phone: customer.phone,
        billingMonth: String(form.get('billingMonth')),
        amount: Number(form.get('amount')),
        dueDate: String(form.get('dueDate')),
        status: String(form.get('status')),
        updatedAt: serverTimestamp(),
      };
      if (modal.bill) await updateDoc(doc(db, 'bills', modal.bill.id), values);
      else {
        const billRef = doc(collection(db, 'bills'));
        await setDoc(billRef, { ...values, billNumber: `BILL-${billRef.id.toUpperCase()}`, issueDate: today(), createdAt: serverTimestamp() });
      }
      setModal(null); notify(modal.bill ? 'Bill updated successfully.' : 'Bill created successfully.');
    } catch (error) { notify(errorText(error), 'error'); }
    finally { setSaving(false); }
  };

  const removeRecord = async (kind, record) => {
    const label = kind === 'customer' ? record.name : record.billNumber;
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, kind === 'customer' ? 'customers' : 'bills', record.id));
      notify(`${kind === 'customer' ? 'Customer' : 'Bill'} deleted.`);
    } catch (error) { notify(errorText(error), 'error'); }
  };

  const setPaid = async (bill) => {
    try {
      await updateDoc(doc(db, 'bills', bill.id), { status: bill.status === 'Paid' ? 'Unpaid' : 'Paid', updatedAt: serverTimestamp() });
      notify(bill.status === 'Paid' ? 'Bill marked unpaid.' : 'Bill marked paid.');
    } catch (error) { notify(errorText(error), 'error'); }
  };

  const sendWhatsApp = (bill) => {
    const phone = String(bill.phone || '').replace(/\D/g, '');
    if (!phone) { notify('Add a phone number to this customer before sending a WhatsApp bill.', 'error'); return; }
    const text = [
      `Hello ${bill.customerName},`,
      '',
      `Your water bill is ready.`,
      `Bill number: ${bill.billNumber}`,
      `Billing month: ${bill.billingMonth}`,
      `Amount due: ${money(bill.amount)}`,
      `Due date: ${dateLabel(bill.dueDate)}`,
      '',
      'Please arrange payment by the due date. Thank you for choosing our service.',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const printBill = (bill) => {
    setModal({ type: 'print', bill });
    window.setTimeout(() => window.print(), 200);
  };

  if (!authReady) return <div className="loading-screen"><div className="spinner" />Loading BlueSpring…</div>;
  if (!authorized) {
    const authNotice = user && !user.emailVerified
      ? 'Please verify your admin email address before signing in.'
      : user && !adminEmails.includes(user.email?.toLowerCase())
        ? 'This account is not on the configured admin allowlist.'
        : authError;
    return <Login onLogin={login} busy={authBusy} error={authNotice} configured={firebaseConfigured} />;
  }

  const navItems = [
    { label: 'Dashboard', icon: 'dashboard' },
    { label: 'Customers', icon: 'users' },
    { label: 'Bills', icon: 'receipt' },
    { label: 'Settings', icon: 'settings' },
  ];
  const openCustomerHistory = (customer) => {
    setSearch(customer.customerCode);
    setPage('Bills');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setPage('Dashboard'); }}><span className="brand-mark"><Icon name="water" size={22} /></span><span>BlueSpring<small>WATER MANAGEMENT</small></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => <button className={`nav-link ${page === item.label ? 'active' : ''}`} key={item.label} aria-label={item.label} onClick={() => { setPage(item.label); setSearch(''); }}><Icon name={item.icon} />{item.label}{item.label === 'Bills' && bills.length > 0 && <span className="nav-count">{bills.length}</span>}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="water-note"><div className="water-drop"><Icon name="water" size={20} /></div><strong>Every drop counts.</strong><span>Keep your community flowing.</span></div><div className="profile"><div className="avatar">{user.email?.[0]?.toUpperCase()}</div><div className="profile-meta"><strong>{user.email?.split('@')[0]}</strong><span>Administrator</span></div><button className="signout-button" title="Sign out" onClick={() => signOut(auth)}><span aria-hidden="true">↪</span></button></div></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Icon name="water" size={20} /></span>BlueSpring</div><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="topbar-right"><span className="live-indicator"><i /> Live data</span><div className="avatar small">{user.email?.[0]?.toUpperCase()}</div><button className="header-signout" onClick={() => signOut(auth)}>Sign out</button></div></header>

        <div className="content">
          {page === 'Dashboard' && <Dashboard customers={customers} bills={bills} totals={totals} loading={loading} setPage={setPage} setModal={setModal} />}
          {page === 'Customers' && <section>
            <PageHeading eyebrow="CUSTOMER DIRECTORY" title="Customers" description="Manage your water service customers and their accounts." action={<button className="button primary" onClick={() => setModal({ type: 'customer' })}><Icon name="plus" /> Add customer</button>} />
            <div className="toolbar"><div className="search-box"><Icon name="search" /><input aria-label="Search customers" placeholder="Search name, phone or customer ID…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="result-count">{filteredCustomers.length} customer{filteredCustomers.length === 1 ? '' : 's'}</span></div>
            <CustomerTable customers={filteredCustomers} bills={bills} onEdit={(customer) => setModal({ type: 'customer', customer })} onDelete={(customer) => removeRecord('customer', customer)} onHistory={openCustomerHistory} loading={loading} />
          </section>}
          {page === 'Bills' && <section>
            <PageHeading eyebrow="BILLING & PAYMENTS" title="Bills" description="Create, track, and share monthly water bills." action={<button className="button primary" onClick={() => setModal({ type: 'bill' })} disabled={!customers.length}><Icon name="plus" /> Create bill</button>} />
            <div className="toolbar"><div className="search-box"><Icon name="search" /><input aria-label="Search bills" placeholder="Search customer, bill number, month…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="result-count">{filteredBills.length} bill{filteredBills.length === 1 ? '' : 's'}</span></div>
            <BillTable bills={filteredBills} loading={loading} onEdit={(bill) => setModal({ type: 'bill', bill })} onDelete={(bill) => removeRecord('bill', bill)} onPaid={setPaid} onWhatsApp={sendWhatsApp} onPrint={printBill} />
          </section>}
          {page === 'Settings' && <Settings user={user} />}
        </div>
        <footer className="footer"><span>BlueSpring Water Management</span><span>Made for better service <span className="footer-heart">♥</span></span></footer>
      </main>

      {modal?.type === 'customer' && <CustomerForm customer={modal.customer} onClose={() => setModal(null)} onSave={saveCustomer} saving={saving} />}
      {modal?.type === 'bill' && <BillForm bill={modal.bill} customers={customers} onClose={() => setModal(null)} onSave={saveBill} saving={saving} />}
      {modal?.type === 'print' && <PrintBill bill={modal.bill} onClose={() => setModal(null)} />}
      {toast && <div className={`toast ${toast.kind}`} role="status"><span>{toast.kind === 'success' ? '✓' : '!'}</span>{toast.message}<button onClick={() => setToast(null)} aria-label="Dismiss"><Icon name="close" size={16} /></button></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function Dashboard({ customers, bills, totals, loading, setPage, setModal }) {
  const cards = [
    { label: 'Total customers', value: customers.length, icon: 'users', tone: 'blue', note: 'Active accounts' },
    { label: 'Total bills', value: bills.length, icon: 'receipt', tone: 'violet', note: 'All billing periods' },
    { label: 'Paid bills', value: totals.paid, icon: 'receipt', tone: 'green', note: 'Successfully collected' },
    { label: 'Unpaid bills', value: totals.unpaid, icon: 'receipt', tone: 'amber', note: 'Awaiting payment' },
    { label: 'Amount received', value: money(totals.received), icon: 'water', tone: 'green', note: 'From paid bills' },
    { label: 'Outstanding', value: money(totals.outstanding), icon: 'water', tone: 'rose', note: 'From unpaid bills' },
  ];
  const recent = [...bills].slice(0, 5);
  return <section>
    <PageHeading eyebrow="YOUR BUSINESS AT A GLANCE" title="Dashboard" description="Here’s what’s happening with your water service today." action={<button className="button primary" onClick={() => setModal({ type: 'bill' })} disabled={!customers.length}><Icon name="plus" /> Create bill</button>} />
    <div className="stats-grid">{cards.map((card) => <article className="stat-card" key={card.label}><div className={`stat-icon ${card.tone}`}><Icon name={card.icon} /></div><div className="stat-label">{card.label}</div><strong className="stat-value">{loading ? '—' : card.value}</strong><span className="stat-note">{card.note}</span></article>)}</div>
    <div className="section-heading"><div><h2>Recent bills</h2><p>Your latest customer billing activity</p></div><button className="button quiet" onClick={() => setPage('Bills')}>View all bills <Icon name="arrow" size={16} /></button></div>
    {recent.length ? <BillTable bills={recent} compact onEdit={(bill) => setModal({ type: 'bill', bill })} onDelete={() => {}} onPaid={() => {}} onWhatsApp={() => {}} onPrint={() => {}} /> : <div className="empty-state"><div className="empty-icon"><Icon name="receipt" size={24} /></div><h3>No bills yet</h3><p>Create a bill to start tracking customer payments.</p><button className="button secondary" onClick={() => setModal({ type: 'bill' })} disabled={!customers.length}><Icon name="plus" size={17} /> Create your first bill</button>{!customers.length && <span className="field-hint">Add a customer before creating a bill.</span>}</div>}
  </section>;
}

function CustomerTable({ customers, bills, onEdit, onDelete, onHistory, loading }) {
  if (loading) return <div className="table-card loading-table"><div className="spinner" />Loading customers…</div>;
  if (!customers.length) return <div className="empty-state"><div className="empty-icon"><Icon name="users" size={24} /></div><h3>No customers found</h3><p>Add a customer or adjust your search to get started.</p></div>;
  return <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Customer</th><th>Phone number</th><th>Address</th><th>Monthly price</th><th>Billing</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {customers.map((customer) => <tr key={customer.id}><td><div className="customer-cell"><div className="customer-avatar">{customer.name?.[0]?.toUpperCase() || '?'}</div><div><strong>{customer.name}</strong><span>{customer.customerCode}</span></div></div></td><td>{customer.phone || '—'}</td><td className="address-cell">{customer.address || '—'}</td><td className="amount-cell">{money(customer.monthlyPrice)}</td><td><button className="history-link" onClick={() => onHistory(customer)}>{bills.filter((bill) => bill.customerId === customer.id).length} bills</button></td><td><div className="row-actions"><button className="action-button" onClick={() => onEdit(customer)} title="Edit customer">Edit</button><button className="action-button danger-text" onClick={() => onDelete(customer)} title="Delete customer">Delete</button></div></td></tr>)}
  </tbody></table></div></div>;
}

function BillTable({ bills, loading, compact = false, onEdit, onDelete, onPaid, onWhatsApp, onPrint }) {
  if (loading) return <div className="table-card loading-table"><div className="spinner" />Loading bills…</div>;
  if (!bills.length) return <div className="empty-state"><div className="empty-icon"><Icon name="receipt" size={24} /></div><h3>No bills found</h3><p>Your bills will appear here once you create them.</p></div>;
  return <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Bill / Customer</th><th>Billing month</th><th>Issue date</th><th>Due date</th><th>Amount</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {bills.map((bill) => <tr key={bill.id}><td><div className="bill-cell"><strong>{bill.billNumber}</strong><span>{bill.customerName}</span></div></td><td>{bill.billingMonth || '—'}</td><td>{dateLabel(bill.issueDate)}</td><td>{dateLabel(bill.dueDate)}</td><td className="amount-cell">{money(bill.amount)}</td><td><span className={`status-pill ${bill.status === 'Paid' ? 'paid' : 'unpaid'}`}><i />{bill.status || 'Unpaid'}</span></td><td><div className="row-actions bill-actions"><button className="action-button" onClick={() => onEdit(bill)} title="Edit bill">Edit</button>{!compact && <><button className="action-button" onClick={() => onPaid(bill)} title={bill.status === 'Paid' ? 'Mark unpaid' : 'Mark paid'}>{bill.status === 'Paid' ? 'Unpaid' : 'Mark paid'}</button><button className="action-button" onClick={() => onWhatsApp(bill)} title="Send via WhatsApp">WhatsApp</button><button className="action-button" onClick={() => onPrint(bill)} title="Print bill">Print</button><button className="action-button danger-text" onClick={() => onDelete(bill)} title="Delete bill">Delete</button></>}</div></td></tr>)}
  </tbody></table></div></div>;
}

function CustomerForm({ customer, onClose, onSave, saving }) {
  return <Modal title={customer ? 'Edit customer' : 'Add a customer'} onClose={onClose}><form className="form-stack modal-form" onSubmit={onSave}>
    <p className="modal-description">{customer ? `Update the account details for ${customer.name}.` : 'Add a new water service account to your directory.'}</p>
    {customer && <div className="readonly-id"><span>Customer ID</span><strong>{customer.customerCode}</strong></div>}
    <label>Customer name<input name="name" placeholder="e.g. Alex Morgan" defaultValue={customer?.name} required maxLength="100" /></label>
    <label>Phone number<input name="phone" type="tel" placeholder="+1 (555) 000-0000" defaultValue={customer?.phone} required maxLength="30" /></label>
    <label>Address<textarea name="address" placeholder="Street, city, postal code" defaultValue={customer?.address} rows="3" required maxLength="300" /></label>
    <label>Monthly water price<div className="input-with-prefix"><span>{currency}</span><input name="monthlyPrice" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={customer?.monthlyPrice} required /></div></label>
    <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}</button></div>
  </form></Modal>;
}

function BillForm({ bill, customers, onClose, onSave, saving }) {
  const initialCustomer = bill?.customerId || customers[0]?.id || '';
  const [customerId, setCustomerId] = useState(initialCustomer);
  const selected = customers.find((customer) => customer.id === customerId);
  return <Modal title={bill ? 'Edit bill' : 'Create a bill'} onClose={onClose}><form className="form-stack modal-form" onSubmit={onSave}>
    <p className="modal-description">{bill ? `Update ${bill.billNumber}.` : 'Create a monthly water bill for a customer.'}</p>
    {bill && <div className="readonly-id"><span>Bill number</span><strong>{bill.billNumber}</strong></div>}
    <label>Customer<select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required><option value="" disabled>Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.customerCode}</option>)}</select></label>
    {selected && <div className="suggested-amount">Monthly price <strong>{money(selected.monthlyPrice)}</strong><button type="button" onClick={(e) => { const input = e.currentTarget.closest('form').elements.amount; input.value = selected.monthlyPrice; }}>Use price</button></div>}
    <label>Billing month<input name="billingMonth" type="month" defaultValue={bill?.billingMonth || monthNow()} required /></label>
    <label>Amount<div className="input-with-prefix"><span>{currency}</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" defaultValue={bill?.amount ?? selected?.monthlyPrice ?? ''} required /></div></label>
    <label>Due date<input name="dueDate" type="date" defaultValue={bill?.dueDate || today()} required /></label>
    {bill && <label>Payment status<select name="status" defaultValue={bill.status || 'Unpaid'}><option>Unpaid</option><option>Paid</option></select></label>}
    {!bill && <input type="hidden" name="status" value="Unpaid" />}
    <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving || !customers.length}>{saving ? 'Saving…' : bill ? 'Save changes' : 'Create bill'}</button></div>
  </form></Modal>;
}

function PrintBill({ bill, onClose }) {
  return <Modal title="Bill preview" onClose={onClose} wide><div className="print-preview"><div className="print-brand"><span className="brand-mark"><Icon name="water" size={24} /></span><div><strong>BlueSpring</strong><span>WATER SERVICE</span></div></div><div className="invoice-title"><span>WATER BILL</span><strong>{bill.billNumber}</strong></div><div className="invoice-rule" /><div className="invoice-meta"><div><span>BILLED TO</span><strong>{bill.customerName}</strong><small>{bill.phone}</small></div><div><span>BILLING MONTH</span><strong>{bill.billingMonth}</strong></div></div><div className="invoice-dates"><div><span>Issue date</span><strong>{dateLabel(bill.issueDate)}</strong></div><div><span>Due date</span><strong>{dateLabel(bill.dueDate)}</strong></div><div><span>Payment status</span><strong className={bill.status === 'Paid' ? 'paid-ink' : 'unpaid-ink'}>{bill.status}</strong></div></div><div className="invoice-total"><span>Total amount due</span><strong>{money(bill.amount)}</strong></div><p className="invoice-thanks">Please arrange payment by the due date. Thank you for choosing our service.</p></div><div className="modal-actions print-actions"><button className="button secondary" onClick={onClose}>Close</button><button className="button primary" onClick={() => window.print()}>Print / Save as PDF</button></div></Modal>;
}

function Settings({ user }) {
  return <section><PageHeading eyebrow="PREFERENCES" title="Settings" description="Your administrator account and application configuration." /><div className="settings-grid"><article className="settings-card"><div className="settings-card-head"><div className="stat-icon blue"><Icon name="users" /></div><div><h2>Administrator account</h2><p>Signed-in account details</p></div></div><div className="settings-row"><span>Email address</span><strong>{user.email}</strong></div><div className="settings-row"><span>Email verification</span><strong className={user.emailVerified ? 'verified' : 'unverified'}>{user.emailVerified ? 'Verified' : 'Not verified'}</strong></div><div className="settings-row"><span>Access level</span><strong>Administrator</strong></div></article><article className="settings-card"><div className="settings-card-head"><div className="stat-icon violet"><Icon name="settings" /></div><div><h2>Application setup</h2><p>Connected services and data safety</p></div></div><div className="settings-row"><span>Database</span><strong>Firebase Firestore</strong></div><div className="settings-row"><span>Authentication</span><strong>Firebase Auth</strong></div><div className="settings-info">Admin access is restricted by your email allowlist and Firestore security rules. Update the allowlist in your environment and Firebase Rules together when administrator access changes.</div></article></div></section>;
}

export default App;
