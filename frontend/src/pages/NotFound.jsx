import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>This page is outside the case file.</h1>
      <p>The address may be outdated or you may not have a route to this page.</p>
      <Link className="btn btn-brand" to="/">Return home</Link>
    </div>
  );
}
