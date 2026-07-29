import { UserProfile } from "./components/UserProfile";
import "./styles.css";

export function App() {
  return (
    <main>
      <h1>Frontend Testing Blueprint</h1>
      <UserProfile userId="42" />
    </main>
  );
}
