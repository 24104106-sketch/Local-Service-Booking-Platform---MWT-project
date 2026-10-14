import { createContext, useEffect } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorage("fixit_local_theme", "light");

  // Whenever theme changes, reflect it on <html data-theme="..."> so CSS variables switch
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
