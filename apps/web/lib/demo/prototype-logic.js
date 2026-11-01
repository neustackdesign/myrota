// @ts-nocheck
/* eslint-disable */
/**
 * DEMO-ONLY. Verbatim port of the Prototype v1.6 DCLogic class (Claude Design
 * source, "myrota Prototype (1).html"). It is the design-review scenario
 * navigator: hard-coded products, fixture friends (Ama, Tobi), editorial
 * placeholder safety flags and simulated timing. It is only reachable from
 * /dev/states in builds with NEXT_PUBLIC_MYROTA_DEMO=1 and must never be
 * imported by the production runtime.
 */
import { DCLogic } from "./dc-logic";

export class PrototypeLogic extends DCLogic {
  LIB = [
    { id: 'cleanser', name: 'Hydrating Cleanser', brand: 'CeraVe', type: 'Cleanser', icon: 'cleanser', role: 'cleanser' },
    { id: 'toner', name: 'Watermelon Glow Toner', brand: 'Glow Recipe', type: 'Toner', icon: 'water', role: 'toner' },
    { id: 'vitc', name: 'Vitamin C 20% Serum', brand: 'Timeless', type: 'Serum', icon: 'serum', role: 'vitc' },
    { id: 'niac', name: 'Niacinamide 10% + Zinc 1%', brand: 'The Ordinary', type: 'Serum', icon: 'serum', role: 'niac' },
    { id: 'ret', name: 'Crystal Retinal 3', brand: 'Medik8', type: 'Retinoid', icon: 'serum', role: 'ret' },
    { id: 'bha', name: '2% BHA Liquid Exfoliant', brand: "Paula's Choice", type: 'Exfoliant', icon: 'water', role: 'bha' },
    { id: 'moist', name: 'Moisturizing Cream', brand: 'Vanicream', type: 'Moisturiser', icon: 'jar', role: 'moist' },
    { id: 'spf', name: 'Anthelios UVMune 400 SPF 50+', brand: 'La Roche-Posay', type: 'Sunscreen', icon: 'spf', role: 'spf' },
  ];
  SHORT = { cleanser: 'Cleanser', toner: 'Toner', vitc: 'Vitamin C', niac: 'Niacinamide', ret: 'Retinal', bha: 'BHA', moist: 'Moisturiser', spf: 'SPF 50' };
  NOTE = { cleanser: 'Massage 30 seconds, rinse', toner: 'Pat in with hands', vitc: 'Before moisturiser', niac: 'Two drops', ret: 'Pea-sized, on dry skin', bha: 'Swipe on, wait a minute', moist: 'Seal it all in', spf: 'Two finger-lengths, last step', unknown: 'Your choice · not analysed' };
  ORDER = ['cleanser', 'toner', 'vitc', 'niac', 'ret', 'bha', 'unknown', 'moist', 'spf'];
  TONES = ['#845535', '#2A1911', '#A8764F', '#5A3824', '#845535', '#2A1911', '#A8764F'];
  PROV = { corrected: ['You corrected ingredients · awaiting confirmation', '#2A1911'], verified: ['Verified · matched to library', '#17605F'], 'user-confirmed': ['You confirmed this', '#2A1911'], partial: ['Partly read · left out of checks', '#5A3824'], unknown: ['Unknown · not analysed', '#5A3824'] };
  FLAGS = {
    label: { tag: 'Label declares', tagBg: '#2A1911', title: 'Hydroquinone is on this label.', body: "Hydroquinone is a prescription medicine in many countries. We've kept this product out of your rota. A pharmacist can tell you whether it's right for you.", src: 'Rule HQ-01 · reviewed by [pharmacist], [date] · draft copy pending review' },
    alert: { tag: 'Independent alert', tagBg: '#845535', title: 'This product appears in a regulator alert', body: "An official notice reported this product. It describes tested samples, not your bottle, and we can't confirm what's inside it. We've kept it out of your rota.", src: 'Source · [regulator], notice [ref], [date] · alerts feed' },
  };
  REVIEW = {
    verified: { id: 'verified', inci: 'verified', icon: 'serum', name: 'Crystal Retinal 3', brand: 'Medik8 · matched to library', prov: 'verified', chips: [['Aqua'], ['Squalane'], ['Retinal', 'act'], ['Glycerin'], ['Tocopherol']], flags: [], foot: 'Every ingredient matched the library entry.' },
    flag: { id: 'read', inci: 'partial', icon: 'jar', name: 'Clear Tone Cream', brand: 'Brand as printed on the label', prov: 'partial', chips: [['Aqua'], ['Hydroquinone 2%', 'flag'], ['Glycerin'], ['Cetearyl alcohol'], ['unreadable', 'x']], flags: ['label'], foot: 'One line was too blurred to read.' },
    alert: { id: 'read', inci: 'partial', icon: 'jar', name: 'Bright Glow Lotion', brand: 'Brand as printed on the label', prov: 'partial', chips: [['Aqua'], ['Glycerin'], ['Parfum'], ['unreadable', 'x'], ['unreadable', 'x']], flags: ['alert'], foot: 'Two lines were too blurred to read.' },
    partial: { id: 'none', inci: 'partial', icon: 'serum', name: '', brand: 'Name not read yet', prov: 'partial', chips: [['Aqua'], ['Niacinamide', 'act'], ['Glycerin'], ['unreadable', 'x'], ['unreadable', 'x']], flags: [], foot: "Some text was unreadable. Until it's confirmed, this product stays out of pairing checks.", askFront: true },
  };
  GENTLE = ['cleanser', 'toner', 'moist', 'spf'];
  // Illustrative fixture: only explicitly listed pairs are "reviewed". Production reads the reviewed pair-rule table.
  FINE_FIXTURES = ['cleanser+ret', 'moist+ret', 'bha+moist', 'moist+vitc', 'ret+spf', 'spf+vitc', 'moist+niac', 'cleanser+moist', 'moist+spf'];
  calc(s, o = {}) {
    const days = this.days(s), done = o.done || s.done, list = [];
    (s.history || []).forEach(h => { for (let d = 0; d < 7; d++) list.push({ id: `w${h.week}-d${d}`, ok: !!(h.comp[d] || h.rescued[d]) }); });
    let open = false;
    for (let d = 0; d <= s.day; d++) { const ok = this.complete(done, d, days) || !!s.rescued[d]; if (d === s.day && !ok) { open = true; break; } list.push({ id: `w${s.week}-d${d}`, ok }); }
    const ref = s.missedRef ? `w${s.missedRef.week}-d${s.missedRef.d}` : null, mi = ref ? list.findIndex(x => x.id === ref) : -1;
    if (o.okId && mi >= 0) list[mi] = { ...list[mi], ok: true };
    let end = list.length - 1;
    if (s.missedPending && mi >= 0 && !o.okId) end = mi - 1;
    let v = 0, i = end;
    for (; i >= 0 && list[i].ok; i--) v++;
    const reached = i < 0;
    return { v: v + (reached ? (s.streakBase || 0) : 0), reached, raw: v, list };
  }
  syncStreak() { const v = this.calc(this.state).v; if (v !== this.state.streak) this.setState({ streak: v }); }
  componentDidMount() { this.syncStreak(); }
  componentDidUpdate() { this.syncStreak(); }
  hq() { return { id: 'hq', name: 'Clear Tone Cream', brand: 'As printed on label', type: 'Cream', icon: 'jar', role: 'flag', flag: 'label', prov: 'user-confirmed' }; }
  held(s, p) { return (s.ctxCare === 'preg' && p.role === 'ret') || (s.ctxCare === 'rx' && (p.role === 'ret' || p.role === 'bha')); }
  rp(s) { return s.products.filter(p => !(s.finished || {})[p.id] && !this.held(s, p)); }
  days(s) { return this.rota(this.rp(s), { retNew: s.ctxRet === 'new' }).map((x, d) => (s.swapped || [])[d] && (x.t === 'r' || x.t === 'b') ? { t: 'rec', am: x.am, pm: x.pm.filter(p => p.role !== 'ret' && p.role !== 'bha') } : x); }
  mixVerdict(a, b) {
    if (!a || !b) return { v: '', line: '', bg: '#3E63D8' };
    const S = '#845535', L = '#3E63D8';
    if (a.id === b.id) return { v: 'Same product', line: 'Pick two different products to compare.', bg: L };
    if ([a, b].some(p => p.role === 'flag')) return { v: 'Check with a professional', line: 'One of these needs a pharmacist’s view before it goes in a routine.', bg: S };
    const u = [a, b].find(p => p.role === 'unknown');
    if (u) return { v: 'Not enough evidence', line: `We can't confirm what's in ${u.name}, so we won't call this pair compatible.`, bg: S };
    const key = [a.role, b.role].sort().join('+');
    const M = { 'bha+ret': ['Alternate days', 'Use them on different nights, never together.'], 'ret+vitc': ['Better separated', 'Vitamin C in the morning, retinal at night.'], 'bha+vitc': ['Better separated', 'Vitamin C in the morning, BHA in the evening.'], 'niac+vitc': ['Fine together', 'They can share a morning.'] };
    if (M[key]) return { v: M[key][0], line: M[key][1], bg: L };
    if (this.FINE_FIXTURES.includes(key)) return { v: 'Fine together', line: 'Nothing here needs keeping apart.', bg: L };
    
    return { v: 'Not enough evidence', line: "We haven't reviewed this pair yet, so we won't call it compatible.", bg: S };
  }
  runProc(next) {
    clearInterval(this.pi); this.setState({ scanStage: 'proc', procN: 0 }); let k = 0;
    this.pi = setInterval(() => { k++; this.setState({ procN: Math.min(7, k) }); if (k >= 8) { clearInterval(this.pi); next(); } }, 170);
  }
  toReview(c) { this.go('review', 1, { revStep: 1, reviewCase: c, revName: this.REVIEW[c].name, revCat: c === 'verified' ? 'Treatment' : c === 'partial' ? 'Serum' : 'Moisturiser', revUse: 'Leave-on', frontDone: false, scanStage: 'view', revChips: this.REVIEW[c].chips.map(x => [...x]) }); }
  openShare(t) { this.openSheet('share', { shareType: t, shareNames: false, shareFmt: 'story' }); }
  DOW = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
  DOWL = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday'];
  TRACK = '#EADCCF'; SG = '#9ED8CF';
  timers = [];
  state = this.makeState(0, 0);

  componentWillUnmount() { this.timers.forEach(clearTimeout); clearInterval(this.bi); }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  P(ids) { return ids.map(id => ({ ...this.LIB.find(p => p.id === id) })); }
  shea(place) { return { id: 'u1', name: 'Shea butter from Makola', brand: 'Not in library', type: 'Unknown', icon: 'jar', role: 'unknown', place }; }
  blank() { return Array.from({ length: 7 }, () => ({ am: false, pm: false })); }
  short(p) { return p.role === 'unknown' ? p.name : (this.SHORT[p.role] || p.name); }
  base() {
    return { history: [], missedRef: null, streakBase: 0, revChips: [], chipIdx: 0, chipDraft: '', scanStage: 'perm', camOk: false, glareSeen: false, procN: 0, reviewCase: 'verified', revName: '', revCat: 'Serum', revUse: 'Leave-on', frontDone: false, scanFor: 'shelf', ctxRet: null, ctxCare: null, ctxDone: false, swapped: Array(7).fill(false), late: false, platform: 'ios', displayName: null, nameDraft: '', afterName: null, existingUser: false, paired: false, pairStreak: 0, shareType: 'rota', shareFmt: 'story', shareNames: false, sheetDay: 0, reflect: null, week: 1, finished: {}, prodId: null, missedPrev: false, pasteText: 'Aqua, Niacinamide, Glycerin, Pentylene Glycol, Zinc PCA, ...', screen: 'welcome', hist: [], phase: 'idle', dir: 1, sheet: null, sheetIn: false, perm: false, toast: null, products: [], query: '', unkName: '', unkPlace: 'pm', source: 'organic', day: 0, tod: 'am', done: this.blank(), rescued: Array(7).fill(false), missedPending: false, missedInfo: null, rescueUsed: false, streak: 0, installed: false, account: null, claimStage: 'choose', email: 'kemi@example.com', otpFilled: false, rem: { am: '07:30', pm: '21:00', on: false }, friends: [], openDay: 0, amOpen: null, pmOpen: null, buildN: 0, mixA: null, mixB: null, mixSlot: 'a', pop: false, doneAt: {}, invited: false };
  }
  ama() { return { look: { skin: 7, hair: 'afro', face: 'smile', extra: 'hoops', bg: 'seaglass' }, name: 'Ama', initial: 'A', bg: '#A8764F', streak: 12, status: 'Morning done · evening left', statusInk: '#845535', tones: '#A8764F,#9ED8CF,#845535,#EADCCF,#EADCCF,#EADCCF,#EADCCF', lit: 3 }; }
  tobi() { return { name: 'Tobi', initial: 'T', bg: '#5A3824', streak: 0, status: 'Built a rota from your invite · Day 1', statusInk: '#1F7F7E', tones: '#EADCCF,#EADCCF,#EADCCF,#EADCCF,#EADCCF,#EADCCF,#EADCCF', lit: 0 }; }
  J() {
    const P = ids => this.P(ids);
    const D = arr => { const d = this.blank(); arr.forEach(([i, a, p]) => { d[i] = { am: !!a, pm: !!p }; }); return d; };
    const R = arr => { const r = Array(7).fill(false); arr.forEach(i => { r[i] = true; }); return r; };
    const full1 = () => [...P(['cleanser', 'vitc', 'ret', 'bha', 'moist', 'spf']), this.shea('pm')];
    const set6 = () => P(['cleanser', 'vitc', 'ret', 'bha', 'moist', 'spf']);
    const set5 = () => P(['cleanser', 'toner', 'niac', 'moist', 'spf']);
    const rem = { am: '07:30', pm: '21:00', on: true };
    const j4 = () => ({ missedRef: { week: 1, d: 2 }, products: set6(), installed: true, account: 'google', day: 3, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 0]]), streak: 13, missedPending: true, screen: 'today', friends: [this.ama()], rem });
    const j5 = () => ({ products: set5(), done: D([[0, 1, 1]]), streak: 1, tod: 'pm' });
    const j5b = () => ({ ...j5(), installed: true, rem, day: 1, done: D([[0, 1, 1], [1, 1, 1]]), streak: 2, screen: 'today' });
    const ret = () => P(['ret'])[0], bha = () => P(['bha'])[0];
    const full = () => [...set6(), this.shea('pm')];
    const pairT = (x = {}) => ({ screen: 'today', products: set6(), friends: [this.ama()], paired: true, pairStreak: 4, displayName: 'Kemi', streak: 6, day: 2, done: D([[0, 1, 1], [1, 1, 1]]), ...x });
    return [
      { title: 'Understand · add any product', steps: [
        ['Landing', () => ({ screen: 'welcome' })],
        ['Add: four ways in', () => ({ screen: 'add' })],
        ['Camera permission', () => ({ screen: 'scan', scanStage: 'perm' })],
        ['Glare, retake', () => ({ screen: 'scan', scanStage: 'glare', camOk: true, glareSeen: true })],
        ['Review · verified', () => ({ screen: 'review', reviewCase: 'verified', revName: 'Crystal Retinal 3', revCat: 'Treatment' })],
        ['Review · label flag', () => ({ screen: 'review', reviewCase: 'flag', revName: 'Clear Tone Cream', revCat: 'Moisturiser' })],
        ['Review · regulator alert', () => ({ screen: 'review', reviewCase: 'alert', revName: 'Bright Glow Lotion', revCat: 'Moisturiser' })],
        ['Review · partly read', () => ({ screen: 'review', reviewCase: 'partial', revName: '', revChips: this.REVIEW.partial.chips.map(x => [...x]) })],
        ['Correct an ingredient', () => ({ screen: 'review', reviewCase: 'partial', revStep: 2, revName: 'Daily Glow Serum', frontDone: true, revChips: this.REVIEW.partial.chips.map(x => [...x]), sheet: 'chip', chipIdx: 3, chipDraft: '' })],
        ['Paste ingredients', () => ({ screen: 'add', products: P(['cleanser']), sheet: 'paste' })],
        ['Duplicate', () => ({ screen: 'add', products: P(['cleanser', 'ret']), query: 'Retinal' })],
        ['Unknown product', () => ({ screen: 'add', products: P(['cleanser', 'vitc', 'ret']), query: 'Shea butter from Makola', unkName: 'Shea butter from Makola', sheet: 'unknown' })],
      ] },
      { title: 'Plan · week and Shelf Check', steps: [
        ['Context questions', () => ({ screen: 'context', products: full() })],
        ['New to retinoids', () => ({ screen: 'reveal', products: full(), ctxDone: true, ctxRet: 'new', ctxCare: 'none' })],
        ['Prescription treatment', () => ({ screen: 'reveal', products: full(), ctxDone: true, ctxRet: 'some', ctxCare: 'rx' })],
        ['Building', () => ({ screen: 'building', products: full(), ctxDone: true })],
        ['Rota reveal', () => ({ screen: 'reveal', products: full(), ctxDone: true })],
        ['Share my rota', () => ({ screen: 'reveal', products: full(), sheet: 'share', shareType: 'rota' })],
        ['Shelf with safety flag', () => ({ screen: 'shelf', products: [...full(), this.hq()], day: 1 })],
        ['Product detail', () => ({ screen: 'shelf', products: full(), sheet: 'product', prodId: 'u1' })],
      ] },
      { title: 'Do · today, rest, Rescue', steps: [
        ['Morning, paired', () => pairT()],
        ['Evening atmosphere', () => pairT({ tod: 'pm', done: D([[0, 1, 1], [1, 1, 1], [2, 1, 0]]), pmOpen: true })],
        ['Swap to recovery', () => pairT({ day: 0, streak: 4, done: D([[0, 1, 0]]), tod: 'pm', sheet: 'swap' })],
        ['Day sheet', () => pairT({ sheet: 'day', sheetDay: 4 })],
        ['Rest day check-in', () => ({ screen: 'today', source: 'invite', products: P(['ret']), friends: [this.ama()], paired: true, day: 1, done: D([[0, 0, 1]]), streak: 1 })],
        ['Late night boundary', () => pairT({ tod: 'pm', late: true, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 0]]) })],
        ['Yesterday missed', () => j4()],
        ['Rescue offer', () => ({ ...j4(), sheet: 'rescue' })],
        ['Rescued', () => ({ ...j4(), missedPending: false, rescued: R([2]), rescueUsed: true, streak: 14 })],
        ['Day 7 missed, still rescuable', () => ({ ...j4(), day: 0, week: 2, done: this.blank(), rescued: Array(7).fill(false), rescueUsed: false, missedPending: true, missedRef: { week: 1, d: 6 }, history: [{ week: 1, comp: [true, true, true, true, true, true, false], rescued: Array(7).fill(false), rescueUsed: false }], streak: 13 })],
        ['Miss pending: today done, streak held', () => ({ ...j4(), done: D([[0, 1, 1], [1, 1, 1], [2, 1, 0], [3, 1, 1]]), tod: 'pm' })],
        ['Second miss, no Rescue', () => ({ ...j4(), missedPending: false, rescued: R([2]), rescueUsed: true, day: 5, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 0], [3, 1, 1]]), streak: 0, missedInfo: "You missed Sunday and this rota's Rescue is used. Today's plan hasn't changed." })],
      ] },
      { title: 'Continue · day 7 and week 2', steps: [
        ['First day celebration', () => ({ screen: 'dayDone', products: full(), done: D([[0, 1, 1]]), tod: 'pm', streak: 1 })],
        ['Day 3 celebration', () => ({ screen: 'dayDone', products: full(), day: 2, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 1]]), tod: 'pm', streak: 3, invited: true })],
        ['Rota complete', () => ({ screen: 'rotaComplete', products: full(), day: 6, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 1], [6, 1, 1]]), streak: 7, tod: 'pm' })],
        ['Week ended · 5 of 7', () => ({ screen: 'rotaComplete', products: full(), day: 6, done: D([[0, 1, 1], [1, 1, 1], [3, 1, 1], [5, 1, 1], [6, 1, 1]]), streak: 2, tod: 'pm' })],
        ['Weekly reflection', () => ({ screen: 'rotaComplete', products: full(), day: 6, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 1], [6, 1, 1]]), streak: 7, tod: 'pm', reflect: 'bit' })],
        ['Share my week', () => ({ screen: 'rotaComplete', products: full(), day: 6, done: D([[0, 1, 1], [1, 1, 1], [2, 1, 1], [3, 1, 1], [4, 1, 1], [5, 1, 1], [6, 1, 1]]), streak: 7, sheet: 'share', shareType: 'day7' })],
        ['Next week from the same shelf', () => ({ screen: 'nextWeek', products: full(), streak: 7, finished: { vitc: true } })],
      ] },
      { title: 'Spread · friends', steps: [
        ['Name before inviting', () => ({ screen: 'friends', products: full(), streak: 1, done: D([[0, 1, 1]]), sheet: 'name', afterName: 'invite' })],
        ['Reusable invite', () => ({ screen: 'friends', products: full(), streak: 1, done: D([[0, 1, 1]]), displayName: 'Kemi', sheet: 'invite' })],
        ['WhatsApp message', () => ({ screen: 'whatsapp', source: 'invite' })],
        ['Invite landing · new', () => ({ screen: 'inviteLanding', source: 'invite' })],
        ['Invite landing · existing user', () => ({ screen: 'inviteLanding', source: 'invite', existingUser: true, products: set5() })],
        ['Rota from one product', () => ({ screen: 'reveal', source: 'invite', products: P(['moist']) })],
        ['Inviter: Tobi joined', () => ({ screen: 'friendJoined', products: set6(), displayName: 'Kemi', friends: [this.tobi()], streak: 12 })],
        ['Paired on Today', () => pairT()],
        ['WhatsApp nudge', () => pairT({ sheet: 'nudge' })],
        ['Share Friend Streak', () => pairT({ screen: 'friends', sheet: 'share', shareType: 'friend' })],
      ] },
      { title: 'Spread · Mix Check', steps: [
        ['Mix Check', () => ({ screen: 'mix', source: 'mix' })],
        ['Pick or scan', () => ({ screen: 'mix', source: 'mix', mixA: ret(), mixSlot: 'b', sheet: 'mixPick' })],
        ['Verdict · alternate days', () => ({ screen: 'mixResult', source: 'mix', mixA: ret(), mixB: bha() })],
        ['Verdict · not enough evidence', () => ({ screen: 'mixResult', source: 'mix', mixA: ret(), mixB: this.shea('none') })],
        ['Verdict · check with a professional', () => ({ screen: 'mixResult', source: 'mix', mixA: ret(), mixB: this.hq() })],
        ['Share the answer', () => ({ screen: 'mixResult', source: 'mix', mixA: ret(), mixB: bha(), sheet: 'share', shareType: 'mix' })],
        ['Builder with context', () => ({ screen: 'add', source: 'mix', mixA: ret(), mixB: bha(), products: P(['ret', 'bha']) })],
      ] },
      { title: 'Install, reminders, account', steps: [
        ['Install · iPhone', () => ({ ...j5(), screen: 'today', sheet: 'install', platform: 'ios' })],
        ['Install · Android', () => ({ ...j5(), screen: 'today', sheet: 'install', platform: 'android' })],
        ['Reminder times', () => ({ ...j5(), installed: true, screen: 'reminders' })],
        ['Permission', () => ({ ...j5(), installed: true, screen: 'reminders', perm: true })],
        ['Lock screen', () => ({ ...j5(), installed: true, rem, day: 1, done: D([[0, 1, 1], [1, 1, 0]]), screen: 'lock' })],
        ['Save your streak', () => ({ ...j5b(), sheet: 'claim', claimStage: 'choose' })],
        ['Email + display name', () => ({ ...j5b(), sheet: 'claim', claimStage: 'email' })],
        ['Verify code', () => ({ ...j5b(), sheet: 'claim', claimStage: 'otp' })],
        ['Saved · Profile', () => ({ ...j5b(), account: 'email', displayName: 'Kemi', sheet: 'profile' })],
      ] },
    ];
  }
  makeState(j, i) {
    const st = { ...this.base(), ...this.J()[j].steps[i][1](), journey: j, stepIdx: i };
    st.week = st.week || 1;
    const c0 = this.calc({ ...st, streakBase: 0 });
    st.streakBase = c0.reached ? Math.max(0, (st.streak || 0) - c0.raw) : 0;
    st.streak = this.calc(st).v;
    if (st.sheet) st.sheetIn = true;
    return st;
  }
  apply(j, i) {
    clearInterval(this.bi); this.timers.forEach(clearTimeout); this.timers = [];
    const st = this.makeState(j, i);
    this.setState(st);
    if (st.screen === 'building') this.runBuild();
    if (st.toast) this.later(() => this.setState({ toast: null }), 2600);
  }

  rota(ps, o = {}) {
    const has = r => ps.some(p => p.role === r);
    const Rt = has('ret'), B = has('bha');
    // Illustrative only. Production: reviewed scheduler rule RET-START bounds retinoid nights for new users.
    const pat = o.retNew && Rt ? (B ? ['r', 'rec', 'b', 'rec', 'r', 'rec', 'rec'] : ['r', 'rec', 'rec', 'r', 'rec', 'rec', 'rec']) : Rt && B ? ['r', 'rec', 'b', 'rec', 'r', 'rec', 'rec'] : Rt ? ['r', 'rec', 'r', 'rec', 'r', 'rec', 'rec'] : B ? ['b', 'rec', 'b', 'rec', 'rec', 'b', 'rec'] : Array(7).fill('base');
    const ord = p => this.ORDER.indexOf(p.role);
    return pat.map(t => {
      const am = [], pm = [];
      ps.forEach(p => {
        const r = p.role;
        if (r === 'cleanser' || r === 'toner' || r === 'moist') { am.push(p); pm.push(p); }
        else if (r === 'vitc' || r === 'spf') am.push(p);
        else if (r === 'niac') { if (has('vitc')) { if (t !== 'r' && t !== 'b') pm.push(p); } else am.push(p); }
        else if (r === 'ret') { if (t === 'r') pm.push(p); }
        else if (r === 'bha') { if (t === 'b') pm.push(p); }
        else if (r === 'unknown') { if (p.place === 'am') am.push(p); if (p.place === 'pm') pm.push(p); }
      });
      am.sort((a, b) => ord(a) - ord(b)); pm.sort((a, b) => ord(a) - ord(b));
      return { t, am, pm };
    });
  }
  complete(done, d, days) {
    const x = days[d], na = x.am.length > 0, np = x.pm.length > 0;
    if (!na && !np) return !!done[d].rest;
    return (!na || done[d].am) && (!np || done[d].pm);
  }

  go(to, dir = 1, extra = {}) {
    this.setState({ phase: 'out', dir });
    this.later(() => {
      this.setState(s => ({ screen: to, hist: [...s.hist, s.screen], phase: 'in0', ...extra }));
      this.later(() => this.setState({ phase: 'idle' }), 30);
      if (to === 'building') this.runBuild();
      if (to === 'dayDone') { this.setState({ pop: true }); this.later(() => this.setState({ pop: false }), 450); }
    }, 150);
  }
  back() {
    const h = [...this.state.hist]; const prev = h.pop();
    if (!prev) return;
    this.setState({ phase: 'out', dir: -1 });
    this.later(() => { this.setState({ screen: prev, hist: h, phase: 'in0' }); this.later(() => this.setState({ phase: 'idle' }), 30); }, 150);
  }
  openSheet(name, extra = {}) { this.setState({ sheet: name, sheetIn: false, ...extra }); this.later(() => this.setState({ sheetIn: true }), 20); }
  closeSheet(then) { this.setState({ sheetIn: false }); this.later(() => { this.setState({ sheet: null }); then && then(); }, 300); }
  toast(t) { this.setState({ toast: t }); clearTimeout(this.tt); this.tt = setTimeout(() => this.setState({ toast: null }), 2400); }
  runBuild() {
    clearInterval(this.bi); this.setState({ buildN: 0 });
    let k = 0;
    this.bi = setInterval(() => {
      k++;
      this.setState({ buildN: Math.min(7, k) });
      if (k >= 9) { clearInterval(this.bi); this.go('reveal'); }
    }, 260);
  }
  markDone(k) {
    const s = this.state, days = this.days(s);
    const done = s.done.map(x => ({ ...x }));
    const was = this.complete(s.done, s.day, days);
    done[s.day][k] = true;
    const now = this.complete(done, s.day, days);
    const patch = { done, doneAt: { ...s.doneAt, [s.day + k]: k === 'am' ? '7:42' : k === 'pm' ? '21:14' : '9:05' }, amOpen: null, pmOpen: null };
    if (now && !was) patch.pop = true;
    this.setState(patch);
    this.toast(k === 'am' ? 'Morning done' : k === 'pm' ? 'Evening done' : 'Rest day done');
    if (now && !was) {
      const ns = this.calc({ ...s, done }).v;
      this.later(() => this.setState({ pop: false }), 400);
      if (s.day === 6) this.later(() => this.go('rotaComplete'), 900);
      else if (ns === 1 || ns === 3) this.later(() => this.go('dayDone'), 900);
      else this.later(() => this.toast(`Today's done · ${ns}-day streak`), 700);
    }
  }
  nextDay() {
    const s = this.state, days = this.days(s);
    if (!s.products.length) return;
    const comp = this.complete(s.done, s.day, days);
    const patch = { tod: 'am', amOpen: null, pmOpen: null, missedInfo: null, missedPending: false };
    patch.missedRef = null;
    if (!comp) {
      if (!s.rescueUsed) { patch.missedPending = true; patch.missedRef = { week: s.week, d: s.day }; }
      else { patch.missedInfo = `You missed ${this.DOWL[s.day]}${s.rescueUsed ? " and this rota's Rescue is used" : ''}. Today's plan hasn't changed.`; }
    }
    if (s.day >= 6) { Object.assign(patch, { history: [...(s.history || []), { week: s.week, comp: days.map((x, d) => this.complete(s.done, d, days)), rescued: [...s.rescued], rescueUsed: s.rescueUsed }], day: 0, done: this.blank(), rescued: Array(7).fill(false), rescueUsed: false, swapped: Array(7).fill(false), week: (s.week || 1) + 1 }); this.toast('A new rota starts today'); }
    else patch.day = s.day + 1;
    if (!['today', 'shelf', 'friends'].includes(s.screen)) patch.screen = 'today';
    this.setState(patch);
  }

  mixObs(a, b) {
    if (!a || !b) return [];
    if ([a, b].some(p => p.role === 'flag')) return [{ h: 'A flagged ingredient on the label', t: 'See the note on that product before pairing it with anything.' }, { h: "We won't schedule it", t: 'It stays on your shelf, out of your rota.' }];
    const unk = [a, b].find(p => p.role === 'unknown');
    if (unk) {
      const k = [a, b].find(p => p !== unk);
      if (k.role === 'unknown') return [{ h: "We don't know either product", t: "Neither is in our library, so we won't guess how they mix." }];
      return [
        { h: `We don't know ${unk.name}`, t: "It isn't in our library, so we won't guess how it mixes with anything." },
        { h: `${this.short(k)} on its own`, t: { ret: 'Evenings only. Start every other night.', bha: 'Evenings, two or three nights a week to begin.', vitc: 'Mornings, before moisturiser and SPF.' }[k.role] || 'Fine morning and evening.' },
        { h: 'Scan its label to know more', t: 'If we can read the ingredients, we can give a real answer.' },
      ];
    }
    const key = [a.role, b.role].sort().join('+');
    const M = {
      'bha+ret': [{ h: 'Give them separate nights', t: 'Both are strong actives. Layered together they tend to irritate.' }, { h: 'Leave a recovery night between', t: 'A gentle night after each one gives skin time to settle.' }, { h: 'SPF the morning after', t: 'Both make skin more sensitive to sun.' }],
      'ret+vitc': [{ h: 'Morning and evening', t: 'Vitamin C in the morning, retinal at night.' }, { h: 'No need for separate days', t: 'Different times of day is enough.' }, { h: 'SPF every morning', t: 'Retinal makes skin more sensitive to sun.' }],
      'bha+vitc': [{ h: 'Split by time of day', t: 'Vitamin C in the morning, BHA in the evening.' }, { h: 'Go easy at first', t: 'Start BHA two or three nights a week.' }],
      'niac+vitc': [{ h: 'They can share a morning', t: 'Vitamin C first, niacinamide after it.' }],
    };
    if (a.id === b.id) return [{ h: 'Same product twice', t: 'Pick two different products to compare.' }];
    if (M[key]) return M[key];
    if (this.FINE_FIXTURES.includes(key)) return [{ h: 'Nothing to keep apart', t: 'This pair is in the reviewed fixtures as fine together.' }, { h: 'Order matters', t: 'Thinnest to thickest, SPF last in the morning.' }];
    return [{ h: "We haven't reviewed this pair", t: "Until a reviewer has, we won't call it compatible." }];
  }
  shelfObs(ps) {
    const has = r => ps.some(p => p.role === r), o = [];
    if (has('ret') && has('bha')) o.push('Retinal and BHA get separate nights, with recovery nights in between.');
    else if (has('ret') || has('bha')) o.push('Your active gets its own nights, with recovery nights between.');
    else o.push('No strong actives, so every day follows the same plan.');
    if (has('vitc') && has('ret')) o.push('Vitamin C stays in the morning, retinal at night.');
    o.push(has('spf') ? 'SPF closes every morning.' : 'No SPF on your shelf yet. Mornings end with your last step.');
    const u = ps.filter(p => p.role === 'unknown');
    if (u.length) o.push(`${u[0].name} is unknown, so it's left out of these checks.`);
    return o.slice(0, 3).map((t, i) => ({ n: '0' + (i + 1), t }));
  }

  LOGIC = {
    scan: { title: 'Scan · LAUNCH', purpose: 'Read the back label first; front only if identity is missing.', rules: ['Permission asked on our screen first, with Gallery as the alternative.', 'Glare and blur get a retake prompt, never a guess.', 'Photos are processed, not kept.', 'Scan is available in the builder, Shelf and each Mix Check picker.'] },
    review: { title: 'Product review · LAUNCH', purpose: 'Show what was read, how sure we are, and let the user correct it.', rules: ['Provenance: verified · user-confirmed · partial · unknown.', 'Identity confidence and ingredient confidence are tracked separately. Confirming the name never upgrades ingredients.', 'Tap any ingredient to correct it; corrections are marked edited and stay out of checks until corroborated.', 'Partial and unknown products stay out of pairing and scheduling conclusions.', 'SafetyFlag renders only from reviewed rules or sourced alerts. Label-declared and independent alerts look different.', 'No flag is never presented as a safety certificate. OCR never claims to detect undeclared ingredients.', 'User corrections are local until corroborated.'] },
    context: { title: 'Context questions · LAUNCH', purpose: 'Ask only when the answer changes the plan.', rules: ['Shown only when a retinoid or exfoliant is on the shelf.', 'New to retinoids: fewer retinoid nights (reviewed rule RET-START; illustrative pattern here).', 'Prescription treatment: retinoid and exfoliant are held with a professional-check note. Pregnancy/breastfeeding: retinoid held.', 'Pregnancy, breastfeeding and prescription answers are private: never in friend views or share payloads.', '"Prefer not to say" is always available.'] },
    rotaComplete: { title: 'Rota complete · LAUNCH', purpose: 'A real Day 7 moment, a gentle check-in, and the way into week 2.', rules: ['Shown when day 7 closes. 7 of 7 (done or rescued) = Rota complete with share; fewer = Week ended, no celebration.', 'Reflection: Calm / A bit irritated / Very irritated.', 'Self-report never raises frequency on its own; changes stay inside reviewed bounds and need user choice.', 'Share is optional and previewed.'] },
    nextWeek: { title: 'Next week · LAUNCH', purpose: 'Continue from the same shelf.', rules: ['Mark products finished or add new ones before week 2 starts.', 'A new rota gets a new Rescue.'] },
    friendJoined: { title: 'Friend joined · LAUNCH', purpose: 'A meaningful moment for the inviter, not just a toast.', rules: ['Friend Streak starts on the first day both people complete, using each person’s own day boundary.', 'Push notification for this moment is FAST FOLLOW.'] },
    welcome: { title: 'Welcome', purpose: 'Organic entry on mobile web. One job: get products in.', rules: ['No account or install before the rota is visible.', 'One primary action. The reassurance line answers cost and effort up front.'], ix: ['Add my products → product builder (push, 220ms).'] },
    add: { title: 'Product builder', purpose: 'Collect the shelf with as little typing as possible.', rules: ['Organic: 3+ encouraged, 1 allowed. The bar shows 3 as a target and never blocks.', 'Invite: one product is enough, and the copy says so.', 'Mix: both checked products arrive pre-added, with the Mix Check note carried forward.', 'No library match → "Add as unknown". Unknown products are never analysed.'], ix: ['Type to filter. Tap + to add, tap a chip to remove.', 'Build is enabled from one product; below three the label explains the trade-off.'] },
    building: { title: 'Building', purpose: 'A short pause that shows the plan being made.', rules: ['About two seconds, then auto-advance.', 'Lines describe what the planner does with this shelf.'], ix: ['Segments fill 0→7 at 260ms each.'] },
    reveal: { title: 'Rota reveal', purpose: 'Show the whole week before asking for commitment.', rules: ['Seven rows. Active nights alternate; recovery nights follow actives.', 'Mornings repeat; evenings change.', 'Unknown products appear only where the user placed them.'], ix: ['Tap a day to expand its morning and evening.', 'Start my streak → Today, day 1, no account.'] },
    today: { title: 'Today · LAUNCH', purpose: "Do today's sessions. Nothing else competes.", rules: ['Paired friend sits under the Ring: their completion today and the joint Friend Streak. Never products.', 'WhatsApp nudge (LAUNCH) opens a prefilled message; the user picks the chat. Push nudge is FAST FOLLOW. Bonus Rescues are EXPERIMENT.', 'Swap to recovery is a user choice on active nights; it is not a Rescue and costs nothing.', 'Evening switches the header to Dusk. Component anatomy is unchanged.', 'Mark done buttons stick to the bottom of long cards.', 'Before 4am the previous day stays open.', 'Streak is derived from dated day records (w{week}-d{day}), never a mutable counter. While a miss is pending, the streak is held: completing today adds nothing until the miss is rescued or let go.', 'Rescue references the missed day by id, including last week’s day 7, and spends that rota’s Rescue.', 'Missed ring segments are a thin Sienna line; rescued are Sea glass; future is the pale track.', 'A day with zero scheduled steps is a Rest day: one "Rest day done" check-in completes it.', 'Ring = this seven-day rota. Centre = continuous Skin Streak.', 'One completion action per session. No per-product ticking.', 'A day is complete when every session scheduled that day is done. Recovery days count.', "A missed day never moves or doubles today's steps.", 'One Rota Rescue per rota, offered only for yesterday.'], ix: ['The current session is expanded; the other collapses to a row.', 'Mark done → toast and collapse. Completing the day fills the segment, pops the streak and opens the reward.', 'Avatar → Profile sheet.'] },
    dayDone: { title: 'Celebration · Day 1 and Day 3', purpose: 'Reward on grain, and the natural moment to invite.', rules: ['Full-screen only for the first day and Day 3. Other days complete inline on Today. Day 7 goes to Rota complete.', 'Primary CTA is stateful: no invite yet → Invite a friend; streak 3 → Share 3-day streak; day 7 → Share first full rota; otherwise → Back to Today only.', 'On mobile web, Back to today leads to the install prompt.'], ix: ['Streak number springs in (420ms overshoot).'] },
    shelf: { title: 'Shelf', purpose: 'What you own and how the rota uses it.', rules: ['Shelf Check: at most three observations, no score.', 'Unknown products are listed apart and left out of checks.', 'Adding a product updates the rota from tomorrow, never mid-day.'], ix: ['Add → product builder in shelf mode, then back here.'] },
    friends: { title: 'Friends', purpose: 'Accountability without sharing routines.', rules: ['Friends see ring and streak only.', "Nobody can view or copy another person's products.", 'WhatsApp is the primary invite; copying the link is secondary.'], ix: ['Invite → sheet with a prewritten message.'] },
    whatsapp: { title: 'WhatsApp invite', purpose: 'Where most invitees first meet myrota.', rules: ["The link preview carries the inviter's name.", 'The message promises their own rota, not a copy.'], ix: ['Tap the link card → invite landing on mobile web.'] },
    inviteLanding: { title: 'Invite landing', purpose: 'Turn a friend’s nudge into a first product.', rules: ['Names the inviter and their streak.', 'States that routines stay private.', 'Lower bar: one product is enough.'], ix: ['Start with what I have → builder in invite mode.'] },
    mix: { title: 'Mix Check', purpose: 'Acquisition utility: answer one question, then offer a rota.', rules: ['Lives at /mix, outside main navigation.', 'Two slots. Unknown products allowed.'], ix: ['Tap a slot → picker sheet. Check the mix when both are filled.'] },
    mixResult: { title: 'Mix Check result', purpose: 'Plain answers, then a reason to build the week.', rules: ['Up to three observations. No score, no traffic lights.', 'Unknown products get an explicit "we don\'t know".', 'The CTA carries both products into the builder.'], ix: ['Build a rota with these → builder with both pre-added.'] },
    reminders: { title: 'Reminder times', purpose: 'Ask for notifications with a reason attached.', rules: ['Asked only after install and a completed day.', 'Our screen comes first, then the system prompt.', 'No reminder once a session is marked done.'], ix: ['Pick times → system permission dialog.'] },
    lock: { title: 'Lock-screen reminder', purpose: 'Bring people back at the time they chose.', rules: ['One per scheduled session, at the chosen time.', 'Copy names the session and the streak day.'], ix: ['Tap → Today with the evening card open.'] },
  };

  renderVals() { return this.post(this.renderVals0()); }
  post(v) {
    const s = this.state, days = this.days(s);
    const sched = x => !!(x && (x.showOpen || x.showClosed || x.showDone));
    const amS = sched(v.am), pmS = sched(v.pm), amP = amS && !v.am.showDone, pmP = pmS && !v.pm.showDone, rest = !amS && !pmS;
    const curK = pmP && (s.tod === 'pm' || !amP) ? 'pm' : amP ? 'am' : null;
    v.curOn = !!curK; v.curTitle = curK === 'pm' ? 'Evening' : 'Morning'; v.curSteps = curK ? v[curK].steps.slice(0, 5) : []; v.curSwap = curK === 'pm' && !!v.canSwap;
    const at = x => (x.doneLine || '').replace('Marked at ', '');
    v.otherLine = rest ? (v.dockLineOn ? 'Rest day kept.' : "Nothing scheduled today. That's the plan.")
      : curK === 'pm' && amS ? (v.am.showDone ? 'Morning done at ' + at(v.am) + '.' : 'Morning not marked yet.')
      : curK === 'am' && pmS ? 'Evening later: ' + v.pm.steps.length + ' steps.'
      : !curK ? 'Morning and evening both done.' : '';
    v.otherOn = !!v.otherLine;
    v.dayLabelShort = String(v.dayLabel || '').replace(' OF 7', '');
    v.dockPad = '100px'; v.numFs320 = String(v.streak).length >= 3 ? '112px' : '144px'; v.numFs120 = String(v.streak).length >= 3 ? '36px' : '44px'; v.weekLink = '#A9401A'; v.numFs200 = String(v.streak).length >= 3 ? '64px' : '80px';
    v.streakLabel = s.missedPending ? 'Streak at risk' : 'day streak';
    const B = v.showMissed ? { t: v.missedTitle, a: 'Use Rescue', go: v.openRescue }
      : v.showMissedInfo ? { t: 'Your streak restarts today. The rota carries on.', a: 'OK', go: v.dismissInfo }
      : v.showLate ? { t: 'Your evening still counts for ' + (v.lateDay || 'today') + ' until 4am.' }
      : v.showClaim ? { t: 'Your streak lives on this phone only.', a: 'Save it', go: v.openClaim }
      : v.showInviteCard ? { t: 'Streaks are easier in pairs.', a: 'Invite', go: v.openInvite } : null;
    v.bannerOn = !!B; v.bannerText = B ? B.t : ''; v.bannerA = B && B.a || ''; v.bannerHasA = !!(B && B.a); v.bannerAct = B && B.go || (() => {});
    const fr = (s.friends || [])[0];
    v.meWho = s.displayName || ''; v.meLook = s.look || null; v.pairOn = !!(s.paired && fr); v.pairWho = fr ? fr.name : ''; v.pairLook = fr && fr.look || null; v.pairTones = fr && fr.tones || '';
    v.avatarAria = v.pairOn ? 'You and ' + v.pairWho + ' · open Friends' : 'Open Friends';
    v.openFriendsSheet = () => this.go('friends', 1);
    v.openWeek = () => this.openSheet('week', { weekOpen: s.day });
    v.SH = { ...(v.SH || {}), week: s.sheet === 'week', notes: s.sheet === 'notes', avatar: s.sheet === 'avatar' };
    v.missedStatement = String(v.missedTitle || '').replace(/\.?$/, '.');
    v.iosSteps = [...(!s.account ? [{ t: 'Save your streak first, so you can sign back in.', act: true }] : []), { t: "Tap Share in Safari's toolbar.", share: true }, { t: 'Choose Add to Home Screen.' }, { t: 'Open myrota from your Home Screen.' }].map((r, k) => ({ share: false, act: false, ...r, n: k + 1 }));
    v.shareOptsOpen = !!s.shareOpts; v.shareOptsLabel = s.shareOpts ? 'Hide options' : 'Options'; v.toggleShareOpts = () => this.setState(z => ({ shareOpts: !z.shareOpts }));
    const AV = { skin: [0, 1, 2, 3, 4, 5, 6, 7, 8], hair: ['lowcut', 'bald', 'coils', 'afro', 'puffs', 'locs', 'braids', 'cornrows', 'bun', 'long', 'headwrap', 'hijab'], face: ['calm', 'smile', 'grin', 'wink'], extra: ['none', 'patches', 'mask', 'towel', 'headband', 'glasses', 'hoops'], bg: ['dew', 'seaglass', 'shell', 'apricot', 'rosesand', 'tide'] };
    const SK = ['#F5E2D3', '#EED3BE', '#E2C0A3', '#D1A47F', '#B98661', '#9A6B48', '#7C5235', '#5E3B25', '#3D2618'], BGC = { dew: '#E3F1EC', seaglass: '#9ED8CF', shell: '#F1E0D2', apricot: '#F6B48F', rosesand: '#E8CDB9', tide: '#1F7F7E' };
    const dl = s.draft || s.look || { skin: -1, hair: 'lowcut', face: 'smile', extra: 'none', bg: 'seaglass' }, tab = s.avTab || 'skin';
    v.draftLook = dl.skin >= 0 ? dl : null;
    v.avTabs = [['skin', 'Skin'], ['hair', 'Hair'], ['face', 'Face'], ['extra', 'Extras'], ['bg', 'Background']].map(([k, t]) => ({ t, bar: k === tab ? '#EE6F3E' : 'transparent', ink: k === tab ? '#2A1911' : '#5A3824', go: () => this.setState({ avTab: k }) }));
    const base = { ...dl, skin: dl.skin >= 0 ? dl.skin : 5 };
    v.avOpts = AV[tab].map(o => { const on = dl[tab] === o, sw = tab === 'skin' || tab === 'bg'; return { on, label: tab + ' ' + o, isSwatch: sw, isAv: !sw, sw: tab === 'skin' ? SK[o] : BGC[o] || '', look: { ...base, [tab]: o }, tileBg: '#F7EFE7', edge: on ? 'inset 0 0 0 3px #EE6F3E' : 'inset 0 0 0 1px #E8D8C9', pick: () => this.setState(z => ({ draft: { ...(z.draft || dl), [tab]: o } })) }; });
    v.openBuilder = () => this.closeSheet(() => this.openSheet('avatar', { draft: s.look || null, avTab: 'skin' }));
    v.saveLook = () => { const d = this.state.draft; if (!d || !(d.skin >= 0)) { this.setState({ avTab: 'skin' }); this.toast('Pick a skin tone first'); return; } this.setState({ look: d }); this.closeSheet(); this.toast('Look saved'); };
    v.shuffleLook = () => { const r = a => a[Math.floor(Math.random() * a.length)]; this.setState({ draft: { skin: r(AV.skin), hair: r(AV.hair), face: r(AV.face), extra: r(AV.extra), bg: r(AV.bg) } }); };
    v.amaLook = this.ama().look;
    const TYPEOF = x => (!x.am.length && !x.pm.length) ? 'Rest' : ({ r: 'Retinoid', b: 'Exfoliant', rec: 'Recovery' }[x.t] || 'Recovery');
    v.stripDays = days.map((x, d) => ({ d: this.DOW[d].slice(0, 2), long: this.DOWL[d], type: TYPEOF(x), steps: x.pm.filter(p => p.role !== 'unknown').map(p => this.short(p)).join(', '), unknown: (x.pm.find(p => p.role === 'unknown') || {}).name || '' }));
    v.stripSel = s.stripSel >= 0 ? s.stripSel : 0; v.stripPick = i => this.setState({ stripSel: i });
    v.revAmLine = (days[0] ? days[0].am : []).filter(p => p.role !== 'unknown').map(p => this.short(p)).join(', ');
    v.dayIdx = s.day; const ws = s.weekOpen >= 0 ? s.weekOpen : s.day; v.weekSel = ws; v.weekPick = i => this.setState({ weekOpen: i });
    const wd = days[ws] || { am: [], pm: [] }, wt = TYPEOF(wd);
    v.weekSelHead = this.DOWL[ws] + ' · ' + wt + (wt === 'Rest' ? ' day' : ' night');
    const wst = ws < s.day ? (this.complete(s.done, ws, days[ws]) ? 'Done' : s.rescued[ws] ? 'Rescued' : 'Missed') : ws === s.day ? 'Today' : 'Ahead';
    v.weekSelState = wst;
    v.weekSelRows = [...wd.am.filter(p => p.role !== 'unknown').map(p => ({ when: 'Morning', t: this.short(p) })), ...wd.pm.filter(p => p.role !== 'unknown').map(p => ({ when: 'Evening', t: this.short(p) }))];
    if (!v.weekSelRows.length) v.weekSelRows = [{ when: 'All day', t: 'Nothing scheduled. One check-in.' }];
    const wu = [...wd.am, ...wd.pm].find(p => p.role === 'unknown'); v.weekSelUnk = !!wu; v.weekSelUnkLine = wu ? '+ ' + wu.name + ' (not analysed)' : '';
    const BUD = {
      today: ['Do tonight\'s session', 'Day statement + ring', [1, 2, 3, 5, 1, 0, 7, 1]],
      reveal: ['Understand the week, then start', 'Week grid', [1, 2, 3, 0, 0, 0, 4, 1]],
      add: ['Get one product in', 'Scan button', [1, 2, 3, 2, 0, 0, 4, 1]],
      review: ['Confirm this product', 'Product name', [1, 1, 3, 0, 0, 0, 5, 1]],
      shelf: ['See what I own', 'Product list', [1, 1, 2, 5, 0, 0, 3, 1]],
      mixResult: ['Answer the question', 'Verdict', [1, 2, 3, 0, 0, 1, 4, 1]],
      dayDone: ['Feel it, then share', '320px ring', [1, 1, 3, 0, 0, 0, 3, 0]],
      friends: ['See my people', 'Friend rows', [1, 0, 2, 5, 0, 0, 4, 1]],
    };
    const SHB = { week: ['See any day', 'Selected day', [0, 0, 2, 5, 0, 1, 3, 1]], rescue: ['Decide on the Rescue', 'Statement', [1, 1, 3, 0, 0, 0, 4, 1]], install: ['Add to Home Screen', 'Steps', [1, 1, 2, 4, 0, 0, 3, 1]], share: ['Send the card', 'Card preview', [1, 2, 2, 0, 0, 0, 3, 1]], avatar: ['Pick a look', '160px preview', [1, 2, 3, 0, 0, 0, 2, 1]], notes: ['Read shelf notes', 'Notes', [0, 0, 1, 3, 0, 0, 2, 1]] };
    const bd = (s.sheet && SHB[s.sheet]) || BUD[s.screen];
    v.budgetOn = !!bd;
    if (bd) { const MX = [1, 2, 3, 5, 1, 2, 4, 1], K = ['Primary actions', 'Secondary actions', 'Content groups', 'List rows', 'Banners', 'Tags', 'Type sizes', 'Card nesting'];
      v.budget = { job: bd[0], focus: bd[1], rows: K.map((k, i) => ({ k, v: bd[2][i] + ' / ' + MX[i], ink: bd[2][i] > MX[i] ? '#A9401A' : '#1F7F7E' })) }; } else v.budget = { job: '', focus: '', rows: [] };
    v.openLookFromName = () => { const nm = this.state.nameDraft; this.closeSheet(() => this.openSheet('avatar', { draft: s.look || null, avTab: 'skin', displayName: nm || s.displayName })); };
    v.usePhoto = () => this.toast('Photo from Google or Apple, or your camera roll');
    const sob = this.shelfObs(s.products) || [];
    v.insight = sob[0] ? sob[0].t : 'Strong nights take turns, with recovery nights between.'; v.notesRows = sob;
    v.moreNotesOn = sob.length > 1; v.moreNotes = (sob.length - 1) + ' more ' + (sob.length - 1 === 1 ? 'note' : 'notes');
    v.openNotes = () => this.openSheet('notes');
    v.moreNotesAny = sob.length > 0; v.shelfNotesLine = sob.length + (sob.length === 1 ? ' note' : ' notes') + ' about your shelf';
    const flagIds = new Set((v.shelfFlags || []).map(f => f.id || f.pid).filter(Boolean));
    v.shelfRows = [...(v.shelfIn || []).map(p => ({ name: p.name, role: String(p.meta || '').split('·')[0].trim(), when: [p.am && 'AM', p.pm && 'PM'].filter(Boolean).join(' · ') || 'Not in rota', dot: p.flag || flagIds.has(p.id) ? '#845535' : 'transparent', open: p.open })),
      ...(v.shelfUnknown || []).map(p => ({ name: p.name, role: p.tag === 'Flagged' || /flag/i.test(p.tag || '') ? 'Flagged' : 'Unknown', when: String(p.meta || '').split('·')[0].trim() || 'Placed by you', dot: '#845535', open: p.open }))];
    const FR = s.friends || [];
    v.hasFriends = FR.length > 0; v.noFriends = !FR.length;
    v.friendRows = FR.map(f => ({ name: f.name, look: f.look || null, tones: f.tones, status: f.status, streak: f === FR[0] && s.pairStreak ? s.pairStreak : f.streak, open: () => this.openSheet('nudge') }));
    if (v.verdict) {
      const VT = { 'Alternate days': ['#1F7F7E', '#FBFAF6', 'Take turns.'], 'Better separated': ['#F6B48F', '#2A1911', 'Morning and night.'], 'Fine together': ['#9ED8CF', '#2A1911', 'Fine together.'], 'Not enough evidence': ['#F1E0D2', '#5A3824', 'Not enough evidence.'], 'Check with a professional': ['#845535', '#FBFAF6', 'Ask first.'] }[v.verdict.v] || ['#F1E0D2', '#2A1911', v.verdict.v];
      v.vTagBg = VT[0]; v.vTagInk = VT[1]; v.vStatement = VT[2];
      v.whyOpen = !!s.whyOpen; v.whySign = s.whyOpen ? '−' : '+'; v.toggleWhy = () => this.setState(z => ({ whyOpen: !z.whyOpen }));
      v.mixObs3 = (v.mixObs || []).slice(0, 3);
    }
    if (s.screen === 'review' && v.rv) {
      const st = s.revStep || 1, rv = v.rv, flags = rv.flags || [], f0 = flags[0] || {};
      v.rs1 = st === 1; v.rsFlag = st === 'flag'; v.rs2 = st === 2;
      v.revStepLabel = st === 1 ? 'Step 1 of 2' : st === 2 ? 'Step 2 of 2' : 'Before you add it';
      v.rvTitle = s.revName || rv.name || 'Unnamed product'; v.rvProv = (v.rvBadges || []).map(b => b.t).join(' · ');
      v.rvCats6 = (v.rvCats || []).slice(0, 6).map(c => ({ ...c, bd: c.bc === '#2A1911' ? '2px solid #2A1911' : '1.5px solid #C99A72' }));
      v.rvUse2 = v.rvUse || [];
      v.revNext = () => this.setState({ revStep: flags.length ? 'flag' : 2 });
      v.flagNext = () => this.setState({ revStep: 2 });
      v.flagTag = f0.tag || 'Label flag'; v.flagTitle = f0.title || ''; v.flagBody = f0.body || ''; v.flagSrc = f0.src || '';
      const raw = (s.revChips && s.revChips.length ? s.revChips : (this.REVIEW[s.reviewCase] || {}).chips) || [], ch = rv.chips || [];
      v.actRows = raw.map((c, k) => ({ t: c[0], kind: c[1], edit: (ch[k] || {}).edit || (() => {}) })).filter(c => c.kind === 'act' || c.kind === 'flag').slice(0, 6);
      const unr = raw.map((c, k) => ({ kind: c[1], k })).filter(c => c.kind === 'x');
      v.unreadOn = unr.length > 0; v.unreadLine = unr.length + ' we couldn\'t read'; v.unreadFix = unr.length ? ((ch[unr[0].k] || {}).edit || (() => {})) : (() => {});
    }
    const M = v.addMethods || [], fm = re => (M.find(m => re.test(m.t || '')) || {}).go || (() => {});
    v.scanGo = (M.find(m => m.scan) || {}).go || fm(/scan/i); v.pasteGo = fm(/paste/i); v.galleryGo = fm(/galler|photo/i);
    const sp = !v.hasAdded; v.scanBg = sp ? '#EE6F3E' : '#FBFAF6'; v.scanInk = sp ? '#2A1911' : '#A9401A'; v.scanSh = sp ? '3px 4px 0 #2A1911' : 'none';
    v.resultsTyped = (s.query || '').trim() ? (v.results || []).slice(0, 5) : [];
    v.revGrid = (v.revGrid || []).map(g => ({ ...g, dot: g.unk ? '#845535' : 'transparent' }));
    const unk = (s.products || []).filter(p => p.role === 'unknown');
    v.revUnkOn = unk.length > 0; v.revUnkLine = unk.length ? unk[0].name + ' goes where you put it. myrota hasn\'t analysed it.' : '';
    const strip = v.strip || [], grid = v.revGrid || [];
    v.weekRows = days.map((x, d) => {
      const g = grid[d] || {}, st = strip[d] || {}, open = s.weekOpen === d;
      const items = [['Morning', x.am], ['Evening', x.pm]].filter(r => r[1].length).map(([t, l]) => ({ t, list: l.map(p => this.short(p)).join(' · ') }));
      return { name: this.DOWL[d] + (d === s.day ? ' · today' : ''), tag: g.tag === 'Daily' ? 'Morning' : (g.tag || 'Rest'), segBg: st.bg || '#FBFAF6', segEdge: st.edge || 'inset 0 0 0 1px #E8D8C9', open, sign: open ? '−' : '+', items, hasItems: items.length > 0,
        toggle: () => this.setState(z => ({ weekOpen: z.weekOpen === d ? -1 : d })) };
    });
    return v;
  }
  renderVals0() {
    const s = this.state, days = this.days(s), JS = this.J(), TR = this.TRACK, SG = this.SG;
    const tabsOn = ['today', 'shelf', 'friends'].includes(s.screen);
    const web = !s.installed && !['whatsapp', 'lock'].includes(s.screen);
    const comp = d => this.complete(s.done, d, days);
    const status = d => d < s.day ? (comp(d) ? 'done' : s.rescued[d] ? 'rescued' : 'missed') : d === s.day ? (comp(d) ? 'done' : 'today') : 'future';
    const tone = (d, st) => st === 'done' ? (days[d].t === 'rec' ? SG : this.TONES[d]) : st === 'rescued' ? SG : st === 'missed' ? 'x' : TR;
    const isPM = s.tod === 'pm';
    const todayComp = comp(s.day);
    const ringTones = days.map((x, d) => tone(d, status(d))).join(',');
    const week = days.map((x, d) => {
      const st = status(d), t = tone(d, st);
      const w = { l: this.DOW[d][0], lc: isPM ? (d === s.day ? '#FBFAF6' : '#BFE4DD') : (d === s.day ? '#2A1911' : '#5A3824'), bs: 'solid', bg: 'transparent', bc: isPM ? '#7EC4BA' : '#C99A72', open: () => this.openSheet('day', { sheetDay: d }), aria: this.DOWL[d] };
      if (st === 'done' || st === 'rescued') { w.bg = t; w.bc = t === SG ? '#1F7F7E' : isPM ? '#FBFAF6' : t; }
      else if (st === 'today') { w.bg = '#FBFAF6'; w.bc = '#EE6F3E'; }
      else if (st === 'missed') { w.bs = 'dashed'; w.bc = isPM ? '#F6B48F' : '#845535'; }
      else if (x.t === 'rec') { w.bc = '#7EC4BA'; w.bg = '#E3F1EC'; }
      return w;
    });
    const T = days[s.day] || { am: [], pm: [], t: 'base' }, dd = s.done[s.day];
    const steps = list => list.map((p, i) => ({ n: i + 1, short: this.short(p), icon: p.icon, note: this.NOTE[p.role] }));
    const sess = k => {
      const list = T[k], sched = list.length > 0, done = dd[k];
      const cur = k === 'am' ? s.tod === 'am' || !sched : s.tod === 'pm' || dd.am || !T.am.length;
      const ov = k === 'am' ? s.amOpen : s.pmOpen;
      const open = !done && (ov ?? (k === 'am' ? (s.tod === 'am') : cur && !(s.tod === 'am' && !dd.am)));
      let meta = `${list.length} step${list.length === 1 ? '' : 's'}`;
      if (k === 'pm' && T.t === 'rec') meta += ' · recovery';
      if (k === 'pm' && T.t === 'r') meta += ' · retinoid';
      if (k === 'pm' && T.t === 'b') meta += ' · exfoliant';
      if (k === 'pm' && s.tod === 'am') meta += ' · from 8pm';
      if (k === 'am' && s.tod === 'pm' && !done) meta += ' · open till 4am';
      return {
        showOpen: sched && open, showClosed: sched && !done && !open, showDone: sched && done,
        meta, tag: (k === s.tod) ? 'Now' : 'Early', steps: steps(list), doneLine: `Marked at ${s.doneAt[s.day + k] || (k === 'am' ? '7:42' : '21:14')}`,
        toggle: () => this.setState(k === 'am' ? { amOpen: !open } : { pmOpen: !open }),
        complete: () => this.markDone(k),
      };
    };
    let todayLine;
    if (todayComp) todayLine = "Today's done. See you tomorrow morning.";
    else if (!T.am.length && !T.pm.length) todayLine = 'A rest day. Nothing to apply.';
    else if (!T.pm.length) todayLine = dd.am ? '' : 'One session today.';
    else if (!T.am.length) todayLine = 'One session today, in the evening.';
    else if (dd.am) todayLine = s.tod === 'pm' ? 'Morning done. Evening is ready.' : 'Morning done. Evening from 8pm.';
    else if (dd.pm) todayLine = 'Evening done. Morning is still open.';
    else todayLine = 'Two sessions today. Start with the morning.';
    const yd = s.day - 1, ydx = yd >= 0 ? s.done[yd] : null;
    const missedWhat = ydx ? (!ydx.am && !ydx.pm ? 'sessions were' : !ydx.pm ? 'evening was' : 'morning was') : '';
    const missedTitle = yd >= 0 ? `${this.DOWL[yd]}'s ${missedWhat} missed` : '';

    const Q = s.query.trim().toLowerCase();
    const inMix = s.sheet === 'mixPick';
    const results = this.LIB.filter(p => (!Q || (p.name + ' ' + p.brand + ' ' + p.type).toLowerCase().includes(Q))).map(p => ({
      name: p.name, meta: `${p.brand} · ${p.type}`, icon: p.icon, onShelf: !inMix && s.products.some(x => x.id === p.id), canAdd: inMix || !s.products.some(x => x.id === p.id),
      act: inMix ? () => this.closeSheet(() => this.setState({ [s.mixSlot === 'a' ? 'mixA' : 'mixB']: { ...p }, query: '' })) : () => this.setState(st => ({ products: [...st.products, { ...p }], query: '' })),
    }));
    const n = s.products.length, src = s.source;
    const minOk = n >= 1;
    let buildLabel = src === 'shelf' ? 'Update my rota' : n >= 3 || src === 'invite' || src === 'mix' ? 'Build my rota' : n === 0 ? 'Add a product to start' : `Build with ${n} product${n > 1 ? 's' : ''}`;
    const mixCarry = s.mixA && s.mixB ? `From Mix Check: ${this.short(s.mixA)} and ${this.short(s.mixB)}. ${(this.mixObs(s.mixA, s.mixB)[0] || {}).h}.` : '';

    const pv = days.map((x, d) => x.t === 'rec' ? SG : this.TONES[d]).join(',');
    const actN = days.filter(x => x.t === 'r' || x.t === 'b').length, recN = days.filter(x => x.t === 'rec').length;
    const unk = s.products.filter(p => p.role === 'unknown');
    let revealNote = '', revealNoteBg = '#E3F1EC', revealNoteInk = '#2A1911';
    if (s.ctxCare === 'preg' && s.products.some(p => p.role === 'ret')) revealNote = 'Your retinal stays on your shelf but out of this rota. Check with a professional before using it.';
    else if (s.ctxCare === 'rx' && s.products.some(p => p.role === 'ret' || p.role === 'bha')) revealNote = 'Because you use a prescription treatment, your retinal and BHA are held out of this rota. Check with a professional, then turn them on from Shelf.';
    else if (s.ctxRet === 'new' && s.products.some(p => p.role === 'ret')) revealNote = "Retinal starts on two nights this week because you're new to it.";
    else if (src === 'mix' && s.mixA && s.mixB) { revealNote = `From Mix Check: ${this.short(s.mixA)} and ${this.short(s.mixB)} never share a night in this rota.`; revealNoteBg = '#3E63D8'; revealNoteInk = '#FBFAF6'; }
    else if (unk.length) revealNote = `${unk[0].name} is in your ${unk[0].place === 'am' ? 'mornings' : unk[0].place === 'pm' ? 'evenings' : 'shelf only'} because you put it there. We haven't analysed it.`;
    else if (src === 'invite') revealNote = 'Built from your shelf only. Ama has her own rota and can’t see this one.';
    const revealDays = days.map((x, d) => ({
      l: this.DOW[d][0], title: `${this.DOW[d]} · ${{ r: 'Retinoid night', b: 'Exfoliant night', rec: 'Recovery night', base: 'Daily' }[x.t]}`,
      sub: `Morning ${x.am.length} · Evening ${x.pm.length}${d === 0 ? ' · today' : ''}`,
      bg: x.t === 'rec' ? '#E3F1EC' : d === 0 ? '#FBFAF6' : '#F1E0D2', border: d === 0 ? '#EE6F3E' : x.t === 'rec' ? SG : '#E8D8C9',
      open: s.openDay === d, chev: s.openDay === d ? 'Hide' : 'Show',
      toggle: () => this.setState({ openDay: s.openDay === d ? -1 : d }),
      am: x.am.map(p => ({ short: this.short(p) })), pm: x.pm.map(p => ({ short: this.short(p) })),
    }));

    const jn = s.journey, stepsDef = JS[jn].steps;
    let active = s.stepIdx;
    stepsDef.forEach((st, i) => { const pt = st[1](); if (pt.screen === s.screen && (pt.sheet || null) === (s.sheet || null)) active = i; });
    const logic = this.LOGIC[s.screen] || this.LOGIC.today;
    const sheetOn = !!s.sheet;
    const inviteHead = s.invited ? 'Invite sent. Waiting for them to build a rota.' : s.friends.length ? 'Invite one more' : 'Streaks are easier in pairs.';
    const darkStatus = ['building', 'lock', 'mix', 'mixResult', 'scan'].includes(s.screen) || (s.screen === 'today' && isPM);
    const urls = { welcome: '', add: '/build', building: '/build', reveal: '/rota', today: '/today', dayDone: '/today', shelf: '/shelf', friends: '/friends', inviteLanding: '/i/a8Kb4Q', scan: '/add/scan', review: '/add/review', context: '/build/context', rotaComplete: '/week/complete', nextWeek: '/week/next', friendJoined: '/friends', mix: '/mix', mixResult: '/mix', reminders: '/settings' };
    const fr = s.friends.length ? s.friends : [];
    const mixSlot = (k, p, slot) => ({ k, label: p ? (p.role === 'unknown' ? p.name : p.name) : 'Choose a product', icon: p ? p.icon : 'add', bg: p ? '#FBFAF6' : '#F7EFE7', bs: p ? 'solid' : 'dashed', bc: p ? '#2A1911' : '#C99A72', pick: () => this.openSheet('mixPick', { mixSlot: slot, query: '' }) });
    const mixO = this.mixObs(s.mixA, s.mixB);
    const otpDigits = '482913'.split('');

    const DT = { r: 'Retinoid', b: 'Exfoliant', rec: 'Recovery' }, TAGC = { Retinoid: ['#1E3A3C', '#FBFAF6', 'none'], Exfoliant: ['#1F7F7E', '#FBFAF6', 'none'], Recovery: ['#9ED8CF', '#2A1911', 'none'], Rest: ['#E3F1EC', '#2A1911', 'inset 0 0 0 1px rgba(42,25,17,.14)'], Daily: ['#F1E0D2', '#2A1911', 'none'] };
    const isRest = !T.am.length && !T.pm.length, tagOf = x => (!x.am.length && !x.pm.length) ? 'Rest' : DT[x.t] || 'Daily';
    const pmField = isPM || !!dd.am, AMs = sess('am'), PMs = sess('pm');
    const dockSpec = isRest ? (dd.rest ? ['line', 'Rest day done. See you tomorrow.'] : ['btn', 'Rest day done', () => this.markDone('rest')])
      : todayComp ? ['line', "Today's done. See you tomorrow morning."]
      : (s.tod === 'pm' && T.pm.length && !dd.pm) ? ['btn', 'Mark evening done', () => this.markDone('pm')]
      : (T.am.length && !dd.am) ? ['btn', 'Mark morning done', () => this.markDone('am')]
      : (T.pm.length && !dd.pm) ? ['line', 'Morning done · Evening from 20:00'] : ['line', ''];
    const tdx = {
      dayLabel: this.DOWL[s.day].slice(0, 3).toUpperCase() + ' · DAY ' + (s.day + 1) + ' OF 7',
      dayStatement: isRest ? 'Rest day.' : ({ r: 'Retinoid night.', b: 'Exfoliant night.', rec: 'Recovery night.' }[T.t] || 'Daily rota.'), dayTag: isRest ? 'Rest' : (DT[T.t] || 'Morning'),
      fieldAm: pmField ? 0 : 1, fieldPm: pmField ? 1 : 0, fieldInk: pmField ? '#FBFAF6' : '#2A1911', fieldSub: pmField ? 'rgba(251,250,246,.8)' : '#5A3824',
      ringTones2: ringTones.replace(/x/g, TR), todayHollow: todayComp ? -1 : s.day,
      ringMissed: days.map((x, d) => status(d) === 'missed' ? d : -1).filter(d => d >= 0).join(','),
      ringRescued: days.map((x, d) => status(d) === 'rescued' ? d : -1).filter(d => d >= 0).join(','),
      strip: days.map((x, d) => { const st = status(d), t = tone(d, st), tg = tagOf(x); return { l: this.DOW[d][0], aria: this.DOWL[d] + ' · ' + tg, open: () => this.openSheet('day', { sheetDay: d }), icon: tg === 'Rest' ? 'done' : { r: 'serum', b: 'water', rec: 'jar' }[x.t] || 'am',
        bg: st === 'done' || st === 'rescued' ? (t === 'x' ? '#FBFAF6' : t) : '#FBFAF6', ink: (st === 'done' && t !== SG && (t === '#2A1911' || t === '#5A3824')) ? '#FBFAF6' : '#2A1911',
        edge: st === 'today' ? 'inset 0 0 0 2px #2A1911' : st === 'missed' ? 'inset 0 0 0 1.5px #845535' : st === 'rescued' ? 'inset 0 0 0 2px #1F7F7E' : 'inset 0 0 0 1px #E8D8C9', op: st === 'future' ? 0.5 : 1, lc: pmField ? '#FBFAF6' : '#2A1911' }; }),
      dockBtn: dockSpec[0] === 'btn', dockLineOn: dockSpec[0] === 'line' && !!dockSpec[1], dockLabel: dockSpec[1], dockAct: dockSpec[2] || (() => {}),
      listPad: (s.paired && s.friends.length) ? '44px' : '20px',
      revealDayName: this.DOWL[0], revAm: (days[0] ? days[0].am : []).map(p => this.short(p)).join(' · '),
      revGrid: days.map((x, d) => { const tg = tagOf(x), c = TAGC[tg]; return { d: this.DOW[d].slice(0, 2), tag: tg === 'Daily' ? 'Daily' : tg, bg: c[0], ink: c[1], edge: c[2], unk: x.am.concat(x.pm).some(p => p.role === 'unknown'), delay: (d * 60) + 'ms', open: () => this.openSheet('day', { sheetDay: d }) }; }),
    };
    const sob = this.shelfObs(s.products) || [], fi = (s.fanI || 0) % Math.max(1, sob.length);
    tdx.fanCards = sob.map((o, i) => { const k = (i - fi + sob.length) % sob.length; return { ...o, of: (i + 1) + '/' + sob.length, y: k * 10, x: k * 8, z: 10 - k, op: k > 2 ? 0 : 1, cycle: () => this.setState(st => ({ fanI: ((st.fanI || 0) + 1) % Math.max(1, sob.length) })) }; });
    tdx.fanH = (96 + Math.min(2, sob.length - 1) * 10) + 'px';
    return {
      ...tdx,
      journeys: JS.map((j, i) => ({ n: '0' + (i + 1), title: j.title, bg: i === jn ? '#FBFAF6' : 'transparent', border: i === jn ? '#2A1911' : '#E8D8C9', pick: () => this.apply(i, 0) })),
      steps: stepsDef.map((st, i) => ({ i: i + 1, label: st[0], dotBg: i === active ? '#EE6F3E' : i < active ? '#2A1911' : '#F1E0D2', dotInk: i < active ? '#FBFAF6' : '#2A1911', fw: i === active ? 600 : 400, go: () => this.apply(jn, i) })),
      setAM: () => this.setState({ tod: 'am', amOpen: null, pmOpen: null }), setPM: () => this.setState({ tod: 'pm', amOpen: null, pmOpen: null }),
      amBtnBg: s.tod === 'am' ? '#F6B48F' : 'transparent', pmBtnBg: s.tod === 'pm' ? '#1E3A3C' : 'transparent', pmBtnInk: s.tod === 'pm' ? '#FBFAF6' : '#2A1911',
      nextDay: () => this.nextDay(), restart: () => this.apply(jn, 0),
      S: { [s.screen]: true }, SH: s.sheet ? { [s.sheet]: true } : {},
      phoneBg: s.screen === 'scan' ? '#2A1911' : s.screen === 'today' && isPM ? '#1E3A3C' : s.screen === 'building' ? '#3E63D8' : s.screen === 'mix' ? '#3E63D8' : s.screen === 'lock' ? '#1E3A3C' : '#FBFAF6',
      statusInk: darkStatus ? '#FBFAF6' : '#2A1911', homeInk: darkStatus && !web ? '#FBFAF6' : '#2A1911',
      clock: s.screen === 'lock' ? '' : s.tod === 'am' ? '7:41' : '21:02',
      tx: s.phase === 'out' ? `translateX(${-28 * s.dir}px)` : s.phase === 'in0' ? `translateX(${28 * s.dir}px)` : 'translateX(0)',
      op: s.phase === 'idle' ? 1 : 0, tr: s.phase === 'in0' ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 200ms',
      tabsOn, web, url: 'myrota.app' + (urls[s.screen] ?? ''), tabPad: web ? '8px' : '24px',
      ctxLabel: s.screen === 'whatsapp' ? 'WhatsApp · friend’s phone' : s.screen === 'lock' ? 'Lock screen' : web ? 'Mobile web · not installed' : 'Installed web app',
      tabs: [['today', 'Today', 'rota', '#EE6F3E'], ['shelf', 'Shelf', 'shelf', SG], ['friends', 'Friends', 'friends', '#DDBB9C']].map(([id, label, icon, acc]) => ({ label, icon, acc, mode: 'mono', ink: s.screen === id ? '#2A1911' : '#5A3824', pill: s.screen === id ? '#EE6F3E' : 'transparent', go: () => this.setState({ screen: id }) })),
      toastOn: !!s.toast, toast: s.toast || '',
      sheetOn, scrimOp: s.sheetIn ? 1 : 0, sheetT: s.sheetIn ? 'translateY(0)' : 'translateY(100%)', closeSheet: () => this.closeSheet(),
      perm: s.perm,
      toAdd: () => this.go('add'), back: () => this.back(),
      addKicker: src === 'invite' ? 'Invited by Ama' : src === 'mix' ? 'From Mix Check' : src === 'shelf' ? 'Shelf' : 'Step 1 of 2',
      addTitle: src === 'shelf' ? 'Add to your shelf' : "What's on your shelf?",
      addSub: src === 'invite' ? 'One product is enough to start. Add more any time.' : src === 'shelf' ? 'Your rota updates from tomorrow.' : src === 'mix' ? 'Add anything else you use to round out the week.' : 'Three or more makes a proper week. Fewer works too.',
      addMix: src === 'mix' && !!mixCarry, mixCarry,
      query: s.query, onQuery: e => this.setState({ query: e.target.value }),
      results, showUnknownRow: Q.length > 2 && !this.LIB.some(p => p.name.toLowerCase() === Q),
      openUnknown: () => this.openSheet('unknown', { unkName: s.query.trim(), unkPlace: 'pm' }),
      hasAdded: n > 0, added: s.products.map((p, i) => ({ short: this.short(p), icon: p.icon, bg: p.role === 'unknown' ? '#FBFAF6' : '#F1E0D2', border: p.role === 'unknown' ? '#3E63D8' : '#F1E0D2', remove: () => this.setState(st => ({ products: st.products.filter((_, j) => j !== i) })) })),
      showProgress: src === 'organic', progSegs: [0, 1, 2].map(i => ({ bg: i < n ? '#EE6F3E' : '#F1E0D2' })), progLabel: n >= 3 ? 'Good spread' : `${n} of 3 suggested`,
      buildLabel, buildOp: minOk ? 1 : 0.4, buildPe: minOk ? 'auto' : 'none',
      build: () => { if (src === 'shelf') { this.go('shelf', -1); this.toast('Rota updated from tomorrow'); } else this.go('building'); },
      unkName: `“${s.unkName}”`, unkOpts: [['am', 'Morning'], ['pm', 'Evening'], ['none', 'Not yet']].map(([v, t]) => ({ t, bg: s.unkPlace === v ? '#F1E0D2' : '#FBFAF6', bc: s.unkPlace === v ? '#2A1911' : '#E8D8C9', pick: () => this.setState({ unkPlace: v }) })),
      addUnknown: () => this.closeSheet(() => { this.setState(st => ({ products: [...st.products, { id: 'u' + Date.now(), name: st.unkName, brand: 'Not in library', type: 'Unknown', icon: 'jar', role: 'unknown', place: st.unkPlace }], query: '' })); this.toast('Added as unknown'); }),
      buildN: s.buildN,
      buildLines: [[`Reading ${n} product${n === 1 ? '' : 's'}`, 1], [actN ? 'Giving actives their own nights' : 'Setting your morning and evening order', 3], [recN ? 'Adding recovery nights' : 'Keeping every day the same', 5]].map(([t, at]) => ({ t, op: s.buildN >= at ? 1 : 0.15 })),
      revealKicker: src === 'invite' ? 'Your own rota' : 'Your first rota', previewTones: pv,
      revealTitle: 'Starts today, Wednesday.',
      revealSub: actN ? `${actN} active night${actN > 1 ? 's' : ''} and ${recN} recovery nights. Mornings stay the same every day.` : 'The same calm plan every day. Add an active later and the week starts to vary.',
      revealNoteOn: !!revealNote, revealNote, revealNoteBg, revealNoteInk, revealDays,
      startRota: () => { this.go('today', 1, { day: 0, done: this.blank(), tod: 'am', friends: src === 'invite' ? [this.ama()] : s.friends }); this.later(() => this.toast('Day 1. Your streak starts today.'), 400); },
      dayOf: `Day ${s.day + 1} of 7`, dateLabel: `${this.DOWL[s.day]} ${7 + s.day} Oct`,
      ringTones, ringLit: todayComp ? -1 : s.day, streak: s.streak, streakLabel: s.missedPending ? 'at risk' : 'day streak', popT: s.pop ? 'scale(1.18)' : 'scale(1)',
      week, todayLine, am: sess('am'), pm: sess('pm'), noPmNote: !T.pm.length && T.am.length > 0,
      showMissed: s.missedPending, missedTitle, missedDay: yd >= 0 ? this.DOWL[yd] : '', showMissedInfo: !!s.missedInfo && !s.missedPending, missedInfo: s.missedInfo || '',
      dismissInfo: () => this.setState({ missedInfo: null }),
      showRecovery: T.t === 'rec' && T.pm.length > 0 && !dd.pm,
      showRest: !T.am.length && !T.pm.length && !dd.rest, showRestDone: !T.am.length && !T.pm.length && !!dd.rest,
      restDone: () => this.markDone('rest'), restAt: s.doneAt[s.day + 'rest'] || '9:05',
      openRescue: () => this.openSheet('rescue'),
      rescueTones: days.map((x, d) => d === yd ? SG : tone(d, status(d))).join(','), streakIfRescued: this.calc(s, { okId: true }).v,
      useRescue: () => this.closeSheet(() => { const r = [...s.rescued]; r[yd] = true; this.setState(st => ({ rescued: r, rescueUsed: true, missedPending: false, streak: st.streak + 1, pop: true })); this.later(() => this.setState({ pop: false }), 400); this.toast('Rescued. Your streak carries on.'); }),
      letGo: () => this.closeSheet(() => { this.setState({ missedPending: false, missedRef: null, missedInfo: 'Your rota carries on exactly as planned. Nothing doubles up.' }); }),
      showInviteCard: todayComp && !s.friends.length && !s.invited && !s.missedPending,
      showClaim: !s.account && s.streak >= 1 && (s.installed || s.day >= 1) && !s.missedPending,
      openInvite: () => this.openSheet('invite'), openClaim: () => this.openSheet('claim', { claimStage: 'choose', otpFilled: false }), openProfile: () => this.openSheet('profile'),
      doneTitle: `Day ${s.day + 1} done.`, doneSub: !T.am.length && !T.pm.length ? 'A rest day, kept. It counts like any other.' : T.t === 'rec' ? 'A recovery day, kept. It counts like any other.' : 'Every session today. That’s how a streak grows.',
      ...(() => {
        const share = t => () => { this.toast('Opening WhatsApp'); this.go('today', -1); if (!s.installed) this.later(() => this.openSheet('install'), 600); };
        if (s.day === 6) return { doneCta: 'Share your first full rota', doneAct: share(), showDoneBack: true };
        if (s.streak === 3) return { doneCta: 'Share your 3-day streak', doneAct: share(), showDoneBack: true };
        if (!s.invited && !s.friends.length) return { doneCta: 'Invite a friend on WhatsApp', doneAct: () => this.go('friends', 1, {}) || this.later(() => this.openSheet('invite'), 450), showDoneBack: true };
        return { doneCta: 'Back to today', doneAct: () => { this.go('today', -1); if (!s.installed) this.later(() => this.openSheet('install'), 600); }, showDoneBack: false };
      })(),
      doneInvite: () => this.go('friends', 1, {}) || this.later(() => this.openSheet('invite'), 450),
      doneContinue: () => { this.go('today', -1); if (!s.installed) this.later(() => this.openSheet('install'), 600); },
      shelfAdd: () => this.go('add', 1, { source: 'shelf', query: '' }),
      shelfObs: this.shelfObs(s.products),
      shelfIn: s.products.filter(p => p.role !== 'unknown').map(p => ({ name: p.name, meta: `${p.brand} · ${p.type}`, icon: p.icon, am: days.some(x => x.am.includes(p)), pm: days.some(x => x.pm.includes(p)) })),
      shelfInCount: s.products.filter(p => p.role !== 'unknown').length,
      hasUnknown: unk.length > 0, shelfUnknown: unk.map(p => ({ name: p.name, meta: p.place === 'am' ? 'Mornings · your choice' : p.place === 'pm' ? 'Evenings · your choice' : 'On your shelf, not in your rota' })),
      friends: fr, inviteHead,
      sendWhatsApp: () => this.closeSheet(() => { this.setState({ invited: true }); this.toast('Opening WhatsApp'); }),
      copyLink: () => this.closeSheet(() => this.toast('Link copied')),
      openInviteLink: () => this.go('inviteLanding'), inviteStart: () => this.go('add', 1, { source: 'invite', products: [] }),
      mixSlots: [mixSlot('First product', s.mixA, 'a'), mixSlot('Second product', s.mixB, 'b')],
      mixOp: s.mixA && s.mixB ? 1 : 0.4, mixPe: s.mixA && s.mixB ? 'auto' : 'none', runMix: () => this.go('mixResult'),
      mixPickTitle: `Pick the ${s.mixSlot === 'a' ? 'first' : 'second'} product`,
      pickUnknownMix: () => this.closeSheet(() => this.setState({ [s.mixSlot === 'a' ? 'mixA' : 'mixB']: { id: 'u' + Date.now(), name: s.query.trim(), brand: 'Not in library', type: 'Unknown', icon: 'jar', role: 'unknown', place: 'none' }, query: '' })),
      mixIconA: s.mixA ? s.mixA.icon : 'add', mixIconB: s.mixB ? s.mixB.icon : 'add',
      mixTitle: s.mixA && s.mixB ? `${this.short(s.mixA)} + ${this.short(s.mixB)}` : '',
      mixCountLabel: ['', 'One thing to know', 'Two things to know', 'Three things to know'][mixO.length],
      mixObs: mixO.map((o, i) => ({ ...o, n: i + 1, dot: i === 0 && [s.mixA, s.mixB].some(p => p && p.role === 'unknown') ? '#845535' : '#3E63D8' })),
      mixToRota: () => this.go('add', 1, { products: [s.mixA, s.mixB].filter(Boolean).map(p => ({ ...p })), source: 'mix', query: '' }),
      mixAgain: () => this.go('mix', -1, { mixA: null, mixB: null }),
      remAm: ['06:30', '07:30', '08:30'].map(t => ({ t, bg: s.rem.am === t ? '#EE6F3E' : '#FBFAF6', bc: s.rem.am === t ? '#2A1911' : '#C99A72', pick: () => this.setState(st => ({ rem: { ...st.rem, am: t } })) })),
      remPm: ['20:00', '21:00', '22:00'].map(t => ({ t, bg: s.rem.pm === t ? '#EE6F3E' : '#FBFAF6', ink: '#2A1911', bc: s.rem.pm === t ? '#2A1911' : '#C99A72', pick: () => this.setState(st => ({ rem: { ...st.rem, pm: t } })) })),
      askPerm: () => this.setState({ perm: true }), skipRem: () => this.go('today'),
      permAllow: () => { this.setState(st => ({ perm: false, rem: { ...st.rem, on: true } })); this.toast(`Reminders on: ${s.rem.am} and ${s.rem.pm}`); this.go('today'); },
      permDeny: () => { this.setState({ perm: false }); this.toast('No reminders. Turn them on in Profile.'); this.go('today'); },
      doInstall: () => this.closeSheet(() => { this.setState({ installed: true }); this.go('reminders'); }),
      pmCount: (days[s.day] || { pm: [] }).pm.length || 3,
      openFromLock: () => this.go('today', 1, { installed: true, tod: 'pm', pmOpen: true }),
      claim: { [s.claimStage]: true },
      claimEmail: () => this.setState({ claimStage: 'email' }),
      claimGoogle: () => this.closeSheet(() => { this.setState({ account: 'google' }); this.toast(`Saved. Your ${s.streak}-day streak is safe.`); }),
      claimApple: () => this.closeSheet(() => { this.setState({ account: 'apple' }); this.toast(`Saved. Your ${s.streak}-day streak is safe.`); }),
      email: s.email, onEmail: e => this.setState({ email: e.target.value }), claimSend: () => this.setState({ claimStage: 'otp', otpFilled: false }),
      claimResend: () => { this.setState({ otpFilled: false }); this.toast('New code sent'); },
      otpBoxes: otpDigits.map(d => ({ d: s.otpFilled ? d : '', bc: s.otpFilled ? '#2A1911' : '#E8D8C9' })),
      otpLabel: s.otpFilled ? 'Verify' : 'Paste code from email',
      claimVerify: () => { if (!s.otpFilled) { this.setState({ otpFilled: true }); return; } this.closeSheet(() => { this.setState(st => ({ account: 'email', displayName: st.nameDraft.trim() || st.displayName })); this.toast(`Saved. Your ${s.streak}-day streak is safe.`); }); },
      profName: s.displayName || (s.account ? 'Saved account' : 'Guest on this phone'), profSub: s.account === 'email' ? s.email : s.account === 'apple' ? 'Signed in with Apple' : s.account === 'google' ? 'Signed in with Google' : 'Streak saved on this device only',
      profRows: [
        { k: 'Reminders', v: s.rem.on ? `${s.rem.am} · ${s.rem.pm}` : 'Off', c: '#5A3824', act: () => this.closeSheet(() => this.go('reminders')) },
        { k: 'Display name', v: s.displayName || 'Add', c: s.displayName ? '#5A3824' : '#2A1911', act: () => this.setState({ sheet: 'name', nameDraft: s.displayName || '', afterName: null }) },
        { k: 'Account', v: s.account ? 'Saved' : 'Save your streak', c: s.account ? '#17605F' : '#2A1911', act: () => { if (!s.account) this.setState({ sheet: 'claim', claimStage: 'choose' }); } },
        { k: 'This rota', v: `Day ${s.day + 1} of 7 · Rescue ${s.rescueUsed ? 'used' : 'available'}`, c: '#5A3824', act: () => {} },
        { k: 'App', v: s.installed ? 'On home screen' : 'Add to Home Screen', c: s.installed ? '#5A3824' : '#2A1911', act: () => { if (!s.installed) this.setState({ sheet: 'install' }); } },
      ],
      ...(() => {
        const V = {};
        const ama = this.ama(), pair = s.paired && s.friends.length ? s.friends[0] : null;
        const sel = (on) => ({ bg: on ? '#EE6F3E' : '#FBFAF6', bc: on ? '#2A1911' : '#C99A72' });
        const seg = (on) => ({ bg: on ? '#EE6F3E' : 'transparent', sh: on ? '0 0 0 2px #2A1911' : 'none' });
        // add + scan + review
        V.addMethods = [
          { t: 'Scan', scan: true, icon: '', bg: '#EE6F3E', bc: '#2A1911', go: () => this.go('scan', 1, { scanFor: src === 'shelf' ? 'shelf' : 'add', scanStage: s.camOk ? 'view' : 'perm' }) },
          { t: 'Search', icon: 'add', bg: '#F1E0D2', bc: '#2A1911', go: () => {} },
          { t: 'Paste', icon: 'log', bg: '#FBFAF6', bc: '#E8D8C9', go: () => this.openSheet('paste') },
          { t: 'Gallery', icon: 'history', bg: '#FBFAF6', bc: '#E8D8C9', go: () => { this.go('scan', 1, { scanStage: 'view' }); this.later(() => this.runProc(() => this.toReview('partial')), 300); } },
        ];
        const st = s.scanStage;
        V.scan = { perm: st === 'perm', view: st !== 'perm', glare: st === 'glare', proc: st === 'proc' };
        V.scanKicker = st === 'perm' ? 'Scan' : 'Back label · ingredients';
        V.procN = s.procN;
        V.camAllow = () => this.setState({ scanStage: 'view', camOk: true });
        V.toGallery = () => { this.setState({ scanStage: 'view', camOk: true }); this.runProc(() => this.toReview('partial')); };
        V.shutter = () => { if (st === 'view' && !s.glareSeen) { this.setState({ scanStage: 'glare', glareSeen: true }); return; } this.runProc(() => this.toReview(s.scanFor === 'mix' ? 'verified' : (s.scanCase || 'flag'))); };
        V.openPaste = () => this.openSheet('paste');
        V.pasteText = s.pasteText; V.onPaste = e => this.setState({ pasteText: e.target.value });
        V.pasteGo = () => this.closeSheet(() => this.toReview('partial'));
        const RC = this.REVIEW[s.reviewCase] || this.REVIEW.verified;
        const edited = s.revName && s.revName !== RC.name;
        const chipsNow = s.revChips && s.revChips.length ? s.revChips : RC.chips;
        const idConf = RC.id === 'verified' ? 'verified' : (edited || s.frontDone) ? 'confirmed' : RC.id;
        const anyX = chipsNow.some(c => c[1] === 'x'), anyU = chipsNow.some(c => c[1] === 'u');
        const inciConf = RC.inci === 'verified' && !anyU ? 'verified' : !anyX && anyU ? 'corrected' : 'partial';
        const prov = inciConf === 'verified' ? 'verified' : inciConf === 'corrected' ? 'corrected' : 'partial';
        const BD = (on, t) => on === 'good' ? { t, bg: '#E3F1EC', ink: '#17605F', bs: 'solid', bc: '#1F7F7E' } : on === 'mid' ? { t, bg: '#FBFAF6', ink: '#2A1911', bs: 'solid', bc: '#2A1911' } : { t, bg: '#FBFAF6', ink: '#5A3824', bs: 'dashed', bc: '#845535' };
        V.rvBadges = [
          BD(idConf === 'verified' ? 'good' : idConf === 'none' ? 'low' : 'mid', { verified: 'Name · matched to library', read: 'Name · read from label', confirmed: 'Name · you confirmed', none: 'Name · not read' }[idConf]),
          BD(inciConf === 'verified' ? 'good' : inciConf === 'corrected' ? 'mid' : 'low', { verified: 'Ingredients · verified', partial: 'Ingredients · partly read', corrected: 'Ingredients · you corrected, awaiting confirmation' }[inciConf]),
        ];
        const PV = { verified: ['#E3F1EC', '#17605F', 'solid', '#1F7F7E'], 'user-confirmed': ['#FBFAF6', '#2A1911', 'solid', '#2A1911'], partial: ['#FBFAF6', '#5A3824', 'dashed', '#845535'], unknown: ['#FBFAF6', '#5A3824', 'dashed', '#845535'] }[prov];
        V.rv = { icon: RC.icon, name: s.revName || 'Name not read yet', brand: RC.brand, provLabel: this.PROV[prov][0], provBg: PV[0], provInk: PV[1], provBs: PV[2], provBc: PV[3], askFront: !!RC.askFront && !s.frontDone && !edited, flags: RC.flags.map(k => this.FLAGS[k]), foot: RC.foot,
          chips: chipsNow.map(([t, k], i) => ({ i, edit: () => this.openSheet('chip', { chipIdx: i, chipDraft: k === 'x' ? '' : t }) })).map((e, i) => { const [t, k] = chipsNow[i]; return { ...e, ...(k === 'u' ? { t: t + ' · edited', bg: '#F7EFE7', ink: '#2A1911', bs: 'solid', bc: '#2A1911' } : k === 'act' ? { t, bg: '#3E63D8', ink: '#FBFAF6', bs: 'solid', bc: '#3E63D8' } : k === 'flag' ? { t, bg: '#2A1911', ink: '#FBFAF6', bs: 'solid', bc: '#2A1911' } : k === 'x' ? { t, bg: 'transparent', ink: '#5A3824', bs: 'dashed', bc: '#845535' } : { t, bg: '#FBFAF6', ink: '#2A1911', bs: 'solid', bc: '#C99A72' }) }; }) };
        const ci = chipsNow[s.chipIdx] || ['', ''];
        V.chipTitle = ci[1] === 'x' ? 'What does this line say?' : `Correct “${ci[0]}”`;
        V.chipDraft = s.chipDraft; V.onChipDraft = e => this.setState({ chipDraft: e.target.value });
        V.chipSave = () => { const nc = chipsNow.map(x => [...x]); if (s.chipDraft.trim()) nc[s.chipIdx] = [s.chipDraft.trim(), 'u']; this.closeSheet(() => this.setState({ revChips: nc })); };
        V.chipRemove = () => { const nc = chipsNow.filter((_, i) => i !== s.chipIdx); this.closeSheet(() => this.setState({ revChips: nc })); };
        V.revName = s.revName; V.onRevName = e => this.setState({ revName: e.target.value });
        V.shootFront = () => { this.setState({ frontDone: true, revName: 'Daily Glow Serum' }); this.toast('Front label read'); };
        V.rvCats = ['Cleanser', 'Serum', 'Treatment', 'Moisturiser', 'Sunscreen'].map(t => ({ t, ...sel(s.revCat === t), pick: () => this.setState({ revCat: t }) }));
        V.rvUse = ['Rinse-off', 'Leave-on'].map(t => ({ t, ...seg(s.revUse === t), pick: () => this.setState({ revUse: t }) }));
        V.reviewCta = s.scanFor === 'mix' ? 'Use in Mix Check' : RC.flags.length ? 'Keep on shelf, out of rota' : 'Add to shelf';
        V.reviewAdd = () => {
          const base = s.reviewCase === 'verified' && prov === 'verified' ? { ...this.LIB.find(p => p.id === 'ret'), prov: 'verified' } : RC.flags.length ? { id: 'f' + Date.now(), name: s.revName || RC.name, brand: 'As printed on label', type: s.revCat, icon: RC.icon, role: 'flag', flag: RC.flags[0], prov } : { id: 'p' + Date.now(), name: s.revName || 'Unnamed serum', brand: 'As printed on label', type: s.revCat, icon: RC.icon, role: 'unknown', place: 'none', prov };
          if (s.scanFor === 'mix') { this.go('mix', -1, { [s.mixSlot === 'a' ? 'mixA' : 'mixB']: base }); return; }
          const dup = s.products.some(p => p.id === base.id);
          if (dup) { this.toast('Already on your shelf'); this.go(s.scanFor === 'shelf' ? 'shelf' : 'add', -1); return; }
          this.go(s.scanFor === 'shelf' ? 'shelf' : 'add', -1, { products: [...s.products, base] });
          this.later(() => this.toast(RC.flags.length ? 'On your shelf, kept out of your rota' : 'Added to your shelf'), 300);
        };
        V.retake = () => this.go('scan', -1, { scanStage: 'view' });
        V.mixScan = () => this.closeSheet(() => this.go('scan', 1, { scanFor: 'mix', scanStage: s.camOk ? 'view' : 'perm' }));
        // context
        const hasRet = s.products.some(p => p.role === 'ret'), needsCtx = hasRet || s.products.some(p => p.role === 'bha');
        const qs = [];
        if (hasRet) qs.push({ q: 'Have you used a retinoid before?', why: 'It sets how often your retinal starts.', opts: [['new', 'No, new to it'], ['some', 'Yes, for a few months'], ['long', 'Yes, for over a year']].map(([v, t]) => ({ t, ...sel(s.ctxRet === v), pick: () => this.setState({ ctxRet: v }) })) });
        qs.push({ q: 'Anything we should plan around?', why: 'Some treatments are best checked with a professional first.', opts: [['preg', 'Pregnant or breastfeeding'], ['rx', 'Using a prescription skin treatment'], ['none', 'None of these'], ['skip', 'Prefer not to say']].map(([v, t]) => ({ t, ...sel(s.ctxCare === v), pick: () => this.setState({ ctxCare: v }) })) });
        V.ctxQs = qs;
        const ctxOk = (!hasRet || s.ctxRet) && s.ctxCare;
        V.ctxOp = ctxOk ? 1 : 0.4; V.ctxPe = ctxOk ? 'auto' : 'none';
        V.ctxGo = () => this.go('building', 1, { ctxDone: true });
        V.build = () => { if (src === 'shelf') { this.go('shelf', -1); this.toast('Rota updated from tomorrow'); } else if (needsCtx && !s.ctxDone) this.go('context'); else this.go('building'); };
        // today
        V.todayBg = isPM ? '#EEF0EC' : '#F7EFE7'; V.hdrBg = isPM ? '#1E3A3C' : '#F1E0D2'; V.hdrInk = isPM ? '#FBFAF6' : '#2A1911'; V.hdrSub = isPM ? '#BFE4DD' : '#5A3824'; V.noteInk = '#5A3824';
        V.hasName = !!s.displayName; V.noName = !s.displayName; V.meInitial = (s.displayName || 'Y')[0].toUpperCase();
        V.pairOn = !!pair; V.pair = pair ? { ...pair, today: pair.today || 'evening left' } : { name: '', initial: '', bg: '#845535', today: '' }; V.pairStreak = s.pairStreak;
        V.pairLine = todayComp ? 'your side is done' : 'grows when you both finish';
        V.pairName = pair ? pair.name : (s.friends[0] || {}).name || 'a friend';
        V.nudgeText = todayComp ? `Finished my skincare for today. Your turn, our Friend Streak is on ${s.pairStreak} days. myrota.app/today` : `Doing my skincare now. Join me? Our Friend Streak is on ${s.pairStreak} days. myrota.app/today`;
        V.openNudge = () => this.openSheet('nudge');
        V.nudgeSend = () => this.closeSheet(() => this.toast('WhatsApp opens. You pick the chat.'));
        V.canSwap = (T.t === 'r' || T.t === 'b') && !dd.pm && !s.swapped[s.day];
        V.swapWhat = T.t === 'r' ? 'retinal' : 'BHA';
        V.openSwap = () => this.openSheet('swap');
        V.doSwap = () => this.closeSheet(() => { const w = [...s.swapped]; w[s.day] = true; this.setState({ swapped: w }); this.toast('Tonight is a recovery night'); });
        V.showLate = s.late && !dd.pm; V.lateDay = this.DOWL[s.day];
        V.showDoneCard = todayComp && !s.missedPending;
        const ref = s.missedRef, prevWk = ref && ref.week !== s.week;
        if (ref) V.missedDay = this.DOWL[ref.d] + (prevWk ? ' (last week)' : '');
        if (prevWk) V.missedTitle = `Last week's ${this.DOWL[ref.d]} was missed`;
        if (ref && prevWk) { const h = (s.history || []).find(x => x.week === ref.week); if (h) V.rescueTones = h.comp.map((c, d) => d === ref.d ? SG : c ? this.TONES[d] : h.rescued[d] ? SG : 'x').join(','); }
        V.useRescue = () => this.closeSheet(() => {
          if (!ref) return;
          if (ref.week === s.week) { const r = [...s.rescued]; r[ref.d] = true; this.setState({ rescued: r, rescueUsed: true, missedPending: false, missedRef: null, pop: true }); }
          else this.setState(st => ({ history: st.history.map(h => h.week === ref.week ? { ...h, rescued: h.rescued.map((x, d) => d === ref.d ? true : x), rescueUsed: true } : h), missedPending: false, missedRef: null, pop: true }));
          this.later(() => this.setState({ pop: false }), 400); this.toast('Rescued. Your streak carries on.');
        });
        V.dayId = `w${s.week}-d${s.day}`;
        // day sheet
        const dx = days[s.sheetDay] || T, dst = status(s.sheetDay);
        const DS = { done: ['Done', '#9ED8CF', '#2A1911', 'solid', '#1F7F7E'], rescued: ['Rescued', '#9ED8CF', '#2A1911', 'solid', '#1F7F7E'], missed: ['Missed', 'transparent', '#5A3824', 'dashed', '#845535'], today: ['Today', '#FBFAF6', '#2A1911', 'solid', '#EE6F3E'], future: ['Planned', '#FBFAF6', '#5A3824', 'solid', '#C99A72'] }[dst];
        const items = l => l.map((p, i) => ({ n: i + 1, t: this.short(p) }));
        V.ds = { title: this.DOWL[s.sheetDay], type: { r: 'Retinal night', b: 'BHA night', rec: 'Recovery night', base: 'Daily' }[dx.t] + ((s.swapped || [])[s.sheetDay] ? ' · swapped by you' : ''), status: DS[0], stBg: DS[1], stInk: DS[2], stBs: DS[3], stBc: DS[4], rest: !dx.am.length && !dx.pm.length,
          sessions: [dx.am.length ? { t: 'Morning', bg: '#F6B48F', ink: '#2A1911', items: items(dx.am) } : null, dx.pm.length ? { t: 'Evening', bg: '#1E3A3C', ink: '#FBFAF6', items: items(dx.pm) } : null].filter(Boolean) };
        // shelf
        const provOf = p => p.prov || (p.role === 'unknown' ? 'unknown' : 'verified');
        V.shelfIn = s.products.filter(p => p.role !== 'unknown' && p.role !== 'flag' && !s.finished[p.id]).map(p => ({ name: p.name, meta: `${p.brand} · ${p.type}`, icon: p.icon, am: days.some(x => x.am.includes(p)), pm: days.some(x => x.pm.includes(p)), prov: this.held(s, p) ? 'Held · check with a professional first' : this.PROV[provOf(p)][0], provInk: this.held(s, p) ? '#2A1911' : this.PROV[provOf(p)][1], open: () => this.openSheet('product', { prodId: p.id }) }));
        V.shelfInCount = V.shelfIn.length;
        const off = s.products.filter(p => p.role === 'unknown' || p.role === 'flag');
        V.hasUnknown = off.length > 0;
        V.shelfUnknown = off.map(p => ({ name: p.name, tag: p.role === 'flag' ? 'Not scheduled' : 'Unknown', meta: p.role === 'flag' ? 'Kept out of your rota · see note above' : p.place === 'am' ? 'Mornings · your choice' : p.place === 'pm' ? 'Evenings · your choice' : 'On your shelf, not in your rota', open: () => this.openSheet('product', { prodId: p.id }) }));
        V.shelfFlags = s.products.filter(p => p.flag).map(p => ({ ...this.FLAGS[p.flag], title: `${p.name}: ${this.FLAGS[p.flag].title.charAt(0).toLowerCase()}${this.FLAGS[p.flag].title.slice(1)}` }));
        const pp = s.products.find(p => p.id === s.prodId) || s.products[0] || { name: '', icon: 'jar', role: 'unknown' };
        V.pd = { name: pp.name, icon: pp.icon, prov: this.PROV[provOf(pp)][0], provInk: this.PROV[provOf(pp)][1], timing: pp.role === 'unknown' };
        V.pdTiming = [['am', 'Morning'], ['pm', 'Evening'], ['none', 'Not in rota']].map(([v, t]) => ({ t, ...sel(pp.place === v), pick: () => this.setState(st => ({ products: st.products.map(p => p.id === pp.id ? { ...p, place: v } : p) })) }));
        V.pdActions = [
          { t: 'Correct details', ink: '#2A1911', act: () => this.closeSheet(() => this.toReview(pp.flag === 'alert' ? 'alert' : pp.flag ? 'flag' : pp.role === 'unknown' ? 'partial' : 'verified')) },
          { t: 'Re-scan the label', ink: '#2A1911', act: () => this.closeSheet(() => this.go('scan', 1, { scanFor: 'shelf', scanStage: 'view' })) },
          { t: 'Mark as finished', ink: '#2A1911', act: () => this.closeSheet(() => { this.setState(st => ({ finished: { ...st.finished, [pp.id]: true } })); this.toast('Marked finished. Your rota updates tomorrow.'); }) },
          { t: 'Remove from shelf', ink: '#2A1911', act: () => this.closeSheet(() => { this.setState(st => ({ products: st.products.filter(p => p.id !== pp.id) })); this.toast('Removed'); }) },
        ];
        V.toMix = () => this.go('mix', 1, { source: 'mix', mixA: null, mixB: null });
        // mix
        const vd = this.mixVerdict(s.mixA, s.mixB);
        V.verdict = vd; V.mixHdrBg = vd.bg;
        V.shareMix = () => this.openShare('mix');
        V.shareRota = () => this.openShare('rota');
        V.shareDay7 = () => this.openShare('day7');
        // share
        const names = s.shareNames;
        const CLS = { ret: 'Retinoid', bha: 'BHA', vitc: 'Vitamin C', niac: 'Niacinamide', moist: 'Moisturiser', spf: 'SPF', cleanser: 'Cleanser', toner: 'Toner', unknown: 'Unknown', flag: 'Flagged product' };
        const mx = s.mixA && s.mixB ? (names ? this.short(s.mixA) + ' + ' + this.short(s.mixB) : (CLS[s.mixA.role] || 'Product') + ' + ' + (CLS[s.mixB.role] || 'Product')) : '';
        const VS = { 'Alternate days': ['These two', 'take turns.', '#1F7F7E', '#FBFAF6'], 'Better separated': ['Morning', 'and night.', '#F6B48F', '#2A1911'], 'Fine together': ['Fine', 'together.', '#9ED8CF', '#2A1911'], 'Not enough evidence': ['Not enough', 'evidence.', '#F1E0D2', '#5A3824'], 'Check with a professional': ['Ask a', 'professional first.', '#845535', '#FBFAF6'] }[vd.v] || [vd.v, '', '#F1E0D2', '#2A1911'];
        const ps = s.pairStreak || 30;
        const C = {
          rota: { bg: '#3E63D8', ink: '#FBFAF6', field: 'rinse', grid: true, wash: 'rgba(62,99,216,.55)', s1: 'My week,', s2: 'planned.', meta: names ? s.products.filter(p => p.role !== 'unknown' && p.role !== 'flag').map(p => this.short(p)).join(' · ') : actN + ' strong nights · ' + recN + ' recovery' },
          mix: { bg: '#F1E0D2', ink: '#2A1911', field: 'sunrise', panel: true, mixHead: 'Mix Check · ' + mx, tag: vd.v, tagBg: VS[2], tagInk: VS[3], s1: VS[0], s2: VS[1], meta: 'myrota.app/mix' },
          day3: { bg: '#E8CDB9', ink: '#2A1911', field: 'skin', photo: true, slot: 'share-day3', shot: 'Shot #5 · SPF on cheek, morning window', rule: 3, pfield: 'sunrise', ring: true, tones: '#E8CDB9,#C99A72,#845535,#E8D8C9,#E8D8C9,#E8D8C9,#E8D8C9', s1: 'Three days', s2: 'in a row.', meta: 'myrota.app' },
          day7: { bg: '#9ED8CF', ink: '#2A1911', field: 'sea', window: true, tones: ringTones.replace(/x/g, '#E8D8C9'), s1: 'Rota', s2: 'complete.', meta: '7 of 7 · Week ' + ((s.week || 0) + 1) },
          friend: { bg: '#E8CDB9', ink: '#2A1911', field: 'skin', photo: true, slot: 'share-friend', shot: 'Shot #4 · Two friends at one mirror', rule: -1, pfield: 'sunrise', moment: true, mName: (V.pairName || 'Ama') + ' and you', mMeta: ps + ' days · friend streak', s1: (ps === 30 ? 'Thirty' : ps) + ' nights,', s2: 'neither of us missed.', meta: 'myrota.app' },
        }[s.shareType] || {};
        const F = { story: ['260px', '9/16', 'column', '28px', 'auto'], square: ['100%', '1/1', 'column', '28px', 'auto'], link: ['100%', '1200/630', 'row', '24px', '44%'] }[s.shareFmt];
        V.card = { ...C, fs: F[3] }; V.cardWash = C.wash || 'transparent'; V.cardWords = false; V.cardStripScale = s.shareFmt === 'link' ? 0.5 : s.shareFmt === 'story' ? 0.68 : 0.82; V.cardFrameFlex = s.shareFmt === 'link' ? '0 0 52%' : '0 0 auto'; V.cardFrameMaxH = s.shareFmt === 'link' ? 'none' : '45%'; V.cardFramePad = s.shareFmt === 'link' ? '6px' : '10px'; V.cardMax = F[0]; V.cardAR = F[1]; V.cardDir = F[2]; V.cardTextW = F[4]; V.winSize = s.shareFmt === 'link' ? 140 : 200;
        V.fmtOpts = [['story', 'Story 9:16'], ['square', 'Square'], ['link', 'Link']].map(([v, t]) => ({ t, ...seg(s.shareFmt === v), pick: () => this.setState({ shareFmt: v }) }));
        V.shareCanNames = s.shareType === 'rota' || s.shareType === 'mix';
        V.namesTrack = names ? '#EE6F3E' : '#F1E0D2'; V.namesJust = names ? 'flex-end' : 'flex-start';
        V.toggleNames = () => this.setState({ shareNames: !names });
        V.shareTitle = { rota: 'Share my rota', mix: 'Share this answer', day3: 'Share Day 3', day7: 'Share my week', friend: 'Share our streak' }[s.shareType];
        V.shareSend = () => this.closeSheet(() => this.toast('WhatsApp opens. You pick the chat or Status.'));
        V.shareSave = () => this.closeSheet(() => this.toast('Image saved'));
        // celebrations
        V.doneTitle = s.streak === 3 ? 'Three days in a row.' : `Day ${s.day + 1} done.`;
        if (s.streak === 3) Object.assign(V, { doneCta: 'Share your 3-day streak', doneAct: () => this.openShare('day3'), showDoneBack: true });
        V.weekN = s.week; V.nextWeekN = s.week + 1;
        const wkOk = days.map((x, d) => this.complete(s.done, d, days) || !!s.rescued[d]), okN = wkOk.filter(Boolean).length;
        V.rcFull = okN === 7; V.rcCount = okN; V.rcTitle = okN === 7 ? 'Rota complete.' : 'Week ended.';
        V.rcSub = okN === 7 ? 'Seven days followed. Recovery and rest days counted like any other.' : `${okN} of 7 days followed. Next week starts fresh from the same shelf, with a new Rescue.`;
        const RF = { calm: 'Next week keeps the same plan. Any change in frequency stays within reviewed limits, and only if you choose it.', bit: 'Next week keeps the same plan, no stronger. Swap any night to recovery if you need to.', very: 'Next week keeps the same plan, no stronger. If irritation continues, pause your strongest product and ask a pharmacist.' };
        V.reflectOpts = [['calm', 'Calm'], ['bit', 'A bit irritated'], ['very', 'Very irritated']].map(([v, t]) => ({ t, ...sel(s.reflect === v), pick: () => this.setState({ reflect: v }) }));
        V.reflectNoteOn = !!s.reflect; V.reflectNote = RF[s.reflect] || '';
        V.toNextWeek = () => this.go('nextWeek');
        V.nwRows = s.products.filter(p => p.role !== 'flag').map(p => { const f = !!s.finished[p.id]; return { name: p.name, meta: f ? 'Finished · left out of next week' : `${p.brand} · ${p.type}`, icon: p.icon, op: f ? 0.5 : 1, td: f ? 'line-through' : 'none', btn: f ? 'Undo' : 'Finished', bg: f ? '#F1E0D2' : '#FBFAF6', toggle: () => this.setState(st => ({ finished: { ...st.finished, [p.id]: !f } })) }; });
        V.nwAdd = () => this.go('add', 1, { source: 'shelf', query: '' });
        V.startNextWeek = () => { this.go('today', 1, { day: 0, done: this.blank(), rescued: Array(7).fill(false), rescueUsed: false, swapped: Array(7).fill(false), week: s.week + 1, tod: 'am', reflect: null }); this.later(() => this.toast(`Week ${s.week + 1} starts today`), 400); };
        // spread
        V.openInvite = () => s.displayName ? this.openSheet('invite') : this.openSheet('name', { afterName: 'invite', nameDraft: '' });
        V.nameDraft = s.nameDraft; V.onNameDraft = e => this.setState({ nameDraft: e.target.value });
        const nameOk = s.nameDraft.trim().length > 0; V.nameOp = nameOk ? 1 : 0.4; V.namePe = nameOk ? 'auto' : 'none';
        V.saveName = () => { const nm = s.nameDraft.trim(), nx = s.afterName; this.closeSheet(() => { this.setState({ displayName: nm }); if (nx) this.openSheet(nx); }); };
        V.inviteCta = s.existingUser ? 'Pair with Ama' : 'Start with what I have';
        V.inviteFoot = s.existingUser ? "You keep your own rota. Ama sees your streak, never your shelf." : 'One product is enough. No account, no download.';
        V.inviteStart = () => s.existingUser ? (this.go('today', 1, { friends: [ama], paired: true, pairStreak: 0 }), this.later(() => this.toast('You and Ama are paired'), 400)) : this.go('add', 1, { source: 'invite', products: [] });
        V.startRota = () => { this.go('today', 1, { day: 0, done: this.blank(), tod: 'am', friends: src === 'invite' ? [ama] : s.friends, paired: src === 'invite' || s.paired }); this.later(() => this.toast('Day 1. Your streak starts today.'), 400); };
        V.toToday = () => this.go('today', -1);
        // install
        V.platOpts = [['ios', 'iPhone'], ['android', 'Android']].map(([v, t]) => ({ t, ...seg(s.platform === v), pick: () => this.setState({ platform: v }) }));
        V.isIOS = s.platform === 'ios'; V.isAndroid = s.platform === 'android';
        V.iosSaveFirst = () => this.setState({ sheet: 'claim', claimStage: 'choose' });
        V.androidInstall = () => this.closeSheet(() => { this.toast('Chrome shows its install prompt'); this.setState({ installed: true }); this.later(() => this.go('reminders'), 500); });
        V.androidRemOnly = () => this.closeSheet(() => this.go('reminders'));
        return V;
      })(),
      logic,
      liveData: [
        { k: 'Rota day', v: `${s.day + 1}/7 · ${this.DOW[s.day]}` }, { k: 'Day id', v: `w${s.week}-d${s.day}` }, { k: 'Miss ref', v: s.missedRef ? `w${s.missedRef.week}-d${s.missedRef.d}` : '—' }, { k: 'Time', v: s.tod === 'am' ? 'Morning' : 'Evening' },
        { k: 'Skin Streak', v: `${s.streak}${s.missedPending ? ' · at risk' : ''}` }, { k: 'Rescue', v: s.rescueUsed ? 'Used' : 'Available' },
        { k: 'Products', v: `${n}${unk.length ? ` · ${unk.length} unknown` : ''}` }, { k: 'Today', v: todayComp ? 'Complete' : `${['am', 'pm'].filter(k => T[k].length && dd[k]).length}/${['am', 'pm'].filter(k => T[k].length).length} sessions` },
        { k: 'Install', v: s.installed ? 'Installed' : 'Web' }, { k: 'Account', v: s.account || 'None' },
        { k: 'Source', v: src }, { k: 'Friends', v: String(s.friends.length) },
      ],
    };
  }
}
