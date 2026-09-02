import { describe, it, expect } from "vitest";
import { isSafeRedirectPath } from "@/lib/auth/redirect";

describe("isSafeRedirectPath", () => {
  // Rutas válidas
  it("acepta ruta raíz", () => {
    expect(isSafeRedirectPath("/")).toBe(true);
  });

  it("acepta ruta simple", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
  });

  it("acepta ruta con parámetros", () => {
    expect(isSafeRedirectPath("/ventas/ordenes?page=2")).toBe(true);
  });

  it("acepta ruta anidada", () => {
    expect(isSafeRedirectPath("/ventas/ordenes/123/editar")).toBe(true);
  });

  // Rutas inválidas - protocol-relative
  it("rechaza protocol-relative URL", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("//evil.com/path")).toBe(false);
  });

  // Rutas inválidas - esquemas peligrosos
  it("rechaza javascript:", () => {
    expect(isSafeRedirectPath("/javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rechaza data:", () => {
    expect(isSafeRedirectPath("/data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rechaza vbscript:", () => {
    expect(isSafeRedirectPath("/vbscript:msgbox(1)")).toBe(false);
  });

  it("rechaza file:", () => {
    expect(isSafeRedirectPath("/file:///etc/passwd")).toBe(false);
  });

  it("rechaza mailto:", () => {
    expect(isSafeRedirectPath("/mailto:test@test.com")).toBe(false);
  });

  it("rechaza tel:", () => {
    expect(isSafeRedirectPath("/tel:+1234567890")).toBe(false);
  });

  it("rechaza ftp:", () => {
    expect(isSafeRedirectPath("/ftp://evil.com")).toBe(false);
  });

  // Rutas inválidas - patrones de host externo
  it("rechaza @ en la ruta", () => {
    expect(isSafeRedirectPath("/@evil.com")).toBe(false);
    expect(isSafeRedirectPath("/path@evil.com")).toBe(false);
  });

  it("rechaza backslash", () => {
    expect(isSafeRedirectPath("\\evil.com")).toBe(false);
    expect(isSafeRedirectPath("/path\\evil.com")).toBe(false);
  });

  // Rutas inválidas - no empiezan con /
  it("rechaza ruta sin slash inicial", () => {
    expect(isSafeRedirectPath("dashboard")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });

  // Edge cases
  it("acepta ruta con fragmento", () => {
    expect(isSafeRedirectPath("/dashboard#section")).toBe(true);
  });

  it("acepta ruta con query string compleja", () => {
    expect(isSafeRedirectPath("/search?q=test&page=1&sort=desc")).toBe(true);
  });
});