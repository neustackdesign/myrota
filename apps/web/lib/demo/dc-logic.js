// @ts-nocheck
/* eslint-disable */
/** Minimal stand-in for the Claude Design DCLogic base class (DEMO-ONLY). */
export class DCLogic {
  constructor(props) {
    this.props = props || {};
    this._listeners = new Set();
  }
  setState(patch, cb) {
    const p = typeof patch === "function" ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this._listeners.forEach((fn) => fn());
    if (cb) cb();
  }
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}
