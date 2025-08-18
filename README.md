
# YOUnite

**YOUnite** is a mobile application designed to connect volunteers, NGOs, and community organizations in one place.  
It helps people find volunteer opportunities, organize events, and report areas that need attention — making it easier for everyone to give back to the community.

This project is built with **React Native** using the **Expo** framework.

---

## Features

- **Volunteer Event Listings**  
  Organizations can post events with details such as date, time, location, and description.  
  Example: "Trash cleanup at the Nile riverbank on Saturday, 9:00 AM."

- **User-Created Volunteer Groups**  
  Volunteers can create groups to organize their own initiatives.

- **Verified User Profiles**  
  User identity verification through official ID submission.

- **Community Reporting**  
  Any user can report a location that needs attention, such as a polluted area or unsafe park.

- **Event Search and Filters**  
  Search for events by category, location, or date.

- **Event Details & RSVP**  
  View event details and confirm participation.

---

## Tech Stack

- **Frontend:** React Native with Expo
- **State Management:** React Hooks / Context API (planned)
- **Backend:** (To be decided – could be Firebase, Node.js + Express, etc.)
- **Database:** (To be decided – could be Firebase Firestore, MongoDB, etc.)
- **Authentication:** (Planned – possibly Firebase Auth or custom backend)

---

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/Rawan10101/YOUnite.git
cd YOUnite
````

### 2. Install dependencies

```bash
npm install
```

### 3. Start the Expo development server

```bash
npx expo start
```

### 4. Run on Android emulator

* Press `a` in the terminal after starting Expo.

---

## Project Structure

```
YOUnite/
│
├── App.js                # Main entry point
├── assets/               # Images, fonts, static files
├── components/           # Reusable UI components
├── screens/              # App screens (Home, Events, etc.)
├── navigation/           # Navigation setup (stack, tabs)
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

---

## Planned Screens

* **Splash Screen** – App logo and loading animation.
* **Login / Sign Up** – User authentication and ID verification.
* **Home Screen** – List of upcoming events.
* **Event Details** – Detailed view of a single event with RSVP option.
* **Create Event** – Form to create and publish new events.
* **Groups** – Create and join volunteer groups.
* **Reports** – Submit and view community reports.

---

## Development Roadmap

1. Set up core navigation and UI.
2. Implement authentication and user verification.
3. Build event listing and event details features.
4. Add group creation and joining functionality.
5. Enable community reporting with location tagging.
6. Deploy backend and connect data.
7. Test and optimize performance.

---

## License

This project is licensed under the MIT License.
