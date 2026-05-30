import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: "VibeTrip | Collaborative Family Itinerary Planner",
  description: "Create, plan, and share your group travel itineraries. Coordinate flights, lodging, trains, and activities easily in a single interactive timeline.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
