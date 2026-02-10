# Dynamic PWA & Branding Documentation (AI School 360)

Yeh document explain karta hai ki kaise AI School 360 platform alag-alag schools/institutions ke liye unki apni branding (Logo, Name, Custom Title) ke saath PWA (Progressive Web App) install karne ki suvidha deta hai.

## 1. Logo Upload & School Creation

Jab Admin ek naya school create karta hai ya purane ko edit karta hai (`SchoolManagement.tsx`), tab:

### A. Logo Upload Process
- **Logo Upload**: School ka logo Firebase Storage mein upload hota hai (`/schools/{schoolId}/logo`).
- **Data Save**: Logo ka URL aur school ki details Firestore database (`schools` collection) mein save hoti hai.
- **School ID**: Har school ka apna ek unique ID hota hai jo URL path mein use hota hai (e.g., `aischool360.web.app/school_id`).

### B. School Data Structure
School ko create karte waqt ye details save hoti hain:
- **name**: School ka short name (e.g., "Canopus Academy")
- **fullName**: School ka full name (optional)
- **logoUrl**: Uploaded logo ka Firebase Storage URL
- **customTitle**: Browser tab mein show hone wala custom title (optional)
- **themeColor**: PWA theme color (optional, default: '#6366f1')
- **allowedModules**: School ke paas available features/modules ki list

### C. File Location
- **Component**: `src/pages/settings/SchoolManagement.tsx`
- **Functions**:
  - `handleLogoChange()`: Logo file ko select aur preview karne ke liye
  - `handleSave()`: School data aur logo ko Firebase mein save karne ke liye

---

## 2. Dynamic Branding System (`SchoolContext.tsx`)

Jab koi user kisi school ki URL open karta hai:

### A. URL Detection
1. **Path Analysis**: System automatically URL path ko analyze karta hai
   - Example: `/canopus/login` se school ID = `canopus`
2. **Reserved Routes**: Common routes ko skip karta hai (login, register, admin, dashboard, etc.)
3. **School Lookup**: Firestore se us school ID ka data fetch karta hai

### B. Real-time Data Fetch
- Firestore `schools` collection se school ka complete data real-time fetch hota hai
- Data mein school ka naam, logo URL, custom title, theme color sab included hai
- Yeh data globally accessible hota hai through `useSchool()` hook

### C. Context Provider
- **Component**: `src/context/SchoolContext.tsx`
- **Hook**: `useSchool()` - Kisi bhi component mein current school ka data access karne ke liye
- **Data**: `currentSchool`, `loading`, `error`

---

## 3. Dynamic PWA Configuration (`DynamicPWAConfig.tsx`)

Yeh component app ki branding ko browser mein real-time badalta hai:

### A. Document Title & Favicon

#### Browser Title
- Browser tab ka title school ke `customTitle` ya `name` se automatically change ho jata hai
- Example: "Canopus Academy" dikhega instead of "AI School 360"

#### Favicon (Browser Icon)
- Browser icon (Favicon) ko school ke uploaded logo se replace kar diya jata hai
- Multiple icon types add hote hain:
  - Regular favicon
  - Apple touch icon (iOS devices ke liye)

### B. Dynamic PWA Manifest (The "Install" Logo)

PWA installation ke liye ek **Dynamic Manifest** real-time generate kiya jata hai:

#### Manifest Properties
```javascript
{
  name: "School Full Name",
  short_name: "School Name",
  description: "School Name - AI School Management System",
  start_url: "/school_id/",
  scope: "/school_id/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#6366f1", // School's theme color
  icons: [
    {
      src: "school_logo_url",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "school_logo_url",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    }
  ]
}
```

#### Blob Injection
- Manifest ko ek JavaScript Blob ke roop mein banakar HTML `<head>` mein inject kiya jata hai
- Yeh ensure karta hai ki browser naya logo aur branding pehchan le
- Old manifest links remove ho jati hain, new manifest link add ho jati hai

### C. Mobile-Specific Meta Tags

#### iOS Support
- `apple-mobile-web-app-capable`: iOS par app-like experience ke liye
- `apple-mobile-web-app-status-bar-style`: Status bar styling
- `apple-mobile-web-app-title`: iOS home screen pe app ka naam
- `apple-touch-icon`: iOS home screen icon

#### Android Support
- `theme-color`: Android browser ka theme color

### D. File Location
- **Component**: `src/components/DynamicPWAConfig.tsx`
- **Usage**: App.tsx mein globally included hai, automatically har page pe kaam karta hai

---

## 4. App Installation Experience

Jab user mobile ya desktop par "Install App" ya "Add to Home Screen" click karta hai:

### A. Installation Icon
- Use wahi logo dikhta hai jo school admin ne upload kiya tha
- Logo high-resolution (512x512) mein save hota hai for better quality

### B. App Name
- App ka naam school ke naam se dikhta hai
- Example: "Canopus Academy" install hoga as separate app

### C. Standalone App
- Install hone ke baad, app bina kisi browser bar ke ek native app ki tarah kaam karti hai
- Icon wahi rehta hai jo school ka logo hai
- Opening URL directly us school ki context mein hoga (`/school_id/`)

### D. Multi-School Support
- Different schools ke liye alag-alag apps install ho sakti hain
- Har app apne school ke logo aur naam ke saath
- Example:
  - "Canopus Academy" - logo1.png
  - "Millat Academy" - logo2.png
  - "PPHS School" - logo3.png

---

## 5. Integration Points

### A. App.tsx
- `DynamicPWAConfig` component globally included hai
- SchoolProvider se wrapped hai for context access
- Har route change par branding update hoti hai

### B. Login Pages
- School logo dynamically display hota hai
- School name show hota hai
- Custom branding apply hoti hai

### C. Dashboard Layout
- Sidebar mein school logo
- Header mein school name
- Complete branding consistency

---

## 6. Technical Flow Diagram

```
User Opens URL (e.g., /canopus/login)
           ↓
SchoolContext detects "canopus" from URL
           ↓
Fetches school data from Firestore
           ↓
DynamicPWAConfig receives school data
           ↓
Updates Browser Title ✓
Updates Favicon ✓
Generates Dynamic Manifest ✓
Updates Meta Tags ✓
           ↓
User sees branded interface
           ↓
User clicks "Install App"
           ↓
PWA installed with school's logo & name
```

---

## 7. Files Modified/Created

### Created Files
1. `src/components/DynamicPWAConfig.tsx` - Dynamic PWA manifest generator

### Modified Files
1. `src/App.tsx` - Added DynamicPWAConfig component
2. `src/context/SchoolContext.tsx` - Already had school detection logic
3. `src/pages/settings/SchoolManagement.tsx` - Already had logo upload

---

## 8. Testing Checklist

### Browser Testing
- [ ] Browser title changes when accessing different school URLs
- [ ] Favicon updates to school's logo
- [ ] Theme color applies correctly

### PWA Installation Testing
- [ ] "Install App" option appears
- [ ] Correct logo shows in installation prompt
- [ ] Correct name shows in installation prompt
- [ ] After installation, app icon is school's logo
- [ ] App opens directly to school's URL

### Multi-School Testing
- [ ] Multiple schools can be accessed via different URLs
- [ ] Each school shows its own branding
- [ ] Multiple apps can be installed for different schools
- [ ] No conflict between different school apps

---

## 9. Future Enhancements

### Possible Additions
1. **Custom Color Schemes**: Allow schools to define complete color palettes
2. **Custom Fonts**: School-specific font selections
3. **Splash Screens**: Custom loading screens for PWA
4. **Push Notification Icons**: Branded notification icons
5. **Offline Pages**: Custom offline pages with school branding

---

## Technical Summary for Developers

### Core Components
- **Upload & Storage**: `SchoolManagement.tsx` (handles Firebase Storage upload)
- **Context Management**: `SchoolContext.tsx` (manages global school state)
- **Dynamic Branding**: `DynamicPWAConfig.tsx` (manipulates DOM & manifest)
- **Trigger**: URL path validation automatically updates branding

### Technologies Used
- Firebase Storage (logo upload)
- Firebase Firestore (school data)
- React Context API (state management)
- Web App Manifest API (PWA configuration)
- Blob API (dynamic manifest generation)

### Key Features
- ✅ Real-time branding updates
- ✅ URL-based school detection
- ✅ Dynamic favicon injection
- ✅ Dynamic manifest generation
- ✅ Multi-school support
- ✅ iOS & Android compatibility
- ✅ Offline-capable PWA

---

**Last Updated**: January 28, 2026
**Version**: 1.0
**Platform**: AI School 360
