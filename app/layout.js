import "./globals.css";
import AuthenticatedNavigation from "../components/authenticated-navigation.js";
import StoreProvider from "../store/store-provider.js";

export const metadata = {
  title: "DataScope | Data Discovery & Intelligence",
  description: "Enterprise data discovery and intelligence.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <AuthenticatedNavigation />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
