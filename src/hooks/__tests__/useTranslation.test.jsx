import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTranslation } from "../useTranslation";
import { PersonalizationContext } from "../../context/PersonalizationContext";

function wrapperFor(language) {
  return function Wrapper({ children }) {
    return (
      <PersonalizationContext.Provider value={{ language, setLanguage: () => {} }}>
        {children}
      </PersonalizationContext.Provider>
    );
  };
}

describe("useTranslation", () => {
  it("returns the English string for a known key", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapperFor("en") });
    expect(result.current.t("dashboard")).toBe("Dashboard");
  });

  it("returns the Tamil string when language is 'ta'", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapperFor("ta") });
    expect(result.current.t("dashboard")).toBe("டாஷ்போர்டு");
  });

  it("falls back to the raw key when missing from every language", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapperFor("en") });
    expect(result.current.t("thisKeyDoesNotExistAnywhere")).toBe("thisKeyDoesNotExistAnywhere");
  });

  it("exposes the current language and a setter", () => {
    const { result } = renderHook(() => useTranslation(), { wrapper: wrapperFor("ta") });
    expect(result.current.language).toBe("ta");
    expect(typeof result.current.setLanguage).toBe("function");
  });
});
