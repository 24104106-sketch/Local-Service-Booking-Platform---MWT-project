import { createContext } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

export const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useLocalStorage("fixit_local_user", null);

  const login = (userData) => setUser(userData);
  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("fixit_local_user");
    } catch {
      // Ignored
    }
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}
