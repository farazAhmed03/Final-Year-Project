module.exports = {
  openapi: "3.0.3",
  info: {
    title: "LegalSphere API",
    version: "2.0.0",
    description: "Secure API for clients, lawyers and administrators."
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Authentication" },
    { name: "Lawyers" },
    { name: "Appointments" },
    { name: "Cases" },
    { name: "Conversations" },
    { name: "Payments" },
    { name: "Administration" }
  ],
  paths: {
    "/auth/csrf": {
      get: {
        tags: ["Authentication"],
        summary: "Issue a CSRF token",
        responses: { 200: { description: "CSRF token and cookie" } }
      }
    },
    "/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a client or lawyer",
        responses: { 201: { description: "Account created" } }
      }
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Create an authenticated session",
        responses: { 200: { description: "Signed in" } }
      }
    },
    "/lawyers": {
      get: {
        tags: ["Lawyers"],
        summary: "List approved lawyers",
        responses: { 200: { description: "Paginated lawyers" } }
      }
    },
    "/appointments": {
      get: {
        tags: ["Appointments"],
        summary: "List appointments visible to the current user",
        responses: { 200: { description: "Paginated appointments" } }
      },
      post: {
        tags: ["Appointments"],
        summary: "Request an appointment as a client",
        responses: { 201: { description: "Appointment created" } }
      }
    },
    "/cases": {
      get: {
        tags: ["Cases"],
        summary: "List cases visible to the current user",
        responses: { 200: { description: "Paginated cases" } }
      },
      post: {
        tags: ["Cases"],
        summary: "Submit a case with private documents",
        responses: { 201: { description: "Case created" } }
      }
    }
  }
};
